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
import { ExternalToolsPanel } from './ExternalToolsPanel';
import { ResourceStudioProvider } from './ResourceStudioProvider';

import {Configuration, InstallationProblem} from './Configuration';
import {Providers} from './Providers';

import * as fs from 'fs';
import * as path from 'path';

let buildTask: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) 
{	
	console.log('WOWCube SDK extension is loaded...');

	ResourceStudioProvider.register(context);
	
	await Configuration.init();
	Configuration.context = context;
	
	//initialize providers
	Providers.init(context.extensionUri);

	//register build task
	const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";

	const buildTaskProvider = new WOWCubeBuildTaskProvider(workspaceRoot);
	buildTask = vscode.tasks.registerTaskProvider(WOWCubeBuildTaskProvider.wowCubeBuildScriptType, buildTaskProvider);

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
			vscode.commands.registerCommand('WOWCubeSDK.openExternalTools', () => 
			{
				ExternalToolsPanel.createOrShow(context.extensionUri);
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

		//check the validity of installation
		var problem = Configuration.checkCurrentInstallation();

		if(problem!=InstallationProblem.None)
		{
			switch(problem)
			{
				case InstallationProblem.EmscriptedPresent:
					{
						vscode.window.showErrorMessage(
							"Currently installed version of  C++ Compiler support package for WOWCUbe SDK is not supported anymore and must be re-installed.",
							...["Manage Packages"]
						).then((answer)=>
						{
							if(answer==="Manage Packages")
							{
								vscode.commands.executeCommand('WOWCubeSDK.openExternalTools');
							}
						});
					}
				break;
				default:
					break;
			}
		}
		//check for updates when extension starts
		let check:string = Configuration.getAutoCheckForUpdates();
		if(check=='1')
		{
		Providers.settings.doCheckUpdate();
		}

		//Octavios
		//check if packed folder exists

		var tasks = await buildTaskProvider.provideTasks();
		const task = tasks?.find(
			t => t.definition.target === 'resources'
		);

		if(task)
		{
			await handleWorkspaceOpened(context,task);
		}
}

async function handleWorkspaceOpened(context: vscode.ExtensionContext, t:vscode.Task): Promise<void> 
{

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const workspaceRoot = workspaceFolder.uri.fsPath;

    const buildConfig = path.join(workspaceRoot,'wowcubeapp-build.json');

    if (!fs.existsSync(buildConfig))
        return;

    // This is a WOWCube project.

    const build_json = JSON.parse(fs.readFileSync(buildConfig, 'utf-8'));
    const packedFolder = path.join(workspaceRoot,build_json.appFolder,'art','packed');
    const newFile = path.join(packedFolder, 'new');

    if (fs.existsSync(newFile)) 
		{
			if (t) 
				{
					await vscode.tasks.executeTask(t);
					fs.unlinkSync(newFile);
				}
   		 }
}

// this method is called when your extension is deactivated
export function deactivate() 
{
	if (buildTask) 
	{
		buildTask.dispose();
	}
}