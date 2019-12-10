import ArgumentType from './argument-type.js'
import BlockType from './block-type.js'
import {extensionDecl, blockDecl} from './extension-templates.js';
import parseAnnotation from './annotation-parser.js'

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
      externals: [],
      menus: {}
    }

    comments.forEach(comment => {
      if (comment.type != "Line") { return; }
      if (comment.value.length === 0) { return; }
      if (comment.value.trim()[0] != "@") { return; } // Make sure it starts with @
      
      var {error, ...parsed} = parseAnnotation(comment.value);
      if (error) {
        var errorLoc = comment.loc;
        errorLoc.start.line--;
        errorLoc.end.line--;
        errorLoc.start.column = error.location.start + 2; // +2 accounts for the comment starting with '//'
        errorLoc.end.column = error.location.end + 2;
        throw createParseError(error.message, errorLoc);
      }
      
      switch(parsed.type) {
        case 'block': {
          
          var blockInfo = {
            text: parsed.text,
            args: parsed.args,
            loc: comment.loc,
          }
          
          switch (parsed.blockType) {
            case 'boolean': blockInfo.type = BlockType.BOOLEAN; break;
            case 'command': blockInfo.type = BlockType.COMMAND; break;
            case 'conditional': blockInfo.type = BlockType.CONDITIONAL; break;
            case 'event': blockInfo.type = BlockType.EVENT; break;
            case 'hat': blockInfo.type = BlockType.HAT; break;
            case 'loop': blockInfo.type = BlockType.LOOP; break;
            case 'reporter': blockInfo.type = BlockType.REPORTER; break;
            default: throw createParseError(`Annotation has unknown block type ${parsed.blockType}`, blockInfo.loc);
          }
          
          // Find the function for this annotation in the parse tree
          var annotatedFuncIdx = mutableStatements.findIndex((statement) => {
            return statement.type == "FunctionDeclaration" && statement.loc.start.line == blockInfo.loc.start.line + 1;
          });

          if (annotatedFuncIdx === -1) {
            // No matching function was found
            var annotationLoc = blockInfo.loc
            annotationLoc.start.line--;
            annotationLoc.end.line--;
            throw createParseError(`Annotation isn't attached to a function. (The function must start on the next line immediately after the annotation).`, annotationLoc);
          }
          
          var annotatedFunc = mutableStatements[annotatedFuncIdx];

          // Remove the function from the array
          mutableStatements.splice(annotatedFuncIdx, 1);

          var argNames = Object.keys(blockInfo.args);
          if (argNames.length !== annotatedFunc.params.length) {
            throw createParseError(`Annotation requires exactly ${argNames.length} arguments, but ${annotatedFunc.params.length} were given in the function.`, blockInfo.loc);
          }
          annotatedFunc.params.forEach(param => {
            if (param.type != "Identifier") {
              throw createParseError(`Annotated functions can only take named parameters (no default values or rest parameters)`, blockInfo.loc);
            }
          });
          var paramNames = annotatedFunc.params.map(param => param.name);
          argNames.forEach(argName => {
            if (paramNames.indexOf(argName) == -1) {
              throw createParseError(`Annotated function is missing argument "${argName}"`, blockInfo.loc);
            }
          });

          // Attach the function parse tree to the annotation
          blockInfo.opcode = annotatedFunc.id.name;
          blockInfo.imp = annotatedFunc;

          extensionInfo.blocks.push(blockInfo);
          
          break;
        }
        case 'init': {
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
          break;
        }
        case 'internal': {
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
          break;
        }
        case 'menu': {
          // @TODO: Check for menu overwriting, nameless menus, probably more stuff

          var foundDecl = false;
          // First, check if the annotation is attached to a raw array declaration
          var annotatedArrayIdx = mutableStatements.findIndex((statement) => {
            return statement.type == "ExpressionStatement" && statement.expression.type == "ArrayExpression" && statement.loc.start.line == comment.loc.start.line + 1;
          });

          if (annotatedArrayIdx !== -1) {
            foundDecl = true;
            extensionInfo.menus[parsed.name] = mutableStatements[annotatedArrayIdx];
            mutableStatements.splice(annotatedArrayIdx, 1); // Remove the array decl from the statements array
          }

          // @TODO : Reenable this eventually when VM supports dynamic menu function calls through web workers
          // 
          // // If not, check to see if it's attached to a function
          // if (!foundDecl) {
          //   var annotatedFuncIdx = mutableStatements.findIndex((statement) => {
          //     return statement.type == "FunctionDeclaration" && statement.loc.start.line == comment.loc.start.line + 1;
          //   });
          //   if (annotatedFuncIdx !== -1) {
          //     foundDecl = true;
          //     extensionInfo.menus[menuAnnotationMatches[1]] = mutableStatements[annotatedFuncIdx];
          //     mutableStatements.splice(annotatedFuncIdx, 1); // Remove the function decl from the statements array
          //   }            
          // }

          // Otherwise, error out
          if (!foundDecl) {
            var annotationLoc = comment.loc
              annotationLoc.start.line--;
              annotationLoc.end.line--;
              throw createParseError(`Menu annotation must be attached to an array. (The array must start on the next line immediately after the annotation).`, annotationLoc);
          }
          break;
        }
      }
    });

    // All remaining statements and declarations become 'externals'
    // (i.e., they get added to the transpiled code before and outside the extension class)
    extensionInfo.externals = mutableStatements;
    
    console.log(extensionInfo);
    
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
      if (block.args[arg].type == ArgumentType.NUMBER) {
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

  var menusDecls = [];
  var menuFuncs = [];
  for (var menuName in extensionInfo.menus) {
    var menuImp = extensionInfo.menus[menuName];
    if (menuImp.type == "ExpressionStatement") { // Menu is an array
      var code = escodegen.generate(menuImp);
      if (code.endsWith(";")) {
        code = code.slice(0, -1);
      }
      menusDecls.push(`${menuName}: ${code}`);
    }
    else if (menuImp.type == "FunctionDeclaration") {
      menusDecls.push(`${menuName}: {items: '_menu_${menuName}'}`);
      menuImp.id.name = `_menu_${menuName}`;
      var code = escodegen.generate(menuImp);
      if (code.startsWith("function ")) {
        // Remove the function keyword since we're putting it into a class
        code = code.slice(9);
      }
      menuFuncs.push(code);
    }
    else { console.log("ERROR: Unknown menu implementation type"); }
  }

  var menusDecl = `{${menusDecls.join(',\n')}}`;

  return jsBeautify(extensionDecl(externals, internals, initializer, blockDecls, blockImps, menusDecl, menuFuncs));
}

export {
  parseAnnotatedExtension,
  createExtensionCode
};
