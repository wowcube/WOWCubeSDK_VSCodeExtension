/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import { Project } from "./Project";
import {Output} from './Output';

export class ExternalToolsPanel {

    public static currentPanel: ExternalToolsPanel | undefined;
    public static readonly viewType = "WOWCubeSDK.externalToolsPanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;
	private _channel: vscode.OutputChannel = Output.channel();

    public static createOrShow(extensionUri: vscode.Uri) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if (ExternalToolsPanel.currentPanel) 
        {
            ExternalToolsPanel.currentPanel._panel.reveal(column);
            return;     
        }
        
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(
            ExternalToolsPanel.viewType,
            'Manage External Tools',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);    
    }

    public static kill() 
    { 
        ExternalToolsPanel.currentPanel?.dispose();
        ExternalToolsPanel.currentPanel = undefined; 
    }

    public static revive(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
            ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);  
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
                        case 'folder': 
                        {
                            const options: vscode.OpenDialogOptions = {
                                canSelectMany: false,
                                openLabel: 'Select Project Folder',
                                canSelectFiles: false,
                                canSelectFolders: true
                            };
                           
                           vscode.window.showOpenDialog(options).then(fileUri => 
                            {
                               if (fileUri && fileUri[0]) 
                               {
                                    if (this._panel) 
                                    {
                                        //save configuration
                                        var path = fileUri[0].fsPath;

                                        if(!path.endsWith(Configuration.getSlash()))
                                        {
                                            path = path + Configuration.getSlash();
                                        }

                                        Configuration.setLastPath(path);
                                        this._panel.webview.postMessage({ type: 'folderSelected',value:path});
                                    }
                               }
                           });
                        }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }


        makefiles(filepaths: string[]) 
        {
            filepaths.forEach(filepath => this.makeFileSync(filepath));
        }
    
        makefolders(files: string[]) 
        {
            files.forEach(file => this.makeDirSync(file));
        }
    
        makeDirSync(dir: string) 
        {
            if (fs.existsSync(dir)) return;
            if (!fs.existsSync(path.dirname(dir))) 
            {
                this.makeDirSync(path.dirname(dir));
            }
            fs.mkdirSync(dir);
        }
    
        makeFileSync(filename: string) 
        {
            if (!fs.existsSync(filename)) 
            {
                this.makeDirSync(path.dirname(filename));
                fs.createWriteStream(filename).close();
            }
        }
    
        findDir(filePath: string) 
        {
            if (!filePath) return null;
            if (fs.statSync(filePath).isFile())
                return path.dirname(filePath);
    
            return filePath;
        }

        deleteDir(dir:string)
        {
            var ret:boolean = true;
            try
            {
                if (fs.existsSync(dir)) 
                {
                    fs.rmSync(dir,{ recursive: true });
                }
            }
            catch(error)
            {
                ret = false;
            }

            return ret;
        }

        public dispose() {    
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

            const styleMainCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
            );

            const scriptUri = webview.asWebviewUri( 
                vscode.Uri.joinPath(this._extensionUri, "media", "wizard.js")
            );
            
            const nonce = getNonce();  
            const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media')
                ).toString().replace('%22', '');

            var ret =  `      
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
