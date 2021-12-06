// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getNonce } from "./getNonce";
//import { WebAppPanel } from './WebAppPanel';
import { WizardPanel } from './WizardPanel';
import { DeviceDetailsPanel } from './DeviceDetailsPanel';
import { WizardViewProvider } from './WizardViewProvider';
import { BTDeviceViewProvider } from './BTDeviceViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';
import { WOWCubeBuildTaskProvider } from './WOWCubeBuildTaskProvider';
import {Configuration} from './Configuration';

let buildTask: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) 
{	
	console.log('WOWCube SDK extension is loaded...');
	
	await Configuration.init();

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

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.openWizard', () => 
		{
			WizardPanel.createOrShow(context.extensionUri);
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.openDeviceDetails', () => 
		{
			DeviceDetailsPanel.createOrShow(context.extensionUri);
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