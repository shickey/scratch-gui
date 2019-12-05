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
    if (isDone(tokenizer)) { return {type: TOKEN.end, location: {start: tokenizer.cursor, end: tokenizer.cursor}}; }
    
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
    cursor: 0,
    get current() { return this.cursor >= this.tokens.length ? this.tokens[this.tokens.length - 1] : this.tokens[this.cursor]; },
    get peek() { return this.cursor + 1 >= this.tokens.length ? this.tokens[this.tokens.length - 1] : this.tokens[this.cursor + 1]; }
  }
  
  function parseError(message, location) {
    return {
      error: { 
        message: message,
        location: location 
      }
    };
  }
  
  function nextToken(tokenStream) {
    if (tokenStream.cursor < tokenStream.tokens.length) { tokenStream.cursor++; }
    return tokenStream.current;
  }
  
  function consumeWhitespace(tokenStream) {
    while (tokenStream.current.type === TOKEN.whitespace) {
      nextToken(tokenStream);
    }
  }
  
  function requireToken(tokenStream, tokenType) {
    return tokenStream.current.type === tokenType;
  }
  
  function isValidIdent(ident) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident);
  }
  
  function readString(tokenStream) {
    var str = '';
    while (tokenStream.current.type === TOKEN.text || tokenStream.current.type === TOKEN.whitespace) {
      str += tokenStream.current.value;
      nextToken(tokenStream);
    }
    return str;
  }
  
  function parseBlockText(tokenStream) {
    var text = readString(tokenStream);
    return { text };
  }
  
  function parseBlockArg(tokenStream) {
    
    nextToken(tokenStream); // Skip over [
    consumeWhitespace(tokenStream);
    
    if (!requireToken(tokenStream, TOKEN.text)) {
      return parseError(`Expected argument name`, tokenStream.current.location);
    }
    var argName = tokenStream.current.value;
    
    if (!isValidIdent(argName)) {
      return parseError('Block argument must begin with letter or underscore and contain only letters, numbers, and underscores',
        tokenStream.current.location);
    }
    
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.colon)) {
      return parseError(`Argument name must be followed by ':' and an argument type`, tokenStream.current.location);
    }
          
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.text)) {
      return parseError(`Expected argument type`, token.stream.location);
    }
    var argType = tokenStream.current.value;
    if (!['ANGLE', 'BOOLEAN', 'COLOR', 'NUMBER', 'STRING', 'MATRIX', 'NOTE', 'MENU'].includes(argType)) {
      return parseError(`Unknown annotation argument type '${argType}'. Must be one of: ANGLE, BOOLEAN, COLOR, NUMBER, STRING, MATRIX, NOTE`,
        tokenStream.current.location);
    }
          
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    var argDefault = undefined;
    if (argType == 'MENU') {
      // Require a menu name
      if (!requireToken(tokenStream, TOKEN.colon)) {
        return parseError(`Menu argument requires a menu name`, tokenStream.current.location);
      }
      nextToken(tokenStream);
      consumeWhitespace(tokenStream);
      if (!requireToken(tokenStream, TOKEN.text)) {
        return parseError(`Menu argument requires a menu name`, tokenStream.current.location);
      }
      argDefault = readString(tokenStream).trim(); // Trim whitepsace off the end
      if (!isValidIdent(argDefault)) {
        return parseError('Menu name must begin with letter or underscore and contain only letters, numbers, and underscores',
        tokenStream.current.location);
      }
    }
    else if (tokenStream.current.type === TOKEN.colon) {
      // Optional default parameter
      nextToken(tokenStream);
      if (!requireToken(tokenStream, TOKEN.text) && !requireToken(tokenStream, TOKEN.whitespace)) {
        // @TODO: Currently we only accept text default params
        //        We should allow numbers as well (and maybe colors as hex value, etc.?)
        //        We could also do more clever error type checking here to make sure the
        //        default is actually matches the argument type
        return parseError(`Expected default value for argument`, tokenStream.current.location);
      }
      argDefault = readString(tokenStream);
    }
    if (!requireToken(tokenStream, TOKEN.bracketRight)) {
      return parseError(`Expected argument declaration to end with ]`, tokenStream.current.location);
    }
    nextToken(tokenStream);
    
    var result = {
      arg: {
        name: argName,
        type: argType
      }
    }
    
    if (argDefault) {
      result.arg.default = argDefault;
    }
    
    return result;
  }
  
  function parseBlockAnnotation(tokenStream) {
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.parenLeft)) {
      return parseError(`Block annotation must contain a block description in parentheses`, tokenStream.current.location);
    }
    nextToken(tokenStream);
    
    var blockText = '';
    var blockArgs = {};
    
    blockParseLoop:
      while (true) {
        switch (tokenStream.current.type) {
        case TOKEN.text:
        case TOKEN.whitespace: {
          var {error, text} = parseBlockText(tokenStream);
          if (error) { return { error }};
          blockText += text;
          break;
        }
        case TOKEN.bracketLeft: {
          var {error, arg} = parseBlockArg(tokenStream);
          if (error) { return { error }};
          
          blockText += `[${arg.name}]`;
          blockArgs[arg.name] = { type: arg.type };
          if (arg.default) {
            blockArgs[arg.name].defaultValue = arg.default;
          }
          break;
        }
        case TOKEN.parenRight: {
          break blockParseLoop;
        }
        case TOKEN.end: {
          break blockParseLoop;
        }
        default: {
          return parseError(`Illegal token in block annotation`, tokenStream.current.location);
          break;
        }
      }
    }
    
    if (!requireToken(tokenStream, TOKEN.parenRight)) {
      return parseError(`Unexpected end of block annotation. Block description must be contained in parentheses`, tokenStream.current.location);
    }
    
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.end)) {
     return parseError(`Unexpected token after block annotation`, tokenStream.current.location);
    }
    
    return {
      text: blockText,
      args: blockArgs
    };
  }
  
  function parseMenuAnnotation(tokenStream) {
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.parenLeft)) {
      return parseError('Menu annotation must be followed by a menu name in parentheses', tokenStream.current.location);
    }
    
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.text)) {
      return parseError('Menu annotation must be followed by a menu name in parentheses', tokenStream.current.location);
    }
    
    var menuName = tokenStream.current.value;
    
    if (!isValidIdent(menuName)) {
      return parseError('Menu name must begin with letter or underscore and contain only letters, numbers, and underscores',
        tokenStream.current.location);
    }
    
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (tokenStream.current.type === TOKEN.end) {
      return parseError(`Unexpected end of menu annotation. Expected ')'`, tokenStream.current.location);
    }
    else if (!requireToken(tokenStream, TOKEN.parenRight)) {
      return parseError(`Unexpected token in menu annotation. Expected ')'`, tokenStream.current.location);
    }
    
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (tokenStream.current.type !== TOKEN.end) {
      return parseError(`Unexpected token after menu annotation`, tokenStream.current.location);
    }
    return {
      type: ANNOTATION.menu,
      name: menuName
    };
  }
  
  function parseInitializerAnnotation(tokenStream) {
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.end)) {
      // We found something after the initializer declaration
      return parseError(`Unexpected token in initializer annotation`, tokenStream.current.location);
    }
    return {
      type: ANNOTATION.initializer
    };
  }
  
  function parseInternalFunctionAnnotation(tokenStream) {
    nextToken(tokenStream);
    consumeWhitespace(tokenStream);
    if (!requireToken(tokenStream, TOKEN.end)) {
      // We found something after the internal declaration
      return parseError(`Unexpected token in internal annotation`, tokenStream.current.location);
    }
    return {
      type: ANNOTATION.internal
    };
  }
  
  consumeWhitespace(tokenStream);
  if (!requireToken(tokenStream, TOKEN.at)) {
    return parseError("Annotation must start with '@'", tokenStream.current.location)
  }
  
  switch (tokenStream.current.value) {
    case 'boolean':
    case 'command':
    case 'conditional':
    case 'event':
    case 'hat':
    case 'loop':
    case 'reporter':
      // Block
      var blockType = tokenStream.current.value;
      var {error, ...block} = parseBlockAnnotation(tokenStream);
      if (error) { return {error}; }
      block.type = blockType;
      return block;
      break;
    case 'menu':
      // Menu
      return parseMenuAnnotation(tokenStream);
      break;
    case 'init':
      // Initializer
      return parseInitializerAnnotation(tokenStream);
      break;
    case 'internal':
      // Internal function
      return parseInternalFunctionAnnotation(tokenStream);
      break;
    default:
      return parseError(`Unknown annotation type '${tokenStream.current.value}'`, tokenStream.current.location);
  }
  
  return {};
          
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
  '@menu(%$!adkf)',
  '@menu( 89_foo)',
  '@menu(89_foo)',
  '@menu(_foo89)',
  '@init',
  '@init()',
  '@init(foo)',
  '@internal',
  '@internal()',
  '@command(name of command [foo:STRING:default string val] continued name [second:NUMBER] more name)',
  '@command(name of command [foo:MENU])',
  '@command(name of command [foo:MENU:])',
  '@command(name of command [foo:MENU:8123])',
  '@command(name of command [foo:MENU:bar])',
  '@command(name of command [foo:MENU:  bar ])',
]

var testNum = 1;
testAnnotations.forEach(ann => {
  console.log('----------------------------');
  console.log(`Test ${testNum}`);
  console.log('~~~~~~~~~~~~~~~');
  console.log(`${ann}`)
  // console.log(`Lexing...`)
  var {tokens, error} = tokenizeAnnotation(ann);
  if (error) {
    console.log(`ERROR: ${error.message}`);
    console.log(`${ann}`);
    console.log(`${' '.repeat(error.location.start)}^~~~`);
  }
  else {
    // console.log('Lexing successful\n');
    // console.log(tokens);
    // console.log(`Parsing...`)
    var {error, ...parsed} = parseAnnotationTokens(tokens);
    if (error) {
      console.log(`ERROR: ${error.message}`);
      console.log(`${ann}`);
      console.log(`${' '.repeat(error.location.start)}^~~~`);
    }
    else {
      // console.log('Parsing successful:');
      console.log(parsed);
    }
  }
  ++testNum;
  console.log('----------------------------');
  console.log('\n\n');
});
