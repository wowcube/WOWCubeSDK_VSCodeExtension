import * as vscode from "vscode";
import { getNonce } from "./getNonce";

export class WebAppPanel {

    public static currentPanel: WebAppPanel | undefined;

    public static readonly viewType = "vscodevuecli:panel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if (WebAppPanel.currentPanel) {
            WebAppPanel.currentPanel._panel.reveal(column);
            return;     
        }
        
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(
            WebAppPanel.viewType,
            'WOWCube SDK',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        WebAppPanel.currentPanel = new WebAppPanel(panel, extensionUri);    
    }

    public static kill() 
    { 
        WebAppPanel.currentPanel?.dispose();
        WebAppPanel.currentPanel = undefined; 
    }

    public static revive(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
        WebAppPanel.currentPanel = new WebAppPanel(panel, extensionUri);  
    }

    private constructor(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
            this._panel = panel;    
            this._extensionUri = extensionUri;

        // Set the webview's initial html content    
            this._update();

            this._panel.onDidDispose(() => this.dispose(), 
                null, this._disposables);
            
        // Update the content based on view changes 
            this._panel.onDidChangeViewState(  
                e => {
                    if (this._panel.visible) {  
                        this._update();
                    }
                },
                null,
                this._disposables
            );

            // Handle messages from the webview  
            this._panel.webview.onDidReceiveMessage(    
                message => {
                    switch (message.command) {
                        case 'alert': vscode.window.showErrorMessage(message.text); 
                        return;
                    }
                },
                null,
                this._disposables 
            );
        }

        public dispose() {    
            WebAppPanel.currentPanel = undefined;  

            // Clean up our resources  
            this._panel.dispose();

            while (this._disposables.length) {
                const x = this._disposables.pop(); 
                    if (x) {
                    x.dispose();
                    }
            }
        }

        private async _update() {
            const webview = this._panel.webview;    
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }
        
        private _getHtmlForWebview(webview: vscode.Webview) {    
            const styleResetUri = webview.asWebviewUri(      
                vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")   
            );

            const styleVSCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
            );
            const scriptUri = webview.asWebviewUri( 
                vscode.Uri.joinPath(this._extensionUri, "dist-web", "js/app.js")
            );
            
            const scriptVendorUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, "dist-web", 
                    "js/chunk-vendors.js")
            );

            const nonce = getNonce();  
            const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'dist-web')
                ).toString().replace('%22', '');

            return `      
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <!-- <link href="${styleResetUri}" rel="stylesheet"> -->
                    <!-- <link href="${styleVSCodeUri}" rel="stylesheet"> -->
                    <title>WOWCube SDK</title>
                </head>
                <body>
                <input hidden data-uri="${baseUri}">
                    <div id="app"></div>  
                    <div style="margin:10px;font-size:18px;"> WOWCube SDK </div>
                </body>
                </html> 
            `;  
        }
}
function getWebviewOptions(extensionUri: vscode.Uri): 
vscode.WebviewOptions {    
    return {
        // Enable javascript in the webview
        enableScripts: true,

        localResourceRoots: [  
            vscode.Uri.joinPath(extensionUri, 'media'),  
            vscode.Uri.joinPath(extensionUri, 'dist-web'),
        ]
    };
}
