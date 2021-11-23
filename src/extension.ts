// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
//import { WebAppPanel } from './WebAppPanel';
import { WizardPanel } from './WizardPanel';
import { WizardViewProvider } from './WizardViewProvider';
import { BTDeviceViewProvider } from './BTDeviceViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';
import { WOWCubeBuildTaskProvider } from './WOWCubeBuildTaskProvider';
import {Configuration} from './Configuration';

let buildTask: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) 
{	
	console.log('WOWCube SDK extension is loaded...');
	
	Configuration.init();

	const wizard = new WizardViewProvider(context.extensionUri);
	const btdevices = new BTDeviceViewProvider(context.extensionUri);
	const settings = new SettingsViewProvider(context.extensionUri);

	const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
	buildTask = vscode.tasks.registerTaskProvider(WOWCubeBuildTaskProvider.wowCubeBuildScriptType, new WOWCubeBuildTaskProvider(workspaceRoot));

	context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(WizardViewProvider.viewType, wizard));

	context.subscriptions.push(
				vscode.window.registerWebviewViewProvider(BTDeviceViewProvider.viewType, btdevices));

	context.subscriptions.push(
					vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, settings));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.scanDevices', () => 
		{
			btdevices.reload();
		}));
/*
	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.clearColors', () => 
		{
			provider.clearColors();
		}));
	*/

		context.subscriptions.push(
			vscode.commands.registerCommand('WOWCubeSDK.openWizard', () => 
			{
				WizardPanel.createOrShow(context.extensionUri);
			}));
}

// this method is called when your extension is deactivated
export function deactivate() 
{
	if (buildTask) 
	{
		buildTask.dispose();
	}
}
/*
class ColorsViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'WOWCubeSDK.colorsView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
				case 'buttonPressed':
						{
							vscode.window.showInformationMessage(`${data.value}`);
							break;
						}

			}
		});
	}

	public addColor() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'addColor' });
		}
	}

	public clearColors() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'clearColors' });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Cat Colors</title>
			</head>
			<body>
				<div>Thryl was here</div>
				<ul class="color-list">
				</ul>
				<button class="add-color-button">Add Color</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}*/