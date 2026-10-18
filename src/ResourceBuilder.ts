import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as cp from 'child_process';
import { Configuration } from './Configuration';
import { Output } from './Output';
import { ResourceStudioProvider } from './ResourceStudioProvider';

export class ResourceBuilder
{
	private static builds:Map<string,Promise<void>> = new Map<string,Promise<void>>();

	public static register(context:vscode.ExtensionContext):void
	{
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async document =>
		{
			if(document.uri.scheme !== 'file' || path.basename(document.uri.fsPath) !== 'wowcubeapp-resources.json') { return; }
			const folder = path.dirname(document.uri.fsPath);
			try
			{
				// A save during compilation needs a follow-up build of the latest JSON.
				await this.builds.get(folder)?.catch(() => {});
				await this.build(folder, 'save');
			}
			catch(error)
			{
				const message = 'Resource compilation failed: '+(error instanceof Error ? error.message : String(error));
				Output.channel().appendLine('[resource-builder] '+message);
				Output.channel().show(true);
				void vscode.window.showErrorMessage(message);
			}
		}));
	}

	public static async build(workspace:string, reason:'save' | 'build' = 'build'):Promise<void>
	{
		const folder = path.resolve(workspace);
		const pending = this.builds.get(folder);
		if(pending) { return pending; }
		// Install the pending promise before saving a dirty document can fire a save event.
		const build = Promise.resolve().then(() => this.compile(folder, reason));
		this.builds.set(folder, build);
		try { await build; }
		finally { if(this.builds.get(folder) === build) { this.builds.delete(folder); } }
	}

	private static async compile(workspace:string, reason:'save' | 'build'):Promise<void>
	{
		const resources = path.join(workspace, 'wowcubeapp-resources.json');
		await ResourceStudioProvider.flushEdits(resources);
		const document = vscode.workspace.textDocuments.find(item => item.uri.scheme === 'file' && path.resolve(item.uri.fsPath) === resources);
		if(document?.isDirty && !await document.save()) { throw new Error('Unable to save the resource bundle before building.'); }
		let contents:Buffer;
		try { contents = await fs.promises.readFile(resources); }
		catch(error)
		{
			if((error as NodeJS.ErrnoException).code !== 'ENOENT') { throw error; }
			Output.channel().appendLine('[resource-builder] No resource bundle; skipping resource compilation.');
			return;
		}
		const hash = crypto.createHash('sha256').update(contents).digest('hex');
		const key = 'resourceBuilder:'+vscode.Uri.file(resources).toString();
		const state:vscode.Memento = Configuration.context.workspaceState;
		const channel = Output.channel();
		if(state.get<string>(key) === hash)
		{
			channel.appendLine('[resource-builder] Resources are up to date.');
			return;
		}
		const toolsPath = Configuration.getUtilsPath();
		if(!toolsPath) { throw new Error('Configure the WOWCube Development Kit path before building resources.'); }
		const tool = path.join(toolsPath, Configuration.getResourceBuilder());
		try { await fs.promises.access(tool, fs.constants.F_OK); }
		catch { throw new Error('Resource builder not found: '+tool+'. Install it in the SDK tools folder.'); }
		channel.appendLine('[resource-builder] '+(reason === 'save' ? 'Resource file saved. Building resources...' : 'Building resources...'));
		channel.show(true);
		await new Promise<void>((resolve, reject) =>
		{
			const child = cp.spawn(tool, [resources, '--build', path.join(workspace, 'wowcubeapp-build.json')], {cwd:workspace, windowsHide:true});
			child.stdout?.on('data', data => channel.append(data.toString()));
			child.stderr?.on('data', data => channel.append(data.toString()));
			child.on('error', reject);
			child.on('close', code => code === 0 ? resolve() : reject(new Error('Resource compilation failed with exit code '+code+'.')));
		});
		const current = await fs.promises.readFile(resources);
		if(!contents.equals(current) || document?.isDirty)
		{
			throw new Error('Resource JSON changed during resource compilation. Build again before compiling the app.');
		}
		await state.update(key, hash);
		channel.appendLine('[resource-builder] Resources built successfully.');
	}
}
