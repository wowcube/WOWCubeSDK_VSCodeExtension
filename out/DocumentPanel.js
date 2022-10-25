"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const Configuration_1 = require("./Configuration");
const Providers_1 = require("./Providers");
class DocumentPanel {
    constructor(panel, extensionUri, folder, file, version, language) {
        this._disposables = [];
        this._key = "";
        this._folder = "";
        this._file = "";
        this._version = "";
        this._language = "";
        this._viewLoaded = false;
        this._scrollPos = 0;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._key = '___' + language + '___' + folder + '___' + file;
        this._file = file;
        this._folder = folder;
        this._version = version;
        this._language = language;
        // Set the webview's initial html content    
        this._update();
        this._panel.onDidDispose(() => {
            this.dispose();
        }, null, this._disposables);
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
                    }
                    break;
                case 'prev':
                    {
                        var prev = this.getPrevDocument();
                        DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, prev.folder, prev.file, this._version, this._language);
                        this.dispose();
                    }
                    break;
                case 'next':
                    {
                        var next = this.getNextDocument();
                        DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, next.folder, next.file, this._version, this._language);
                        this.dispose();
                    }
                    break;
                case 'scrollChanged':
                    {
                        this._scrollPos = message.value;
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShowDoc(extensionUri, folder, file, sdkVersion, language) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        var exampleKey = '___' + language + '___' + folder + '___' + file;
        // If we already have a panel, show it.      
        if (DocumentPanel.panels.has(exampleKey)) {
            DocumentPanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(DocumentPanel.viewType, 'WOWCube SDK Document', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        DocumentPanel.panels.set(exampleKey, new DocumentPanel(panel, extensionUri, folder, file, sdkVersion, language));
    }
    dispose() {
        DocumentPanel.panels.delete(this._key);
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
        webview.postMessage({ type: 'scrollTo', value: this._scrollPos });
        if (this._viewLoaded === false)
            this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    getPrevDocument() {
        try {
            var docs;
            switch (this._language) {
                case 'pawn':
                default:
                    docs = Providers_1.Providers.examples.docs_pawn;
                    break;
                case 'cpp':
                    docs = Providers_1.Providers.examples.docs_pawn;
                    break;
            }
            for (var i = 0; i < docs.length; i++) {
                if (docs[i][0] === this._folder) {
                    for (var j = 0; j < docs[i][1].length; j++) {
                        if (docs[i][1][j] === this._file) {
                            //found current 
                            if (j === 0) {
                                //try to find prev topic
                                if (i === 0) {
                                    //first page of first topic, no prev
                                    return { folder: "", file: "" };
                                }
                                else {
                                    var t = docs[i - 1];
                                    var tp = t[0];
                                    var fl = t[1][t[1].length - 1];
                                    return { folder: tp, file: fl };
                                }
                            }
                            else {
                                var tp = docs[i][0];
                                var fl = docs[i][1][j - 1];
                                return { folder: tp, file: fl };
                            }
                        }
                    }
                }
            }
        }
        catch (e) {
        }
        return { folder: "", file: "" };
    }
    getNextDocument() {
        try {
            var docs;
            switch (this._language) {
                case 'pawn':
                default:
                    docs = Providers_1.Providers.examples.docs_pawn;
                    break;
                case 'cpp':
                    docs = Providers_1.Providers.examples.docs_pawn;
                    break;
            }
            for (var i = 0; i < docs.length; i++) {
                if (docs[i][0] === this._folder) {
                    for (var j = 0; j < docs[i][1].length; j++) {
                        if (docs[i][1][j] === this._file) {
                            //found current 
                            if (j === docs[i][1].length - 1) {
                                //try to find next topic
                                if (i === docs.length - 1) {
                                    //last page of last topic, no next
                                    return { folder: "", file: "" };
                                }
                                else {
                                    var t = docs[i + 1];
                                    var tp = t[0];
                                    var fl = t[1][0];
                                    return { folder: tp, file: fl };
                                }
                            }
                            else {
                                var tp = docs[i][0];
                                var fl = docs[i][1][j + 1];
                                return { folder: tp, file: fl };
                            }
                        }
                    }
                }
            }
        }
        catch (e) { }
        return { folder: "", file: "" };
    }
    _createTempMediaFolder() {
        try {
            var tempmedia = this._extensionUri.fsPath + "/media/temp/";
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            tempmedia += this._version + '/';
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            tempmedia += this._folder + '/';
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            return tempmedia;
        }
        catch (e) {
        }
        return "";
    }
    _getHtmlForWebview(webview) {
        var MarkdownIt = require('markdown-it');
        var md = new MarkdownIt({
            html: true
        });
        var content = "";
        var tempfolder = "";
        var info = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._version + '/' + this._language + '/' + this._folder + '/';
        //Look for external resources and copy them into extension temp folder
        if (fs.existsSync(info) === true) {
            fs.readdirSync(info).forEach(file => {
                var ext = file.substring(file.lastIndexOf('.'));
                if (ext !== '.md') {
                    tempfolder = this._createTempMediaFolder();
                    if (tempfolder !== "") {
                        try {
                            fs.copyFileSync(info + file, tempfolder + file);
                        }
                        catch (e) {
                        }
                    }
                }
            });
        }
        const imgUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media/temp", "Cascade.png"));
        var prev = 1;
        var next = 1;
        if (fs.existsSync(info) === false) {
            content = '# this document is empty';
        }
        else {
            info += this._file;
            if (fs.existsSync(info) === false) {
                content = '# this document is empty';
            }
            else {
                try {
                    var contentmd = fs.readFileSync(info, 'utf8');
                    //split md file into lines 
                    var lines = contentmd.split('\n');
                    //search for ![alt_name](/Users/apple 1/WOWCubeSDK/media/temp/0.9/Graphics/Cascade.png) tag and exteract full filename and path
                    var re = /[!][[](?<name>[\s\S]+)][(](?<path>[\s\S]+)[)]/g;
                    var m;
                    var toReplace = new Array();
                    lines.forEach(line => {
                        m = re.exec(line);
                        if (m) {
                            toReplace.push(m[2]);
                        }
                    });
                    //render md context
                    content = md.render(contentmd.toString());
                    //replace pathes with secure alternatives provided by VSCode
                    if (tempfolder !== '') {
                        toReplace.forEach(element => {
                            var name = element.substring(element.lastIndexOf('/') + 1);
                            var fullpath = tempfolder + name;
                            const imgUri = webview.asWebviewUri(vscode.Uri.file(fullpath));
                            content = content.replace(new RegExp(element, 'g'), `${imgUri}`);
                        });
                    }
                    if (this.getPrevDocument().file === "") {
                        prev = -1;
                    }
                    if (this.getNextDocument().file === "") {
                        next = -1;
                    }
                    var fname = this._file.substring(0, this._file.length - 3);
                    this._panel.title = "WOWCube SDK " + this._version + ' / ' + this._language + ' / ' + this._folder.substring(this._folder.indexOf('.') + 1) + ' / ' + fname.substring(fname.indexOf('.') + 1);
                }
                catch (e) {
                    content = '# this document is empty';
                }
            }
        }
        //replace all img src in generated content
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const styleMDUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "markdown.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "document.js"));
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
                    <link href="${styleMDUri}" rel="stylesheet"> 
                    <title>Document</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">

                        <div id="viewdiv" class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px; top:0px;">`;
        ret += content;
        ret += `</div>`;
        if (prev !== -1) {
            ret += `<button id="prev_button" style="position:absolute; left:20px; bottom:20px; height:40px; width:90px;" key="${prev}"><< PREV</button>`;
        }
        else {
            ret += `<div class="inactive" style="position: absolute;left: 20px;bottom: 20px;height: 52px;width: 90px;line-height: 52px;text-align: center;"><< PREV</div>`;
        }
        if (next !== -1) {
            ret += `<button id="next_button" style="position:absolute; right:20px; bottom:20px; height:40px; width:90px;" key="${next}">NEXT >> </button>`;
        }
        else {
            ret += `<div class="inactive" style="position:absolute; right:20px; bottom:20px; height:52px; width:90px;line-height: 52px;text-align: center;">NEXT >> </div>`;
        }
        ret += `
                         </div>
                </body>
                </html> 
            `;
        this._viewLoaded = true;
        return ret;
    }
}
exports.DocumentPanel = DocumentPanel;
DocumentPanel.panels = new Map();
DocumentPanel.viewType = "WOWCubeSDK.documentPanel";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=DocumentPanel.js.map