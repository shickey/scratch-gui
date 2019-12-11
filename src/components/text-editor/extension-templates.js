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
`
  )
}

const workerExtensionWrapper = function(extensionCode) {
  return (
`${extensionCode}

Scratch.extensions.register(new MyExtension());
`
  )
}

const mainThreadExtensionWrapper = function(extensionCode) {
  return (
`
window.ScratchExtensions = window.ScratchExtensions || {
  extensionToLoad: null,
  error: null
};

(function() {
  try {
    ${extensionCode};
    
    window.ScratchExtensions.extensionToLoad = MyExtension;
  }
  catch(e) {
    window.ScratchExtensions.extensionToLoad = null;
    window.ScratchExtensions.error = e;
    return;
  }
})();
`  
  )
}

export {
  blockDecl,
  extensionDecl,
  workerExtensionWrapper,
  mainThreadExtensionWrapper
};
