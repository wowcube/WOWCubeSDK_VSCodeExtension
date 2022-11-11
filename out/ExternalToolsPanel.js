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
    /*
    public static getContentLength(url:string)
    {
        const http = require('http');

        return new Promise((resolve, reject) =>
        {
            http.request(url, { method: 'HEAD', headers: { 'user-agent': 'test' } }, (res:any) =>
            {
                console.log(res.statusCode);
                if(res.statusCode == 200)
                {
                    var contentLength = res.headers['content-length'];
                    if(contentLength>0)
                    {
                        console.log("File length: "+contentLength);
                        resolve({length:contentLength,url:url});
                    }
                    else
                    {
                        reject(-1);
                    }
                }
                else
                {
                    reject(-1);
                }
            }).on('error', (err:any) =>
            {
                console.error(err);
                reject(-1);
            }).end();
        });
    }
    */
    /*
    public static download(url:string, dest:string, len:any)
    {
        var http = require('http');
        var progress = require('progress-stream');
        
        return new Promise((resolve, reject) =>
        {
            const file = fs.createWriteStream(dest, { flags: "wx" });
    
            var str = progress({
                time: 100,
                length:len
            });
             
            str.on('progress', function(progress:any)
            {
                console.log(Math.round(progress.percentage)+'%');
                console.log(progress.transferred);

                ExternalToolsPanel.currentPanel?.setProgress(Math.round(progress.percentage)+'%');
            });

            const request = http.get(url, { headers: { 'user-agent': 'test' }}, (response:any) => {
                if (response.statusCode === 200)
                {
                    response.pipe(str).pipe(file);
                }
                 else
                 {
                    file.close();
                    fs.unlink(dest, () => {}); // Delete temp file
                    reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
                }
            });
    
            request.on("error", (err:any) =>
            {
                file.close();
                fs.unlink(dest, () => {}); // Delete temp file
                reject(err.message);
            });
    
            file.on("finish", () =>
            {
                resolve(dest);
            });
    
            file.on("error", err =>
            {
                file.close();
    
                if (err.name === "EEXIST") {
                    reject("File already exists");
                } else {
                    fs.unlink(dest, () => {}); // Delete temp file
                    reject(err.message);
                }
            });
        });
        
    }
    */
    constructor(panel, extensionUri) {
        this._disposables = [];
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        //downloader
        //private url:string = "https://media0.giphy.com/media/4SS0kfzRqfBf2/giphy.gif";
        //private url:string = "http://ipv4.download.thinkbroadband.com/50MB.zip";
        //private url:string = "http://ipv4.download.thinkbroadband.com/200MB.zip";
        this._url = "https://www.sample-videos.com/zip/30mb.zip";
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
                        switch (message.value.pack) {
                            case 'cpp':
                                {
                                }
                                break;
                            case 'rust':
                                {
                                    this._url = "https://www.sample-videos.com/zip/30mb.zip";
                                    ExternalToolsPanel._filename = toolspath + "package.zip";
                                }
                                break;
                            default:
                                return;
                        }
                        ExternalToolsPanel.currentPanel?.showWait(true);
                        DownloadManager_1.DownloadManager.getFileLength(this._url).then(function (value) {
                            const url = value.url;
                            const len = value.length;
                            DownloadManager_1.DownloadManager.doDownload(url, ExternalToolsPanel._filename, len, (value, progress) => {
                                console.log(value + '%');
                                console.log(progress.transferred);
                                ExternalToolsPanel.currentPanel?._channel.appendLine(`Downloaded ${value}% / ${progress.transferred} of ${len}`);
                                ExternalToolsPanel.currentPanel?._channel.show(true);
                                ExternalToolsPanel.currentPanel?.setProgress(value + '%');
                            }).then(function (value) {
                                var toolspath = Configuration_1.Configuration.getToolsPath();
                                ArchiveManager_1.ArchiveManager.doUnzip(value, toolspath);
                                ExternalToolsPanel.currentPanel?.showWait(false);
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
                                //this.doDeleteApp(device.mac,appname);
                                //Providers.btdevices.showWait(true); 
                            }
                        });
                        //vscode.window.showErrorMessage('Remove '+message.value.pack); 
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
            ret += `  <button class="remove_button" style="display:inline-block;width:120px;" pack="em" packname="C++ Compiler support">Remove</button>
                                            <div class="itemdesc positive" style="margin-top:10px">INSTALLED</div>`;
        }
        else {
            ret += `   <button class="install_button" style="display:inline-block;width:120px;" pack="em" packname="C++ Compiler support">Install</button>
                                             <div class="itemdesc neutral" style="margin-top:10px">NOT INSTALLED</div>`;
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