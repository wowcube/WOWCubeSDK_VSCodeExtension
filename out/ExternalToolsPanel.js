"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalToolsPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const DownloadManager_1 = require("./DownloadManager");
const ArchiveManager_1 = require("./ArchiveManager");
class ExternalToolsPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        //downloader
        this._url = "";
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
                case 'installButtonPressed':
                    {
                        var toolspath = Configuration_1.Configuration.getToolsPath();
                        if (toolspath === '') {
                            this._channel.appendLine("External Tools management: Unable to create a folder for saving the package");
                            this._channel.show(true);
                            return;
                        }
                        this._url = Configuration_1.Configuration.getPackageDownloadURL(message.value.pack);
                        ExternalToolsPanel._filename = toolspath + "package.zip";
                        if (this._url === '') {
                            this._channel.appendLine("External Tools management: Unable to find download url for the package");
                            this._channel.show(true);
                            return;
                        }
                        ExternalToolsPanel.currentPanel?.setProgress('Getting ready to download the package...');
                        ExternalToolsPanel.currentPanel?.showWait(true);
                        DownloadManager_1.DownloadManager.getFileLength(this._url).then(function (value) {
                            const url = value.url;
                            const len = value.length;
                            DownloadManager_1.DownloadManager.doDownload(url, ExternalToolsPanel._filename, len, (value, progress) => {
                                console.log(value + '%');
                                console.log(progress.transferred);
                                ExternalToolsPanel.currentPanel?._channel.appendLine(`Downloaded ${value}% / ${progress.transferred} of ${len}`);
                                ExternalToolsPanel.currentPanel?._channel.show(true);
                                ExternalToolsPanel.currentPanel?.setProgress('Package is being downloaded: ' + value + '%');
                            }).then(function (value) {
                                var toolspath = Configuration_1.Configuration.getToolsPath();
                                ExternalToolsPanel.currentPanel?.setProgress('Package is being installed...');
                                ArchiveManager_1.ArchiveManager.doUnzip(value, toolspath, () => {
                                    ExternalToolsPanel.currentPanel?.showWait(false);
                                    ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: The package has been successfully installed");
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    ExternalToolsPanel.currentPanel?.reload();
                                }, (e) => {
                                    vscode.window.showErrorMessage(e);
                                    ExternalToolsPanel.currentPanel?.showWait(false);
                                    ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unalbe to install the package, " + e);
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    ExternalToolsPanel.currentPanel?.reload();
                                });
                            }, function (error) {
                                vscode.window.showErrorMessage(error);
                                ExternalToolsPanel.currentPanel?.showWait(false);
                            });
                        }, function (error) {
                            vscode.window.showErrorMessage(error);
                            ExternalToolsPanel.currentPanel?.showWait(false);
                        });
                    }
                    break;
                case 'removeButtonPressed':
                    {
                        vscode.window.showInformationMessage("Package '" + message.value.packname + "' will be removed from the computer", ...["Remove Package", "Cancel"]).then((answer) => {
                            if (answer === "Remove Package") {
                                var toolspath = Configuration_1.Configuration.getToolsPath();
                                if (toolspath === '') {
                                    ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unable to locate tools folder");
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    return;
                                }
                                ExternalToolsPanel.currentPanel?.setProgress('Package is being uninstalled...');
                                ExternalToolsPanel.currentPanel?.showWait(true);
                                if (!ExternalToolsPanel.currentPanel?.deleteDir(toolspath + message.value.pack)) {
                                    vscode.window.showErrorMessage("Failed to uninstall the package");
                                }
                                ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management:  Package '" + message.value.packname + "' has been successfully uninstalled");
                                ExternalToolsPanel.currentPanel?._channel.show(true);
                                ExternalToolsPanel.currentPanel?.showWait(false);
                                ExternalToolsPanel.currentPanel?.reload();
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
    setProgress(v) {
        this._panel.webview.postMessage({ type: 'setProgress', value: v });
    }
    showWait(b) {
        if (b) {
            this._panel.webview.postMessage({ type: 'showWait', value: { show: b } });
        }
        else {
            this._panel.webview.postMessage({ type: 'hideWait', value: { show: b } });
            this.setProgress('');
        }
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
        if (DownloadManager_1.DownloadManager.isDownloading()) {
            this.showWait(true);
        }
        else {
            if (ArchiveManager_1.ArchiveManager.isBusy()) {
                this.setProgress('Package is being uninstalled...');
                this.showWait(true);
            }
        }
    }
    reload() {
        if (typeof (this._panel) !== 'undefined') {
            this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        }
    }
    _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "externaltoolsview.js"));
        const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var emInstall = this.validateToolInstallation('emscripten');
        var ret = `      
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet"> 
                    <link href="${styleMainCodeUri}" rel="stylesheet"> 
                    <link href="${styleWaitUri}" rel="stylesheet">
                    <title>External Tools</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">External Tools</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Manage external tools supported by WOWCube Development Kit</div>
                        <div class="separator"></div>

                        <div class="view">

                            <div class="items">
                                <div id="i1" class="item">
                                    <div style="margin:5px;"><strong>C++ Compiler support package for WOWCube SDK</strong></div>

                                    <div style="display:inline-block; width: calc(100% - 145px);">
                                        <div class="itemdesc">The package provides the ability to compile and build cubeapps in the C++ programming language.</div>
                                        </div>`;
        if (emInstall == true) {
            ret += `  <button class="remove_button" style="display:inline-block;width:120px;" pack="cpp" packname="C++ Compiler support">Remove</button>
                                            <div class="itemstatus itemdesc positive" style="margin-top:10px" pack="cpp">INSTALLED</div>`;
        }
        else {
            ret += `   <button class="install_button" style="display:inline-block;width:120px;" pack="cpp" packname="C++ Compiler support">Install</button>
                                             <div class="itemstatus itemdesc neutral" style="margin-top:10px" pack="cpp">NOT INSTALLED</div>`;
        }
        ret += `</div>

                                <div id="i2" class="item">
                                    <div style="margin:5px;"><strong>RUST Compiler support package for WOWCube SDK</strong></div>
                                    
                                    <div style="display:inline-block; width: calc(100% - 145px);">
                                        <div class="itemdesc"><i>COMING SOON</i></div>
                                        <div class="itemdesc">The package provides the development tools needed to write programs in Rust.</div>
                                        </div>
                                        <button class="install_button" style="display:inline-block;width:120px;" pack="rust" packname="RUST Compiler support">Install</button>
                                    <div class="itemdesc neutral" style="margin-top:10px">NOT INSTALLED</div>
                                </div>
                            </div>
                            
                            <div class="wait" id="wait">
                            <div class="centered">
                                <div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                            </div>
                            <div class="centered" style="top:calc(50% - 60px);left:0;width:100%;text-align:center;">
                                <div style="margin:5px;"><strong id='progresstext'>Package is being downloaded</strong></div>
                            </div>
                        </div>

                        </div>
                    </div>
                </body>
                </html> 
            `;
        return ret;
    }
    validateToolInstallation(tool) {
        if (typeof (tool) === 'undefined') {
            tool = '';
        }
        if (tool.length > 0) {
            switch (tool) {
                case 'emscripten':
                    {
                        var compilerpath = Configuration_1.Configuration.getCompilerPath("cpp");
                        compilerpath += 'em/upstream/emscripten/';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: Path \"" + compilerpath + "\" is invalid, C++ Compiler support package for WOWCube SDK is not installed");
                            this._channel.show(true);
                            return false;
                        }
                        var command = '"' + compilerpath + Configuration_1.Configuration.getCC("cpp") + '"';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: File \"" + command + "\" does not exist, C++ Compiler support package for WOWCube SDK is not installed or corrupted");
                            this._channel.show(true);
                            return false;
                        }
                    }
                    break;
                default:
                    return false;
                    break;
            }
        }
        else {
            return false;
        }
        return true;
    }
}
exports.ExternalToolsPanel = ExternalToolsPanel;
ExternalToolsPanel.viewType = "WOWCubeSDK.externalToolsPanel";
ExternalToolsPanel._filename = "";
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