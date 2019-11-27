const TOKEN = {
  bracketLeft: 'bracketLeft',
  bracketRight: 'bracketRight',
  parenLeft: 'parenLeft',
  parenRight: 'parenRight',
  colon: 'colon',
  at: 'at',
  text: 'text',
  whitespace: 'whitespace',
  end: 'end'
}

const ANNOTATION = {
  block: 'block',
  initializer: 'init',
  internal: 'internal',
  menu: 'menu'
}


const tokenizeAnnotation = function(annotation) {
  
  var tokenizer = {
    code: annotation,
    cursor: 0,
  }
  
  function isChar(char) {
    return char === undefined ? false : /[a-zA-Z_]/.test(char);
  }
  
  function isWhitespace(char) {
    return char === undefined ? false : /[ \t]/.test(char); // Intentionally leave out newline
  }
  
  function isText(char) {
    // We parse text *super* liberally here to try to allow for
    // blocks with names that include things like ? or !
    return char === undefined ? false : /[^\[\]\(\)\:\@\t ]/.test(char);
  }
  
  function isDone(tokenizer) {
    return tokenizer.cursor >= tokenizer.code.length;
  }
  
  function current(tokenizer) {
    return isDone(tokenizer) ? undefined : tokenizer.code[tokenizer.cursor];
  }
  
  function readToken(tokenizer) {
    if (isDone(tokenizer)) { return {type: TOKEN.end}; }
    
    var token = undefined;
    switch(current(tokenizer)) {
      case "[": { 
        token = {type: TOKEN.bracketLeft, location: {start: tokenizer.cursor, end: tokenizer.cursor}};
        tokenizer.cursor++;
        break;
      }
      case "]": { 
        token = {type: TOKEN.bracketRight, location: {start: tokenizer.cursor, end: tokenizer.cursor}};
        tokenizer.cursor++;
        break;
      }
      case "(": { 
        token = {type: TOKEN.parenLeft, location: {start: tokenizer.cursor, end: tokenizer.cursor}};
        tokenizer.cursor++;
        break;
      }
      case ")": { 
        token = {type: TOKEN.parenRight, location: {start: tokenizer.cursor, end: tokenizer.cursor}};
        tokenizer.cursor++;
        break;
      }
      case ":": { 
        token = {type: TOKEN.colon, location: {start: tokenizer.cursor, end: tokenizer.cursor}};
        tokenizer.cursor++;
        break;
      }
      case "@": {
        tokenizer.cursor++;
        let tokenStart = tokenizer.cursor;
        while(isChar(current(tokenizer))) {
          tokenizer.cursor++;
        }
        token = {
          type: TOKEN.at,
          value: tokenizer.code.slice(tokenStart, tokenizer.cursor),
          location: {
            start: tokenStart,
            end:tokenizer.cursor
          }
        }
        break;
      }
      // Whitespace
      case " ":
      case "\t": {
        let tokenStart = tokenizer.cursor;
        while (isWhitespace(current(tokenizer))) {
          tokenizer.cursor++;
        }
        token = {
          type: TOKEN.whitespace,
          value: tokenizer.code.slice(tokenStart, tokenizer.cursor),
          location: {
            start: tokenStart,
            end:tokenizer.cursor
          }
        }
        break;
      }
      default: {
        let tokenStart = tokenizer.cursor;
        while (isText(current(tokenizer))) {
          tokenizer.cursor++;
        }
        token = {
          type: TOKEN.text,
          value: tokenizer.code.slice(tokenStart, tokenizer.cursor),
          location: {
            start: tokenStart,
            end:tokenizer.cursor
          }
        }
        break;
      }
    }
    return token;
  }
  
  var tokens = [];
  while (true) {
    var token = readToken(tokenizer);
    tokens.push(token);
    if (token.type === TOKEN.end) { break; }
  }

  return { tokens: tokens };
}
  
  
  
  
  
  
  
  
  
  
  
