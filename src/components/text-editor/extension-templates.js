const extensionDecl = function(blocks, imps, id) {
  return (
`class MyExtension {
  getInfo() {
    return {
      id: 'myExtension',
      name: 'Test Extension',
      blocks: [${blocks.join(',')}]
    }
  }
  
  ${imps.join('\n\n')}
}

Scratch.extensions.register(new MyExtension());`
  )
}

const blockDecl = function(annotation) {
  var block = {
    opcode: annotation.opcode,
    blockType: annotation.type,
    text: annotation.text,
    arguments: {}
  };

  for (var argName in annotation.args) {
    block.arguments[argName] = {
      type: annotation.args[argName]
    };
  }

  return JSON.stringify(block);
}

export {
  extensionDecl,
  blockDecl
};
