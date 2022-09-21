/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import { Providers } from "./Providers";
import { Version } from "./Version";

export class ExamplePanel {

    public static panels = new Map<string,ExamplePanel>();
    public static readonly viewType = "WOWCubeSDK.examplePanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private readonly _key:string = "";
    private _version:string = "";
    private  _forceVersion:string="";

    private _viewLoaded:Boolean = false;
    private _scrollPos = 0;

    public static createOrShow(extensionUri: vscode.Uri,exampleKey:string) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if(ExamplePanel.panels.has(exampleKey))
        {
            if(ExamplePanel.panels.get(exampleKey)?._version===Configuration.getCurrentVersion()) 
            {
                 ExamplePanel.panels.get(exampleKey)?._panel.reveal(column);
                return;
            }
            else
            {
                ExamplePanel.panels.get(exampleKey)?._panel.dispose();
            }
        }

        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel
        (
            ExamplePanel.viewType,
            'WOWCube SDK Document',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        ExamplePanel.panels.set(exampleKey,new ExamplePanel(panel, extensionUri,exampleKey,""));
    }

    public static createOrShowForce(extensionUri: vscode.Uri,exampleKey:string,forceVersion:string) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if(ExamplePanel.panels.has(exampleKey))
        {
            if(ExamplePanel.panels.get(exampleKey)?._version===forceVersion) 
            {
                 ExamplePanel.panels.get(exampleKey)?._panel.reveal(column);
                return;
            }
            else
            {
                ExamplePanel.panels.get(exampleKey)?._panel.dispose();
            }
        }

        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel
        (
            ExamplePanel.viewType,
            'WOWCube SDK Document',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        ExamplePanel.panels.set(exampleKey,new ExamplePanel(panel, extensionUri,exampleKey,forceVersion));
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, key:string, forceVersion:string) 
        {    
            this._panel = panel;    
            this._extensionUri = extensionUri;
            this._key = key;
            this._forceVersion = forceVersion;

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
                        case 'generate':
                            {                                
                                const options: vscode.OpenDialogOptions = {
                                    canSelectMany: false,
                                    openLabel: 'Select Folder and Create Project',
                                    canSelectFiles: false,
                                    canSelectFolders: true
                                };
                               
                               vscode.window.showOpenDialog(options).then(fileUri => 
                                {
                                   if (fileUri && fileUri[0]) 
                                   {
                                        if (this._panel) 
                                        {
                                            //save project
                                            var path = fileUri[0].fsPath;

                                            var ret = this.generateExample(message.value,path);

                                            if(ret.path.length===0)
                                            {
                                                //error
                                                vscode.window.showErrorMessage("Unable to create example project: "+ret.desc);
                                            }
                                            else
                                            {
                                                //all good
                                                let uri = Uri.file(ret.path);
                                                let success = vscode.commands.executeCommand('vscode.openFolder', uri,{forceNewWindow:true});
                                            }
                                        }
                                   }
                               });

                            }
                        break;
                        case 'prev':
                        case 'next':
                            {
                                ExamplePanel.createOrShow(Configuration.context.extensionUri,message.value);
                                this.dispose();
                            }
                        break;
                        case 'versionChanged':
                            {
                                ExamplePanel.createOrShowForce(Configuration.context.extensionUri,this._key,message.value);
                                this.dispose();
                            }
                            break;
                        case 'scrollChanged':
                        {
                            this._scrollPos = message.value;
                        }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }

