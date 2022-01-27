/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import { isDeepStrictEqual } from "util";


export class ExamplePanel {

    public static panels = new Map<string,ExamplePanel>();
    public static readonly viewType = "WOWCubeSDK.examplePanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private readonly _key:string = "";

    public static createOrShow(extensionUri: vscode.Uri,exampleKey:string) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if(ExamplePanel.panels.has(exampleKey))
        {
            ExamplePanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel
        (
            ExamplePanel.viewType,
            'WOWCube SDK Document',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        ExamplePanel.panels.set(exampleKey,new ExamplePanel(panel, extensionUri,exampleKey));
    }

    private constructor(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri, key:string) 
        {    
            this._panel = panel;    
            this._extensionUri = extensionUri;
            this._key = key;

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
                this.makeDirSync(fullpath+'/resources');
                this.makeDirSync(fullpath+'/resources/images');
                this.makeDirSync(fullpath+'/resources/sounds');

                const iconFilename:string = this._extensionUri.fsPath+"/media/templates/appIcon.png";             
                fs.copyFileSync(iconFilename,fullpath+'/resources/appIcon.png');

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
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }
        
        private _getHtmlForWebview(webview: vscode.Webview) 
        {
            var MarkdownIt = require('markdown-it');
            var md = new MarkdownIt();
            var content: string = "";

            var info:string = this._extensionUri.fsPath+"/media/examples/"+this._key;
            var minfo:string = info;

            var title:string = "No title";
            var desc:string  = "No description";

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
                        content = md.render(contentmd.toString());

                        const meta = require(minfo);

                        title = meta.name;
                        desc = meta.desc;

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
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:30px;">${title}</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">${desc}</div>
                        <div class="separator"></div>

                        <div class="view" style="padding:26px;">`;
                        
                        ret+= content;

                        ret+=`</div>

                        <button id="generate_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">CREATE EXAMPLE PROJECT</button>
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
