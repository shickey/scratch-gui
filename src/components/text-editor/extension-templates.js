const blockDecl = function(opcode, type, label, args) {
  var block = {
    opcode: opcode,
    blockType: type,
    text: label,
    arguments: args
  };
  
  return JSON.stringify(block);
}

const extensionDecl = function(externals, internals, initializer, blockDecls, blockImps, menusDecl, menuFuncs) {
  return (
`
${externals.join('\n')}

class MyExtension {
  ${initializer ? initializer : ""}

  ${menuFuncs.join('\n\n')}

  getInfo() {
    return {
      id: 'myExtension',
      name: 'My Extension',
      blocks: [${blockDecls.join(',')}],
      menus: ${menusDecl}
    }
  }
  
  ${blockImps.join('\n\n')}

  ${internals.join('\n\n')}
}

Scratch.extensions.register(new MyExtension());
`
  )
}

export {
  blockDecl,
  extensionDecl
};