        public generateExample(key:number,path:string)
        {
            var ret = {path:'',desc:''};
            var fullpath = '';
            var needDeleteFolder:boolean = false;

            try
            {

            var ex = Providers.examples.examples.e;
            var availableVersions = ex.get(this._key);
    
            var currVersion = Configuration.getCurrentVersion();
    
            if(this._forceVersion!=="")
            {
                currVersion = this._forceVersion;
            }

            //check if document is available for this version
            var available:boolean = false;
            this._version= currVersion;

            for(var i=0;i<availableVersions.length;i++)
            {
                if(availableVersions[i]===currVersion)
                {
                    available = true;
                    break;
                }
            }

            if(available===false)
            {
                //there is no document for this version, so take a first available one
                this._version = availableVersions[0];
            }

            var info:string = Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key;
            var minfo:string = info;

            var title:string = "Untitled Project";
            var desc:string  = "No description";
            var prev = -1;
            var next = -1;
            var hasProject:boolean = false;

            if(fs.existsSync(info)===false)
            {
                throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
            }
            else
            {
                info+='/info.md';
                minfo+='/info.json';

                if(fs.existsSync(info)===false)
                {
                    throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
                }
                else
                {
                    try
                    {
                        const meta = require(minfo);

                        title = meta.name;
                        desc = meta.desc;

                        prev = meta.prev_key;
                        next = meta.next_key;

                        hasProject = meta.has_project;
                    }
                    catch(e)
                    {
                        throw new Error("Unable to find example project metadata, please try to re-install WOWCube SDK extension");
                    }
                }
            }

                path = path.replace(/\\/g, "/");
                if(!path.endsWith("/")) { path+='/';}

                fullpath = path + title+"("+this._version+")";
                ret.path = fullpath;

                if(fs.existsSync(fullpath))
                {
                    throw new Error("Project with such name already exists in this folder");
                }

                this.makeDirSync(fullpath);

                needDeleteFolder = true;

                this.makeDirSync(fullpath+'/.vscode');
                this.makeDirSync(fullpath+'/binary');
                this.makeDirSync(fullpath+'/src');
                this.makeDirSync(fullpath+'/assets');
                this.makeDirSync(fullpath+'/assets/images');
                this.makeDirSync(fullpath+'/assets/sounds');

                const templatespath = Configuration.getWOWSDKPath()+'sdk/templates/'+Configuration.getCurrentVersion()+'/';

                //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";     
                const iconFilename:string = templatespath+"icon.png";             
                fs.copyFileSync(iconFilename,fullpath+'/assets/icon.png');

                //copy project files
                var sourcePrj = Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key+"/project/src/";
                if(fs.existsSync(sourcePrj)===true)
                {
                    fs.readdirSync(sourcePrj).forEach(file => 
                        {
                            fs.copyFileSync(sourcePrj+file,fullpath+'/src/'+file);
                        });
                }

                //copy resources
                var sourceImg = Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key+"/project/assets/images/";
                var sourceSnd = Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key+"/project/assets/sounds/";

                if(fs.existsSync(sourceImg)===true)
                {
                    fs.readdirSync(sourceImg).forEach(file => 
                        {
                            fs.copyFileSync(sourceImg+file,fullpath+'/assets/images/'+file);
                        });
                }

                if(fs.existsSync(sourceSnd)===true)
                {
                    fs.readdirSync(sourceSnd).forEach(file => 
                        {
                            fs.copyFileSync(sourceSnd+file,fullpath+'/assets/sounds/'+file);
                        });
                }

                //copy build json
                fs.copyFileSync(Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key+"/project/wowcubeapp-build.json",fullpath+'/wowcubeapp-build.json');

                //create vscode-related configs

                //fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/_launch.json",fullpath+'/.vscode/launch.json');
                //fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/_tasks.json",fullpath+'/.vscode/tasks.json');
                //fs.copyFileSync(this._extensionUri.fsPath+"/media/templates/_extensions.json",fullpath+'/.vscode/extensions.json');

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

        public dispose() 
        {    
            ExamplePanel.panels.delete(this._key);

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

            webview.postMessage({ type: 'scrollTo',value: this._scrollPos} );

            if(this._viewLoaded===false)
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }
 
        private _createTempMediaFolder():string
        {
            try
            {
                var tempmedia:string = this._extensionUri.fsPath+"/media/temp/";

                if(fs.existsSync(tempmedia)===false)
                {
                    fs.mkdirSync(tempmedia);
                }

                tempmedia+=this._version+'/';

                if(fs.existsSync(tempmedia)===false)
                {
                    fs.mkdirSync(tempmedia);
                }

                var key:string = this._key.replace('/','_');
                key = key.replace('\\','_');

                tempmedia+=key+'/';

                if(fs.existsSync(tempmedia)===false)
                {
                    fs.mkdirSync(tempmedia);
                }

                return tempmedia;
            }
            catch(e)
            {
                var t;
                t=0;
            }

            return "";
        }

        private _getHtmlForWebview(webview: vscode.Webview) 
        {
            var MarkdownIt = require('markdown-it');
            var md = new MarkdownIt({
                html: true
              });
            var content: string = "";
            var tempfolder: string = "";

            var ex = Providers.examples.examples.e;
            var availableVersions = ex.get(this._key);

            var currVersion = Configuration.getCurrentVersion();

            if(this._forceVersion!=="")
            {
                currVersion = this._forceVersion;
            }

            //check if document is available for this version
            var available:boolean = false;
            this._version = currVersion;

            for(var i=0;i<availableVersions.length;i++)
            {
                if(availableVersions[i]===currVersion)
                {
                    available = true;
                    break;
                }
            }

            if(available===false)
            {
                //there is no document for this version, so take a first available one
                this._version = availableVersions[0];
            }

            var info:string = Configuration.getWOWSDKPath()+"/sdk/examples/"+this._version+'/'+this._key+'/';
            var minfo:string = info;

            var title:string = "No title";
            var desc:string  = "No description";
            var prev = -1;
            var next = -1;
            var hasProject:boolean = false;
            var correctSDK:boolean = false;
            var versionClass:string = "neutral-blue";

             //Look for external resources and copy them into extension temp folder
             if(fs.existsSync(info)===true)
             {                    
                 fs.readdirSync(info).forEach(file => 
                     {
                         var ext = file.substring(file.lastIndexOf('.'));

                         if(ext!=='.md' && ext!=='.json' && ext!=='.DS_Store' && ext!=='project')
                         {
                             tempfolder = this._createTempMediaFolder();

                             if(tempfolder!=="")
                             {
                               try
                               {
                                 fs.copyFileSync(info+file,tempfolder+file);
                               }
                               catch(e)
                               {

                               }
                             }
                         }
                     });
             }

            if(fs.existsSync(info)===false)
            {
                content = '# this document is empty';
            }
            else
            {
                info+='/info.md';
                minfo+='/info.json';

                if(fs.existsSync(info)===false)
                {
                    content = '# this document is empty';
                }
                else
                {
                    try
                    {
                        var contentmd = fs.readFileSync(info,'utf8');

                        //split md file into lines 
                        var lines = contentmd.split('\n');

                        var re = /[!][[](?<name>[\s\S]+)][(](?<path>[\s\S]+)[)]/g;
                        var m;
                        var toReplace:Array<string> = new Array<string>();

                        lines.forEach(line => {

                            m = re.exec(line);
                            if(m)
                            {
                                toReplace.push(m[2]);
                            }
                        });

                        content = md.render(contentmd.toString());

                         //replace pathes with secure alternatives provided by VSCode
                         if(tempfolder!=='')
                         {
                         toReplace.forEach(element => {       
                             
                             var name = element.substring(element.lastIndexOf('/')+1);
                             var fullpath = tempfolder+name;
 
                             const imgUri = webview.asWebviewUri(vscode.Uri.file(fullpath));
 
                             content = content.replace(new RegExp(element,'g'),`${imgUri}`);
                         });
                         }
                         
                        const meta = require(minfo);

                        title = meta.name;
                        desc = meta.desc;

                        prev = meta.prev_key;
                        next = meta.next_key;

                        hasProject = meta.has_project;
                        
                        const vc = Version.compare(this._version,Configuration.getCurrentVersion());

                        //if the version is lesser or equal the one that is currently used, OK
                        if(vc<=0)
                        {
                            correctSDK = true;
                        }
                        else
                        {
                            correctSDK = false;
                            versionClass = "negative";
                        }

                        this._panel.title = title;
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
                vscode.Uri.joinPath(this._extensionUri, "media", "example.js")
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
                    <title>Example</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:30px;line-height: 35px;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">${title}</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">${desc}</div>

                        <!--<div class='${versionClass}' id="t3" style="position: absolute;right: 10px;top: 0;font-size: 12px;">SDK version ${this._version}</div>-->

                        <div class='${versionClass}' id="t3" style="position: absolute;right: 10px;top: 0;font-size: 12px;">`;

                        if(available===false)
                        {
                            ret+=`<select id="versions" class='selector_docs no_version'>`;
                        }
                        else 
                        {
                            ret+=`<select id="versions" class='selector_docs'>`;
                        }

                        for(var i=0;i<availableVersions.length;i++)
                        {
                            if(availableVersions[i]!==this._version)
                            {
                                ret+=`<option value="${availableVersions[i]}">SDK Version ${availableVersions[i]}</option>`;
                            }
                            else
                            {
                                ret+=`<option value="${availableVersions[i]}" selected>SDK Version ${availableVersions[i]}</option>`;
                            }
                        }

                        ret+=`</select>
                        </div>

                        <div class="separator"></div>

                        <div id="viewdiv" class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px;">`;
                        
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

                        if(hasProject===true)
                        {
                            ret+=`<button id="generate_button" style="position:absolute; left:130px; right:20px; bottom:20px; height:40px; width:calc(100% - 270px);" key="${this._key}"}>CREATE EXAMPLE PROJECT</button>`;
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

            this._viewLoaded = true;
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
