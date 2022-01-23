import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { error } from 'console';
import { rejects } from 'assert';
import {Configuration} from './Configuration';
import {Providers} from './Providers';
import {Output} from './Output';

interface WOWCubeBuildTaskDefinition extends vscode.TaskDefinition 
{
	/**
	 * The build action. Should be either 'complile' or 'build'.
	 */
	action: string;

	/**
	 * Specifies build target. Should be either 'emulator' or 'device'
	 */
	target?: string;
}

export class WOWCubeBuildTaskProvider implements vscode.TaskProvider 
{
	static wowCubeBuildScriptType = 'wowsdkbuild';
	private tasks: vscode.Task[] | undefined;

	// We use a CustomExecution task when state needs to be shared across runs of the task or when 
	// the task requires use of some VS Code API to run.
	// If you don't need to share state between runs and if you don't need to execute VS Code API in your task, 
	// then a simple ShellExecution or ProcessExecution should be enough.
	// Since our build has this shared state, the CustomExecution is used below.
	private sharedState: string | undefined;

	constructor(private workspaceRoot: string) { }

	public async provideTasks(): Promise<vscode.Task[]> 
    {
		return this.getTasks();
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined 
    {
		const action: string = _task.definition.action;
		if (action) 
		{
			const definition: WOWCubeBuildTaskDefinition = <any>_task.definition;
			return this.getTask(definition.action, definition.flags ? definition.flags : [], definition);
		}
		return undefined;
	}

	private getTasks(): vscode.Task[] 
    {
		if (this.tasks !== undefined) 
        {
			return this.tasks;
		}

		this.tasks = [];
		this.tasks!.push(this.getTask('compile',''));
		this.tasks!.push(this.getTask('build', 'emulator'));
		this.tasks!.push(this.getTask('build', 'device'));

		return this.tasks;
	}

	private getTask(action: string, target: string, definition?: WOWCubeBuildTaskDefinition): vscode.Task 
    {
		if (definition === undefined) 
        {
			definition = 
            {
				type: WOWCubeBuildTaskProvider.wowCubeBuildScriptType,
				action,
				target
			};
		}
		return new vscode.Task(definition, vscode.TaskScope.Workspace, `${action} ${target}`,
			WOWCubeBuildTaskProvider.wowCubeBuildScriptType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => 
            {
				// When the task is executed, this callback will run. Here, we setup for running the task.
				return new WOWCubeBuildTaskTerminal(this.workspaceRoot, action, target, () => this.sharedState, (state: string) => this.sharedState = state);
			}));
	}
}

class WOWCubeBuildTaskTerminal implements vscode.Pseudoterminal 
{
	private writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;

	private fileWatcher: vscode.FileSystemWatcher | undefined;

	private workspace:string;
	private _channel: vscode.OutputChannel = Output.channel();

	constructor(private workspaceRoot: string, private action: string, private target: string, private getSharedState: () => string | undefined, private setSharedState: (state: string) => void) 
    {
		this.workspace = workspaceRoot;
	}

	open(initialDimensions: vscode.TerminalDimensions | undefined): void 
    {
		/*
		// At this point we can start using the terminal.
		if (this.flags.indexOf('watch') > -1) 
		{
			const pattern = path.join(this.workspaceRoot, 'customBuildFile');
			this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
			this.fileWatcher.onDidChange(() => this.doBuild());
			this.fileWatcher.onDidCreate(() => this.doBuild());
			this.fileWatcher.onDidDelete(() => this.doBuild());
		}
		*/	

		this.doCompile(this.action);
	}

	close(): void 
    {
		// The terminal has been closed. Shutdown the build.
		if (this.fileWatcher) 
        {
			this.fileWatcher.dispose();
		}
	}

	private printOutput(data:string) 
	{
		this._channel.appendLine(data);
		this._channel.show(true);
	}

