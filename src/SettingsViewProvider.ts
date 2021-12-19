import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';

export class SettingsViewProvider implements vscode.WebviewViewProvider
{
	public static readonly viewType = 'WOWCubeSDK.settingsView';
	private _view?: vscode.WebviewView;

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
				var path = Configuration.getWOWSDKPath();
				if(typeof(path)==='undefined') path='';
				this._view.webview.postMessage({ type: 'folderSelected',value:path });
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
			switch (data.type) {
				case 'pathChanged':
					{
						Configuration.setWOWSDKPath(data.value);
					}
					break;
				case 'buttonPressed':
						{
							var p = os.platform();
							var canSelectFiles = false;
							var canSelectFolders = true;

							var title = 'Select WOWCube SDK Folder';

							switch(p)
							{
								case 'darwin': //mac
								{
									canSelectFiles = true;
									canSelectFolders = false;
									title ='Select WOWCube SDK Application';
								}
								break;

								case 'linux':
								case 'win32': //windows
								default:
								break;
							}

                            const options: vscode.OpenDialogOptions = {
                                canSelectMany: false,
                                openLabel: title,
                                canSelectFiles: canSelectFiles,
                                canSelectFolders: canSelectFolders
                            };
                           
                           vscode.window.showOpenDialog(options).then(fileUri => 
                            {
                               if (fileUri && fileUri[0]) 
                               {
                                    if (this._view) 
                                    {
                                        //save configuration
										if(canSelectFiles===false)
										{
                                        	Configuration.setWOWSDKPath(fileUri[0].fsPath+Configuration.getSlash());
											this._view.webview.postMessage({ type: 'folderSelected',value:fileUri[0].fsPath+Configuration.getSlash() });
										}
										else
										{
											Configuration.setWOWSDKPath(fileUri[0].fsPath+'/Contents'+Configuration.getSlash());
											this._view.webview.postMessage({ type: 'folderSelected',value:fileUri[0].fsPath+'/Contents'+Configuration.getSlash() });
										}

                                    }
                               }
                           });
							break;
						}
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) 
	{
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'settingsview.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

        var path = Configuration.getWOWSDKPath();
        if(typeof(path)==='undefined') path='';

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>SDK Settings</title>
			</head>
			<body>
				<br/>
				<div>SDK Path</div>
                <div>
                <input  class='sdk-path' id='sdkpath' value='${path}'></input>
				<button class='sdk-path-button'>...</button>
                </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}