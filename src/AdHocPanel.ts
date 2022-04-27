/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import * as FormData from "form-data";

export class AdHocPanel {

    public static currentPanel: AdHocPanel | undefined;
    public static readonly viewType = "WOWCubeSDK.openAdHocSharing";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if (AdHocPanel.currentPanel) 
        {
            AdHocPanel.currentPanel._panel.reveal(column);
            return;     
        }
        
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(
            AdHocPanel.viewType,
            'WOWCube Share Ad-Hoc Cubeapp',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        AdHocPanel.currentPanel = new AdHocPanel(panel, extensionUri);    
    }

    public static kill() 
    { 
        AdHocPanel.currentPanel?.dispose();
        AdHocPanel.currentPanel = undefined; 
    }

    public static revive(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
            AdHocPanel.currentPanel = new AdHocPanel(panel, extensionUri);  
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
                    if (this._panel.visible) 
                    {  
                        this._update();
                    }
                },
                null,
                this._disposables
            );

            // Handle messages from the webview  
            this._panel.webview.onDidReceiveMessage(    
                message => {
                    switch (message.type) 
                    {
                        case 'error':
                             vscode.window.showErrorMessage(message.value); 
                        break;
                        case 'warn':
                            vscode.window.showWarningMessage(message.value); 
                        break;
                        case 'generate':
                            {
                                this.uploadAdHoc();
                            }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }

        // abstract and promisify actual network request
        public async makeRequest(formData:FormData, options:any) 
        {
            return new Promise<string>((resolve, reject) => 
            {
                const req = formData.submit(options, (err, res) => 
                {
                    if (err) 
                    {
                         return reject(new Error(err.message));
                    }
            
                    if(typeof res.statusCode === 'undefined')
                    {
                        return reject(new Error(`HTTP status code ${res.statusCode}`));
                    }

                    if (res.statusCode < 200 || res.statusCode > 299) 
                    {
                        return reject(new Error(`HTTP status code ${res.statusCode}`));
                    }
            
                    const body:any = [];
                    res.on('data', (chunk) => body.push(chunk));
                    res.on('end', () => 
                    {
                        const resString = Buffer.concat(body).toString();
                        resolve(resString);
                    });
                });
            });
        }

        public async uploadAdHoc()
        {
            var ret = {url:'',desc:''};
            try
            {
                this._panel.webview.postMessage({ type: 'startRequest'});

                const formData = new FormData();

                formData.append('name',"Test APP");
                formData.append('description',"This is a test description");
                formData.append('icon',fs.createReadStream("/Users/thryl/Examples/ex1/resources/appIcon.png"));
                formData.append('file',fs.createReadStream("/Users/thryl/Examples/ex1/binary/Example1.cub"));

                const options = {
                    host: 'wowstore.wowcube.com',
                    path: '/api/upload',
                    method: 'POST',
                    protocol: 'https:', // note : in the end
                    headers: {
                      //Authorization: `Basic some-token-here`,
                    },
                  };

                  const res:string = await this.makeRequest(formData,options);
                  ret.url = res;

            }
            catch(error)
            {
                ret.desc = error as string;
                ret.url = '';
            } 

            this._panel.webview.postMessage({ type: 'endRequest'});

            if(ret.url.length===0)
            {
              //error
              vscode.window.showErrorMessage("Unable to share this cubeapp: "+ret.desc);   
            }
            else
            {
               //all good, open web page and close itself
               vscode.env.openExternal(vscode.Uri.parse(ret.url));
               AdHocPanel.kill();
            }

            return ret;
        }

        public dispose() {    
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

        private async _update() {
            const webview = this._panel.webview;    
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }
        
        private _getHtmlForWebview(webview: vscode.Webview) {    
            const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
            const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
            const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
            const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));

            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "adhoc.js"));
            
            

            const nonce = getNonce();  
            const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media')
                ).toString().replace('%22', '');

            var lastPath = Configuration.getLastPath();
            if(typeof(lastPath)==='undefined') lastPath='';

            var ret =  `      
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
                        <div class="separator"></div>

                        
                        <div class="view">                        
                        </div>
                        
                        <button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">SHARE AD-HOC CUBEAPP</button>
                    </div>

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
function getWebviewOptions(extensionUri: vscode.Uri): 
vscode.WebviewOptions {    
    return {
        // Enable javascript in the webview
        enableScripts: true,

        localResourceRoots: [  
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
