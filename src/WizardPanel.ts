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

    public static createOrShow(extensionUri: vscode.Uri) 
    { 
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
            'WOWCube Cubeapp Project Wizard',
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

            const templatespath = Configuration.getWOWSDKPath()+'sdk/templates/'+Configuration.getCurrentVersion()+'/';
            const templates = require(templatespath+'templates.json');

            var fullpath = '';
            var needDeleteFolder:boolean = false;

            try
            {
                path = path.replace(/\\/g, "/");
                if(!path.endsWith("/")) { path+='/';}

                fullpath = path + name;
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

                needDeleteFolder = true;

                this.makeDirSync(fullpath+'/.vscode');
                this.makeDirSync(fullpath+'/binary');
                this.makeDirSync(fullpath+'/src');
                this.makeDirSync(fullpath+'/assets');
                this.makeDirSync(fullpath+'/assets/images');
                this.makeDirSync(fullpath+'/assets/sounds');

                //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";
                const iconFilename:string = templatespath+"icon.png";             
                fs.copyFileSync(iconFilename,fullpath+'/assets/icon.png');

                for(var i=0;i<currentTemplate.files.length; i++)
                {
                    if(currentTemplate.files[i]==='_main.pwn')
                    {
                        fs.copyFileSync(templatespath+currentTemplate.id+"/"+currentTemplate.files[i],fullpath+'/src/'+name+'.pwn');
                    }
                    else
                    {
                        fs.copyFileSync(templatespath+currentTemplate.id+"/"+currentTemplate.files[i],fullpath+'/src/'+currentTemplate.files[i]);
                    }
                }
            
                for(var i=0;i<currentTemplate.images.length; i++)
                {
                    fs.copyFileSync(templatespath+currentTemplate.id+"/"+currentTemplate.images[i],fullpath+'/assets/images/'+currentTemplate.images[i]);
                }

                for(var i=0;i<currentTemplate.sounds.length; i++)
                {
                    fs.copyFileSync(templatespath+currentTemplate.id+"/"+currentTemplate.sounds[i],fullpath+'/assets/sounds/'+currentTemplate.sounds[i]);
                }

                //create json file for build
                const json = fs.readFileSync(templatespath+currentTemplate.id+"/_build.json").toString();
                var str = json.replace(/##NAME##/gi,name);
                str = str.replace(/##SDKVERSION##/gi,Configuration.getCurrentVersion());

                fs.writeFileSync(fullpath+'/wowcubeapp-build.json',str);

                //create vscode-related configs
                fs.copyFileSync(templatespath+"_launch.json",fullpath+'/.vscode/launch.json');
                fs.copyFileSync(templatespath+"_tasks.json",fullpath+'/.vscode/tasks.json');
                fs.copyFileSync(templatespath+"_extensions.json",fullpath+'/.vscode/extensions.json');

            }
            catch(error)
            {
                ret.desc = error as string;
                ret.path = '';

                if(needDeleteFolder===true)
                {
                    if(!this.deleteDir(fullpath))
                    {
                        ret.desc+='; unalbe to delete recently created project folder!';
                    }
                }
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
                    <title>New Cubeapp Wizard</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">New Cubeapp Wizard</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Create new WOWCube cubeapp application project from template</div>
                        <div class="separator"></div>

                        <div class="view">
                        
                            <div style="margin-top:0px;">
                                <div class="badge"> <div class="badge_text">1</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Name of your new project</div>
                                <input id="projectname" style="display:block;width:50%;"></input>
                            </div>
                          
                            <div style="margin-top:30px;">
                                <div class="badge"> <div class="badge_text">2</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Choose the folder for your project</div>
                                <br/>
                                <input id="foldername" style="display:inline-block; width:50%;" readonly value="${lastPath}"></input> <button id="folder_button" style="display:inline-block; width:70px;">...</button>
                            </div>
                        
                            <div style="margin-top:30px;margin-bottom:5px;">
                                <div class="badge"> <div class="badge_text">3</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Select project template</div>
                            </div>

                            <div class="items">
                                <div id="i1" class="item">
                                    <div style="margin:5px;"><strong>Empty project</strong></div>
                                    <div class="itemdesc">Creates an empty project with a bare minimum of functions needed to build WOWCube cubeapp application</div>
                                </div>

                                <div id="i2" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with basic rendering support</div>
                                    <div class="itemdesc">Demonstrates principles of work with a compound multi-screen device</div>
                                </div>

                                <div id="i3" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp with resources</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with some resources</div>
                                    <div class="itemdesc">Demonstrates how to find and use application resources</div>
                                </div>

                                <div id="i4" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp with splash screens</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with in-game splash screens support</div>
                                    <div class="itemdesc">Demonstrates the use of in-game splash screens</div>
                                </div>
                            </div>
                            
                        </div>

                        <button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">GENERATE NEW PROJECT</button>
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
