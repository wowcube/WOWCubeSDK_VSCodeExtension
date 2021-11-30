import * as vscode from 'vscode';
import { getNonce } from "./getNonce";

import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { error } from 'console';
import { rejects } from 'assert';
import {Configuration} from './Configuration';
import { resolve } from 'path';

export class BTDeviceViewProvider implements vscode.WebviewViewProvider
{
	public static readonly viewType = 'WOWCubeSDK.btdeviceView';
	private _view?: vscode.WebviewView;
	private _busy:boolean;
	private devices:Array<object> = new Array();

	constructor(private readonly _extensionUri: vscode.Uri,)
    {
		this._busy = false;
	 }

     public reload()
     { 
		if(!this._busy)
		{
			this._view?.webview.postMessage({ type: 'beginDiscovery'});
			this._busy = true;

			this.doDeviceDiscovery();
		}
     }

	 public resolveWebviewView( webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext,_token: vscode.CancellationToken,) 
	 {
		this._view = webviewView;

		this._view?.onDidChangeVisibility(e=>{

			if(this._view?.visible)
			{
				this._loadeSavedDevices();	
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

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'buttonPressed':
				{
                    vscode.commands.executeCommand('WOWCubeSDK.scanDevices');
				}
				break;
				case 'manageButtonPressed':
				{
					vscode.commands.executeCommand('WOWCubeSDK.openDeviceDetails');
				}
				break;
				case 'deviceSelected':
					{
						Configuration.setCurrentDevice(data.value);
					}
					break;		
				case 'checkDeviceConnection':
				{
					this.doGetDeviceInfo(data.value.mac);
				}
				break;
			}
		});

		this._loadeSavedDevices();	
	}

	private _loadeSavedDevices()
	{
		var devices = Configuration.getLastDetectedDevices();
		this._view?.webview.postMessage({ type: 'endDiscovery',value: devices});

		var dev = Configuration.getCurrentDevice();
		if(dev!==null)
		{
			this._view?.webview.postMessage({ type: 'selectDevice',value: dev});
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) 
	{
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'btdeviceview.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
		const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleWaitUri}" rel="stylesheet">

				<title>Bluetooth Devices</title>
			</head>
			<body>
				<br/>
				<div>Please select WOWCube device from the list</div>
	
				<div id="debug"></div>
				<br/>
				<div class="wait" id="wait">
					<div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
				</div>
				<div class="visible" id="list">
					<ul class="bt-list" id="bt-list">
					</ul>
				</div>
				<br/>
				<button class="bt-scan-button">Scan For Paired Devices</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private async doGetDeviceInfo(mac:string): Promise<void>
	{
		return new Promise<void>((resolve) =>
		{
			var out:Array<string> = new Array();
			var err:boolean = false;
			var info:string = "";
			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getLoader()+'"';

			command+=" ci -f -a ";
			command+=mac;

			var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
			{
				if (error) 
				{
					resolve();
				}

				if (stderr && stderr.length > 0) 
				{
					out.push(stderr);
				}

				if (stdout && stdout.length > 0) 
				{
					out.push(stdout);
				}

				if(child.exitCode===0)
				{
					out.forEach(line=>{
						
						line = line.replace('\n','');

						if(line.indexOf('Error:')!==-1)
						{
							err = true;
						}

						if(line.indexOf('Build name')!==-1)
						{
							var l:string[] = line.split('\n');

							l.forEach(s=>{
								if(s.indexOf('Build name:')!==-1) {info = s;}
							});
						}
					});
				}
				else
				{
					err = true;
				}

				if(err)
					{ this._view?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:-1}} ); }
				else
					{ 
						this._view?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:1}} ); 

						if(info.length>0)
						{
							this._view?.webview.postMessage({ type: 'setDeviceInfo',value: {mac:mac,info:info}}); 
						}
					}


				resolve();
			});	
		});
	}
	private async doDeviceDiscovery(): Promise<void> 
    {
		return new Promise<void>((resolve) => 
        {	
			var out:Array<string> = new Array();

			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getLoader()+'"';

			command+=" dd";

			this.devices = [];

			var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
			{
				if (error) 
				{
					resolve();
				}

				if (stderr && stderr.length > 0) 
				{
					out.push(stderr);
				}

				if (stdout && stdout.length > 0) 
				{
					out.push(stdout);
				}

				if(child.exitCode===0)
				{
					out.forEach(line=>{
						
						line = line.replace('\n','');
						var i_n = line.indexOf('Name:');
						var i_m = line.indexOf('Mac:');

						if(i_n===0 && i_m!==-1)
						{
							var deviceName = line.substr(5,i_m-5-1);
							var deviceMac = line.substr(i_m+4);

							this.devices.push({name:deviceName, mac:deviceMac});
						}
					});
					
					Configuration.setLastDetectedDevices(this.devices);
				}
				else
				{
				}

				this._view?.webview.postMessage({ type: 'endDiscovery',value: this.devices});
				this._busy = false;

				resolve();
			});	
		});
	}
}