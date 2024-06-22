"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResultPanel = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const Configuration_1 = require("./Configuration");
class SearchResultPanel {
    constructor(panel, extensionUri, search) {
        this._disposables = [];
        this._key = "";
        this._searchtext = "";
        this._viewLoaded = false;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._key = '___' + search;
        this._searchtext = search;
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
            }
        }, null, this._disposables);
    }
    static createOrShowDoc(extensionUri, search) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        var exampleKey = '___' + search;
        // If we already have a panel, show it.      
        if (SearchResultPanel.panels.has(exampleKey)) {
            SearchResultPanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(SearchResultPanel.viewType, 'WOWCube SDK Search Result', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        SearchResultPanel.panels.set(exampleKey, new SearchResultPanel(panel, extensionUri, search));
    }
    dispose() {
        SearchResultPanel.panels.delete(this._key);
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
        //webview.postMessage({ type: 'scrollTo',value: this._scrollPos} );
        if (this._viewLoaded === false)
            this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        var title = this._searchtext;
        if (title.length > 40) {
            title = title.substring(0, 37);
            title += "...";
        }
        this._panel.title = "Search Result : " + title;
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
        ret += `<div> SEARCH RESULT FOR: <p class="neutral">` + this._searchtext + `</p></div>`;
        ret += `</div>`;
        ret += `
                         </div>
                </body>
                </html> 
            `;
        this._viewLoaded = true;
        return ret;
    }
}
exports.SearchResultPanel = SearchResultPanel;
SearchResultPanel.panels = new Map();
SearchResultPanel.viewType = "WOWCubeSDK.searchResultPanel";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=SearchResultPanel.js.map