	private doCompile(action:string): Promise<void> 
    {
		return new Promise<void>((resolve,reject) => 
        {
			this._channel.appendLine('Compiling cub file...\r\n');

			const build_json = require(this.workspace+'/wowcubeapp-build.json');

			this._channel.appendLine('Project name: '+build_json.name);
			this._channel.appendLine('Project version: '+build_json.version+'\r\n');

			var pawnpath = Configuration.getPawnPath();
			var command = '"'+pawnpath+ Configuration.getPawnCC()+'"';

			var sourcefile = this.workspace+'/'+build_json.sourceFile;

			var currDir = this.workspace+"\\src";	

			var srcdir:string = build_json.sourceFile;
			var pos = srcdir.indexOf('/');
			if(pos!==-1)
			{
				if(srcdir.substring(0,pos)!=='src')
				{
					this._channel.appendLine('NOTE: Non-standard source files folder name is used. Please consider using `src` as a name of the folder.\r\n');
				}
				currDir = this.workspace+"\\"+srcdir.substring(0,pos);
			}

			var builddir:string = this.workspace+"/binary";
			pos = build_json.scriptFile.indexOf('/');
			if(pos!==-1)
			{
				if(srcdir.substring(0,pos)!=='src')
				{
					this._channel.appendLine('NOTE: Non-standard intermediary binary files folder name is used. Please consider using `binary` as a name of the folder.\r\n');
				}

				builddir = this.workspace+"/"+build_json.scriptFile.substring(0,pos);
			}

			var destfile = this.workspace+'/'+build_json.scriptFile;

			this.makeDirSync(builddir);

			//-X$100000 -d0 -O3 -v2 -i../PawnLibs -DSource ladybug.pwn

			var includepath = Configuration.getWOWSDKPath()+'sdk/'+Configuration.getCurrentVersion()+'/pawn/include/';

			if(Configuration.isWindows())
			{
				//This is weird, but it seems that pawncc treats include directories differently on different platforms
				//On windows, it auto-searches for "standard" include folder on level up bin/ folder
				//On mac, it does the opposite - auto-searches for inc files in source folder, but does not know where the "standard" folder is 
				
				includepath=currDir;
			}

			command+=' -X100000 -d0 -O3 -v2 -i"'+includepath+'" ';
			command+='-o"'+destfile+'" ';
			command+='"'+sourcefile+'"';

			if(pawnpath.length===0)
			{
				vscode.window.showErrorMessage("WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed and up to date"); 
				this._channel.appendLine('WOWCube SDK path is not set or operating system is not supported.\r\n\r\n');

				this.closeEmitter.fire(0);
				resolve();
				return;
			}

			var child:cp.ChildProcess = cp.exec(command, { cwd: ""}, (error, stdout, stderr) => 
			{
				if (error) 
				{
					//reject({ error, stdout, stderr });
				}
				if (stderr && stderr.length > 0) 
				{
					this._channel.appendLine(stderr);
					this._channel.show(true);
				}

				if (stdout && stdout.length > 0) 
				{
					this._channel.appendLine(stdout);
					this._channel.show(true);
				}

				const date = new Date();
				this.setSharedState(date.toTimeString() + ' ' + date.toDateString());

				if(child.exitCode===0)
				{
					this._channel.appendLine('File compiled successfully.\r\n');

					if(action==='compile')
					{
						this.closeEmitter.fire(0);
						resolve();
					}
					else
					{
						this.doBuild(this.target);
					}
				}
				else
				{
					this._channel.appendLine('Failed to compile.\r\n');

					this.closeEmitter.fire(0);
					resolve();
				}
			});	
		});
	}

