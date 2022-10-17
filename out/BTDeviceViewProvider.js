"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTDeviceViewProvider = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const DeviceDetailsPanel_1 = require("./DeviceDetailsPanel");
class BTDeviceViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this.devices = new Array();
        this._busy = false;
    }
    async reload() {
        if (!this._busy) {
            this._view?.webview.postMessage({ type: 'beginDiscovery' });
            this._busy = true;
            this.doDeviceDiscovery();
        }
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        this._view?.onDidChangeVisibility(e => {
            if (this._view?.visible) {
                this._loadeSavedDevices();
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
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'buttonPressed':
                    {
                        vscode.commands.executeCommand('WOWCubeSDK.scanDevices');
                    }
                    break;
                case 'manageButtonPressed':
                    {
                        vscode.commands.executeCommand('WOWCubeSDK.openDeviceDetails');
                    }
                    break;
                case 'deviceSelected':
                    {
                        var currentDevice = Configuration_1.Configuration.getCurrentDevice();
                        if (currentDevice === null) {
                            currentDevice = { name: "", mac: "" };
                        }
                        if (currentDevice.name !== data.value.name || currentDevice.mac !== data.value.mac) {
                            Configuration_1.Configuration.setCurrentDevice(data.value);
                            DeviceDetailsPanel_1.DeviceDetailsPanel.setDevice(data.value);
                        }
                    }
                    break;
                case 'checkDeviceConnection':
                    {
                        this.doGetDeviceInfo(data.value.mac);
                    }
                    break;
            }
        });
        this._loadeSavedDevices();
    }
    setDeviceStatus(mac, status) {
        this._view?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: status } });
    }
    showWait(b) {
        if (b) {
            this._view?.webview.postMessage({ type: 'showWait', value: { show: b } });
        }
        else {
            this._view?.webview.postMessage({ type: 'hideWait', value: { show: b } });
        }
    }
    _loadeSavedDevices() {
        var devices = Configuration_1.Configuration.getLastDetectedDevices();
        this._view?.webview.postMessage({ type: 'endDiscovery', value: devices });
        var dev = Configuration_1.Configuration.getCurrentDevice();
        if (dev !== null) {
            this._view?.webview.postMessage({ type: 'selectDevice', value: dev });
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'btdeviceview.js'));
        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));
        // Use a nonce to only allow a specific script to be run.
        const nonce = (0, getNonce_1.getNonce)();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleWaitUri}" rel="stylesheet">

				<title>Bluetooth Devices</title>
			</head>
			<body>
				<br/>
				<div>Please select WOWCube device from the list</div>
	
				<div id="debug"></div>
				<br/>
				<div class="wait" id="wait">
					<div class="centered">
						<div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
					</div>
				</div>
				<div class="visible" id="list">
					<ul class="bt-list" id="bt-list">
					</ul>
				</div>
				<br/>
				<button class="bt-scan-button">Scan For Paired Devices</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
    async doGetDeviceInfo(mac) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = "";
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " ci -f -a ";
            command += mac;
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                        if (line.indexOf('Build name') !== -1) {
                            info = line;
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    this._view?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: -1 } });
                }
                else {
                    this._view?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: 1 } });
                    if (info.length > 0) {
                        this._view?.webview.postMessage({ type: 'setDeviceInfo', value: { mac: mac, info: info } });
                    }
                }
                resolve();
            });
            child?.stdout?.on('data', function (data) {
                out.push(data);
            });
            child?.stderr?.on('data', function (data) {
                out.push(data);
            });
        });
    }
    async doDeviceDiscovery() {
        return new Promise((resolve) => {
            var out = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " dd";
            this.devices = [];
            if (Configuration_1.Configuration.isAnyDeviceBusy() === true) {
                vscode.window.showWarningMessage("At least one device from the list is busy, please wait till current operation is complete to scan for new devices.");
                this._view?.webview.postMessage({ type: 'endDiscovery', value: this.devices });
                this._busy = false;
                resolve();
            }
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        var l = line.split('\n');
                        l.forEach(sline => {
                            sline = sline.replace('\n', '');
                            sline = sline.replace('\r', '');
                            var i_n = sline.indexOf('Name:');
                            var i_m = sline.indexOf('Mac:');
                            if (i_n === 0 && i_m !== -1) {
                                var deviceName = sline.substr(5, i_m - 5 - 1);
                                var deviceMac = sline.substr(i_m + 4);
                                this.devices.push({ name: deviceName, mac: deviceMac });
                            }
                        });
                    });
                    Configuration_1.Configuration.setLastDetectedDevices(this.devices);
                }
                else {
                }
                this._view?.webview.postMessage({ type: 'endDiscovery', value: this.devices });
                this._busy = false;
                resolve();
            });
            child?.stdout?.on('data', function (data) {
                out.push(data);
            });
            child?.stderr?.on('data', function (data) {
                out.push(data);
            });
        });
    }
}
exports.BTDeviceViewProvider = BTDeviceViewProvider;
BTDeviceViewProvider.viewType = 'WOWCubeSDK.btdeviceView';
//# sourceMappingURL=BTDeviceViewProvider.js.map