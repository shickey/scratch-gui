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
      name: 'Test Extension',
      blocks: [${blockDecls.join(',')},
        {
          "opcode": "menuTest",
          "blockType": "reporter",
          "text": "menu test [m]",
          "arguments": {
            "m" : {
              "type": "string",
              "menu": "foo"
            }
          }
        }
      ],
      menus: ${menusDecl}
    }
  }

  menuTest(args) {
    return args.m;
  }
  
  ${blockImps.join('\n\n')}

  ${internals.join('\n\n')}
}

Scratch.extensions.register(new MyExtension());`
  )
}

export {
  blockDecl,
  extensionDecl
};
