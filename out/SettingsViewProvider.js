"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsViewProvider = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const Providers_1 = require("./Providers");
const Version_1 = require("./Version");
class SettingsViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this.checkingForUpdates = false;
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
    }
    reload() {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    }
    async resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        this._view?.onDidChangeVisibility(e => {
            if (this._view?.visible) {
                var path = Configuration_1.Configuration.getWOWSDKPath();
                if (typeof (path) === 'undefined')
                    path = '';
                this._view.webview.postMessage({ type: 'folderSelected', value: path });
                if (this.validateSDKPath(path) === false) {
                    this._view.webview.postMessage({ type: 'pathError', value: true });
                }
                else {
                    this._view.webview.postMessage({ type: 'pathError', value: false });
                }
                let version = Configuration_1.Configuration.getCurrentVersion();
                this._view.webview.postMessage({ type: 'setVersion', value: version });
            }
        });
        webviewView.webview.options =
            {
                // Allow scripts in the webview
                enableScripts: true,
                localResourceRoots: [
                    this._extensionUri
                ]
            };
        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'checkPath':
                    {
                        if (this.validateSDKPath(Configuration_1.Configuration.getWOWSDKPath()) === false) {
                            webviewView.webview.postMessage({ type: 'pathError', value: true });
                        }
                        else {
                            webviewView.webview.postMessage({ type: 'pathError', value: false });
                        }
                    }
                    break;
                case 'pathChanged':
                    {
                        Configuration_1.Configuration.setWOWSDKPath(data.value);
                        webviewView.webview.postMessage({ type: 'checkPath', value: true });
                        Providers_1.Providers.examples.reload();
                    }
                    break;
                case 'versionChanged':
                    {
                        Configuration_1.Configuration.setCurrentVersion(data.value);
                        if (this.validateSDKPath(Configuration_1.Configuration.getWOWSDKPath()) === false) {
                            webviewView.webview.postMessage({ type: 'pathError', value: true });
                        }
                        else {
                            webviewView.webview.postMessage({ type: 'pathError', value: false });
                        }
                        Providers_1.Providers.examples.reload();
                    }
                    break;
                case 'buttonCheckForUpdatesPressed':
                    {
                        if (!this.checkingForUpdates) {
                            this.checkingForUpdates = true;
                            this.doCheckUpdate();
                        }
                    }
                    break;
                case 'buttonPressed':
                    {
                        var p = os.platform();
                        var canSelectFiles = false;
                        var canSelectFolders = true;
                        var title = 'Select WOWCube Development Kit Folder';
                        switch (p) {
                            case 'darwin': //mac
                                {
                                    canSelectFiles = true;
                                    canSelectFolders = false;
                                    title = 'Select WOWCube Development Kit Application';
                                }
                                break;
                            case 'linux':
                            case 'win32': //windows
                            default:
                                break;
                        }
                        const options = {
                            canSelectMany: false,
                            openLabel: title,
                            canSelectFiles: canSelectFiles,
                            canSelectFolders: canSelectFolders
                        };
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                if (this._view) {
                                    //save configuration
                                    if (canSelectFiles === false) {
                                        Configuration_1.Configuration.setWOWSDKPath(fileUri[0].fsPath + Configuration_1.Configuration.getSlash());
                                        this._view.webview.postMessage({ type: 'folderSelected', value: fileUri[0].fsPath + Configuration_1.Configuration.getSlash() });
                                    }
                                    else {
                                        Configuration_1.Configuration.setWOWSDKPath(fileUri[0].fsPath + '/Contents' + Configuration_1.Configuration.getSlash());
                                        this._view.webview.postMessage({ type: 'folderSelected', value: fileUri[0].fsPath + '/Contents' + Configuration_1.Configuration.getSlash() });
                                    }
                                    if (this.validateSDKPath(fileUri[0].fsPath + '/Contents' + Configuration_1.Configuration.getSlash()) === false) {
                                        this._view.webview.postMessage({ type: 'pathError', value: true });
                                    }
                                    else {
                                        this._view.webview.postMessage({ type: 'pathError', value: false });
                                    }
                                }
                            }
                        });
                        break;
                    }
            }
        });
    }
    refreshVersionSelector() {
        Configuration_1.Configuration.reloadVersions();
        let versions = Configuration_1.Configuration.getVersions();
        let version = Configuration_1.Configuration.getCurrentVersion();
        this._view?.webview.postMessage({ type: 'clearVersions', value: true });
        for (var i = 0; i < versions.length; i++) {
            this._view?.webview.postMessage({ type: 'addVersion', value: versions[i] });
        }
        this._view?.webview.postMessage({ type: 'setVersion', value: version });
    }
    async doCheckUpdate() {
        return new Promise((resolve, reject) => {
            var out = new Array();
            var err = false;
            var re = /(?<maj>\d{1,2})\.(?<min>\d{1,2})\.(?<build>\d{1,4})/g;
            this._channel.appendLine("Checking for updates...");
            this._channel.show(true);
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getUpdater().cli + '"';
            var globals = Configuration_1.Configuration.getWDKGlobals();
            if (globals === null) {
                this._channel.appendLine('Failed to complete the check, WOWCube Development Kit global parameters can not be read\r\n');
                this.closeEmitter.fire(0);
                resolve();
            }
            var currVersion = globals.currentVersion;
            var endpoint = globals.updateEndpoint;
            const cm = re.exec(currVersion);
            const currMaj = cm?.groups?.maj;
            const currMin = cm?.groups?.min;
            const currBuild = cm?.groups?.build;
            command += " check -cr " + currVersion + " -cho -de " + endpoint;
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                if (error) {
                    //reject({ error, stdout, stderr });
                }
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    if (out.length === 0) {
                        this._channel.appendLine("WOWCube Development Kit version " + currVersion + " is up to date");
                    }
                    else {
                        out.forEach(line => {
                            if (line.indexOf('Error:') !== -1) {
                                err = true;
                            }
                            else {
                                var l = line.split('\n');
                                let started = false;
                                l.forEach(s => {
                                    if (!started) {
                                        const match = re.exec(s);
                                        if (match !== null) {
                                            const aMaj = match?.groups?.maj;
                                            const aMin = match?.groups?.min;
                                            const aBuild = match?.groups?.build;
                                            const ver = aMaj + '.' + aMin + '.' + aBuild;
                                            const cmp = Version_1.Version.compareWDK(currVersion, ver);
                                            if (cmp !== 2) {
                                                if (cmp !== -1) {
                                                    this._channel.appendLine("WOWCube Development Kit version " + currVersion + " is up to date");
                                                }
                                                else {
                                                    this._channel.appendLine("WOWCube Development Kit current version is " + currVersion + ", available version is " + ver);
                                                    this.doUpdate();
                                                    started = true;
                                                }
                                            }
                                            else {
                                                this._channel.appendLine('Failed to check for updates, version string format is incorrect.\r\n');
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                    this.closeEmitter.fire(0);
                    this.checkingForUpdates = false;
                    resolve();
                }
                else {
                    out.forEach(line => {
                        this._channel.appendLine(line);
                    });
                    this._channel.appendLine('Failed to check for updates.\r\n');
                    this.closeEmitter.fire(0);
                    this.checkingForUpdates = false;
                    resolve();
                }
            });
        });
    }
    async doUpdate() {
        return new Promise((resolve, reject) => {
            var out = new Array();
            var err = false;
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getUpdater().ui + '"';
            var wdkPath = Configuration_1.Configuration.getWOWSDKContainingFolder();
            var globals = Configuration_1.Configuration.getWDKGlobals();
            if (globals === null) {
                this._channel.appendLine('Failed to complete the update, WOWCube Development Kit global parameters can not be read\r\n');
                this.closeEmitter.fire(0);
                resolve();
            }
            var currVersion = globals.currentVersion;
            var endpoint = globals.updateEndpoint;
            command += " check -cr " + currVersion + " -chu -tf \"" + wdkPath + "\" -de " + endpoint;
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                if (error) {
                    //reject({ error, stdout, stderr });
                }
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    this._channel.appendLine('Done\r\n');
                    this.closeEmitter.fire(0);
                    this.checkingForUpdates = false;
                    resolve();
                }
                else {
                    out.forEach(line => {
                        this._channel.appendLine(line);
                    });
                    this._channel.appendLine('Failed to complete the update.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
            });
        });
    }
    validateSDKPath(path) {
        if (typeof (path) === 'undefined') {
            path = '';
        }
        if (path.length > 0) {
            this.refreshVersionSelector();
            //Pawn
            var pawnpath = Configuration_1.Configuration.getPawnPath();
            if (fs.existsSync(pawnpath) === false) {
                this._channel.appendLine("SDK Settigs Error: Path \"" + pawnpath + "\" is invalid");
                this._channel.show(true);
                return false;
            }
            else {
                var exe = pawnpath + Configuration_1.Configuration.getPawnCC();
                if (fs.existsSync(exe) === false) {
                    this._channel.appendLine("SDK Settigs Error: File " + exe + " does not exist");
                    this._channel.show(true);
                    return false;
                }
            }
            //let's assume if this folder exists, all subfolders for other languages exist too
            var includepath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/pawn/include/';
            if (fs.existsSync(includepath) === false) {
                this._channel.appendLine("SDK Settigs Error: Path \"" + includepath + "\" is invalid");
                this._channel.show(true);
                return false;
            }
            //CPP
            var cpppath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/';
            if (fs.existsSync(cpppath) === false) {
                this._channel.appendLine("SDK Settigs Error: Path \"" + cpppath + "\" is invalid");
                this._channel.show(true);
                return false;
            }
            //Utils
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            if (fs.existsSync(utilspath) === false) {
                this._channel.appendLine("SDK Settigs Error: Path \"" + utilspath + "\" is invalid");
                this._channel.show(true);
                return false;
            }
            else {
                var exe = utilspath + Configuration_1.Configuration.getBuilder();
                if (fs.existsSync(exe) === false) {
                    this._channel.appendLine("SDK Settigs Error: File " + exe + " does not exist");
                    this._channel.show(true);
                    return false;
                }
                exe = utilspath + Configuration_1.Configuration.getLoader();
                if (fs.existsSync(exe) === false) {
                    this._channel.appendLine("SDK Settigs Error: File " + exe + " does not exist");
                    this._channel.show(true);
                    return false;
                }
            }
            //Emulator
            var emulpath = Configuration_1.Configuration.getEmulPath();
            if (fs.existsSync(emulpath) === false) {
                this._channel.appendLine("SDK Settigs Error: Path \"" + emulpath + "\" is invalid");
                this._channel.show(true);
                return false;
            }
            else {
                var exe = emulpath + Configuration_1.Configuration.getEmulator();
                if (fs.existsSync(exe) === false) {
                    this._channel.appendLine("SDK Settigs Error: File " + exe + " does not exist");
                    this._channel.show(true);
                    return false;
                }
            }
            return true;
        }
        else {
            return true;
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'settingsview.js'));
        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        // Use a nonce to only allow a specific script to be run.
        const nonce = (0, getNonce_1.getNonce)();
        var path = Configuration_1.Configuration.getWOWSDKPath();
        if (typeof (path) === 'undefined')
            path = '';
        var path_valid = this.validateSDKPath(path);
        var err_class = "hidden";
        if (path_valid === false) {
            err_class = "visible";
        }
        var body = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${styleResetUri}" rel="stylesheet">
			<link href="${styleVSCodeUri}" rel="stylesheet">
			<link href="${styleMainUri}" rel="stylesheet">
			
			<title>Development Kit Settings</title>
		</head>
		<body>
			<br/>
			<div>Path To WOWCube Development Kit</div>
			<div>
			<input  class='sdk-path' id='sdkpath' value='${path}'></input>
			<button class='sdk-path-button'>...</button>
			</div>
			<div id='path_err' class="${err_class}">
				<div class="negative">Required files can not be found at that path!</div>
				<div class="negative">Please download, install and provide a path to the most recent version of <strong>WOWCube Development Kit</strong></div>
				<div class="negative">and make sure you have selected supported SDK version.</div>
			</div>
			<br/>
			<div>SDK Version</div>
			<select id="versions" class='selector'>`;
        let versions = Configuration_1.Configuration.getVersions();
        let version = Configuration_1.Configuration.getCurrentVersion();
        for (var i = 0; i < versions.length; i++) {
            if (versions[i] !== version) {
                body += `<option value="` + versions[i] + `">` + versions[i] + `</option>`;
            }
            else {
                body += `<option value="` + versions[i] + `" selected>` + versions[i] + `</option>`;
            }
        }
        body += `</select>

			<br/>
			<br/>
			<button class="share-adhoc-button">Check For Updates</button>

			<script nonce="${nonce}" src="${scriptUri}"></script>
		</body>
		</html>`;
        return body;
    }
}
exports.SettingsViewProvider = SettingsViewProvider;
SettingsViewProvider.viewType = 'WOWCubeSDK.settingsView';
//# sourceMappingURL=SettingsViewProvider.js.map