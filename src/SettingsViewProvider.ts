import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
import * as os from 'os';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import {Output} from "./Output";
import { Providers } from './Providers';
import { Version } from './Version';

export class SettingsViewProvider implements vscode.WebviewViewProvider
{
	public static readonly viewType = 'WOWCubeSDK.settingsView';
	private _view?: vscode.WebviewView;
	private checkingForUpdates:boolean = false;

	private writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;
	private _channel: vscode.OutputChannel = Output.channel();

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

				if(this.validateSDKPath(path)===false)
				{
					this._view.webview.postMessage({ type: 'pathError',value:true });
				}
				else
				{
					this._view.webview.postMessage({ type: 'pathError',value:false });
				}

				let version:string = Configuration.getCurrentVersion();
				this._view.webview.postMessage({type:'setVersion',value:version});
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
				case 'checkPath':
					{
						if(this.validateSDKPath(Configuration.getWOWSDKPath())===false)
						{
							webviewView.webview.postMessage({ type: 'pathError',value:true });
						}
						else
						{
							webviewView.webview.postMessage({ type: 'pathError',value:false });
						}
					}
					break;
				case 'pathChanged':
					{
						Configuration.setWOWSDKPath(data.value);	
						webviewView.webview.postMessage({ type: 'checkPath',value:true });
						Providers.examples.reload();
					}
					break;
				case 'versionChanged':
					{
						Configuration.setCurrentVersion(data.value);
	
						if(this.validateSDKPath(Configuration.getWOWSDKPath())===false)
						{
							webviewView.webview.postMessage({ type: 'pathError',value:true });
						}
						else
						{
							webviewView.webview.postMessage({ type: 'pathError',value:false });
						}

						Providers.examples.reload();

					}
					break;
				case 'buttonCheckForUpdatesPressed':
					{
						if(!this.checkingForUpdates)
						{
							this.checkingForUpdates = true;
							this.doCheckUpdate();
						}
					}
					break;
				case 'buttonPressed':
						{
							var p = os.platform();
							var canSelectFiles = false;
							var canSelectFolders = true;

							var title = 'Select WOWCube Development Kit Folder';

							switch(p)
							{
								case 'darwin': //mac
								{
									canSelectFiles = true;
									canSelectFolders = false;
									title ='Select WOWCube Development Kit Application';
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

										if(this.validateSDKPath(fileUri[0].fsPath+'/Contents'+Configuration.getSlash())===false)
										{
											this._view.webview.postMessage({ type: 'pathError',value:true });
										}
										else
										{
											this._view.webview.postMessage({ type: 'pathError',value:false });
										}
                                    }
                               }
                           });
							break;
						}
			}
		});
	}

	private refreshVersionSelector()
	{
		Configuration.reloadVersions();
		let versions = Configuration.getVersions();			
		let version:string = Configuration.getCurrentVersion();
		this._view?.webview.postMessage({ type: 'clearVersions',value:true });

		for(var i=0;i<versions.length;i++)
		{
			this._view?.webview.postMessage({ type: 'addVersion',value:versions[i] });
		}

		this._view?.webview.postMessage({ type: 'setVersion',value:version });
	}

	private async doCheckUpdate(): Promise<void> 
    {
		return new Promise<void>((resolve,reject) => 
        {
			var out:Array<string> = new Array();
			var err:boolean = false;
			var re = /(?<maj>\d{1,2})\.(?<min>\d{1,2})\.(?<build>\d{1,4})/g;

			this._channel.appendLine("Checking for updates...");
			this._channel.show(true);

			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getUpdater().cli+'"';

			var globals = Configuration.getWDKGlobals();

			if(globals===null)
			{
				this._channel.appendLine('Failed to complete the check, WOWCube Development Kit global parameters can not be read\r\n');
				this.closeEmitter.fire(0);
				resolve();
			}
			var currVersion = globals.currentVersion;
			var endpoint = globals.updateEndpoint;

			const cm = re.exec(currVersion);
			const currMaj = cm?.groups?.maj;
			const currMin = cm?.groups?.min;
			const currBuild = cm?.groups?.build;

			//check -cr 0.9.0 -cho -de https://support.cicloud.com.au:6666

			command+=" check -cr "+currVersion+" -cho -de "+endpoint;

			var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
			{
				if (error) 
				{
					//reject({ error, stdout, stderr });
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
                            
						if(line.indexOf('Error:')!==-1)
						{
							err = true;
						}
						else
						{
							var l:string[] = line.split('\n');							
							l.forEach(s=>
								{
								const match = re.exec(s);
								if(match!==null)
								{
									const aMaj = match?.groups?.maj;
									const aMin = match?.groups?.min;
									const aBuild = match?.groups?.build;

									const ver = aMaj+'.'+aMin+'.'+aBuild;

									const cmp = Version.compareWDK(currVersion,ver);

									if(cmp!==2)
									{
										if(cmp!==-1)
										{
											this._channel.appendLine("WOWCube Development Kit version "+currVersion+" is up to date");
										}
										else
										{
											this._channel.appendLine("WOWCube Development Kit current version is "+currVersion+", available version is "+ver);
											this.doUpdate();
										}
									}
									else
									{
										this._channel.appendLine('Failed to check for updates, version string format is incorrect.\r\n');
									}
								}
							});

						}
					});

					this.closeEmitter.fire(0);
					this.checkingForUpdates = false;
					resolve();
				}
				else
				{
					out.forEach(line=>{
						this._channel.appendLine(line);
					});

					this._channel.appendLine('Failed to check for updates.\r\n');
					this.closeEmitter.fire(0);	
					this.checkingForUpdates = false;
					resolve();
				}
			});	
		});
	}

	private async doUpdate(): Promise<void> 
    {
		return new Promise<void>((resolve,reject) => 
        {
			var out:Array<string> = new Array();
			var err:boolean = false;

			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getUpdater().ui+'"';

			var wdkPath = Configuration.getWOWSDKContainingFolder();
			var globals = Configuration.getWDKGlobals();

			if(globals===null)
			{
				this._channel.appendLine('Failed to complete the update, WOWCube Development Kit global parameters can not be read\r\n');
				this.closeEmitter.fire(0);
				resolve();
			}
			var currVersion = globals.currentVersion;
			var endpoint = globals.updateEndpoint;

			//check -cr 0.9.0 -chu -tf "/Applications" -de https://support.cicloud.com.au:6666

			command+=" check -cr "+currVersion+" -chu -tf \""+wdkPath+"\" -de "+endpoint;

			var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
			{
				if (error) 
				{
					//reject({ error, stdout, stderr });
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
					this._channel.appendLine('Done\r\n');
					this.closeEmitter.fire(0);

					this.checkingForUpdates = false;
					resolve();
				}
				else
				{
					out.forEach(line=>{
						this._channel.appendLine(line);
					});

					this._channel.appendLine('Failed to complete the update.\r\n');
					this.closeEmitter.fire(0);

					resolve();
				}
			});	
		});
	}

	private validateSDKPath(path:string)
	{		
        if(typeof(path)==='undefined') {path='';}

		if(path.length>0)
		{
			this.refreshVersionSelector();

			//Pawn
			var pawnpath = Configuration.getPawnPath();
			if(fs.existsSync(pawnpath)===false)
			{
				this._channel.appendLine("SDK Settigs Error: Path \""+pawnpath+"\" is invalid");
				this._channel.show(true);

				return false;
			}
			else
			{
				var exe = pawnpath+ Configuration.getPawnCC();
				if(fs.existsSync(exe)===false)
				{
					this._channel.appendLine("SDK Settigs Error: File "+exe+" does not exist");
					this._channel.show(true);

					return false;
				}
			}

			//let's assume if this folder exists, all subfolders for other languages exist too
			var includepath = Configuration.getWOWSDKPath()+'sdk/'+Configuration.getCurrentVersion()+'/pawn/include/';
			if(fs.existsSync(includepath)===false)
			{
				this._channel.appendLine("SDK Settigs Error: Path \""+includepath+"\" is invalid");
				this._channel.show(true);

				return false;
			}

			//Utils
			var utilspath = Configuration.getUtilsPath();
			if(fs.existsSync(utilspath)===false)
			{
				this._channel.appendLine("SDK Settigs Error: Path \""+utilspath+"\" is invalid");
				this._channel.show(true);

				return false;
			}
			else
			{
				var exe = utilspath+Configuration.getBuilder();
				if(fs.existsSync(exe)===false)
				{
					this._channel.appendLine("SDK Settigs Error: File "+exe+" does not exist");
					this._channel.show(true);

					return false;
				}

				exe = utilspath+Configuration.getLoader();
				if(fs.existsSync(exe)===false)
				{
					this._channel.appendLine("SDK Settigs Error: File "+exe+" does not exist");
					this._channel.show(true);

					return false;
				}
			}

			//Emulator
			var emulpath = Configuration.getEmulPath();
			if(fs.existsSync(emulpath)===false)
			{
				this._channel.appendLine("SDK Settigs Error: Path \""+emulpath+"\" is invalid");
				this._channel.show(true);

				return false;
			}
			else
			{
				var exe = emulpath+Configuration.getEmulator();
				if(fs.existsSync(exe)===false)
				{
					this._channel.appendLine("SDK Settigs Error: File "+exe+" does not exist");
					this._channel.show(true);

					return false;
				}
			}

			return true;
		}
		else
		{ 
			return true;
		}
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

		var path_valid = this.validateSDKPath(path);
		var err_class = "hidden";

		if(path_valid===false)
		{
			err_class = "visible";
		}

		var body:string = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${styleResetUri}" rel="stylesheet">
			<link href="${styleVSCodeUri}" rel="stylesheet">
			<link href="${styleMainUri}" rel="stylesheet">
			
			<title>Development Kit Settings</title>
		</head>
		<body>
			<br/>
			<div>Path To WOWCube Development Kit</div>
			<div>
			<input  class='sdk-path' id='sdkpath' value='${path}'></input>
			<button class='sdk-path-button'>...</button>
			</div>
			<div id='path_err' class="${err_class}">
				<div class="negative">Required files can not be found at that path!</div>
				<div class="negative">Please provide a path to <strong>WOWCube Development Kit version 2.5.0 alpha5</strong> or later</div>
				<div class="negative">and make sure you have selected supported SDK version.</div>
			</div>
			<br/>
			<div>SDK Version</div>
			<select id="versions" class='selector'>`;

			let versions = Configuration.getVersions();			
			let version:string = Configuration.getCurrentVersion();


			for(var i=0;i<versions.length;i++)
			{
				if(versions[i]!==version)
				{
					body+=`<option value="`+versions[i]+`">`+versions[i]+`</option>`;
				}
				else
				{
					body+=`<option value="`+versions[i]+`" selected>`+versions[i]+`</option>`;
				}
			}
			

			body+=`</select>

			<br/>
			<br/>
			<button class="share-adhoc-button">Check For Updates</button>

			<script nonce="${nonce}" src="${scriptUri}"></script>
		</body>
		</html>`;

		return body;
	}
}