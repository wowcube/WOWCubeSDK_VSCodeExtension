import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { error } from 'console';
import { rejects } from 'assert';
import {Configuration} from './Configuration';
import { Project } from './Project';
import {Providers} from './Providers';
import {Output} from './Output';

 export class WOWCubeProjectProvider implements vscode.CustomTextEditorProvider {

    public static currentPanel: WOWCubeProjectProvider | undefined;
	public static readonly viewType = 'WOWCubeSDK.projectPanel';
    private _view?: vscode.WebviewView;

    private writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;
	private _channel: vscode.OutputChannel = Output.channel();

	constructor(private readonly context: vscode.ExtensionContext) 
    {

    }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(document: vscode.TextDocument,webviewPanel: vscode.WebviewPanel,_token: vscode.CancellationToken
	): Promise<void> 
	 {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview,document);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(message => {
			switch (message.type) 
			{
			   case 'error':
				   {
					this._channel.appendLine('Project settings error: '+message.value);
					vscode.window.showErrorMessage(message.value); 
				   }
			   break;
			   case 'warn':
				   vscode.window.showWarningMessage(message.value); 
			   break;
			   case 'update':
				   {
					var params = message.value;

					if(params!==null)
					{
						this.updateTextDocument(document,params);
					}	   
				   }
				break;
				case 'save':
					{
						document.save();
					}
					return;
			}
		});

		updateWebview();
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview,document: vscode.TextDocument): string 
    {
		var fn:String = document.fileName;
		var ind = fn.lastIndexOf('/');
		var workspace:string = fn.substring(0,ind);

		Project.validateAssets(workspace);

		const json = this.getDocumentAsJson(document);

		// Local path to script and css for the webview
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'projectview.js'));

		const nonce = getNonce();

		var body:string = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>WOWCube Cubeapp Project Settings</title>
			</head>
			<body>				
				<script nonce="${nonce}" src="${scriptUri}"></script>
                <div style="padding:0px;">
                	<div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">Cubeapp Project Settings</div>                    
                    <div class="separator"></div>

					<div class="view" style="top:65px;">

						<div style="display:inline-block;margin-left: 2px;font-size:14px;min-width:165px;"><strong>Basic Settings</strong></div>

						<div style="margin-top:0px;">
							<div id="appnamet" class="" style="display:inline-block;margin:10px;margin-left: 2px;margin-top:25px;font-size:14px;min-width:170px;">Application Name</div>
							<input id="appname" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.name}"></input>
						</div>

						<div style="margin-top:0px;">
							<div id="appversiont" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Application Version</div>
							<input id="appversion" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.version}"></input>
						</div>

						<div style="margin-top:0px;">
						<div id="targetsdkt" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Target SDK Version</div>
						<select id="targetsdk" class='selector' style="width:calc(100% - 200px);min-width:100px;">`;

						let versions = Configuration.getVersions();			
						let version:string = json.sdkVersion;//Configuration.getCurrentVersion();
			
						var versionFound:boolean = false;

						for(var i=0;i<versions.length;i++)
						{
							if(versions[i]!==version)
							{
								body+=`<option value="`+versions[i]+`">`+versions[i]+`</option>`;
							}
							else
							{
								body+=`<option value="`+versions[i]+`" selected>`+versions[i]+`</option>`;
								versionFound = true;
							}
						}

						body+=`</select>`;

						if(!versionFound)
						{
						body+=`<div class="negative" style="display:block;margin-left: 185px;font-size:14px;">Application target SDK version ${version} is not installed.`;
						}

						body+=`</div>

						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Advanced Settings</strong></div>

						<div style="margin-top:0px;">
							<div id="appicont" style="display:inline-block;margin:10px;margin-left: 2px;margin-top:25px;font-size:14px;min-width:170px;">Cubeapp Application Icon</div>
							<input id="appicon" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.appIcon.path}"></input>
						</div>

						<div style="margin-top:0px;">
							<div id="sourcefilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">PAWN Source File</div>
							<input id="sourcefile" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.sourceFile}"></input>
						</div>

						<div style="margin-top:0px;">
							<div id="scriptfilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">PAWN Object File</div>
							<input id="scriptfile" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.scriptFile}"></input>
						</div>
						<!--
						<div style="margin-top:0px;">
							<div id="imagedirt" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Image Resource Directory</div>
							<input id="imagedir" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.imageAssetsDir}"></input>
						</div>

						<div style="margin-top:0px;">
							<div id="sounddirt" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Sound Resource Directory</div>
							<input id="sounddir" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.soundAssetsDir}"></input>
						</div>
						-->
						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Image Assets</strong></div>
						<div class="items" style="width:(100% - 25px); margin-top:10px;padding:10px;min-width:700px;">
							
						<div style="padding:5px;">
							<div style="display:inline-block; min-width:25%;"> 
							Resource Identifier
							</div>

							<div style="display:inline-block; min-width:calc(75% - 130px);"> 
								Resource File Name
							</div>

							<div style="display:inline-block; min-width:120px;"> 
								Image Pixel Depth
							</div>						
						</div>
						`;

						for(var i=0;i<0;i++)
						{
							body+=`<div class="assetitem">
							
								<div style="display:inline-block; min-width:25%;"> 
									<input id="imagedir" style="display:inline-block; width: calc(100% - 20px);" value="NIKITA"></input>
								</div>
								<div style="display:inline-block; min-width:calc(75% - 130px);"> DDD </div>
								<div style="display:inline-block; min-width:120px;"> 
									<select class='selector' style="min-width:100px;">
										<option value="-1" selected>AUTO</option>
										<option value="0">RGB 565</option>
										<option value="1">ARGB 6666</option>
									</select>
								</div>

							</div>`;
						}
						body+=`</div>

						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Sound Assets</strong></div>
						<div class="items" style="width:(100% - 25px); margin-top:10px;padding:10px;min-width:700px;">
							
						<div style="padding:5px;">
							<div style="display:inline-block; min-width:25%;"> 
							Resource Identifier
							</div>

							<div style="display:inline-block; min-width:calc(75% - 130px);"> 
								Resource File Name
							</div>				
						</div>
						`;

						for(var i=0;i<0;i++)
						{
							body+=`<div class="assetitem">
							
								<div style="display:inline-block; min-width:25%;"> 
									<input id="imagedir" style="display:inline-block; width: calc(100% - 20px);" value="NIKITA"></input>
								</div>
								<div style="display:inline-block; min-width:calc(75% - 130px);"> DDD </div>
							</div>`;
						}

						body+=`</div>
					</div>
				</div>

				<button id="save_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">SAVE</button>
                </div>
			</body>
			</html>`;

			return body;
	}

	/**
	 * Try to get a current document as json text.
	 */
	private getDocumentAsJson(document: vscode.TextDocument): any 
    {
		const text = document.getText();
		if (text.trim().length === 0) {
			return {};
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, json: any) 
    {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}
}