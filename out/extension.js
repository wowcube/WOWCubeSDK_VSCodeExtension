"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const WizardPanel_1 = require("./WizardPanel");
const AdHocPanel_1 = require("./AdHocPanel");
const DeviceDetailsPanel_1 = require("./DeviceDetailsPanel");
const WizardViewProvider_1 = require("./WizardViewProvider");
const BTDeviceViewProvider_1 = require("./BTDeviceViewProvider");
const SettingsViewProvider_1 = require("./SettingsViewProvider");
const ExamplesViewProvider_1 = require("./ExamplesViewProvider");
const WOWCubeBuildTaskProvider_1 = require("./WOWCubeBuildTaskProvider");
const WOWCubeProjectProvider_1 = require("./WOWCubeProjectProvider");
const ExternalToolsPanel_1 = require("./ExternalToolsPanel");
const Configuration_1 = require("./Configuration");
const Providers_1 = require("./Providers");
let buildTask;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
async function activate(context) {
    console.log('WOWCube SDK extension is loaded...');
    await Configuration_1.Configuration.init();
    Configuration_1.Configuration.context = context;
    //initialize providers
    Providers_1.Providers.init(context.extensionUri);
    //register build task
    const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
    buildTask = vscode.tasks.registerTaskProvider(WOWCubeBuildTaskProvider_1.WOWCubeBuildTaskProvider.wowCubeBuildScriptType, new WOWCubeBuildTaskProvider_1.WOWCubeBuildTaskProvider(workspaceRoot));
    //add subscriptions
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(WizardViewProvider_1.WizardViewProvider.viewType, Providers_1.Providers.wizard));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(BTDeviceViewProvider_1.BTDeviceViewProvider.viewType, Providers_1.Providers.btdevices));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SettingsViewProvider_1.SettingsViewProvider.viewType, Providers_1.Providers.settings));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ExamplesViewProvider_1.ExamplesViewProvider.viewType, Providers_1.Providers.examples));
    context.subscriptions.push(vscode.commands.registerCommand('WOWCubeSDK.scanDevices', () => {
        if (Configuration_1.Configuration.isLinux()) {
            vscode.window.showWarningMessage("Feature is not supported on this platform!");
            return;
        }
        Providers_1.Providers.btdevices.reload();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('WOWCubeSDK.openWizard', () => {
        WizardPanel_1.WizardPanel.createOrShow(context.extensionUri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('WOWCubeSDK.openAdHocSharing', () => {
        AdHocPanel_1.AdHocPanel.createOrShow(context.extensionUri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('WOWCubeSDK.openExternalTools', () => {
        ExternalToolsPanel_1.ExternalToolsPanel.createOrShow(context.extensionUri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('WOWCubeSDK.openDeviceDetails', () => {
        if (Configuration_1.Configuration.isLinux()) {
            vscode.window.showWarningMessage("Feature is not supported on this platform!");
            return;
        }
        DeviceDetailsPanel_1.DeviceDetailsPanel.createOrShow(context.extensionUri);
    }));
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(WOWCubeProjectProvider_1.WOWCubeProjectProvider.viewType, Providers_1.Providers.project));
    //check for updates when extension starts
    let check = Configuration_1.Configuration.getAutoCheckForUpdates();
    if (check == '1') {
        Providers_1.Providers.settings.doCheckUpdate();
    }
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    if (buildTask) {
        buildTask.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map