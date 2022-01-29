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
		this.docs = this.getDocumentation();

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
                        <ul class="nested">
                            <li><span class="caret">Basics</span>
                            <ul class="nested">
                                <li class="liitem" key="1">Example 1</li>
                                <li class="liitem" key="2">Example 2</li>
                                <li class="liitem" key="3">Example 3</li>
                                <li class="liitem" key="4">Example 4</li>
                            </ul>
                            </li>
                        </ul>
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