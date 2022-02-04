import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import {Output} from "./Output";
import { ExamplePanel } from './ExamplePanel';
import { DocumentPanel } from './DocumentPanel';
import { throws } from 'assert';

export class ExamplesViewProvider implements vscode.WebviewViewProvider
{
	public static readonly viewType = 'WOWCubeSDK.examplesView';
	private _view?: vscode.WebviewView;

	private writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;
	private _channel: vscode.OutputChannel = Output.channel();

	public docs:Array<[string, Array<string>]> = [];
	public examples:any;

	constructor(private readonly _extensionUri: vscode.Uri,)
    {

	 }

     public reload()
     {
        vscode.window.showInformationMessage("This feature is not implemented yet");
     }

	 public async resolveWebviewView( webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext,_token: vscode.CancellationToken,) 
	 {
		this._view = webviewView;

		this._view?.onDidChangeVisibility(e=>{

			if(this._view?.visible)
			{
			}
		});

		webviewView.webview.options = 
		{
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) 
            {
				case 'itemSelected':
					{
                        ExamplePanel.createOrShow(Configuration.context.extensionUri,data.value);
					}
					break;
				case 'docSelected':
					{
						DocumentPanel.createOrShowDoc(Configuration.context.extensionUri,data.value.folder, data.value.file);
					}
					break;					
			}
		});
	}

	private getExamples()
	{
		var categories:Array<string> = new Array<string>();

		//Get existing categories of examples
		var catInfoPath = Configuration.getWOWSDKPath()+'sdk/examples/categories.json';
		const cat = require(catInfoPath);

		for(var i=0;i<cat.categories.length;i++)
		{
			categories.push(cat.categories[i]);
		}

		//enumerate versions
		catInfoPath = Configuration.getWOWSDKPath()+'sdk/examples/';

		var versions:Array<string> = new Array<string>();
		if(fs.existsSync(catInfoPath)===true)
		{
			fs.readdirSync(catInfoPath).forEach(folder => 
				{
					versions.push(folder);
				});
		}

		//iterate through versions to collect all examples
		var examples: Map<string,Array<string>> = new Map<string,Array<string>>();
		var names: Map<string,string> = new Map<string,string>();

		for(var i=0;i<versions.length;i++)
		{
			for(var j=0;j<categories.length;j++)
			{
				var path = Configuration.getWOWSDKPath()+'sdk/examples/'+versions[i]+'/'+categories[j]+'/';

				if(fs.existsSync(path))
				{
					fs.readdirSync(path).forEach(exampleFolder => 
						{
							var key = categories[j]+'/'+exampleFolder;

							if(examples.has(key)===false)
							{
								examples.set(key, new Array<string>());
								examples.get(key)?.push(versions[i]);

								try
								{
									const info = require(path+'/'+exampleFolder+'/info.json');
									names.set(key,info.name);
								}
								catch(e)
								{
									names.set(key,"Unnamed Example "+exampleFolder);
								}
							}
							else
							{
								examples.get(key)?.push(versions[i]);
							}
						});
				}
			}
		}

		return {c:categories,e:examples,n:names};
	}

	private getDocumentation()
	{
		var topics:Array<[string, Array<string>]> = new Array<[string, Array<string>]>();
		
		var sourceDocs = this._extensionUri.fsPath+"/media/docs/";

		//fetch docs folder for topics
         if(fs.existsSync(sourceDocs)===true)
                {
                    fs.readdirSync(sourceDocs).forEach(folder => 
                        {
							topics.push([folder,new Array<string>()]);
                        });

					for(var i=0;i<topics.length;i++)
					{
						var path = sourceDocs+topics[i][0];

						if(fs.existsSync(path)===true)
						{
							fs.readdirSync(path).forEach(file => 
								{
									topics[i][1].push(file);
								});	
						}
					}
                }
		
		return topics;
	}

	private _getHtmlForWebview(webview: vscode.Webview) 
	{
		//get examples
		this.examples = this.getExamples();
		var categories:Array<string> = this.examples.c;
		var articles = this.examples.e;
		var names = this.examples.n;

		//get docs
		this.docs = this.getDocumentation();
	
		//setup web page
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'examplesview.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        const styleExamplesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'examples.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		var body:string = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${styleResetUri}" rel="stylesheet">
			<link href="${styleVSCodeUri}" rel="stylesheet">
			<link href="${styleMainUri}" rel="stylesheet">
			<link href="${styleExamplesUri}" rel="stylesheet">

			<title>Code Examples</title>
            <div>
                <ul id="myUL">
                    <li><span class="caret">Built-in Examples</span>
                        <ul class="nested">`;

						for(var i=0;i<categories.length;i++)
						{
							body+=`<li><span class="caret">${categories[i]}</span>
							   <ul class="nested">`;
							
							   articles.forEach((value: Array<string>, key: string) => 
							   {
									if(key.indexOf(categories[i]+'/')===0)
									{
										try
										{
											if(names.has(key))
											{
												var articleName = names.get(key);
												body+=`<li class="liitem" key="${key}">${articleName}</li>`;
											}
											else
											{
												body+=`<li class="liitem" key="${key}">Unnamed Article</li>`;
											}
										}
										catch(e){}
									}
							    });

							   body+=`</ul>
							   </li>`;
						}

                    body+=` </ul>
                    </li>      
					
                    <li><span class="caret">Online Examples</span>
                        <ul class="nested">
                        </ul>
                    </li>
                    <li><span class="caret">Documentation</span>
                        <ul class="nested">`;

					for(var i=0;i<this.docs.length;i++)
					{
						var topic = this.docs[i][0];

						body+=`<li><span class="caret">${topic}</span>
							   <ul class="nested">`;

						for(var j=0;j<this.docs[i][1].length;j++)
						{
							var item = this.docs[i][1][j];
							item = item.substring(0,item.length-3);

							body+=`<li class="liitem" file="${this.docs[i][1][j]}" folder="${topic}" doc="1">${item}</li>`;
						}

						body+=`</ul>
							   </li>`;
					}

					body+=`</ul>
					</li>
				</ul> 
            </div>
		</head>
		<body>
			<script nonce="${nonce}" src="${scriptUri}"></script>
		</body>
		</html>`;

		return body;
	}
}