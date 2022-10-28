"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalToolsPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const path = require("path");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
class ExternalToolsPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content    
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes 
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Handle messages from the webview  
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'error':
                    vscode.window.showErrorMessage(message.value);
                    break;
                case 'warn':
                    vscode.window.showWarningMessage(message.value);
                    break;
                case 'folder':
                    {
                        const options = {
                            canSelectMany: false,
                            openLabel: 'Select Project Folder',
                            canSelectFiles: false,
                            canSelectFolders: true
                        };
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                if (this._panel) {
                                    //save configuration
                                    var path = fileUri[0].fsPath;
                                    if (!path.endsWith(Configuration_1.Configuration.getSlash())) {
                                        path = path + Configuration_1.Configuration.getSlash();
                                    }
                                    Configuration_1.Configuration.setLastPath(path);
                                    this._panel.webview.postMessage({ type: 'folderSelected', value: path });
                                }
                            }
                        });
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (ExternalToolsPanel.currentPanel) {
            ExternalToolsPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(ExternalToolsPanel.viewType, 'Manage External Tools', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);
    }
    static kill() {
        ExternalToolsPanel.currentPanel?.dispose();
        ExternalToolsPanel.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);
    }
    makefiles(filepaths) {
        filepaths.forEach(filepath => this.makeFileSync(filepath));
    }
    makefolders(files) {
        files.forEach(file => this.makeDirSync(file));
    }
    makeDirSync(dir) {
        if (fs.existsSync(dir))
            return;
        if (!fs.existsSync(path.dirname(dir))) {
            this.makeDirSync(path.dirname(dir));
        }
        fs.mkdirSync(dir);
    }
    makeFileSync(filename) {
        if (!fs.existsSync(filename)) {
            this.makeDirSync(path.dirname(filename));
            fs.createWriteStream(filename).close();
        }
    }
    findDir(filePath) {
        if (!filePath)
            return null;
        if (fs.statSync(filePath).isFile())
            return path.dirname(filePath);
        return filePath;
    }
    deleteDir(dir) {
        var ret = true;
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true });
            }
        }
        catch (error) {
            ret = false;
        }
        return ret;
    }
    dispose() {
        ExternalToolsPanel.currentPanel = undefined;
        // Clean up our resources  
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "wizard.js"));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var ret = `      
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet"> 
                    <link href="${styleMainCodeUri}" rel="stylesheet"> 
                    <title>External Tools</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">External Tools</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Manage external tools required by WOWCube Development Kit</div>
                        <div class="separator"></div>

                        <div class="view">

                            <div class="items">
                                <div id="i1" class="item">
                                    <div style="margin:5px;"><strong>C++ Compiler support package for WOWCube SDK</strong></div>

                                    <div style="display:inline-block; width: calc(100% - 145px);">
                                        <div class="itemdesc">The package provides the ability to compile and build cubeapps in the C++ programming language.</div>
                                        </div>
                                        <button id="remove_button" style="display:inline-block;width:120px;">Remove</button>
                                    <div class="itemdesc positive" style="margin-top:10px">INSTALLED</div>
                                </div>

                                <div id="i2" class="item">
                                    <div style="margin:5px;"><strong>RUST Compiler support package for WOWCube SDK</strong></div>
                                    
                                    <div style="display:inline-block; width: calc(100% - 145px);">
                                        <div class="itemdesc"><i>COMING SOON</i></div>
                                        <div class="itemdesc">The package provides the development tools needed to write programs in Rust.</div>
                                        </div>
                                        <button id="remove_button" style="display:inline-block;width:120px;">Install</button>
                                    <div class="itemdesc neutral" style="margin-top:10px">NOT INSTALLED</div>
                                </div>
                            </div>
                            
                        </div>

                        <!--<button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">GENERATE NEW PROJECT</button>-->
                    </div>
                </body>
                </html> 
            `;
        return ret;
    }
}
exports.ExternalToolsPanel = ExternalToolsPanel;
ExternalToolsPanel.viewType = "WOWCubeSDK.externalToolsPanel";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=ExternalToolsPanel.js.map