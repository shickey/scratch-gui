import {connect} from 'react-redux';
import React from 'react';

import {parseAnnotatedExtension, createExtensionCode} from './extension-parser.js'

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';

import {
    updateExtensionJs
} from '../../reducers/extension-editor';

import downloadBlob from '../../lib/download-blob.js';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/addon/lint/lint.css';
import 'codemirror/addon/lint/lint.js';

import {Controlled as CodeMirror} from 'react-codemirror2';

import classNames from 'classnames';
import styles from './text-editor.css';
import overrides from './codemirror-overrides.css';

import loadIcon from './icon--load.svg';
import downloadIcon from './icon--download.svg';
import uploadIcon from './icon--upload.svg';
import downloadCodeIcon from './icon--download-code.svg';


class TextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.extensionId = undefined;
    this.loadExtensionIntoVm = this.loadExtensionIntoVm.bind(this);
    this.uploadExtension = this.uploadExtension.bind(this);
    this.downloadExtension = this.downloadExtension.bind(this);
    this.downloadRawExtension = this.downloadRawExtension.bind(this);
    this.setFileInput = this.setFileInput.bind(this);
    this.handleFileInput = this.handleFileInput.bind(this);
    this.lint = this.lint.bind(this);
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
        vm.setEditingExtensionInfo('myExtension', dataUri, this.props.extensionJs);
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

  lint(text) {
    var {parsed, error} = parseAnnotatedExtension(text);
    if (error !== null) {
      if (error.hasOwnProperty('loc')) {
        var loc = error.loc;
        return [{
          from: { line: loc.start.line, ch: loc.start.column, sticky: null }, // @TODO: Fix. This just matches the spec for CodeMirror.Pos structure, which could change I suppose
          to:   { line: loc.end.line, ch: loc.end.column, sticky: null },
          message: error.message
        }];
      }
    }
    return [];
  }
  
  downloadRawExtension() {
    var extensionBlob = new Blob([this.props.extensionJs], {type: 'application/javascript'});
    downloadBlob('myExtension.scx', extensionBlob);
  }
  
  downloadExtension() {
    var {parsed, error} = parseAnnotatedExtension(this.props.extensionJs);
    if (error !== null) {
      // @TODO: Display the error
      console.log("Extension code errors must be fixed before downloading")
    }
    else {
      var code = createExtensionCode(parsed);
      var extensionBlob = new Blob([code], {type: 'application/javascript'});
      downloadBlob('myExtension.js', extensionBlob);
    }
  }
  
  uploadExtension() {
    this.fileInput.click();
  }
  
  setFileInput (input) {
    this.fileInput = input;
  }
  
  handleFileInput(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.props.onUpdateExtensionJs(reader.result);
    }
    reader.readAsText(file);
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
              scrollbarStyle: "null",
              gutters: ["CodeMirror-lint-markers"],
              lint: this.lint
            }}
            onBeforeChange={(editor, data, value) => {
              this.props.onUpdateExtensionJs(value)
            }}
            onChange={(editor, value) => {}}
          />
        </Box>
        <Box className={styles.extensionEditorHeader}>
          <div className={styles.extensionEditorButtonGroup}>
            <div className={styles.extensionEditorSaveLoadButtons}>
              <Button 
                className={styles.extensionEditorButton}
                onClick={this.downloadRawExtension}
                >
                <div className={styles.extensionEditorButtonContent}>
                  <img
                    className={styles.extensionEditorButtonIcon}
                    draggable={false}
                    src={downloadCodeIcon}
                  />
                </div>
              </Button>
              <Button 
                className={styles.extensionEditorButton}
                onClick={this.downloadExtension}
                >
                <div className={styles.extensionEditorButtonContent}>
                  <img
                    className={styles.extensionEditorButtonIcon}
                    draggable={false}
                    src={downloadIcon}
                  />
                </div>
              </Button>
              <Button 
                className={styles.extensionEditorButton}
                onClick={this.uploadExtension}
                >
                <div className={styles.extensionEditorButtonContent}>
                  <img
                    className={styles.extensionEditorButtonIcon}
                    draggable={false}
                    src={uploadIcon}
                  />
                  <input
                      accept={'.scx'}
                      className={styles.fileInput}
                      multiple={false}
                      ref={this.setFileInput}
                      type="file"
                      onChange={this.handleFileInput}
                  />
                </div>
              </Button>
            </div>
            <Button 
              className={classNames(
                          styles.extensionEditorButton,
                          styles.extensionEditorUpdateButton)}
              onClick={this.loadExtensionIntoVm}>
              <div className={styles.extensionEditorButtonContent}>
                <img
                  className={styles.extensionEditorButtonIcon}
                  draggable={false}
                  src={loadIcon}
                />
                Update Blocks
              </div>
            </Button>
          </div>
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
