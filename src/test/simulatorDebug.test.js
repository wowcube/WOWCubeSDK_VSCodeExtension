// Verify portable launches, native-template compatibility, and failure isolation.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const errors = [];
const prompts = [];
const installations = [];
const notices = [];
let selection;
let installError;
const registrations = new Map();
const installed = new Set(['ms-vscode.cpptools', 'llvm-vs-code-extensions.lldb-dap']);
const vscode = {
    debug: {registerDebugConfigurationProvider: (type, provider) => {
        registrations.set(type, provider);
        return {dispose() { registrations.delete(type); }};
    }},
    extensions: {getExtension: id => installed.has(id) ? {id} : undefined},
    window: {
        showErrorMessage: (message, ...actions) => {
            errors.push(message);
            prompts.push(actions);
            return Promise.resolve(selection);
        },
        showInformationMessage: message => { notices.push(message); }
    },
    commands: {executeCommand: async (command, extension) => {
        installations.push({command, extension});
        if (installError) { throw installError; }
    }}
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain);
};
const {WOWCubeSimulatorDebugProvider: Provider} = require('../../out/WOWCubeSimulatorDebugProvider');
Module._load = originalLoad;
const originalPlatform = os.platform;
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wowcube-debug-'));
const project = path.join(fixture, 'project with spaces');
fs.mkdirSync(project);
const manifest = path.join(project, 'wowcubeapp-build.json');
fs.writeFileSync(manifest, JSON.stringify({appFolder: 'app_test'}));
const folder = {uri: {fsPath: project}};

