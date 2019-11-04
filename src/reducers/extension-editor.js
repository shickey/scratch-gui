const UPDATE_EXTENSION_JS = 'scratch-gui/extension-editor/UPDATE_EXTENSION_JS';

const initialState = {
    extensionJs: `//@reporter(Hello world [FOO:NUMBER])
function helloWorld(FOO) {
  return FOO + 5;
}`
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
