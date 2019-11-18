const UPDATE_EXTENSION_JS = 'scratch-gui/extension-editor/UPDATE_EXTENSION_JS';

const initialState = {
    extensionJs: `/******************************
# Hello!

Here, you can prototype Scratch extensions
using simple javascript functions.
To create a block, simply create a function
with any parameters you want to appear
in the block. E.g.,
    
    function hello(name) {}
   
On the line immediately above
the function, add an annotation to tell
Scratch what the block should be called and
what kind of parameters it takes. E.g.,

    //@reporter(Hello [name:STRING])

Putting it all together:
*******************************/



//@reporter(Hello [name:STRING])
function hello(name) {
  return \`Hello \${name}!\`;
}



/******************************

## On Annotations:

A function annotation must come on the line
immediately before the function and begin with
    
    //@

### Block Type

The next word defines the block type and
must be one of:
    
    boolean
    command
    conditional
    event
    hat
    loop
    reporter

The block type is followed by parentheses \`()\`

## Label and Arugments

The text inside the parentheses of the
annotation defines the label that will appear
on the block, including any arguments that 
the block takes.

Each argument is of the form

   [argName:ARG_TYPE]
   
For each argument, \`argName\` must match an
argument provided to the javascript function.
The \`ARG_TYPE\` indicates the underlying
argument type inside of Scratch and
must be one of:

    ANGLE
    BOOLEAN
    COLOR
    NUMBER
    STRING
    MATRIX
    NOTE

# Hotloading

By pressing the "Load Extension" below, all
annotated function with by loaded into the
Scratch instance on the right (under the
category "Test Extension"). After updating
function implementations in this editor,
you can press "Load Extension" again to
immediately hotload your changes into Scratch.

# Examples

Here are some more examples of blocks you can
define with this tool.
******************************/

//@boolean(It's afternoon?")
function afternoonBool() {
  // Use plain old javascript to
  // return whatever you want
  return new Date(Date.now()).getHours() >= 12;
}

//@reporter(random taco)
function randomTaco() {
  // Connect to an API to get data into Scratch
  return fetch('https://taco-randomizer.herokuapp.com/random/')
    .then((resp) => resp.json()).then((json) => {
    var tacoParts = json;
    return \`\${tacoParts.base_layer.name} with \${tacoParts.mixin.name}, garnished with \${tacoParts.condiment.name} topped off with \${tacoParts.seasoning.name} and wrapped in delicious \${tacoParts.shell.name}\`;
  });
}

/******************************

# Globals

Any statement declared outside on an annotated function
(including non-annotated functions) will run in the 
global context *before* the extension code is loaded
and executed. You can use this to create global state
for an extension. E.g.,
******************************/

var globalStr = "This string is accessible globally!"

//@reporter(global string)
function globalStrReporter() {
    // Use the global state inside extension code
    return globalStr;
}

/******************************

# Internals

In addition to globals, you can also declare functions
within your extension that do *not* represent blocks. For
example, you might want a helper function accesible within
your extension. To declare such a function, annotate it with:

    //@internal

******************************/

// The following declares a new function inside the extension
// which *doesn't* represent a block
//@internal
function internalAddFive(num) {
    return num + 5;
}

// Now create a block that calls the internal function
//@reporter(add five [val:NUMBER])
function addFiveReporter(val) {
    // Use \`this\` to access internal functions
    return this.internalAddFive(val);
}
`
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE_EXTENSION_JS:
        return Object.assign({}, state, {
            extensionJs: action.extensionImp,
        });
    default:
        return state;
    }
};

const updateExtensionJs = function(extensionImplementation) {
    return {
        type: UPDATE_EXTENSION_JS,
        extensionImp: extensionImplementation
    }
}

export {
    reducer as default,
    initialState as extensionEditorInitialState,
    updateExtensionJs,
};
