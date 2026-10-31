import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';
import { Configuration } from './Configuration';
import { Output } from './Output';

export interface BuildTools
{
	cmake?:string;
	env:NodeJS.ProcessEnv;
	issues:string[];
}

export class BuildPrerequisites
{
	private static async file(filename:string):Promise<boolean>
	{
		return fs.promises.stat(filename).then(stat => stat.isFile(), () => false);
	}

	private static async directories(folder:string):Promise<string[]>
	{
		try { return (await fs.promises.readdir(folder, {withFileTypes:true})).filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => path.join(folder, entry.name)); }
		catch { return []; }
	}

	private static async execute(file:string, args:string[], env:NodeJS.ProcessEnv):Promise<string>
	{
		return new Promise((resolve, reject) => cp.execFile(file, args, {env, windowsHide:true, timeout:10000, maxBuffer:1024*1024}, (error, stdout, stderr) =>
		{
			if(error) { reject(new Error(String(stderr || error.message).trim())); }
			else { resolve(String(stdout).trim()); }
		}));
	}

	public static async check(target:'device' | 'simulator'):Promise<BuildTools>
	{
		const platform = os.platform();
		const windows = platform === 'win32';
		const delimiter = windows ? ';' : ':';
		const env = {...process.env};
		const environment = (name:string) => env[windows ? Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase()) || name : name];
		const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
		if(windows) { for(const key of Object.keys(env)) { if(key !== pathKey && key.toLowerCase() === 'path') { delete env[key]; } } }
		const configured = Configuration.getBuildToolPaths();
		const sdkTools = Configuration.getUtilsPath();
		const prefixes = [...configured, sdkTools];
		const programFiles = [environment('ProgramFiles'), environment('ProgramFiles(x86)')].filter((value):value is string => !!value);
		if(windows)
		{
			prefixes.push(...programFiles.map(folder => path.join(folder, 'CMake')));
			for(const folder of programFiles)
			{
				const roots = (await BuildPrerequisites.directories(folder)).filter(entry => /(?:arm.*(?:gnu|gcc)|gnu.*arm|ninja)/i.test(path.basename(entry)));
				prefixes.push(...roots, ...(await Promise.all(roots.map(root => BuildPrerequisites.directories(root)))).flat());
				prefixes.push(...await BuildPrerequisites.directories(path.join(folder, 'Arm GNU Toolchain')));
			}
			const localAppData = environment('LOCALAPPDATA');
			if(localAppData) { prefixes.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links')); }
		}
		else
		{
			prefixes.push('/opt/homebrew', '/usr/local', '/usr', '/Applications/CMake.app/Contents');
			for(const folder of ['/Applications/ArmGNUToolchain', '/opt', '/usr/local'])
			{
				const roots = (await BuildPrerequisites.directories(folder)).filter(entry => folder.endsWith('ArmGNUToolchain') || /arm|gnu/i.test(path.basename(entry)));
				prefixes.push(...roots, ...roots.map(root => path.join(root, 'arm-none-eabi')));
			}
		}
		const directories = [...new Set([
			...configured.flatMap(folder => [folder, path.join(folder, 'bin')]),
			...(env[pathKey] || '').split(delimiter).map(folder => folder.replace(/^"|"$/g, '')).filter(folder => path.isAbsolute(folder)),
			...prefixes.flatMap(folder => [path.join(folder, 'bin'), folder])
		].filter(folder => path.isAbsolute(folder)))];
		const selected = new Set<string>();
		const issues:string[] = configured.filter(folder => !path.isAbsolute(folder)).map(folder => 'Build tool paths must be absolute: '+folder+'.');
		const updateEnvironment = () => { env[pathKey] = [...selected, ...directories].join(delimiter); };
		updateEnvironment();
		const locate = async (name:string, search = directories):Promise<string | undefined> =>
		{
			for(const folder of search)
			{
				const filename = path.join(folder, name+(windows ? '.exe' : ''));
				if(await BuildPrerequisites.file(filename)) { return filename; }
			}
		};
		const tool = async (name:string, label:string, minimum?:number[], search?:string[]):Promise<string | undefined> =>
		{
			const filename = await locate(name, search);
			if(!filename) { issues.push(label+' is missing ('+name+').'); return; }
			try
			{
				const version = await BuildPrerequisites.execute(filename, ['--version'], env);
				if(minimum)
				{
					const numbers = version.match(/\b(\d+)\.(\d+)(?:\.(\d+))?/);
					if(!numbers || +numbers[1] < minimum[0] || +numbers[1] === minimum[0] && +numbers[2] < minimum[1])
					{ issues.push(label+' '+minimum.join('.')+' or newer is required ('+filename+').'); return; }
				}
				selected.add(path.dirname(filename)); updateEnvironment();
				return filename;
			}
			catch(error) { issues.push(label+' cannot run: '+filename+' ('+(error instanceof Error ? error.message : String(error))+').'); }
		};

		let cmake:string | undefined;
		// The Windows simulator script uses MSVC directly, rather than CMake/Ninja.
		if(target === 'device' || !windows)
		{
			cmake = await tool('cmake', 'CMake', target === 'device' ? [3,13] : [3,20]);
			await tool('ninja', 'Ninja');
		}
		if(target === 'device')
		{
			const gcc = await tool('arm-none-eabi-gcc', 'ARM GCC');
			if(gcc)
			{
				try
				{
					if(await BuildPrerequisites.execute(gcc, ['-dumpmachine'], env) !== 'arm-none-eabi') { issues.push('ARM GCC must target arm-none-eabi.'); }
				}
				catch { issues.push('ARM GCC could not report its target architecture.'); }
				await Promise.all(['g++','ar','objcopy','objdump','size','nm'].map(name => tool('arm-none-eabi-'+name, 'ARM toolchain '+name, undefined, [path.dirname(gcc)])));
			}
		}
		else if(platform === 'darwin')
		{
			try
			{
				await BuildPrerequisites.execute('/usr/bin/xcode-select', ['-p'], env);
				await BuildPrerequisites.execute('/usr/bin/xcrun', ['--show-sdk-path'], env);
				const compiler = await BuildPrerequisites.execute('/usr/bin/xcrun', ['--find', 'clang++'], env);
				await BuildPrerequisites.execute(compiler, ['--version'], env);
			}
			catch { issues.push('Apple Command Line Tools and the macOS SDK are missing or unavailable. Install them using xcode-select --install; full Xcode is not required.'); }
			const sdlCandidates = [env.SDL3_DIR, '/Library/Frameworks/SDL3.framework/Resources/CMake', path.join(os.homedir(), 'Library', 'Frameworks', 'SDL3.framework', 'Resources', 'CMake'), ...prefixes.flatMap(folder => [path.join(folder, 'lib', 'cmake', 'SDL3'), path.join(folder, 'share', 'cmake', 'SDL3')]),
				...(env.CMAKE_PREFIX_PATH || '').split(delimiter).filter(Boolean).flatMap(folder => [path.join(folder, 'lib', 'cmake', 'SDL3'), path.join(folder, 'share', 'cmake', 'SDL3')])].filter((value):value is string => !!value);
			let sdl:string | undefined;
			for(const folder of sdlCandidates) { if(await BuildPrerequisites.file(path.join(folder, 'SDL3Config.cmake'))) { sdl = folder; break; } }
			if(sdl)
			{
				// CMake consumes prefix directories from this environment variable using the host separator.
				env.CMAKE_PREFIX_PATH = [sdl, path.resolve(sdl, '..', '..', '..'), env.CMAKE_PREFIX_PATH].filter(Boolean).join(delimiter);
			}
			else { issues.push('SDL3 development files are missing (SDL3Config.cmake). Add their installation prefix to wowsdk.buildTools.paths.'); }
		}
		else if(windows)
		{
			try
			{
				const vswhere = path.join(environment('ProgramFiles(x86)') || environment('ProgramFiles') || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
				const installation = await BuildPrerequisites.execute(vswhere, ['-latest', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], env);
				if(!installation || !await BuildPrerequisites.file(path.join(installation, 'Common7', 'Tools', 'VsDevCmd.bat'))) { throw new Error('C++ build tools not found'); }
				const kits = (await Promise.all(programFiles.map(folder => BuildPrerequisites.directories(path.join(folder, 'Windows Kits', '10', 'Include'))))).flat();
				if(!(await Promise.all(kits.map(folder => BuildPrerequisites.file(path.join(folder, 'um', 'Windows.h'))))).some(Boolean)) { throw new Error('Windows SDK not found'); }
			}
			catch { issues.push('Visual Studio C++ Build Tools and the Windows SDK are required for simulator builds. Install the Desktop development with C++ workload.'); }
		}
		return {cmake, env, issues};
	}

	public static async require(target:'device' | 'simulator'):Promise<BuildTools>
	{
		Output.channel().appendLine('[build-tools] Checking '+target+' build prerequisites...');
		const tools = await BuildPrerequisites.check(target);
		if(tools.issues.length)
		{
			const message = 'Cannot build the '+target+':\n'+tools.issues.map(issue => '• '+issue).join('\n')+'\nInstall or repair these prerequisites using the WOWCube SDK installer or their official installers. For custom locations, set wowsdk.buildTools.paths, then build again.';
			void vscode.window.showErrorMessage(message);
			throw new Error(message);
		}
		Output.channel().appendLine('[build-tools] Prerequisites are ready.');
		return tools;
	}
}
