import ArgumentType from './argument-type.js'
import BlockType from './block-type.js'
import {extensionDecl, blockDecl} from './extension-templates.js';

var esprima = require('esprima');
var escodegen = require('escodegen');
var jsBeautify = require('js-beautify').js;

const createParseError = function (message, loc) { return {message, loc}; }

/**
 * Parses an annotated extension.
 * @return {object} An object with keys `parsed` and `error`.
 *                  If parsing was successful, `parsed` is an object containing the annotations and function implementations.
 *                  If an error occured, `error` contains the error.
 */
const parseAnnotatedExtension = function(annotatedExtension) {
  try {
    var parsedExtension = esprima.parse(annotatedExtension, {comment: true, loc: true});
    var mutableStatements = parsedExtension.body.slice(); // Shallow copy the top level objects in the parse tree (so we can mutate this array later)

    // Find comment decorator function annotations
    var comments = parsedExtension.comments;
    var extensionInfo = {
      initializer: null,
      blocks: [],
      internals: [],
      externals: []
    }

    comments.forEach(comment => {
      if (comment.type != "Line") { return; }
      if (comment.value.length === 0) { return; }
      if (comment.value[0] != "@") { return; }

      // Check for block annotation
      var blockAnnotationMatches = comment.value.match(/^@(boolean|command|conditional|event|hat|loop|reporter)\((.+)\)\s*$/) // @TODO: support button type?
      if (blockAnnotationMatches) {
        // Parse the block text for arguments
        var blockText = blockAnnotationMatches[2];
        // @TODO: Check for more general argument errors (e.g., an untyped argument [foo])
        var argRegex = /\[([a-zA-Z_]+)\:([a-zA-Z0-9_ ]+)\]/g; // We don't support 'IMAGE' type
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
            default: {
              //                3 for //@                              2 for ( and [         1 for :
              var columnStart = 3 + blockAnnotationMatches[1].length + 2 + match[1].length + 1 + match.index;
              var argumentLoc = {
                start: {line: comment.loc.start.line - 1, column: columnStart},
                end: {line: comment.loc.end.line - 1, column: columnStart + match.length}
              };
              throw createParseError(`Unknown annotation argument type '${type}'. Must be one of: ANGLE, BOOLEAN, COLOR, NUMBER, STRING, MATRIX, NOTE`, argumentLoc);
            }
          }
        }

        var block = {
          text: blockText.replace(argRegex, '[$1]'),
          args: args,
          loc:  comment.loc
        };

        switch (blockAnnotationMatches[1]) {
          case 'boolean': block.type = BlockType.BOOLEAN; break;
          case 'command': block.type = BlockType.COMMAND; break;
          case 'conditional': block.type = BlockType.CONDITIONAL; break;
          case 'event': block.type = BlockType.EVENT; break;
          case 'hat': block.type = BlockType.HAT; break;
          case 'loop': block.type = BlockType.LOOP; break;
          case 'reporter': block.type = BlockType.REPORTER; break;
          default: throw createParseError(`Annotation has unknown block type ${blockAnnotationMatches[1]}`, block.loc);
        }

        // Find the function for this annotation in the parse tree
        var annotatedFuncIdx = mutableStatements.findIndex((statement) => {
          return statement.type == "FunctionDeclaration" && statement.loc.start.line == block.loc.start.line + 1;
        });

        if (annotatedFuncIdx === -1) {
          // No matching function was found
          var annotationLoc = block.loc
          annotationLoc.start.line--;
          annotationLoc.end.line--;
          throw createParseError(`Annotation isn't attached to a function. (The function must start on the next line immediately after the annotation).`, annotationLoc);
        }
        
        var annotatedFunc = mutableStatements[annotatedFuncIdx];

        // Remove the function from the array
        mutableStatements.splice(annotatedFuncIdx, 1);

        var argNames = Object.keys(block.args);
        if (argNames.length !== annotatedFunc.params.length) {
          throw createParseError(`Annotation requires exactly ${argNames.length} arguments, but ${annotatedFunc.params.length} were given in the function.`, block.loc);
        }
        annotatedFunc.params.forEach(param => {
          if (param.type != "Identifier") {
            throw createParseError(`Annotated functions can only take named parameters (no default values or rest parameters)`, block.loc);
          }
        });
        var paramNames = annotatedFunc.params.map(param => param.name);
        argNames.forEach(argName => {
          if (paramNames.indexOf(argName) == -1) {
            throw createParseError(`Annotated function is missing argument "${argName}"`, block.loc);
          }
        });

        // Attach the function parse tree to the annotation
        block.opcode = annotatedFunc.id.name;
        block.imp = annotatedFunc;

        extensionInfo.blocks.push(block);
      }

      else {
        // Check for block annotation
        var initializerAnnotationMatches = comment.value.match(/^@init\s*$/);
        if (initializerAnnotationMatches) {
          // Find the function for this annotation in the parse tree
          var annotatedFuncIdx = mutableStatements.findIndex((statement) => {
            return statement.type == "FunctionDeclaration" && statement.loc.start.line == comment.loc.start.line + 1;
          });

          if (annotatedFuncIdx === -1) {
            // No matching function was found
            var annotationLoc = comment.loc
            annotationLoc.start.line--;
            annotationLoc.end.line--;
            throw createParseError(`Annotation isn't attached to a function. (The function must start on the next line immediately after the annotation).`, annotationLoc);
          }

          if (extensionInfo.initializer !== null) {
            // Multiple initializers were declared
            var annotationLoc = comment.loc
            annotationLoc.start.line--;
            annotationLoc.end.line--;
            throw createParseError(`Multiple initializer annotations found. Only one initializer is allowed.`, annotationLoc);
          }
          
          extensionInfo.initializer = mutableStatements[annotatedFuncIdx];

          // Remove the function from the array
          mutableStatements.splice(annotatedFuncIdx, 1);
        }

        else {
          var internalAnnotationMatches = comment.value.match(/^@internal\s*$/);
          if (internalAnnotationMatches) {
            // Find the function for this annotation in the parse tree
            var annotatedFuncIdx = mutableStatements.findIndex((statement) => {
              return statement.type == "FunctionDeclaration" && statement.loc.start.line == comment.loc.start.line + 1;
            });

            if (annotatedFuncIdx === -1) {
              // No matching function was found
              var annotationLoc = comment.loc
              annotationLoc.start.line--;
              annotationLoc.end.line--;
              throw createParseError(`Annotation isn't attached to a function. (The function must start on the next line immediately after the annotation).`, annotationLoc);
            }
            
            extensionInfo.internals.push(mutableStatements[annotatedFuncIdx]);

            // Remove the function from the array
            mutableStatements.splice(annotatedFuncIdx, 1);
          }
        }
      }
    });

    // All remaining statements and declarations become 'externals'
    // (i.e., they get added to the transpiled code before and outside the extension class)
    extensionInfo.externals = mutableStatements;

    return {
      parsed: extensionInfo,
      error: null
    };
  }
  catch(e) {
    if (e.hasOwnProperty('lineNumber')) {
      // Error thrown by esprima
      // Turn it into the same format as our parsing errors
      var errorLoc = {
        start: {line: e.lineNumber - 1, column: e.column - 1},
        end:   {line: e.lineNumber - 1, column: e.column}
      };
      return {
        parsed: null,
        error: createParseError(e.description, errorLoc)
      }
    }
    return {
      parsed: null,
      error: e
    }
  }
}