async function run() {
try {
    const context = {subscriptions: []};
    Provider.register(context);
    assert.strictEqual(context.subscriptions.length, 2);
    const provider = registrations.get(Provider.type);
    const legacy = registrations.get('*');
    const portable = Provider.createLaunchConfiguration();
    const original = JSON.stringify(portable);
    for (const platform of ['darwin', 'win32']) {
        os.platform = () => platform;
        const resolved = provider.resolveDebugConfiguration(folder, portable);
        assert.strictEqual(resolved.type, platform === 'darwin' ? 'lldb-dap' : 'cppvsdbg');
        assert.strictEqual(resolved.cwd, path.join(project, 'app_test', 'bin'));
        assert.strictEqual(resolved.program, path.join(resolved.cwd, 'app_project with spaces')+(platform === 'win32' ? '.exe' : ''));
        assert.strictEqual(resolved.preLaunchTask, Provider.label);
        assert.ok(!fs.existsSync(resolved.program), 'First build must resolve before a binary exists.');
        if (platform === 'darwin') {
            assert.strictEqual(resolved.stopOnEntry, false);
            assert.strictEqual(resolved.disableASLR, false);
            assert.strictEqual(resolved.enableAutoVariableSummaries, false);
            assert.ok(!('stopAtEntry' in resolved));
            assert.ok(!('console' in resolved));
        } else {
            assert.strictEqual(resolved.stopAtEntry, false);
            assert.strictEqual(resolved.console, 'integratedTerminal');
            assert.deepStrictEqual(resolved.environment, []);
            assert.ok(!('stopOnEntry' in resolved));
        }
        assert.deepStrictEqual(legacy.resolveDebugConfiguration(folder, resolved), resolved, 'Repeated resolution must be stable.');
    }
    assert.strictEqual(JSON.stringify(portable), original, 'Resolution must not mutate launch entries.');

    os.platform = () => 'darwin';
    const windows = {...portable, type: 'cppvsdbg', program: '${workspaceFolder}/app_test/bin/app_test.exe',
        cwd: '${workspaceFolder}/app_test/bin', args: ['--custom'], stopAtEntry: true,
        environment: [{name: 'TEST', value: 'yes'}], console: 'integratedTerminal'};
    const mac = legacy.resolveDebugConfiguration(folder, windows);
    assert.strictEqual(mac.type, 'lldb-dap');
    assert.strictEqual(mac.program, '${workspaceFolder}/app_test/bin/app_test');
    assert.strictEqual(mac.cwd, windows.cwd);
    assert.deepStrictEqual(mac.args, ['--custom']);
    assert.strictEqual(mac.stopOnEntry, true);
    assert.deepStrictEqual(mac.env, {TEST: 'yes'});
    assert.ok(!('environment' in mac));
    assert.ok(!('console' in mac));
    os.platform = () => 'win32';
    const back = legacy.resolveDebugConfiguration(folder, mac);
    assert.strictEqual(back.program, windows.program);
    assert.strictEqual(back.stopAtEntry, true);
    assert.deepStrictEqual(back.environment, windows.environment);
    assert.ok(!('disableASLR' in back));
    assert.ok(!('enableAutoVariableSummaries' in back));
    assert.ok(!('env' in back));

    const platformSettings = Provider.createBuildSettings('app_test');
    platformSettings.macos.args = ['--mac'];
    platformSettings.macos.disableASLR = true;
    platformSettings.windows.args = ['--windows'];
    platformSettings.windows.stopAtEntry = true;
    fs.writeFileSync(manifest, JSON.stringify({appFolder: 'app_test', simulatorDebug: platformSettings}));
    const manifestBefore = fs.readFileSync(manifest, 'utf8');
    os.platform = () => 'darwin';
    const projectMac = provider.resolveDebugConfiguration(folder, portable);
    assert.strictEqual(projectMac.type, 'lldb-dap');
    assert.strictEqual(projectMac.program, '${workspaceFolder}/app_test/bin/app_${workspaceFolderBasename}');
    assert.strictEqual(projectMac.cwd, '${workspaceFolder}/app_test/bin');
    assert.strictEqual(projectMac.disableASLR, true);
    assert.deepStrictEqual(projectMac.args, ['--mac']);
    assert.ok(!('stopAtEntry' in projectMac));
    const upgradedWindows = legacy.resolveDebugConfiguration(folder, windows);
    assert.strictEqual(upgradedWindows.program, projectMac.program, 'Manifest settings override legacy launch parameters.');
    assert.ok(!('console' in upgradedWindows));
    assert.deepStrictEqual(legacy.resolveDebugConfiguration(folder, projectMac), projectMac);
    os.platform = () => 'win32';
    const projectWindows = provider.resolveDebugConfiguration(folder, portable);
    assert.strictEqual(projectWindows.type, 'cppvsdbg');
    assert.strictEqual(projectWindows.program, platformSettings.windows.program);
    assert.deepStrictEqual(projectWindows.args, ['--windows']);
    assert.strictEqual(projectWindows.stopAtEntry, true);
    assert.ok(!('disableASLR' in projectWindows));
    assert.strictEqual(fs.readFileSync(manifest, 'utf8'), manifestBefore, 'Resolving must not rewrite the build manifest.');
    assert.deepStrictEqual(legacy.resolveDebugConfiguration(folder, projectWindows), projectWindows);
    for (const simulatorDebug of [null, [], {windows: []}, {windows: {type: 'lldb-dap'}}]) {
        fs.writeFileSync(manifest, JSON.stringify({appFolder: 'app_test', simulatorDebug}));
        assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
        assert.match(errors.at(-1), /simulatorDebug/);
    }
    fs.writeFileSync(manifest, JSON.stringify({appFolder: 'app_test', simulatorDebug: {macos: {}}}));
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable).type, 'cppvsdbg', 'An omitted platform uses compatibility defaults.');
    fs.writeFileSync(manifest, JSON.stringify({appFolder: 'app_test'}));

    for (const other of [
        {...windows, name: 'Other C++ launch'}, {...windows, preLaunchTask: 'Other task'},
        {...windows, request: 'attach'}, {...windows, type: 'node'}
    ]) {
        assert.strictEqual(legacy.resolveDebugConfiguration(undefined, other), other);
    }
    assert.strictEqual(provider.resolveDebugConfiguration(undefined, portable), undefined);
    installed.delete('ms-vscode.cpptools');
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
    assert.match(errors.at(-1), /ms-vscode.cpptools/);
    installed.add('ms-vscode.cpptools');
    os.platform = () => 'darwin';
    installed.delete('llvm-vs-code-extensions.lldb-dap');
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
    assert.match(errors.at(-1), /llvm-vs-code-extensions.lldb-dap/);
    installed.add('llvm-vs-code-extensions.lldb-dap');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(installations, [], 'Dismissing the prompt must not install extensions.');
    for (const [platform, extension] of [['darwin', 'llvm-vs-code-extensions.lldb-dap'], ['win32', 'ms-vscode.cpptools']]) {
        os.platform = () => platform;
        installed.delete(extension);
        selection = 'Install';
        assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
        assert.deepStrictEqual(prompts.at(-1), ['Install']);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepStrictEqual(installations.at(-1), {command: 'workbench.extensions.installExtension', extension});
        assert.match(notices.at(-1), /Start debugging again/);
        installed.add(extension);
    }
    installError = new Error('Marketplace unavailable');
    installed.delete('ms-vscode.cpptools');
    provider.resolveDebugConfiguration(folder, portable);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(errors.at(-1), /Unable to install ms-vscode.cpptools: Marketplace unavailable/);
    installError = undefined;
    selection = undefined;
    installed.add('ms-vscode.cpptools');
    os.platform = () => 'linux';
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
    os.platform = () => 'darwin';
    fs.writeFileSync(manifest, '{}');
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);
    assert.match(errors.at(-1), /appFolder/);
    fs.writeFileSync(manifest, '{');
    assert.strictEqual(provider.resolveDebugConfiguration(folder, portable), undefined);

    const launch = Provider.createLaunchFile();
    const recommendations = {recommendations: ['llvm-vs-code-extensions.lldb-dap', 'other.extension', 'ms-vscode.cpptools'],
        unwantedRecommendations: ['ms-vscode.cmake-tools']};
    assert.deepStrictEqual(Provider.filterDebuggerRecommendations(recommendations), {
        recommendations: ['other.extension'], unwantedRecommendations: ['ms-vscode.cmake-tools']
    });
    assert.strictEqual(recommendations.recommendations.length, 3, 'Filtering must not mutate SDK templates.');
    assert.strictEqual(launch.version, '0.2.0');
    assert.deepStrictEqual(launch.configurations[0], portable);
    assert.strictEqual(launch.configurations[1].preLaunchTask, 'Build and Run on selected device');
    assert.strictEqual(launch.configurations[2].preLaunchTask, 'Pack application resources');
    for (const disposable of context.subscriptions) { disposable.dispose(); }
    assert.strictEqual(registrations.size, 0);
    console.log('Simulator debug resolution tests passed.');
} finally {
    os.platform = originalPlatform;
    fs.rmSync(fixture, {recursive: true, force: true});
}
}
run().catch(error => { console.error(error); process.exitCode = 1; });
