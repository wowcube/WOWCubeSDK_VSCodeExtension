"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdHocPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const Output_1 = require("./Output");
const Configuration_1 = require("./Configuration");
const FormData = require("form-data");
class AdHocPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._cubfile = "";
        this._icon = "";
        this._appname = "";
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
                case 'generate':
                    {
                        this.uploadAdHoc(message.value);
                    }
                    break;
                case 'close':
                    {
                        AdHocPanel.kill();
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        AdHocPanel.workspace = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
        // If we already have a panel, show it.      
        if (AdHocPanel.currentPanel) {
            AdHocPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(AdHocPanel.viewType, 'WOWCube Share Ad-Hoc Cubeapp', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        AdHocPanel.currentPanel = new AdHocPanel(panel, extensionUri);
    }
    static kill() {
        AdHocPanel.currentPanel?.dispose();
        AdHocPanel.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        AdHocPanel.currentPanel = new AdHocPanel(panel, extensionUri);
    }
    // abstract and promisify actual network request
    async makeRequest(formData, options) {
        return new Promise((resolve, reject) => {
            const req = formData.submit(options, (err, res) => {
                if (err) {
                    return reject(new Error(err.message));
                }
                if (typeof res.statusCode === 'undefined') {
                    return reject(new Error(`HTTP status code ${res.statusCode}`));
                }
                if (res.statusCode < 200 || res.statusCode > 299) {
                    return reject(new Error(`HTTP status code ${res.statusCode}`));
                }
                const body = [];
                res.on('data', (chunk) => body.push(chunk));
                res.on('end', () => {
                    const resString = Buffer.concat(body).toString();
                    resolve(resString);
                });
            });
        });
    }
    //upload cubeapp file with given description
    async uploadAdHoc(value) {
        var ret = { url: '', desc: '' };
        try {
            this._panel.webview.postMessage({ type: 'startRequest' });
            const formData = new FormData();
            formData.append('name', this._appname);
            formData.append('description', value);
            formData.append('icon', fs.createReadStream(this._icon));
            formData.append('file', fs.createReadStream(this._cubfile));
            const options = {
                host: 'wowstore.wowcube.com',
                path: '/api/upload',
                method: 'POST',
                protocol: 'https:',
                headers: {
                //Authorization: `Basic some-token-here`,
                },
            };
            const res = await this.makeRequest(formData, options);
            ret.url = res;
        }
        catch (error) {
            ret.desc = error;
            ret.url = '';
        }
        this._panel.webview.postMessage({ type: 'endRequest' });
        if (ret.url.length === 0) {
            //error
            this._channel.appendLine("Share Ad-Hoc: Unable to share this cubeapp: " + ret.desc);
            this._channel.show(true);
            vscode.window.showErrorMessage("Unable to share this cubeapp: " + ret.desc);
        }
        else {
            this._channel.appendLine("Share Ad-Hoc: Cubemap file has been successfully shared");
            this._channel.show(true);
            //all good, open web page and close itself
            vscode.env.openExternal(vscode.Uri.parse(ret.url));
            AdHocPanel.kill();
        }
        return ret;
    }
    dispose() {
        AdHocPanel.currentPanel = undefined;
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
    checkFilesExist() {
        this._cubfile = "";
        this._icon = "";
        this._appname = "";
        try {
            const build_json = JSON.parse(fs.readFileSync(AdHocPanel.workspace + '/wowcubeapp-build.json', 'utf-8')); //require(AdHocPanel.workspace+'/wowcubeapp-build.json');
            const output = AdHocPanel.workspace + '/binary/' + build_json.name + '.cub';
            const icon = AdHocPanel.workspace + '/assets/icon.png';
            if (fs.existsSync(output) === false) {
                this._channel.appendLine("Share Ad-Hoc: Not ready to share, file '" + output + "' is not found!");
                this._channel.show(true);
                return false;
            }
            if (fs.existsSync(icon) === false) {
                this._channel.appendLine("Share Ad-Hoc: Not ready to share, file '" + icon + "' is not found!");
                this._channel.show(true);
                return false;
            }
            this._cubfile = output;
            this._icon = icon;
            this._appname = build_json.name;
        }
        catch (error) {
            return false;
        }
        return true;
    }
    _getHtmlForWebview(webview) {
        var ready = this.checkFilesExist();
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "adhoc.js"));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var lastPath = Configuration_1.Configuration.getLastPath();
        if (typeof (lastPath) === 'undefined')
            lastPath = '';
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
                    <title>Share Ad-Hoc Cubeapp</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">Share Ad-Hoc Application</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Generate link to share your WOWCube ad-hoc cubeapp</div>
                        <div class="separator"></div>`;
        if (ready === true) {
            ret += `
                        <div class="view">   
                        <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Add some description to your ad-hoc build</div> 
                        <div style="margin-right:10px"> 
                        <textarea id="description" style="resize: none;height:100px;" data-role="none"></textarea>    
                        </div               
                        </div>
                        
                        <button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">SHARE AD-HOC CUBEAPP</button>
                    </div>`;
        }
        else {
            ret += `
                        <div class="negative" style="margin-top:30px;margin-bottom:30px;font-size:16px;">Please build your application before sharing the Ad-Hoc version of it !</div>
                        <button id="close_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">CLOSE</button>
                        `;
        }
        ret += `
                    <div id="wait" class="fullscreen topmost hidden">
                        <div class="centered">
                            <div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                        </div>
                    <div>
                </body>
                </html> 
            `;
        return ret;
    }
}
exports.AdHocPanel = AdHocPanel;
AdHocPanel.viewType = "WOWCubeSDK.openAdHocSharing";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=AdHocPanel.js.map