const parseAnnotationTokens = function(tokens) {
  
  var tokenStream = {
    tokens: tokens,
    cursor: 0
  }
  
  function parseError(message, location) {
    return {
      error: { 
        message: message,
        location: location 
      }
    };
  }
  
  consumeWhitespace(tokenStream);
  if (!requireToken(TOKEN.at)) {
    
  }
  
  
  
  var current = tokens.length > 0 ? tokens[0] : undefined;

  function readNext() {
    cursor >= tokens.length ? current = undefined : current = tokens[++cursor];
    return current;
  }

  function consumeWhitespace() {
    while (current && current.type === TOKENS.whitespace) { readNext(); }
  }
  
  function readString() {
    var result = '';
    while (current && (current.type == TOKENS.text || current.type == TOKENS.whitespace)) {
      result += current.value;
      readNext();
    }
    if (result == '') { return undefined; }
    return result;
  }
  
  function parseBlockAnnotation() {
    blockType = current.value;
    var STATES = {
      name: 'name',
      arg: 'arg'
    }
    
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.parenLeft) {
      return parseError('Block annotation must be followed by a block description in parentheses');
    }
    
    readNext();
    if (!current) {
      return parseError('Block annotation must be followed by a block description in parentheses');
    }
    
    var state;
    if (current.type === TOKENS.text || current.type === TOKENS.whitespace) {
      state = STATES.name;
    }
    else if (current.type === TOKENS.bracketRight) {
      state = STATES.arg;
    }
    else {
      return parseError(`Unexpected token in block description: ${token.type}`);
    }
    
    var blockText = '';
    var blockArgs = {};
    blockTextLoop:
    while(current) {
      switch(state) {
        case STATES.name: {
          blockText += readString();
          if (current && current.type == TOKENS.bracketLeft) {
            state = STATES.arg;
          }
          else {
            break blockTextLoop;
          }
          break;
        }
        case STATES.arg: {
          readNext(); // Skip over [
          consumeWhitespace();
          
          if (!current || current.type !== TOKENS.text) {
            return parseError(`Expected argument name`);
          }
          var argName = current.value;
          
          readNext();
          consumeWhitespace();
          if (!current || current.type !== TOKENS.colon) {
            return parseError(`Expected argument type`);
          }
          
          readNext();
          consumeWhitespace();
          if (!current || current.type !== TOKENS.text) {
            return parseError(`Expected argument type`);
          }
          var argType = current.value;
          if (!["ANGLE", "BOOLEAN", "COLOR", "NUMBER", "STRING", "MATRIX", "NOTE"].includes(argType)) {
            return parseError(`Unknown annotation argument type '${argType}'. Must be one of: ANGLE, BOOLEAN, COLOR, NUMBER, STRING, MATRIX, NOTE`);
          }
          
          readNext();
          consumeWhitespace();
          var argDefault = undefined;
          if (current && current.type === TOKENS.colon) {
            // Optional default parameter
            readNext();
            if (!current || (current.type !== TOKENS.text && current.type !== TOKENS.whitespace)) {
              // @TODO: Currently we only accept text default params
              //        We should allow numbers as well (and maybe colors as hex value, etc.?)
              //        We could also do more clever error type checking here to make sure the
              //        default is actually matches the argument type
              return parseError(`Expected default value for argument`);
            }
            argDefault = readString();
          }
          if (!current || current.type !== TOKENS.bracketRight) {
            return parseError(`Expected argument declaration to end with ]`);
          }
          
          blockText += `[${argName}]`;
          blockArgs[argName] = {
            type: argType
          };
          if (argDefault) {
            blockArgs[argName].defaultValue = argDefault;
          }
          
          readNext();
          if (current && (current.type === TOKENS.text || current.type === TOKENS.whitespace)) {
            state = STATES.name;
          }
          else if (current && current.type === TOKENS.bracketLeft) {
            state = STATES.arg; // Parse another argument the next time through the loop
          }
          else if (current) {
            break blockTextLoop;
          }
          break;
        }
      }
    }
    
    if (!current || current.type !== TOKENS.parenRight) {
      return parseError(`Unexpected end of block annotation. Block description must be contained in parentheses.`);
    }
    
    return {
      type: blockType,
      text: blockText,
      args: blockArgs
    };
  }
  
  function parseMenuAnnotation() {
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.parenLeft) {
      return parseError('Menu annotation must be followed by a menu name in parentheses');
    }
    
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.text) {
      return parseError('Menu annotation must be followed by a menu name in parentheses');
    }
    
    var menuName = current.value;
    
    readNext();
    consumeWhitespace();
    if (!current) {
      return parseError(`Unexpected end of menu annotation. Expected ')'.`);
    }
    else if (current.type !== TOKENS.parenRight) {
      return parseError(`Unexpected token in menu annotation: ${current.type}. Expected ')'.`);
    }
    
    readNext();
    consumeWhitespace();
    if (current) {
      return parseError(`Unexpected token after menu annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.menu,
      name: menuName
    };
  }
  
  function parseInitializerAnnotation() {
    readNext();
    consumeWhitespace();
    if (current) {
      // We found something after the initializer declaration
      // @TODO: This is obtuse to the user. This should include the original text and location of the token
      return parseError(`Unexpected token in initializer annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.initializer
    };
  }
  
  function parseInternalFunctionAnnotation() {
    readNext();
    consumeWhitespace();
    if (current) {
      // We found something after the initializer declaration
      // @TODO: This is obtuse to the user. This should include the original text and location of the token
      return parseError(`Unexpected token in internal annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.initializer
    };
  }
  
  consumeWhitespace(); // Ignore whitespace before the annotation
  if (current.type !== TOKENS.atDecl) {
    // @TODO: Better error message here
    return parseError('Annotation must start with an @ declaration');
  }
  switch (current.value) {
    case 'boolean':
    case 'command':
    case 'conditional':
    case 'event':
    case 'hat':
    case 'loop':
    case 'reporter':
      // Block
      return parseBlockAnnotation();
      break;
    case 'menu':
      // Menu
      return parseMenuAnnotation();
      break;
    case 'init':
      // Initializer
      return parseInitializerAnnotation();
      break;
    case 'internal':
      // Internal function
      return parseInternalFunctionAnnotation();
      break;
    default:
      return parseError(`Unknown annotation type: ${current.value}`);
  }
}
  
  


















































const tokenizeAnnotationOLD = function(annotation) {
  var tokens = [];
  var cursor = 0;

  function peek() {
    if (cursor >= annotation.length) {
      return undefined;
    }
    return annotation[cursor];
  }

  function read() {
    return annotation[cursor++];
  }

  function isWhitespace(char) {
    return /[ \t]/.test(char); // Intentionally leave out newline
  }

  function isChar(char) {
    return /[a-zA-Z]/.test(char);
  }

  function isAtDecl(char) {
    return char === '@';
  }

  function scanAtDecl() {
    read(); // Skip over @ symbol
    var start = cursor;
    while (peek() && isChar(peek())) { read(); }
    tokens.push({
      type: TOKENS.atDecl,
      value: annotation.slice(start, cursor)
    });
  }

  function isPunc(char) {
    return /[\[\]\(\)\:]/.test(char); // We recognize only []():
  }

  function scanPunc(char) {
    var punc = read();
    if (punc === "[") {
      tokens.push({
        type: TOKENS.bracketLeft
      })
    }
    else if (punc === "[") {
      tokens.push({
        type: TOKENS.bracketLeft
      })
    }
    else if (punc === "]") {
      tokens.push({
        type: TOKENS.bracketRight
      })
    }
    else if (punc === "(") {
      tokens.push({
        type: TOKENS.parenLeft
      })
    }
    else if (punc === ")") {
      tokens.push({
        type: TOKENS.parenRight
      })
    }
    else if (punc === ":") {
      tokens.push({
        type: TOKENS.colon
      })
    }

    // @TODO: Throw error? We shouldn't even call this function
    //        if it isn't a valid punctuation mark, so...meh?
  }

  function scanText(char) {
    var start = cursor;
    while (peek() && isChar(peek())) { read(); };
    tokens.push({
      type: TOKENS.text,
      value: annotation.slice(start, cursor)
    });
  }

  function scanWhitespace(char) {
    var start = cursor;
    while (peek() && isWhitespace(peek())) { read(); };
    tokens.push({
      type: TOKENS.whitespace,
      value: annotation.slice(start, cursor)
    });
  }

  var next = peek();
  while (next !== undefined) {
    if (isAtDecl(next)) { scanAtDecl(); }
    else if (isPunc(next)) { scanPunc(); }
    else if (isChar(next)) { scanText(); }
    else if (isWhitespace(next)) { scanWhitespace(); }
    else {
      return {
        error: {
          message: 'Unknown syntax',
          location: cursor
        }
      };
    }
    next = peek();
  }

  return { tokens: tokens};
}

const parseAnnotationTokensOLD = function(tokens) {
  var cursor = 0;
  var current = tokens.length > 0 ? tokens[0] : undefined;

  function readNext() {
    cursor >= tokens.length ? current = undefined : current = tokens[++cursor];
    return current;
  }

  function consumeWhitespace() {
    while (current && current.type === TOKENS.whitespace) { readNext(); }
  }
  
  function readString() {
    var result = '';
    while (current && (current.type == TOKENS.text || current.type == TOKENS.whitespace)) {
      result += current.value;
      readNext();
    }
    if (result == '') { return undefined; }
    return result;
  }

  function parseError(message) {
    return { error: message };
  }
  
  function parseBlockAnnotation() {
    blockType = current.value;
    var STATES = {
      name: 'name',
      arg: 'arg'
    }
    
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.parenLeft) {
      return parseError('Block annotation must be followed by a block description in parentheses');
    }
    
    readNext();
    if (!current) {
      return parseError('Block annotation must be followed by a block description in parentheses');
    }
    
    var state;
    if (current.type === TOKENS.text || current.type === TOKENS.whitespace) {
      state = STATES.name;
    }
    else if (current.type === TOKENS.bracketRight) {
      state = STATES.arg;
    }
    else {
      return parseError(`Unexpected token in block description: ${token.type}`);
    }
    
    var blockText = '';
    var blockArgs = {};
    blockTextLoop:
    while(current) {
      switch(state) {
        case STATES.name: {
          blockText += readString();
          if (current && current.type == TOKENS.bracketLeft) {
            state = STATES.arg;
          }
          else {
            break blockTextLoop;
          }
          break;
        }
        case STATES.arg: {
          readNext(); // Skip over [
          consumeWhitespace();
          
          if (!current || current.type !== TOKENS.text) {
            return parseError(`Expected argument name`);
          }
          var argName = current.value;
          
          readNext();
          consumeWhitespace();
          if (!current || current.type !== TOKENS.colon) {
            return parseError(`Expected argument type`);
          }
          
          readNext();
          consumeWhitespace();
          if (!current || current.type !== TOKENS.text) {
            return parseError(`Expected argument type`);
          }
          var argType = current.value;
          if (!["ANGLE", "BOOLEAN", "COLOR", "NUMBER", "STRING", "MATRIX", "NOTE"].includes(argType)) {
            return parseError(`Unknown annotation argument type '${argType}'. Must be one of: ANGLE, BOOLEAN, COLOR, NUMBER, STRING, MATRIX, NOTE`);
          }
          
          readNext();
          consumeWhitespace();
          var argDefault = undefined;
          if (current && current.type === TOKENS.colon) {
            // Optional default parameter
            readNext();
            if (!current || (current.type !== TOKENS.text && current.type !== TOKENS.whitespace)) {
              // @TODO: Currently we only accept text default params
              //        We should allow numbers as well (and maybe colors as hex value, etc.?)
              //        We could also do more clever error type checking here to make sure the
              //        default is actually matches the argument type
              return parseError(`Expected default value for argument`);
            }
            argDefault = readString();
          }
          if (!current || current.type !== TOKENS.bracketRight) {
            return parseError(`Expected argument declaration to end with ]`);
          }
          
          blockText += `[${argName}]`;
          blockArgs[argName] = {
            type: argType
          };
          if (argDefault) {
            blockArgs[argName].defaultValue = argDefault;
          }
          
          readNext();
          if (current && (current.type === TOKENS.text || current.type === TOKENS.whitespace)) {
            state = STATES.name;
          }
          else if (current && current.type === TOKENS.bracketLeft) {
            state = STATES.arg; // Parse another argument the next time through the loop
          }
          else if (current) {
            break blockTextLoop;
          }
          break;
        }
      }
    }
    
    if (!current || current.type !== TOKENS.parenRight) {
      return parseError(`Unexpected end of block annotation. Block description must be contained in parentheses.`);
    }
    
    return {
      type: blockType,
      text: blockText,
      args: blockArgs
    };
  }
  
  function parseMenuAnnotation() {
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.parenLeft) {
      return parseError('Menu annotation must be followed by a menu name in parentheses');
    }
    
    readNext();
    consumeWhitespace();
    if (!current || current.type !== TOKENS.text) {
      return parseError('Menu annotation must be followed by a menu name in parentheses');
    }
    
    var menuName = current.value;
    
    readNext();
    consumeWhitespace();
    if (!current) {
      return parseError(`Unexpected end of menu annotation. Expected ')'.`);
    }
    else if (current.type !== TOKENS.parenRight) {
      return parseError(`Unexpected token in menu annotation: ${current.type}. Expected ')'.`);
    }
    
    readNext();
    consumeWhitespace();
    if (current) {
      return parseError(`Unexpected token after menu annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.menu,
      name: menuName
    };
  }
  
  function parseInitializerAnnotation() {
    readNext();
    consumeWhitespace();
    if (current) {
      // We found something after the initializer declaration
      // @TODO: This is obtuse to the user. This should include the original text and location of the token
      return parseError(`Unexpected token in initializer annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.initializer
    };
  }
  
  function parseInternalFunctionAnnotation() {
    readNext();
    consumeWhitespace();
    if (current) {
      // We found something after the initializer declaration
      // @TODO: This is obtuse to the user. This should include the original text and location of the token
      return parseError(`Unexpected token in internal annotation: ${current.type}`);
    }
    return {
      type: ANNOTATIONS.initializer
    };
  }
  
  consumeWhitespace(); // Ignore whitespace before the annotation
  if (current.type !== TOKENS.atDecl) {
    // @TODO: Better error message here
    return parseError('Annotation must start with an @ declaration');
  }
  switch (current.value) {
    case 'boolean':
    case 'command':
    case 'conditional':
    case 'event':
    case 'hat':
    case 'loop':
    case 'reporter':
      // Block
      return parseBlockAnnotation();
      break;
    case 'menu':
      // Menu
      return parseMenuAnnotation();
      break;
    case 'init':
      // Initializer
      return parseInitializerAnnotation();
      break;
    case 'internal':
      // Internal function
      return parseInternalFunctionAnnotation();
      break;
    default:
      return parseError(`Unknown annotation type: ${current.value}`);
  }
}

const parseAnnotation = function(annotation) {
  var cursor = 0;
  var current = annotation.length > 0 ? annotation[0] : undefined;
  
  function readNext() {
    cursor >= annotation.length ? current = undefined : current = annotation[++cursor];
    return current;
  }
  
  function scanOverWhitespace() {
    while (current && /[ \t]/.test(current)) { readNext(); }
  }
  
  function scanToChar(char) {
    while (current && current != char) { readNext(); }
    if (current == char) { return true; }
    return false;
  }
  
  function scanIdent() {
    var start = cursor;
    if (!current || !(/[a-zA-Z_]/.test(current))) {
      return { ident: '', location: {start, end: cursor} };
    }
    readNext();
    while(current && /[a-zA-Z_0-9]/.test(current)) { readNext(); }
    return { ident: annotation.slice(start, cursor), location: {start, end: cursor} };
  }
  
  function isValidAnnotationType(type) {
    return ['boolean', 'command', 'conditional', 'event', 'hat', 'loop', 'reporter', 'menu', 'init', 'internal'].includes(type);
  }
  
  function isValidArgumentType(type) {
    return ['ANGLE', 'BOOLEAN', 'COLOR', 'NUMBER', 'STRING', 'MATRIX', 'NOTE'].includes(type);
  }
  
  function isValidIdentifier(ident) {
    return /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(ident);
  }
  
  function parseError(message, start, end) {
    return {
      error: {
        message: message,
        location: {
          start,
          end
        }
      }
    }
  }
  
  function parseMenuAnnotation() {
    scanOverWhitespace();
    if (current != '(') { return parseError(`Expected '(' after menu annotation`, cursor, cursor); }
    readNext();
    var nameStart = cursor;
    if (!scanToChar(')')) { return parseError(`Expected ')' to close menu annotation`, cursor, cursor); }
    var possibleMenuName = annotation.slice(nameStart, cursor).trim();
    if (!isValidIdentifier(possibleMenuName)) { return parseError(`Invalid menu name: ${possibleMenuName}`, nameStart, cursor); }
    readNext();
    scanOverWhitespace();
    if (current) { return parseError(`Unexpected token after menu annotation`, cursor, cursor); }
    return {
      type: ANNOTATIONS.menu,
      name: possibleMenuName
    };
  }
  
  // function parseBlockText(blockText) {
  //   var cursor = 0;
  //   var current = blockText.length > 0 ? blockText[0] : undefined;
    
    
  // }
  
  function parseBlockAnnotation(blockType) {
    scanOverWhitespace();
    if (current != '(') { return parseError(`Expected '(' after block annotation`, cursor, cursor); }
    readNext();
    var textStart = cursor;
    if (!scanToChar(')')) { return parseError(`Block annotation must end with ')'`, cursor, cursor); }
    var textEnd = cursor;
    var rawText = annotation.slice(textStart, textEnd);
    
    // var { blockText, blockArgs, error } = parseBlockText(rawText);
    // if (error) { return { error }; }
    
    // Treat everything in rawText as a valid string element (except for arg declarations)
    var blockText = '';
    var blockArgs = [];
    cursor = textStart;
    while (cursor < textEnd) {
      var textStart = cursor;
      if (scanToChar('[') && cursor < textEnd) {
        blockText += annotation.slice(textStart, cursor);
        readNext();
        var argStart = cursor;
        // Parse Arg
        if (!scanToChar(']')) { return parseError(`Expected ']' after argument declaration.`, cursor, cursor); }
        var argEnd = cursor;
        cursor = argStart;
        while (cursor < argEnd) {
          
        }
        
        blockArgs.push(annotation.slice(argStart, cursor));
        blockText += '[]';
        readNext();
      }
      else {
        blockText += annotation.slice(textStart, cursor);
      }
    }
    
    readNext();
    scanOverWhitespace();
    if (current) { return parseError(`Unexpected token after block annotation`, cursor, cursor); }
    
    return {
      type: blockType,
      text: blockText,
      args: blockArgs
    };
  }
  
  scanOverWhitespace();
  if (!scanToChar('@')) { return parseError(`Annotation must begin with '@'`, cursor, cursor); }
  readNext(); // Skip over @
  
  var {ident: annType, location} = scanIdent();
  switch (annType) {
    case 'boolean':
    case 'command':
    case 'conditional':
    case 'event':
    case 'hat':
    case 'loop':
    case 'reporter':
      // Block
      return parseBlockAnnotation(annType);
      break;
    case 'menu':
      // Menu
      return parseMenuAnnotation();
      break;
    case 'init':
      // Initializer
      scanOverWhitespace();
      if (current) { return parseError(`Unexpected symbol after initializer annotation`, cursor, cursor); }
      return { type: ANNOTATIONS.initializer };
      break;
    case 'internal':
      // Internal function
      scanOverWhitespace();
      if (current) { return parseError(`Unexpected symbol after internal annotation '${current}'`, cursor, cursor); }
      return { type: ANNOTATIONS.internal };
      break;
    default:
      return parseError(`Unknown annotation type: ${annType}`, location.start, location.end);
  }
  
}

var testAnnotations = [
  '@hello(foo is bar[arg:TYPE])',
  '@foo',
  'sdfhu',
  '  @reporter ( foo sfw wue   weif [ arg  : tyype]  ) ',
  '  @reporter ( foo sfw wue   weif [ arg  : NUMBER]  ) ',
  '@sdfbn/eiabn:()DF""',
  '[[[[[[[[[[[[))))((((((((:shfuasnf123',
  '@command(name of command [foo:STRING] continued name)',
  ' @menu(foo) ',
  ' @menu ( foo    )',
  ' @menu ( foo    )   sdf',
  '@init',
  '@init()',
  '@init(foo)',
  '@internal',
  '@internal()',
  '@command(name of command [foo:STRING:default string val] continued name [second:NUMBER] more name)',
]

var testNum = 1;
testAnnotations.forEach(ann => {
  console.log('----------------------------');
  console.log(`Test ${testNum}`);
  console.log('~~~~~~~~~~~~~~~');
  console.log(`${ann}`)
  console.log(`Lexing...`)
  var {tokens, error} = tokenizeAnnotation(ann);
  if (error) {
    console.log(`ERROR: ${error.message}`);
    console.log(`${ann}`);
    console.log(`${' '.repeat(error.location)}^~~~`);
  }
  else {
    console.log('Lexing successful\n');
    console.log(tokens);
    // console.log(`Parsing...`)
    // var {error, ...parsed} = parseAnnotationTokens(tokens);
    // if (error) {
    //   console.log(`ERROR: ${error}`);
    // }
    // else {
    //   console.log('Parsing successful:');
    //   console.log(parsed);
    // }
  }
  ++testNum;
  console.log('----------------------------');
  console.log('\n\n');
});

// var testNum = 1;
// testAnnotations.forEach(ann => {
//   console.log('----------------------------');
//   console.log(`Test ${testNum}`);
//   console.log('~~~~~~~~~~~~~~~');
//   console.log(`${ann}`)
//   console.log(`Parsing...\n`);
//   var { error, ...parsed } = parseAnnotation(ann);
//   if (error) {
//     console.log(`ERROR: ${error.message}`);
//   }
//   else {
//     console.log('Parsing successful:');
//     console.log(parsed);
//   }
//   ++testNum;
//   console.log('----------------------------');
//   console.log('\n\n');
// });
