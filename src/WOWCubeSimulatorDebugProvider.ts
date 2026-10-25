import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Resolves the portable WOWCube launch entry into the installed native debugger. */
export class WOWCubeSimulatorDebugProvider implements vscode.DebugConfigurationProvider
{
    public static readonly type = 'wowcube-simulator';
    public static readonly label = 'Build and Debug with WOWCube OcvatiOS Simulator';

    public static register(context: vscode.ExtensionContext): void
    {
        const provider = new WOWCubeSimulatorDebugProvider();
        context.subscriptions.push(
            vscode.debug.registerDebugConfigurationProvider(this.type, provider),
            // SDK templates previously used a native debugger type directly.
            vscode.debug.registerDebugConfigurationProvider('*', {
                resolveDebugConfiguration: (folder, config) =>
                    this.isLegacyConfiguration(config) ? provider.resolveDebugConfiguration(folder, config) : config
            })
        );
    }

    private static isLegacyConfiguration(config: vscode.DebugConfiguration): boolean
    {
        return ['cppvsdbg', 'lldb-dap'].includes(config.type) && config.request === 'launch' &&
            config.name === this.label && config.preLaunchTask === this.label;
    }

    public static createLaunchConfiguration(): vscode.DebugConfiguration
    {
        return {name: this.label, type: this.type, request: 'launch', preLaunchTask: this.label, args: []};
    }

    public static createLaunchFile(): object
    {
        return {
            version: '2.0.0',
            configurations: [
                this.createLaunchConfiguration(),
                {name: 'Build and Run on selected device', type: 'node', request: 'attach', timeout: 1,
                    preLaunchTask: 'Build and Run on selected device'},
                {name: 'Pack application resources', type: 'node', request: 'attach', timeout: 1,
                    preLaunchTask: 'Pack application resources'}
            ]
        };
    }

    public static createBuildSettings(appFolder: string)
    {
        const bin = '${workspaceFolder}/'+appFolder+'/bin';
        const program = bin+'/app_${workspaceFolderBasename}';
        return {
            macos: {
                type: 'lldb-dap', program, cwd: bin, args: [], stopOnEntry: false,
                disableASLR: false, enableAutoVariableSummaries: false
            },
            windows: {
                type: 'cppvsdbg', program: program+'.exe', cwd: bin, args: [],
                stopAtEntry: false, environment: [], console: 'integratedTerminal'
            }
        };
    }

    public static filterDebuggerRecommendations(template: {recommendations?: string[]; [key: string]: unknown})
    {
        const debuggerExtensions = ['llvm-vs-code-extensions.lldb-dap', 'ms-vscode.cpptools'];
        return {...template, recommendations: (template.recommendations ?? []).filter(id => !debuggerExtensions.includes(id))};
    }

    private static async offerDebuggerInstallation(extension: string): Promise<void>
    {
        try
        {
            const name = extension === 'ms-vscode.cpptools' ? 'C/C++' : 'LLDB DAP';
            const choice = await vscode.window.showErrorMessage(
                'WOWCube simulator debugging requires '+name+' ('+extension+').', 'Install');
            if (choice === 'Install')
            {
                await vscode.commands.executeCommand('workbench.extensions.installExtension', extension);
                void vscode.window.showInformationMessage(name+' installed. Start debugging again to launch the WOWCube simulator.');
            }
        }
        catch (exception)
        {
            void vscode.window.showErrorMessage('Unable to install '+extension+': '+
                (exception instanceof Error ? exception.message : String(exception)));
        }
    }

