import {connect} from 'react-redux';
import React from 'react';

import {parseAnnotatedExtension, createExtensionCode} from './extension-parser.js'

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';

import {
    updateExtensionJs
} from '../../reducers/extension-editor';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/javascript/javascript.js';

import {Controlled as CodeMirror} from 'react-codemirror2';

import styles from './text-editor.css';
import overrides from './codemirror-overrides.css';



class TextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.extensionId = undefined;
    this.loadExtensionIntoVm = this.loadExtensionIntoVm.bind(this);
    if(!!props.vm) {
      window.vm = props.vm;
    }
  }

  loadExtensionIntoVm() {
    var {parsed, error} = parseAnnotatedExtension(this.props.extensionJs);
    if (error !== null) {
      // Display the error
    }
    else {
      // Load code into VM
      var vm = this.props.vm
      var extensionCode = createExtensionCode(parsed);
      if(!!vm) {
        var dataUri = `data:text/javascript,${extensionCode};`;
        var extensionManager = vm.extensionManager;
        if (this.extensionId === undefined) {
          extensionManager.loadExtensionURL(dataUri).then((extensionId) => {
            this.extensionId = extensionId;
            console.log(`extension loaded with id ${this.extensionId}`);
          }).catch((e) => { console.log("Error: " + e);})
        }
        else {
          extensionManager.reloadExtensionURL(this.extensionId, dataUri).then(() => {
            console.log("extension reloaded");
          }).catch((e) => { console.log("Error: " + e);})
        }
      }
    }
  }

  render() {
    return (
      <Box className={styles.extensionEditorContainer}>
        <Box className={styles.extensionEditorTextArea}>
          <CodeMirror
            value={this.props.extensionJs}
            options={{
              mode: "javascript",
              theme: "monokai",
              lineNumbers: true,
              scrollbarStyle: "null"
            }}
            onBeforeChange={(editor, data, value) => {
              this.props.onUpdateExtensionJs(value)
            }}
            onChange={(editor, value) => {}}
          />
        </Box>
        <Box className={styles.extensionEditorHeader}>
          <Button onClick={this.loadExtensionIntoVm}>Load Extension</Button>
        </Box>
      </Box>
    )
  }
}

const mapStateToProps = state => ({
    extensionJs: state.scratchGui.extensionEditor.extensionJs,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onUpdateExtensionJs: (js) => dispatch(updateExtensionJs(js)),
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TextEditor);