const createExtensionCode = function(extensionInfo) {
  var initializer = null;
  if (extensionInfo.initializer != null) {
    initializer = `constructor() ${escodegen.generate(extensionInfo.initializer.body)}`;
  }

  var blockDecls = [];
  var blockImps = [];
  extensionInfo.blocks.forEach(block => {
    var argsDecls = Object.keys(block.args).map(arg => {
      if (block.args[arg] == ArgumentType.NUMBER) {
        return `var ${arg} = +(args.${arg});`;
      }
      return `var ${arg} = args.${arg};`;
    }).join("\n");
    var updatedFunctionDecl = `function ${block.imp.id.name}(args){${argsDecls}}`;
    var parsedFunctionDecl = esprima.parse(updatedFunctionDecl).body[0];
    parsedFunctionDecl.body.body = parsedFunctionDecl.body.body.concat(block.imp.body.body);
    var code = escodegen.generate(parsedFunctionDecl);
    if (code.startsWith("function ")) {
      // Remove the function keyword since we're putting it into a class
      code = code.slice(9);
    }
    
    blockDecls.push(blockDecl(block.opcode, block.type, block.text, block.args));
    blockImps.push(code);
  })

  var externals = extensionInfo.externals.map(external => escodegen.generate(external));
  var internals = extensionInfo.internals.map(internal => {
    var code = escodegen.generate(internal);
    if (code.startsWith("function ")) {
      // Remove the function keyword since we're putting it into a class
      code = code.slice(9);
    }
    return code;
  });

  return jsBeautify(extensionDecl(externals, internals, initializer, blockDecls, blockImps));
}

export {
  parseAnnotatedExtension,
  createExtensionCode
};
