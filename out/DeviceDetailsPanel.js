"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceDetailsPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Providers_1 = require("./Providers");
const Output_1 = require("./Output");
class DeviceDetailsPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._currentState = -1;
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content    
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes 
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                if (this._currentState !== 1) {
                    this._currentState = 1;
                    this._update();
                }
            }
            else {
                this._currentState = 0;
            }
        }, null, this._disposables);
        // Handle messages from the webview  
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'error':
                    vscode.window.showErrorMessage(message.value);
                    break;
                case 'warn':
                    vscode.window.showWarningMessage(message.value);
                    break;
                case 'cubselect':
                    {
                        const options = {
                            canSelectMany: false,
                            openLabel: 'Select CUB File',
                            canSelectFiles: true,
                            canSelectFolders: false,
                            filters: { 'Cubeapps': ['cub', 'CUB'], 'All Files': ['*.*'] }
                        };
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                if (this._panel) {
                                    var path = fileUri[0].fsPath;
                                    this._panel.webview.postMessage({ type: 'cubSelected', value: path });
                                }
                            }
                        });
                    }
                    break;
                case 'cubupload':
                    {
                        var device = Configuration_1.Configuration.getCurrentDevice();
                        if (device !== null) {
                            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                                this._panel.webview.postMessage({ type: 'endRequest' });
                                vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                            }
                            else {
                                if (message.value != '') {
                                    this.doUploadApp(device.mac, message.value);
                                    Providers_1.Providers.btdevices.showWait(true);
                                }
                                else {
                                    this._panel.webview.postMessage({ type: 'endRequest' });
                                    Providers_1.Providers.btdevices.showWait(false);
                                    vscode.window.showWarningMessage("CUB file is not selected");
                                }
                            }
                        }
                        else {
                            this._panel.webview.postMessage({ type: 'endRequest' });
                            Providers_1.Providers.btdevices.showWait(false);
                            vscode.window.showWarningMessage("WOWCube device is not selected");
                        }
                    }
                    break;
                case 'refresh':
                    {
                        var device = Configuration_1.Configuration.getCurrentDevice();
                        if (device !== null) {
                            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                                this._panel.webview.postMessage({ type: 'endRequest' });
                                vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                            }
                            else {
                                this.doGetDeviceInfoAll(device.mac);
                                Providers_1.Providers.btdevices.showWait(true);
                            }
                        }
                        else {
                            this._panel.webview.postMessage({ type: 'endRequest' });
                            Providers_1.Providers.btdevices.showWait(false);
                            vscode.window.showWarningMessage("WOWCube device is not selected");
                        }
                    }
                    break;
                case 'runapp':
                    {
                        var device = Configuration_1.Configuration.getCurrentDevice();
                        if (device === null) {
                            this._panel.webview.postMessage({ type: 'endRequest' });
                            Providers_1.Providers.btdevices.showWait(false);
                            vscode.window.showWarningMessage("WOWCube device is not selected");
                        }
                        else {
                            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                                vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                            }
                            else {
                                var appname = message.value.replace('\r', '');
                                if (appname !== null) {
                                    this.doRunApp(device.mac, appname);
                                    Providers_1.Providers.btdevices.showWait(true);
                                }
                                else {
                                    this._panel.webview.postMessage({ type: 'endRequest' });
                                    Providers_1.Providers.btdevices.showWait(false);
                                    vscode.window.showWarningMessage("Unable to run this app");
                                }
                            }
                        }
                    }
                    break;
                case 'deleteapp':
                    {
                        var device = Configuration_1.Configuration.getCurrentDevice();
                        if (device === null) {
                            this._panel.webview.postMessage({ type: 'endRequest' });
                            Providers_1.Providers.btdevices.showWait(false);
                            vscode.window.showWarningMessage("WOWCube device is not selected");
                        }
                        else {
                            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                                vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                            }
                            else {
                                var appname = message.value.replace('\r', '');
                                if (appname !== null) {
                                    vscode.window.showInformationMessage("Application '" + appname + "' will be deleted from the device", ...["Delete Application", "Cancel"]).then((answer) => {
                                        if (answer === "Delete Application") {
                                            this.doDeleteApp(device.mac, appname);
                                            Providers_1.Providers.btdevices.showWait(true);
                                        }
                                        else {
                                            this._panel.webview.postMessage({ type: 'endRequest' });
                                            Providers_1.Providers.btdevices.showWait(false);
                                        }
                                    });
                                }
                                else {
                                    this._panel.webview.postMessage({ type: 'endRequest' });
                                    Providers_1.Providers.btdevices.showWait(false);
                                    vscode.window.showWarningMessage("Unable to delete this app");
                                }
                            }
                        }
                    }
                    break;
                case 'clearappdata':
                    {
                        var device = Configuration_1.Configuration.getCurrentDevice();
                        if (device === null) {
                            this._panel.webview.postMessage({ type: 'endRequest' });
                            Providers_1.Providers.btdevices.showWait(false);
                            vscode.window.showWarningMessage("WOWCube device is not selected");
                        }
                        else {
                            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                                vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                            }
                            else {
                                var appname = message.value.replace('\r', '');
                                if (appname !== null) {
                                    vscode.window.showInformationMessage("Application data of '" + appname + "' will be cleared from the device", ...["Clear Application Data", "Cancel"]).then((answer) => {
                                        if (answer === "Clear Application Data") {
                                            this.doClearAppData(device.mac, appname);
                                            Providers_1.Providers.btdevices.showWait(true);
                                        }
                                        else {
                                            this._panel.webview.postMessage({ type: 'endRequest' });
                                            Providers_1.Providers.btdevices.showWait(false);
                                        }
                                    });
                                }
                                else {
                                    this._panel.webview.postMessage({ type: 'endRequest' });
                                    Providers_1.Providers.btdevices.showWait(false);
                                    vscode.window.showWarningMessage("Unable to clear application data");
                                }
                            }
                        }
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (DeviceDetailsPanel.currentPanel) {
            DeviceDetailsPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(DeviceDetailsPanel.viewType, 'WOWCube Device', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        DeviceDetailsPanel.currentPanel = new DeviceDetailsPanel(panel, extensionUri);
    }
    static kill() {
        DeviceDetailsPanel.currentPanel?.dispose();
        DeviceDetailsPanel.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        DeviceDetailsPanel.currentPanel = new DeviceDetailsPanel(panel, extensionUri);
    }
    static setDevice(device) {
        if (DeviceDetailsPanel.currentPanel?._panel?.visible) {
            DeviceDetailsPanel.currentPanel?._panel?.webview.postMessage({ type: 'setDeviceName', value: { name: device.name + ' (' + device.mac + ')' } });
            DeviceDetailsPanel.currentPanel?._update();
        }
    }
    dispose() {
        DeviceDetailsPanel.currentPanel = undefined;
        // Clean up our resources  
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        if (this._panel.visible) {
            this._currentState = 1;
            var device = Configuration_1.Configuration.getCurrentDevice();
            if (device !== null) {
                if (!Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                    this._panel.webview.postMessage({ type: 'setDeviceName', value: { name: device.name + ' (' + device.mac + ')' } });
                    this._panel.webview.postMessage({ type: 'startRequest' });
                    Providers_1.Providers.btdevices.showWait(true);
                    this.doGetDeviceInfoAll(device.mac);
                }
                else {
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    vscode.window.showWarningMessage("Device '" + device.name + "' is busy, please try again later");
                }
            }
            else {
                this._panel.webview.postMessage({ type: 'endRequest' });
                Providers_1.Providers.btdevices.showWait(false);
                vscode.window.showWarningMessage("WOWCube device is not selected");
            }
        }
        else {
            this._currentState = 0;
        }
    }
    _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "devicedetails.js"));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var lastPath = Configuration_1.Configuration.getLastPath();
        if (typeof (lastPath) === 'undefined')
            lastPath = '';
        var ret = `      
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet"> 
                    <link href="${styleMainCodeUri}" rel="stylesheet"> 
                    <link href="${styleWaitUri}" rel="stylesheet"> 
                    <title>WOWCube Device Details</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">WOWCube Device Details</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Basic information and management</div>
                        <div class="separator"></div>

                        <div class="view">
                            <div style="margin-top:0px;margin-bottom:5px;">
                                <div style="display:inline-block;font-size:14px;margin-bottom:15px;"><strong>Device:</strong></div>
                                <div id="device" class="positive" style="display:inline-block;font-size:14px;"> </div>
                            </div>

                            <div>
                                <div style="display:inline-block;font-size:14px;margin-bottom:10px;"><strong>Status:</strong></div>
                                <div id="status" class="positive" style="display:inline-block;font-size:14px;"></div>
                            </div>

                            <div>
                                <div style="display:inline-block;font-size:14px;margin-bottom:10px;"><strong>Firmware:</strong></div>
                                <div id="firmware" style="display:inline-block;font-size:14px;"></div>
                            </div>

                            <div>
                                <div style="display:inline-block;font-size:14px;margin-bottom:10px;"><strong>Battery:</strong></div>
                                <div id="charge" style="display:inline-block;font-size:14px;"></div>
                            </div>

                            <div style="margin-top:40px;">
                                <div style="display:inline-block;font-size:14px;"><strong>Application Uploader</strong></div>
                                <br/>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Select CUB application file to upload</div>
                                <br/>
                                <input id="cubuploadname" style="display:inline-block; width:calc(100% - 300px);min-width:140px;" readonly></input>
                                 <button id="cubselect_button" style="display:inline-block; width:120px;margin-left:10px;">Select File</button>
                                 <button id="cubupload_button" style="display:inline-block; width:120px;">Upload</button>
                            </div>

                            <div style="margin-top:40px;">
                                <div style="display:inline-block;font-size:14px;"><strong>Installed Applications</strong></div>
                            
                                <div id="applist" class="items" style="margin-top:10px;">
                                </div>
                            </div>

                        </div>
                        <button id="refresh_button" style="position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">REFRESH DEVICE INFORMATION</button>
                    </div>
                    </div>

                    <div id="wait" class="fullscreen topmost hidden">
                        <div class="centered">
                        <div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                        </div>
                    <div>
                </body>
                </html> 
            `;
        return ret;
    }
    async doGetDeviceInfoAll(mac) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = "";
            var battery = "";
            var apps = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " ci -f -c -al -a ";
            command += mac;
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                        else {
                            var l = line.split('\n');
                            l.forEach(s => {
                                if (s.indexOf('Build name:') !== -1) {
                                    info = s;
                                }
                                if (s.indexOf('%') !== -1) {
                                    battery = s;
                                }
                                if (s.indexOf('.cub') !== -1 || s.indexOf('.CUB') !== -1) {
                                    apps.push(s);
                                }
                            });
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: -1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, -1);
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                }
                else {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: 1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, 1);
                    if (info.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setDeviceInfo', value: { mac: mac, info: info } });
                    }
                    else {
                        this._panel?.webview.postMessage({ type: 'setDeviceInfo', value: { mac: mac, info: "Unknown firmware" } });
                    }
                    if (battery.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setBatteryInfo', value: { mac: mac, info: battery } });
                    }
                    else {
                        this._panel?.webview.postMessage({ type: 'setBatteryInfo', value: { mac: mac, info: "Unknwon status" } });
                    }
                    if (apps.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setAppsList', value: { mac: mac, info: apps } });
                    }
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                }
                resolve();
            });
        });
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
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                        if (line.indexOf('Build name') !== -1) {
                            var l = line.split('\n');
                            l.forEach(s => {
                                if (s.indexOf('Build name:') !== -1) {
                                    info = s;
                                }
                            });
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: -1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, -1);
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                }
                else {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: 1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, 1);
                    if (info.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setDeviceInfo', value: { mac: mac, info: info } });
                    }
                    this.doGetBatteryInfo(mac);
                }
                resolve();
            });
        });
    }
    async doGetBatteryInfo(mac) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = "";
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " ci -c -a ";
            command += mac;
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                        else {
                            var l = line.split('\n');
                            l.forEach(s => {
                                if (s.indexOf('%') !== -1) {
                                    info = s;
                                }
                            });
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: -1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, -1);
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                    vscode.commands.executeCommand('WOWCubeSDK.scanDevices');
                }
                else {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: 1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, 1);
                    if (info.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setBatteryInfo', value: { mac: mac, info: info } });
                    }
                    this.doAppsList(mac);
                }
                resolve();
            });
        });
    }
    async doAppsList(mac) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " ci -al -a ";
            command += mac;
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        //line = line.replace('\n','');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                        else {
                            var l = line.split('\n');
                            l.forEach(s => {
                                if (s.length > 0) {
                                    //reject all lines that contain no cubeapp name
                                    const ext = ".cub";
                                    const ss = s.toLowerCase();
                                    if (ss.indexOf(ext) !== -1) {
                                        info.push(s.replace('\r', ''));
                                    }
                                }
                            });
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: -1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, -1);
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                }
                else {
                    this._panel?.webview.postMessage({ type: 'setDeviceStatus', value: { mac: mac, status: 1 } });
                    Providers_1.Providers.btdevices.setDeviceStatus(mac, 1);
                    if (info.length > 0) {
                        this._panel?.webview.postMessage({ type: 'setAppsList', value: { mac: mac, info: info } });
                    }
                    this._panel.webview.postMessage({ type: 'endRequest' });
                    Providers_1.Providers.btdevices.showWait(false);
                }
                resolve();
            });
        });
    }
    async doDeleteApp(mac, name) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " rm -n ";
            command += name;
            command += " -a ";
            command += mac;
            var s = "Deleting '" + name + "' from device...";
            this._channel.appendLine(s);
            this._channel.show(true);
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    if (out.length > 0)
                        vscode.window.showErrorMessage("Unable to delete this app: " + out[0]);
                    else
                        vscode.window.showErrorMessage("Unable to delete this app");
                    this._channel.appendLine("Failed to delete the cubeapp");
                }
                else {
                    this._panel.webview.postMessage({ type: 'deleteAppItem', value: { name: name } });
                    this._channel.appendLine("Cubeapp successfully deleted");
                }
                this._panel.webview.postMessage({ type: 'endRequest' });
                Providers_1.Providers.btdevices.showWait(false);
                resolve();
            });
        });
    }
    async doClearAppData(mac, name) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " rm -s -n ";
            command += name;
            command += " -a ";
            command += mac;
            var s = "Clearing '" + name + "' data...";
            this._channel.appendLine(s);
            this._channel.show(true);
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    if (out.length > 0)
                        vscode.window.showErrorMessage("Unable to clear the data: " + out[0]);
                    else
                        vscode.window.showErrorMessage("Unable to clear the data");
                    this._channel.appendLine("Failed to clear the data");
                }
                else {
                    this._channel.appendLine("Cubeapp data successfully cleared");
                }
                this._panel.webview.postMessage({ type: 'endRequest' });
                Providers_1.Providers.btdevices.showWait(false);
                resolve();
            });
        });
    }
    async doRunApp(mac, name) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " ra -n ";
            command += name;
            command += " -a ";
            command += mac;
            var s = "Starting '" + name + "'...";
            this._channel.appendLine(s);
            this._channel.show(true);
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (stderr && stderr.length > 0) {
                    out.push(stderr);
                }
                if (stdout && stdout.length > 0) {
                    out.push(stdout);
                }
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    if (out.length > 0)
                        vscode.window.showErrorMessage("Unable to run this app: " + out[0]);
                    else
                        vscode.window.showErrorMessage("Unable to run this app");
                    this._channel.appendLine("Failed to start the cubeapp");
                }
                else {
                    this._channel.appendLine("Cubeapp started");
                }
                this._panel.webview.postMessage({ type: 'endRequest' });
                Providers_1.Providers.btdevices.showWait(false);
                resolve();
            });
        });
    }
    async doUploadApp(mac, source) {
        return new Promise((resolve) => {
            var out = new Array();
            var err = false;
            var info = new Array();
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            command += " up -p ";
            command += '"' + source + '"';
            command += " -a ";
            command += mac;
            command += " -r";
            Configuration_1.Configuration.setDeviceBusy(mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(mac, false);
                if (child.exitCode === 0) {
                    out.forEach(line => {
                        line = line.replace('\n', '');
                        if (line.indexOf('Error:') !== -1) {
                            err = true;
                        }
                    });
                }
                else {
                    err = true;
                }
                if (err) {
                    if (out.length > 0)
                        vscode.window.showErrorMessage("Unable to upload this app: " + out[0]);
                    else
                        vscode.window.showErrorMessage("Unable to upload this app");
                    this._channel.appendLine('CUB file upload error');
                    this._panel.webview.postMessage({ type: 'endRequest' });
                }
                else {
                    this._panel.webview.postMessage({ type: 'endUpload' });
                    this._channel.appendLine('CUB file has been successfully uploaded, refreshing applicaiton list...');
                }
                Providers_1.Providers.btdevices.showWait(false);
                this.closeEmitter.fire(0);
                resolve();
            });
            var that = this;
            child?.stdout?.on('data', function (data) {
                that._channel.appendLine(data);
                that._channel.show(true);
            });
            child?.stderr?.on('data', function (data) {
                that._channel.appendLine(data);
                that._channel.show(true);
            });
        });
    }
}
exports.DeviceDetailsPanel = DeviceDetailsPanel;
DeviceDetailsPanel.viewType = "WOWCubeSDK.deviceDetailsPanel";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=DeviceDetailsPanel.js.map