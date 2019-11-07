const extensionDecl = function(externals, internals, initializer, blockDecls, blockImps) {
  return (
`
${externals.join('\n')}

class MyExtension {
  ${initializer ? initializer : ""}

  getInfo() {
    return {
      id: 'myExtension',
      name: 'Test Extension',
      blocks: [${blockDecls.join(',')}]
    }
  }
  
  ${blockImps.join('\n\n')}

  ${internals.join('\n\n')}
}

Scratch.extensions.register(new MyExtension());`
  )
}

const blockDecl = function(opcode, type, label, args) {
  var block = {
    opcode: opcode,
    blockType: type,
    text: label,
    arguments: {}
  };

  for (var argName in args) {
    block.arguments[argName] = {
      type: args[argName]
    };
  }

  return JSON.stringify(block);
}

export {
  extensionDecl,
  blockDecl
};
