"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
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
const ResourceStudioProvider_1 = require("./ResourceStudioProvider");
const Configuration_1 = require("./Configuration");
const Providers_1 = require("./Providers");
const fs = require("fs");
const path = require("path");
let buildTask;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
async function activate(context) {
    console.log('WOWCube SDK extension is loaded...');
    ResourceStudioProvider_1.ResourceStudioProvider.register(context);
    await Configuration_1.Configuration.init();
    Configuration_1.Configuration.context = context;
    //initialize providers
    Providers_1.Providers.init(context.extensionUri);
    //register build task
    const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
    const buildTaskProvider = new WOWCubeBuildTaskProvider_1.WOWCubeBuildTaskProvider(workspaceRoot);
    buildTask = vscode.tasks.registerTaskProvider(WOWCubeBuildTaskProvider_1.WOWCubeBuildTaskProvider.wowCubeBuildScriptType, buildTaskProvider);
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
    //check the validity of installation
    var problem = Configuration_1.Configuration.checkCurrentInstallation();
    if (problem != Configuration_1.InstallationProblem.None) {
        switch (problem) {
            case Configuration_1.InstallationProblem.EmscriptedPresent:
                {
                    vscode.window.showErrorMessage("Currently installed version of  C++ Compiler support package for WOWCUbe SDK is not supported anymore and must be re-installed.", ...["Manage Packages"]).then((answer) => {
                        if (answer === "Manage Packages") {
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
    let check = Configuration_1.Configuration.getAutoCheckForUpdates();
    if (check == '1') {
        Providers_1.Providers.settings.doCheckUpdate();
    }
    //Octavios
    //check if packed folder exists
    var tasks = await buildTaskProvider.provideTasks();
    const task = tasks?.find(t => t.definition.target === 'resources');
    if (task) {
        await handleWorkspaceOpened(context, task);
    }
}
async function handleWorkspaceOpened(context, t) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder)
        return;
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const buildConfig = path.join(workspaceRoot, 'wowcubeapp-build.json');
    if (!fs.existsSync(buildConfig))
        return;
    // This is a WOWCube project.
    const build_json = JSON.parse(fs.readFileSync(buildConfig, 'utf-8'));
    const packedFolder = path.join(workspaceRoot, build_json.appFolder, 'art', 'packed');
    const newFile = path.join(packedFolder, 'new');
    if (fs.existsSync(newFile)) {
        if (t) {
            await vscode.tasks.executeTask(t);
            fs.unlinkSync(newFile);
        }
    }
}
// this method is called when your extension is deactivated
function deactivate() {
    if (buildTask) {
        buildTask.dispose();
    }
}
//# sourceMappingURL=extension.js.map