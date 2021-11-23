/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';

export class WizardPanel {

    public static currentPanel: WizardPanel | undefined;
    public static readonly viewType = "WOWCubeSDK.wizardPanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if (WizardPanel.currentPanel) 
        {
            WizardPanel.currentPanel._panel.reveal(column);
            return;     
        }
        
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(
            WizardPanel.viewType,
            'WOWCube Cubelet Project Wizard',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        WizardPanel.currentPanel = new WizardPanel(panel, extensionUri);    
    }

    public static kill() 
    { 
        WizardPanel.currentPanel?.dispose();
        WizardPanel.currentPanel = undefined; 
    }

    public static revive(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
            WizardPanel.currentPanel = new WizardPanel(panel, extensionUri);  
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
                                        //vscode.workspace.getConfiguration().update('wowsdk.conf.wizard', fileUri[0].fsPath,vscode.ConfigurationTarget.Global);
                                        Configuration.setLastPath(fileUri[0].fsPath);
                                        this._panel.webview.postMessage({ type: 'folderSelected',value:fileUri[0].fsPath });
                                    }
                               }
                           });
                        }
                        break;
                        case 'generate':
                            {
                                var ret = this.generate(message.value.name,message.value.path,message.value.item);

                                if(ret.path.length===0)
                                {
                                    //error
                                    vscode.window.showErrorMessage("Unable to generate new project: "+ret.desc);
                                }
                                else
                                {
                                    //all good
                                    let uri = Uri.file(ret.path);
                                    let success = vscode.commands.executeCommand('vscode.openFolder', uri);
                                }
                            }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }

        public generate(name:string,path:string,template:number)
        {
            var ret = {path:'',desc:''};
            const templates = require('../media/templates/templates.json');

            try
            {
                path = path.replace(/\\/g, "/");
                if(!path.endsWith("/")) { path+='/';}

                var fullpath = path + name;
                ret.path = fullpath;

                if(fs.existsSync(fullpath))
                {
                    throw new Error("Project with such name already exists in this folder");
                }

                var currentTemplate = null;

                for(var i=0;i<templates.length;i++)
                {
                    if(templates[i].id === template)
                    {
                        currentTemplate = templates[i];
                        break;
                    }
                }

                if(currentTemplate===null)
                {
                    throw new Error("Unable to find template source files");
                }

                this.makeDirSync(fullpath);
                this.makeDirSync(fullpath+'/.vscode');
                this.makeDirSync(fullpath+'/binary');
                this.makeDirSync(fullpath+'/src');
                this.makeDirSync(fullpath+'/resources');
                this.makeDirSync(fullpath+'/resources/images');
                this.makeDirSync(fullpath+'/resources/sounds');

                const iconFilename:string = this._extensionUri.fsPath+"/media/templates/appicon.png";             
                fs.copyFileSync(iconFilename,fullpath+'/resources/appicon.png');

                for(var i=0;i<currentTemplate.files.length; i++)
                {
                    if(currentTemplate.files[i]==='_main.pwn')
                    {
                        fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/"+currentTemplate.id+"/"+currentTemplate.files[i],fullpath+'/src/'+name+'.pwn');
                    }
                    else
                    {
                        fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/"+currentTemplate.id+"/"+currentTemplate.files[i],fullpath+'/src/'+currentTemplate.files[i]);
                    }
                }
            
                for(var i=0;i<currentTemplate.images.length; i++)
                {
                    fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/"+currentTemplate.id+"/"+currentTemplate.images[i],fullpath+'/resources/images/'+currentTemplate.images[i]);
                }

                for(var i=0;i<currentTemplate.sounds.length; i++)
                {
                    fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/"+currentTemplate.id+"/"+currentTemplate.sounds[i],fullpath+'/resources/sounds/'+currentTemplate.sounds[i]);
                }

                //create json file for build
                const json = fs.readFileSync(this._extensionUri.fsPath+"/media/templates/"+currentTemplate.id+"/_build.json").toString();
                const str = json.replace(/##NAME##/gi,name);

                fs.writeFileSync(fullpath+'/wowcubeapp-build.json',str);

                //create vscode-related configs
                fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/_launch.json",fullpath+'/.vscode/launch.json');
                fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/_tasks.json",fullpath+'/.vscode/tasks.json');

            }
            catch(error)
            {
                ret.desc = error as string;
                ret.path = '';
            } 

            return ret;
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

        public dispose() {    
            WizardPanel.currentPanel = undefined;  

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
                    <title>New Cubelet Wizard</title>
                </head>
                <body>
                <!--<input hidden data-uri="${baseUri}">-->
                    <!--<div id="app"></div>-->
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">New Cubelet Wizard</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Create new WOWCube cubelet application project from template</div>
                        <div class="separator"></div>

                        <div style="margin-top:20px;">
                            <div style="display:inline-block;">1</div>
                            <div style="display:inline-block;margin:10px;font-size:14px;">Name of your new project</div>
                            <input id="projectname" style="display:block;width:50%;"></input>
                        </div>
                        
                        <div style="margin-top:20px;">
                            <div style="display:inline-block;">2</div>
                            <div style="display:inline-block;margin:10px;font-size:14px;">Choose the folder for your project</div>
                            <br/>
                            <input id="foldername" style="display:inline-block; width:50%;" readonly value="${lastPath}"></input> <button id="folder_button" style="display:inline-block; width:70px;">...</button>
                        </div>

                        <div style="margin-top:20px;">
                        <div style="display:inline-block;">3</div>
                        <div style="display:inline-block;margin:10px;font-size:14px;">Select project template</div>
                        <br/>

                        <div class="items">
                            <div id="i1" class="item">
                                <div style="margin:5px;"><strong>Empty project</strong></div>
                                <div class="itemdesc">Creates an empty project with a bare minimum of functions needed to build WOWCube cubelet application</div>
                            </div>

                            <div id="i2" class="item">
                                <div style="margin:5px;"><strong>Basic cubelet</strong></div>
                                <div class="itemdesc">Creates a project of WOWCube cubelet application that supports basic interaction with WOWCube deviсe</div>
                                <div class="itemdesc">Demonstrates principle of work with device topology</div>
                            </div>

                            <div id="i3" class="item">
                                <div style="margin:5px;"><strong>Some project</strong></div>
                                <div class="itemdesc">Template description here</div>
                            </div>

                            <div id="i4" class="item">
                                <div style="margin:5px;"><strong>Some project 2</strong></div>
                                <div class="itemdesc">Template description here</div>
                            </div>

                            <div id="i5" class="item">
                                <div style="margin:5px;"><strong>Some project</strong></div>
                                <div class="itemdesc">Template description here</div>
                            </div>

                            <div id="i6" class="item">
                                <div style="margin:5px;"><strong>Some other project</strong></div>
                                <div class="itemdesc">Template description here</div>
                            </div>                            

                        </div>
                        <button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">GENERATE NEW PROJECT</button>
                    </div>
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
