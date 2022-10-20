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
						//handle appIconBg
						if(typeof params.appIconBg!=='undefined')
						{
							if(typeof params.appIconBg.path!=='undefined')
							{
								if(params.appIconBg.path.length===0)
								{
									delete params.appIconBg;
								}
							}
						}
						this.updateTextDocument(document,params);
					}	   
				   }
				break;
				case 'save':
					{
						const text = document.getText();
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

		if(ind===-1)
		{
			ind = fn.lastIndexOf('\\');
		}

		var workspace:string = fn.substring(0,ind);
	
		if(Project.validateAssets(workspace,false))
		{
			const v1 = JSON.stringify(JSON.parse(document.getText()));
			const v2 = JSON.stringify(Project.Json);

			if(v1!==v2)
			{
				this.updateTextDocument(document, Project.Json); 
			}
		}

		const json = Project.Json;

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
					<div style="position: absolute;right: 20px;top: 0;font-size: 12px;">
					<!--<button id="reload_button" style="height:10px; width:80px;font-size:10px;">RELOAD</button>-->
					</div>
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
						let version:string = json.sdkVersion;
			
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
							body+=`<div class="negative" id="targetsdkwarn" style="display:block;margin-left: 185px;font-size:14px;">Application target SDK version ${version} is not installed.`;
						}
						else
						{
							body+=`<div class="negative" id="targetsdkwarn" style="display:none;margin-left: 185px;font-size:14px;">`;
						}

						body+=`</div>

						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Advanced Settings</strong></div>

						<div style="margin-top:0px;">
							<div id="appicont" style="display:inline-block;margin:10px;margin-left: 2px;margin-top:25px;font-size:14px;min-width:170px;">Cubeapp Application Icon</div>
							<input id="appicon" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.appIcon.path}"></input>
						</div>`;

						if(typeof json.appIconBg!== 'undefined')
						{
							if(typeof json.appIconBg.path !== 'undefined')
							{
								body+=`<div style="margin-top:0px;">
								<div id="appicontbg" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">Icon Background <i style="font-size:10px;">(optional)</i></div>
								<input id="appiconbg" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.appIconBg.path}"></input>
								</div>`;	
							}
							else
							{
								body+=`<div style="margin-top:0px;">
								<div id="appicontbg" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">Icon Background <i style="font-size:10px;">(optional)</i></div>
								<input id="appiconbg" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value=""></input>
								</div>`;	
							}
						}
						else
						{
							body+=`<div style="margin-top:0px;">
							<div id="appicontbg" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">Icon Background <i style="font-size:10px;">(optional)</i></div>
							<input id="appiconbg" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value=""></input>
							</div>`;		
						}


						body+=`<div style="margin-top:0px;">
						<div id="badget" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Application Badge</div>
						<select id="badge" class='selector' style="width:calc(100% - 200px);min-width:100px;">`;

							if(json.appFlags===0) {body+=`<option value="0" selected>None (default)</option>`;} else {body+=`<option value=0>None (default)</option>`;}
							if(json.appFlags===1) {body+=`<option value="1" selected>Demo</option>`;} else {body+=`<option value=1>Demo</option>`;}
							if(json.appFlags===2) {body+=`<option value="2" selected>Coming Soon</option>`;} else {body+=`<option value=2>Coming Soon</option>`;}

						body+=`</select>
						</div>`;

						if(json.language=='pawn')
						{
						body+=`<div style="margin-top:20px;">
							<div id="sourcefilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">PAWN Source File</div>
							<input id="sourcefile" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.sourceFile}"></input>
						</div>

						<div style="margin-top:0px;">
							<div id="scriptfilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">PAWN Object File</div>
							<input id="scriptfile" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.scriptFile}"></input>
						</div>`;
						}

						if(json.language=='cpp')
						{
						body+=`
						
						<div style="margin-top:20px;display:none;visibility:hidden;">
							<div id="sourcefilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;min-width:170px;">CPP Source File</div>
							<input id="sourcefile" value="${json.sourceFile}"></input>
						</div>

						<div style="margin-top:20px;">
							<div id="scriptfilet" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">WASM Object File</div>
							<input id="scriptfile" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.scriptFile}"></input>
						</div>
						
						<div style="margin-top:20px;">
						<i style="font-size:12px;float:right;">Attention! Please do not modify the following values unless you really know what you are doing</i>
						<br/>
						<div id="compilerflagst" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Compiler flags</div>
						<input id="compilerflags" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.projectOptions.cpp.flags}"></input>
						</div>

						<div style="margin-top:0px;">
						<div id="definest" style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;;min-width:170px;">Additional defines</div>
						<input id="defines" style="display:inline-block;width:calc(100% - 200px);min-width:100px;" value="${json.projectOptions.cpp.defines}"></input>
						</div>						
						`;
						}

						body+=`
						<input id="language_" style="display:none;visibility:hidden;" value="${json.language}"></input>
						<input id="interpreter_" style="display:none;wvisibility:hidden;" value="${json.interpreter}"></input>

						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Image Assets</strong></div>
						<div id="imageitems" class="items" style="width:(100% - 25px); margin-top:10px;padding:10px;min-width:700px;">
							
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

						for(var i=0;i<json.imageAssets.length;i++)
						{
							body+=`<div class="assetitem image">
							
								<div style="display:inline-block; min-width:25%;"> 
									<input id="imageassetalias${i}" class='imageassetalias' style="display:inline-block; width: calc(100% - 40px);" value="${json.imageAssets[i].alias}"></input>
								</div>
								<div id="imageassetpath${i}" style="display:inline-block; min-width:calc(75% - 130px);">${json.imageAssets[i].path} </div>
								<div style="display:inline-block; min-width:120px;"> 
									<select id='imageassetpixeldepth${i}' class='selector imagepixeldepth' tag='${i}' style="min-width:100px;">`;

									if(typeof json.imageAssets[i].encoding === 'undefined')
									{
										body+=`
										<option value="" selected>AUTO</option>
										<option value="RGB565">RGB 565</option>
										<option value="ARGB6666">ARGB 6666</option>
										<option value="ARGB8888">ARGB 8888</option>
										`;
									}
									else
									{
										if(json.imageAssets[i].encoding === 'RGB565')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" selected>RGB 565</option>
											<option value="ARGB6666">ARGB 6666</option>
											<option value="ARGB8888">ARGB 8888</option>
											`;											
										}

										if(json.imageAssets[i].encoding === 'ARGB6666')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" >RGB 565</option>
											<option value="ARGB6666" selected>ARGB 6666</option>
											<option value="ARGB8888">ARGB 8888</option>
											`;											
										}

										if(json.imageAssets[i].encoding === 'ARGB8888')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" >RGB 565</option>
											<option value="ARGB6666">ARGB 6666</option>
											<option value="ARGB8888" selected>ARGB 8888</option>
											`;											
										}
									}

									body+=`</select>
								</div>

							</div>`;
						}
						body+=`</div>

						<div style="display:inline-block;margin-left: 2px;margin-top:40px;font-size:14px;min-width:170px;"><strong>Sound Assets</strong></div>
						<div id="sounditems" class="items" style="width:(100% - 25px); margin-top:10px;padding:10px;min-width:700px;">
							
						<div style="padding:5px;">
							<div style="display:inline-block; min-width:25%;"> 
							Resource Identifier
							</div>

							<div style="display:inline-block; min-width:calc(75% - 130px);"> 
								Resource File Name
							</div>				
						</div>
						`;

						for(var i=0;i<json.soundAssets.length;i++)
						{
							body+=`<div class="assetitem sound">
							
								<div style="display:inline-block; min-width:25%;"> 
									<input id="soundassetalias${i}" class="soundassetalias" style="display:inline-block; width: calc(100% - 40px);" value="${json.soundAssets[i].alias}"></input>
								</div>
								<div id="soundassetpath${i}" style="display:inline-block; min-width:calc(75% - 130px);">${json.soundAssets[i].path}</div>
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

		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}
}