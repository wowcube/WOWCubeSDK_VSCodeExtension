/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import {Configuration} from './Configuration';
import { Version } from "./Version";
import { Providers } from "./Providers";

export class DocumentPanel {

    public static panels = new Map<string,DocumentPanel>();
    public static readonly viewType = "WOWCubeSDK.documentPanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private readonly _key:string = "";
    private readonly _folder:string = "";
    private readonly _file:string = "";
    private readonly _version:string = "";

    public static createOrShowDoc(extensionUri: vscode.Uri,folder:string,file:string, sdkVersion:string) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        var exampleKey:string = '___'+folder+'___'+file;
        
        // If we already have a panel, show it.      
        if(DocumentPanel.panels.has(exampleKey))
        {
            DocumentPanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel
        (
            DocumentPanel.viewType,
            'WOWCube SDK Document',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        DocumentPanel.panels.set(exampleKey,new DocumentPanel(panel, extensionUri,folder,file,sdkVersion));
    }

    private constructor(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri, folder:string, file:string,version:string) 
        {    
            this._panel = panel;    
            this._extensionUri = extensionUri;
            this._key = '___'+folder+'___'+file;
            this._file = file;
            this._folder = folder;
            this._version = version;

        // Set the webview's initial html content    
            this._update();

            this._panel.onDidDispose(() => 
            {
                 this.dispose();
                }, 
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
                        case 'folder': 
                        {
                        }
                        break;
                        case 'prev':
                            {
                                var prev = this.getPrevDocument();
                                DocumentPanel.createOrShowDoc(Configuration.context.extensionUri,prev.folder,prev.file,this._version); 
                                this.dispose();                                
                            }
                            break;
                        case 'next':
                            {
                                var next = this.getNextDocument();
                                DocumentPanel.createOrShowDoc(Configuration.context.extensionUri,next.folder,next.file,this._version); 
                                this.dispose();
                            }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }

        public dispose() 
        {    
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

        private async _update() 
        {
            const webview = this._panel.webview;    
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }
        
        private getPrevDocument()
        {      
            try
            {      
                for(var i=0;i<Providers.examples.docs.length;i++)
                {
                    if(Providers.examples.docs[i][0]===this._folder)
                    {
                        for(var j=0;j<Providers.examples.docs[i][1].length;j++)
                        {
                            if(Providers.examples.docs[i][1][j]===this._file)
                            {
                                //found current 

                                if(j===0)
                                {
                                    //try to find prev topic
                                    if(i===0)
                                    {
                                        //first page of first topic, no prev
                                        return {folder:"",file:""};
                                    }
                                    else
                                    {
                                        var t = Providers.examples.docs[i-1];

                                        var tp = t[0];
                                        var fl = t[1][t[1].length-1];

                                        return {folder:tp,file:fl};
                                    }
                                }
                                else
                                {
                                    var tp = Providers.examples.docs[i][0];
                                    var fl=Providers.examples.docs[i][1][j-1];

                                    return {folder:tp,file:fl};
                                }
                            }
                        }
                    }
                }
            }
            catch(e)
            {                
            }

            return {folder:"",file:""};
        }

        private getNextDocument()
        {
            try
            {
                for(var i=0;i<Providers.examples.docs.length;i++)
                {
                    if(Providers.examples.docs[i][0]===this._folder)
                    {
                        for(var j=0;j<Providers.examples.docs[i][1].length;j++)
                        {
                            if(Providers.examples.docs[i][1][j]===this._file)
                            {
                                //found current 

                                if(j===Providers.examples.docs[i][1].length-1)
                                {
                                    //try to find next topic
                                    if(i===Providers.examples.docs.length-1)
                                    {
                                        //last page of last topic, no next
                                        return {folder:"",file:""};
                                    }
                                    else
                                    {
                                        var t = Providers.examples.docs[i+1];

                                        var tp = t[0];
                                        var fl = t[1][0];

                                        return {folder:tp,file:fl};
                                    }
                                }
                                else
                                {
                                    var tp = Providers.examples.docs[i][0];
                                    var fl=Providers.examples.docs[i][1][j+1];

                                    return {folder:tp,file:fl};
                                }
                            }
                        }
                    }
                }
            }
            catch(e)
            {}

            return {folder:"",file:""};
        }

        private _getHtmlForWebview(webview: vscode.Webview) 
        {
            var MarkdownIt = require('markdown-it');
            var md = new MarkdownIt();
            var content: string = "";

            var info:string = Configuration.getWOWSDKPath()+'sdk/docs/'+this._version+'/'+this._folder+'/';

            var prev = 1;
            var next = 1;

            if(fs.existsSync(info)===false)
            {
                content = '# this document is empty';
            }
            else
            {
                info+=this._file;

                if(fs.existsSync(info)===false)
                {
                    content = '# this document is empty';
                }
                else
                {
                    try
                    {
                        var contentmd = fs.readFileSync(info,'utf8');
                        content = md.render(contentmd.toString());
                        
                        if(this.getPrevDocument().file==="")
                        {
                            prev = -1;
                        }

                        if(this.getNextDocument().file==="")
                        {
                        next = -1;
                        }

                        this._panel.title = "WOWCube SDK "+this._version+' / '+this._folder+' / '+this._file.substring(0,this._file.length-3);
                    }
                    catch(e)
                    {
                        content = '# this document is empty';
                    }
                }
            }
                    
            const styleResetUri = webview.asWebviewUri(      
                vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")   
            );

            const styleVSCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
            );

            const styleMainCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
            );

            const styleMDUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "markdown.css")
            );

            const scriptUri = webview.asWebviewUri( 
                vscode.Uri.joinPath(this._extensionUri, "media", "document.js")
            );
            
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
                    <link href="${styleMDUri}" rel="stylesheet"> 
                    <title>Document</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">

                        <div class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px; top:0px;">`;
                        
                        ret+= content;

                        ret+=`</div>`;

                        if(prev!==-1)
                        {
                            ret+=`<button id="prev_button" style="position:absolute; left:20px; bottom:20px; height:40px; width:90px;" key="${prev}"><< PREV</button>`;
                        }
                        else
                        {
                            ret+=`<div class="inactive" style="position: absolute;left: 20px;bottom: 20px;height: 52px;width: 90px;line-height: 52px;text-align: center;"><< PREV</div>`;
                        }
 
                        if(next!==-1)
                        {
                            ret+=`<button id="next_button" style="position:absolute; right:20px; bottom:20px; height:40px; width:90px;" key="${next}">NEXT >> </button>`;
                        }
                        else
                        {
                            ret+=`<div class="inactive" style="position:absolute; right:20px; bottom:20px; height:52px; width:90px;line-height: 52px;text-align: center;">NEXT >> </div>`;
                        }

                        ret+=`
                         </div>
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
