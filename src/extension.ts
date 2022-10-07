// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getNonce } from "./getNonce";

import { WizardPanel } from './WizardPanel';
import { AdHocPanel } from './AdHocPanel';
import { DeviceDetailsPanel } from './DeviceDetailsPanel';
import { WizardViewProvider } from './WizardViewProvider';
import { BTDeviceViewProvider } from './BTDeviceViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';
import { ExamplesViewProvider } from './ExamplesViewProvider';
import { WOWCubeBuildTaskProvider } from './WOWCubeBuildTaskProvider';
import { WOWCubeProjectProvider } from './WOWCubeProjectProvider';
import {Configuration} from './Configuration';
import {Providers} from './Providers';

let buildTask: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) 
{	
	console.log('WOWCube SDK extension is loaded...');
	
	await Configuration.init();
	Configuration.context = context;
	
	//initialize providers
	Providers.init(context.extensionUri);

	//register build task
	const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
	buildTask = vscode.tasks.registerTaskProvider(WOWCubeBuildTaskProvider.wowCubeBuildScriptType, new WOWCubeBuildTaskProvider(workspaceRoot));

	//add subscriptions
	context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(WizardViewProvider.viewType, Providers.wizard));

	context.subscriptions.push(
				vscode.window.registerWebviewViewProvider(BTDeviceViewProvider.viewType, Providers.btdevices));

	context.subscriptions.push(
					vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, Providers.settings));

	context.subscriptions.push(
						vscode.window.registerWebviewViewProvider(ExamplesViewProvider.viewType, Providers.examples));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.scanDevices', () => 
		{
			if(Configuration.isLinux())
			{
				vscode.window.showWarningMessage("Feature is not supported on this platform!");  
				return;
			}
			
			Providers.btdevices.reload();
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.openWizard', () => 
		{
			WizardPanel.createOrShow(context.extensionUri);
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.openAdHocSharing', () =>
		{
			AdHocPanel.createOrShow(context.extensionUri);
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('WOWCubeSDK.openDeviceDetails', () => 
		{
			if(Configuration.isLinux())
			{
				vscode.window.showWarningMessage("Feature is not supported on this platform!");  
				return;
			}

			DeviceDetailsPanel.createOrShow(context.extensionUri);
		}));	

		context.subscriptions.push(vscode.window.registerCustomEditorProvider(WOWCubeProjectProvider.viewType, Providers.project));

}

// this method is called when your extension is deactivated
export function deactivate() 
{
	if (buildTask) 
	{
		buildTask.dispose();
	}
}