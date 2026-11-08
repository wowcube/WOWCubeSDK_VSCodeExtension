const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const {simulatorMetricsEnabled, setSimulatorMetrics} = require('../../out/SimulatorMetrics');

const metrics = 'WOWCUBE_SIM_METRICS';
const project = {
    name: 'test', version: '1.0.0', appFolder: 'app_test', sdkVersion: '0.100',
    metadata: {application: {name: 'Test', category: 'APP_CATEGORY_GAME', guid1: '1', guid2: '0', extra: 'keep'}},
    custom: {keep: true},
    simulatorDebug: {
        macos: {program: 'mac-binary', env: {OTHER: 'keep', [metrics]: '0'}},
        windows: {program: 'win-binary.exe', environment: [{name: 'OTHER', value: 'keep'}, {name: metrics, value: '0'}]}
    }
};
const before = JSON.stringify(project);
let enabled = setSimulatorMetrics(project, true);
assert.strictEqual(simulatorMetricsEnabled(enabled), true);
assert.strictEqual(enabled.simulatorDebug.macos.env[metrics], '1');
assert.strictEqual(enabled.simulatorDebug.windows.environment.find(entry => entry.name === metrics).value, '1');
assert.strictEqual(enabled.simulatorDebug.macos.env.OTHER, 'keep');
assert.deepStrictEqual(enabled.simulatorDebug.windows.environment[0], {name: 'OTHER', value: 'keep'});
assert.strictEqual(JSON.stringify(project), before);
assert.strictEqual(simulatorMetricsEnabled(setSimulatorMetrics(enabled, false)), false);
assert.strictEqual(setSimulatorMetrics(enabled, true).simulatorDebug.windows.environment.length, 2);
assert.strictEqual(simulatorMetricsEnabled(setSimulatorMetrics({}, true)), true);

let text = JSON.stringify(project);
let receive;
let changed;
const document = {fileName: '/tmp/wowcube-project-metrics-test/wowcubeapp-build.json', uri: {toString: () => 'project'},
    lineCount: 1, getText: () => text};
const Project = {Json: project, validateAssets: () => false, AdHocDescription: 'Keep description'};
const vscode = {
    Uri: {joinPath: (_base, ...parts) => parts.join('/')},
    window: {showErrorMessage() {}, showWarningMessage() {}},
    workspace: {
        onDidChangeTextDocument: handler => { changed = handler; return {dispose() {}}; },
        applyEdit: edit => { text = edit.text; changed?.({document}); return Promise.resolve(true); }
    },
    WorkspaceEdit: class {replace(_uri, _range, value) { this.text = value; }},
    Range: class {}
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'vscode') return vscode;
    if (parent?.filename.endsWith('/out/WOWCubeProjectProvider.js')) {
        if (name === './Project') return {Project};
        if (name === './Configuration') return {Configuration: {getVersions: () => ['0.100']}};
        if (name === './Providers') return {};
        if (name === './Output') return {Output: {terminal: () => ({event() {}}), terminalClose: () => ({event() {}}), channel: () => ({})}};
    }
    return originalLoad.call(this, name, parent, isMain);
};
const {WOWCubeProjectProvider} = require('../../out/WOWCubeProjectProvider');
Module._load = originalLoad;

async function run() {
    const panel = {
        webview: {asWebviewUri: value => value, postMessage() {}, onDidReceiveMessage: handler => { receive = handler; }},
        onDidChangeViewState() {}, onDidDispose() {}
    };
    await new WOWCubeProjectProvider({extensionUri: 'extension'}).resolveCustomTextEditor(document, panel);
    assert.ok(panel.webview.html.includes('<strong>Advanced settings</strong>'));
    assert.ok(panel.webview.html.includes('Show periodic performance and diagnostic counters in the simulator log'));
    receive({type: 'simulatorMetrics', value: true});
    assert.strictEqual(simulatorMetricsEnabled(JSON.parse(text)), true);
    receive({type: 'update', value: {version: '1.0.1', metadata: {application: {name: 'Renamed'}}}});
    const updated = JSON.parse(text);
    assert.strictEqual(simulatorMetricsEnabled(updated), true, 'Basic edits must preserve both platform metrics flags.');
    assert.deepStrictEqual(updated.custom, project.custom);
    assert.strictEqual(updated.metadata.application.extra, 'keep');
    assert.strictEqual(updated.version, '1.0.1');
    receive({type: 'simulatorMetrics', value: false});
    assert.strictEqual(JSON.parse(text).simulatorDebug.macos.env[metrics], '0');
    assert.strictEqual(JSON.parse(text).simulatorDebug.windows.environment.find(entry => entry.name === metrics).value, '0');

    const elements = new Map();
    const sent = [];
    const window = {addEventListener: (_type, handler) => { window.message = handler; }};
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, {value: '', checked: false, style: {}, options: [], length: 0,
            addEventListener(type, handler) { this[type] = handler; }});
        return elements.get(id);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../media/projectview.js'), 'utf8'), {
        window, document: {getElementById: getElement, getElementsByClassName: () => []},
        acquireVsCodeApi: () => ({postMessage: value => sent.push(value)})
    });
    window.onload();
    const checkbox = getElement('simulatorMetrics');
    assert.strictEqual(typeof checkbox.change, 'function');
    checkbox.change({target: {checked: true}});
    assert.strictEqual(sent.at(-1).type, 'simulatorMetrics');
    assert.strictEqual(sent.at(-1).value, true);
    window.message({data: {type: 'update', text: JSON.stringify(enabled)}});
    assert.strictEqual(checkbox.checked, true);
    window.message({data: {type: 'update', text: JSON.stringify(project)}});
    assert.strictEqual(checkbox.checked, false);
    console.log('Project metrics tests passed: checkbox, both JSON flags, updates, and field preservation.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