	private async doBuild(target:string): Promise<void> 
    {
		return new Promise<void>((resolve,reject) => 
        {
			//this.writeEmitter.fire('Building cub file...\r\n');
			this._channel.appendLine('Building cub file...\r\n');

			const build_json = require(this.workspace+'/wowcubeapp-build.json');

			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getBuilder()+'"';

			const project = '"'+this.workspace+'/wowcubeapp-build.json"';	
			const output = '"'+this.workspace+'/binary/'+build_json.name+'.cub"';

			command+=" "+project+" "+output;

			var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
			{
				if (error) 
				{
					//reject({ error, stdout, stderr });
				}
				if (stderr && stderr.length > 0) 
				{
					this._channel.appendLine(stderr);
					this._channel.show(true);
				}

				if (stdout && stdout.length > 0) 
				{
					this._channel.appendLine(stdout);
					this._channel.show(true);
				}

				const date = new Date();
				this.setSharedState(date.toTimeString() + ' ' + date.toDateString());

				if(child.exitCode===0)
				{
					//this.writeEmitter.fire('Build complete.\r\n\r\n');
					this._channel.appendLine('Build complete.\r\n');

					if(target==='emulator')
					{
						this.doRunInEmulator(build_json.name+'.cub');
					}
					else
					{
						this.doRunOnDevice(build_json.name+'.cub');
					}
				}
				else
				{
					this._channel.appendLine('Failed to build.\r\n');

					this.closeEmitter.fire(0);
					resolve();
				}
			});	
		});
	}

	private async doRunOnDevice(cubename:string): Promise<void>
	{
		return new Promise<void>((resolve,reject) => 
        {
			//this.writeEmitter.fire('Running app on selected WOWCube device...\r\n');
			this._channel.appendLine('Running app on selected WOWCube device...\r\n');

			if(!this.createVirtualFlashDir(cubename))
			{
				this._channel.appendLine('Failed to run in emulator.\r\n');
				this.closeEmitter.fire(0);
				resolve();
			}

			var device = Configuration.getCurrentDevice();

			if(device===null)
			{
				this._channel.appendLine('Failed to run on device, no device selected.\r\n');
				this.closeEmitter.fire(0);
				resolve();
			}
			
			if(Configuration.isDeviceBusy(device.mac)===true)
			{
				this._channel.appendLine('Failed to run on device, device is busy. Please wait before current operation is finished and try again.\r\n');
				this.closeEmitter.fire(0);
				resolve();
			}

			var utilspath = Configuration.getUtilsPath();
			var command = '"'+utilspath+Configuration.getLoader()+'"';
			const source = this.workspace+'/binary/'+cubename;

			command+=" up -p ";
			command+='"'+source+'"';
			command+=" -a ";
			command+=device.mac;
			command+=" -r";

			Providers.btdevices.showWait(true);
			Configuration.setDeviceBusy(device.mac,true);
			var child:cp.ChildProcess = cp.exec(command, { cwd: ""}, (error, stdout, stderr) => 
			{
				Configuration.setDeviceBusy(device.mac,false);
				Providers.btdevices.showWait(false);

				if(child.exitCode===0)
				{
					Providers.btdevices.setDeviceStatus(device.mac,1);

					this._channel.appendLine('Done.\r\n');

					this.closeEmitter.fire(0);
					resolve();
				}
				else
				{
					this._channel.appendLine('Failed to start cubelet application on selected device.\r\n');

					this.closeEmitter.fire(0);
					resolve();
				}
			});	

			var that = this;

			child?.stdout?.on('data', function(data) 
			{
				that._channel.appendLine(data);
				that._channel.show(true);
			});

			child?.stderr?.on('data', function(data) 
			{
				that._channel.appendLine(data);
				that._channel.show(true);
			});
			
		});
	}

	private async doRunInEmulator(cubename:string): Promise<void>
	{
		return new Promise<void>((resolve,reject) => 
        {
			this._channel.appendLine('Running app in WOWCube emulator...\r\n');

			//"/Applications/WOWCube SDK.app/Contents/MacOS//bin//wowcube-sdk" --run --firmware-globals "FLASH_DIR=/Users/apple 1/Test/y5/binary" --firmware-build --firmware-cubelet "y5.cub" 

			var utilspath = Configuration.getEmulPath();
			var command = '"'+utilspath+Configuration.getEmulator()+'"';

			const source = this.workspace+'/binary/'+cubename;

			const output = '--project-run "'+source+'" --run';
			command+=" "+output;

			cp.exec(command, { cwd: "" });

			this._channel.appendLine('Done.\r\n');

			this.closeEmitter.fire(0);
			resolve();
		});
	}

	makeDirSync(dir: string) 
	{
		if (fs.existsSync(dir)) {return;}
		if (!fs.existsSync(path.dirname(dir))) 
		{
			this.makeDirSync(path.dirname(dir));
		}
		fs.mkdirSync(dir);
	}

	private createVirtualFlashDir(cubename:string)
	{
		var ret:boolean = true;
		try
		{
			const source = this.workspace+'/binary/'+cubename;
			const flashdir = this.workspace+'/flash';
			const dest = flashdir+'/0/games/'+cubename;

			this.makeDirSync(flashdir);
			this.makeDirSync(flashdir+'/0');
			this.makeDirSync(flashdir+'/0/games');

			fs.copyFileSync(source,dest);
		}
		catch(error)
		{
			this._channel.appendLine('Failed to copy '+cubename+' file to flash directory:'+error+'\r\n');
			ret=false;
		}

		return ret;
	}

	private async exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> 
	{
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => 
    {
		cp.exec(command, options, (error, stdout, stderr) => 
        {
			if (error) 
            {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}
}