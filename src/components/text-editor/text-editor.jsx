import {connect} from 'react-redux';
import React from 'react';
var esprima = require('esprima');
var escodegen = require('escodegen');

import {extensionDecl, blockDecl} from './extension-templates.js';
import ArgumentType from './argument-type.js'
import BlockType from './block-type.js'

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';

import {
    updateExtensionJs
} from '../../reducers/extension-editor';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/javascript/javascript.js';

import {Controlled as CodeMirror} from 'react-codemirror2';

import styles from './text-editor.css';
import overrides from './codemirror-overrides.css';



class TextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.extensionId = undefined;
    this.loadExtensionIntoVm = this.loadExtensionIntoVm.bind(this);
    if(!!props.vm) {
      window.vm = props.vm;
    }
  }

  loadExtensionIntoVm() {
    try {
      var parsed = esprima.parse(this.props.extensionJs, {comment: true, loc: true});

      // Find comment decorator function annotations
      var comments = parsed.comments;
      var annotations = [];
      for (var i = 0; i < comments.length; ++i) {
        var comment = comments[i];
        if (comment.type != "Line") { continue; }
        if (comment.value.length === 0) { continue; }
        if (comment.value[0] != "@") { continue; }

        var annotationMatches = comment.value.match(/^@(boolean|command|conditional|event|hat|loop|reporter)\((.+)\)\s*$/) // @TODO: support button type?
        if (annotationMatches) {
          // Parse the block text for arguments
          var blockText = annotationMatches[2];
          var argRegex = /\[([a-zA-Z_]+)\:(ANGLE|BOOLEAN|COLOR|NUMBER|STRING|MATRIX|NOTE)+\]/g; // We don't support 'IMAGE' type
          var argumentMatches = blockText.matchAll(argRegex);
          var args = {};
          for (const match of argumentMatches) {
            var type = match[2];
            switch (type) {
              case 'ANGLE': args[match[1]] = ArgumentType.ANGLE; break;
              case 'BOOLEAN': args[match[1]] = ArgumentType.BOOLEAN; break;
              case 'COLOR': args[match[1]] = ArgumentType.COLOR; break;
              case 'NUMBER': args[match[1]] = ArgumentType.NUMBER; break;
              case 'STRING': args[match[1]] = ArgumentType.STRING; break;
              case 'MATRIX': args[match[1]] = ArgumentType.MATRIX; break;
              case 'NOTE': args[match[1]] = ArgumentType.NOTE; break;
              default: throw new Error(`Parse error in annotation at line ${comment.loc.start.line}:${comment.loc.start.column}: Unknown argument type '${type}'`)
            }
          }

          var annotation = {
            text: blockText.replace(argRegex, '[$1]'),
            args: args,
            loc:  comment.loc
          };

          switch (annotationMatches[1]) {
            case 'boolean': annotation.type = BlockType.BOOLEAN; break;
            case 'command': annotation.type = BlockType.COMMAND; break;
            case 'conditional': annotation.type = BlockType.CONDITIONAL; break;
            case 'event': annotation.type = BlockType.EVENT; break;
            case 'hat': annotation.type = BlockType.HAT; break;
            case 'loop': annotation.type = BlockType.LOOP; break;
            case 'reporter': annotation.type = BlockType.REPORTER; break;
            default: throw new Error(`Annotation at line ${comment.loc.start.line}:${comment.loc.start.column} has unknown block type '${annotationMatches[1]}'`);
          }

          annotations.push(annotation);
        }
      }

      // Match annotations to functions
      annotations.forEach(annotation => {
        var statements = parsed.body;
        statements.forEach(statement => {
          if (statement.type == "FunctionDeclaration" && statement.loc.start.line == annotation.loc.start.line + 1) {
            // Check to make sure function signature is compatible with the annotation (arg count and names)
            var argNames = Object.keys(annotation.args);
            if (argNames.length !== statement.params.length) {
              throw new Error(`Annotated function at ${comment.loc.start.line}:${comment.loc.start.column} takes ${statement.params.length} arguments. Annotation requires ${argNames.length} arguments`);
            }
            statement.params.forEach(param => {
              if (param.type != "Identifier") {
                throw new Error(`Annotated function at ${comment.loc.start.line}:${comment.loc.start.column} can only take named parameters (no default values or rest parameters)`);
              }
            });
            var paramNames = statement.params.map(param => param.name);
            argNames.forEach(argName => {
              if (paramNames.indexOf(argName) == -1) {
                throw new Error(`Annotated function at ${comment.loc.start.line}:${comment.loc.start.column} is missing argument ${argName}`);
              }
            });

            // Attach the function parse tree to the annotation
            annotation.opcode = statement.id.name;
            annotation.imp = statement;
          }
        });

        if (!annotation.hasOwnProperty('imp')) {
          // No matching function was found
          throw new Error(`Annotation at ${comment.loc.start.line}:${comment.loc.start.column} isn't attached to a function`)
        }
      });

      // Generate extension code to load into VM
      annotations.forEach(annotation => {
        var argsDecls = Object.keys(annotation.args).map(arg => {
          if (annotation.args[arg] == ArgumentType.NUMBER) {
            return `var ${arg} = +(args.${arg});`;
          }
          return `var ${arg} = args.${arg};`;
        }).join("\n");
        var updatedFunctionDecl = `function ${annotation.imp.id.name}(args){${argsDecls}}`;
        var parsedFunctionDecl = esprima.parse(updatedFunctionDecl).body[0];
        parsedFunctionDecl.body.body = parsedFunctionDecl.body.body.concat(annotation.imp.body.body);
        var code = escodegen.generate(parsedFunctionDecl);
        if (code.startsWith("function ")) {
          // Remove the function keyword since we're putting it into a class
          code = code.slice(9);
        }
        annotation.code = code;
      })

      var blockInfos = annotations.map(annotation => blockDecl(annotation));
      var imps = annotations.map(annotation => annotation.code);
      var program = extensionDecl(blockInfos, imps);

      // Load code into VM
      var vm = this.props.vm
      if(!!vm) {
        var dataUri = `data:text/javascript,${program};`;
        var extensionManager = vm.extensionManager;
        if (this.extensionId === undefined) {
          extensionManager.loadExtensionURL(dataUri).then((extensionId) => {
            this.extensionId = extensionId;
            console.log(`extension loaded with id ${this.extensionId}`);
          }).catch((e) => { console.log("Error: " + e);})
        }
        else {
          extensionManager.reloadExtensionURL(this.extensionId, dataUri).then(() => {
            console.log("extension reloaded");
          }).catch((e) => { console.log("Error: " + e);})
        }
        
      }
      
    }
    catch(e) {
      console.log(e);
    }
  }

  render() {
    return (
      <Box className={styles.extensionEditorContainer}>
        <Box className={styles.extensionEditorTextArea}>
          <CodeMirror
            value={this.props.extensionJs}
            options={{
              mode: "javascript",
              theme: "monokai",
              lineNumbers: true,
              scrollbarStyle: "null"
            }}
            onBeforeChange={(editor, data, value) => {
              this.props.onUpdateExtensionJs(value)
            }}
            onChange={(editor, value) => {}}
          />
        </Box>
        <Box className={styles.extensionEditorHeader}>
          <Button onClick={this.loadExtensionIntoVm}>Load Extension</Button>
        </Box>
      </Box>
    )
  }
}

const mapStateToProps = state => ({
    extensionJs: state.scratchGui.extensionEditor.extensionJs,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onUpdateExtensionJs: (js) => dispatch(updateExtensionJs(js)),
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TextEditor);