    public resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration): vscode.DebugConfiguration | undefined
    {
        if (config.type !== WOWCubeSimulatorDebugProvider.type && !WOWCubeSimulatorDebugProvider.isLegacyConfiguration(config))
        {
            return config;
        }
        try
        {
            if (!folder)
            {
                throw new Error('Open the WOWCube project folder before launching the simulator.');
            }
            const platform = os.platform();
            if (platform !== 'darwin' && platform !== 'win32')
            {
                throw new Error('Simulator debugging is supported on macOS and Windows.');
            }
            const extension = platform === 'win32' ? 'ms-vscode.cpptools' : 'llvm-vs-code-extensions.lldb-dap';
            if (!vscode.extensions.getExtension(extension))
            {
                void WOWCubeSimulatorDebugProvider.offerDebuggerInstallation(extension);
                return undefined;
            }
            const manifest = JSON.parse(fs.readFileSync(path.join(folder.uri.fsPath, 'wowcubeapp-build.json'), 'utf8'));
            if (typeof manifest.appFolder !== 'string' || !manifest.appFolder.trim())
            {
                throw new Error('wowcubeapp-build.json must specify appFolder.');
            }
            const platformKey = platform === 'win32' ? 'windows' : 'macos';
            const nativeType = platform === 'win32' ? 'cppvsdbg' : 'lldb-dap';
            let settings = {};
            if (manifest.simulatorDebug !== undefined)
            {
                if (!manifest.simulatorDebug || typeof manifest.simulatorDebug !== 'object' || Array.isArray(manifest.simulatorDebug))
                {
                    throw new Error('simulatorDebug must be an object in wowcubeapp-build.json.');
                }
                const platformSettings = manifest.simulatorDebug[platformKey];
                if (platformSettings !== undefined)
                {
                    if (!platformSettings || typeof platformSettings !== 'object' || Array.isArray(platformSettings))
                    {
                        throw new Error('simulatorDebug.'+platformKey+' must be an object.');
                    }
                    if (platformSettings.type !== undefined && platformSettings.type !== nativeType)
                    {
                        throw new Error('simulatorDebug.'+platformKey+'.type must be '+nativeType+'.');
                    }
                    settings = platformSettings;
                }
            }
            // Project platform settings override old native launch parameters in memory.
            const inputType = config.type;
            const identity = {name: config.name, request: 'launch',
                preLaunchTask: config.preLaunchTask ?? WOWCubeSimulatorDebugProvider.label};
            config = {...config, ...settings, ...identity};
            const bin = path.resolve(folder.uri.fsPath, manifest.appFolder, 'bin');
            const resolved = {...config};
            resolved.type = nativeType;
            resolved.request = 'launch';
            resolved.preLaunchTask = config.preLaunchTask ?? WOWCubeSimulatorDebugProvider.label;
            resolved.cwd = config.cwd ?? bin;
            // Preserve explicit paths in existing projects, changing only the executable suffix.
            const program = config.program ?? path.join(bin, 'app_'+path.basename(folder.uri.fsPath));
            resolved.program = program.replace(/\.exe$/i, '')+(platform === 'win32' ? '.exe' : '');
            resolved.args = config.args ?? [];
            if (platform === 'win32')
            {
                resolved.stopAtEntry = config.stopAtEntry ?? config.stopOnEntry ?? false;
                resolved.environment = config.environment ?? Object.entries(config.env ?? {}).map(([name, value]) => ({name, value}));
                resolved.console = config.console ?? 'integratedTerminal';
                for (const key of ['stopOnEntry', 'disableASLR', 'enableAutoVariableSummaries', 'env',
                    'debugAdapterExecutable', 'debugAdapterArgs', 'debugAdapterEnv'])
                {
                    delete resolved[key];
                }
            }
            else
            {
                resolved.stopOnEntry = config.stopOnEntry ?? config.stopAtEntry ?? false;
                resolved.disableASLR = config.disableASLR ?? false;
                resolved.enableAutoVariableSummaries = config.enableAutoVariableSummaries ?? false;
                if (config.environment && !config.env)
                {
                    resolved.env = Object.fromEntries(config.environment.map((item: {name: string; value: string}) => [item.name, item.value]));
                }
                delete resolved.stopAtEntry;
                delete resolved.environment;
                // The Mac reference leaves console selection to LLDB DAP.
                if (inputType === 'cppvsdbg' && !Object.prototype.hasOwnProperty.call(settings, 'console'))
                {
                    delete resolved.console;
                }
            }
            // The executable can be absent here: preLaunchTask builds it after resolution.
            return resolved;
        }
        catch (exception)
        {
            void vscode.window.showErrorMessage('WOWCube simulator: '+(exception instanceof Error ? exception.message : String(exception)));
            return undefined;
        }
    }
}
