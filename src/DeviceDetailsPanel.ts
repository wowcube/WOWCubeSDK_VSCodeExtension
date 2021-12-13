/* eslint-disable curly */
import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as cp from 'child_process';
import {Configuration} from './Configuration';
import { Providers } from "./Providers";

export class DeviceDetailsPanel {

    public static currentPanel: DeviceDetailsPanel | undefined;
    public static readonly viewType = "WOWCubeSDK.deviceDetailsPanel";

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private _currentState:number = -1;

    public static createOrShow(extensionUri: vscode.Uri) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        // If we already have a panel, show it.      
        if (DeviceDetailsPanel.currentPanel) 
        {
            DeviceDetailsPanel.currentPanel._panel.reveal(column);
            return;     
        }
        
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(
            DeviceDetailsPanel.viewType,
            'WOWCube Device',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        DeviceDetailsPanel.currentPanel = new DeviceDetailsPanel(panel, extensionUri);    
    }

    public static kill() 
    { 
        DeviceDetailsPanel.currentPanel?.dispose();
        DeviceDetailsPanel.currentPanel = undefined; 
    }

    public static revive(panel: vscode.WebviewPanel,extensionUri: vscode.Uri) 
    {    
        DeviceDetailsPanel.currentPanel = new DeviceDetailsPanel(panel, extensionUri);  
    }

    public static setDevice(device:any) 
    { 
        if(DeviceDetailsPanel.currentPanel?._panel?.visible)
        {
            DeviceDetailsPanel.currentPanel?._panel?.webview.postMessage({ type: 'setDeviceName',value: {name:device.name+' ('+device.mac+')'}}); 
            DeviceDetailsPanel.currentPanel?._update();
        }
    }

    private constructor(panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri) {    
            this._panel = panel;    
            this._extensionUri = extensionUri;

        // Set the webview's initial html content    
            this._update();

            this._panel.onDidDispose(() => this.dispose(), 
                null, this._disposables);
            
        // Update the content based on view changes 
            this._panel.onDidChangeViewState(  
                e => {
                    if (this._panel.visible) 
                    {  
                        if(this._currentState!==1)
                        {
                            this._currentState = 1;
                            this._update();
                        }
                    }
                    else
                    {
                        this._currentState = 0;
                    }
                },
                null,
                this._disposables
            );

            // Handle messages from the webview  
            this._panel.webview.onDidReceiveMessage(    
                message => {
                    switch (message.type) 
                    {
                        case 'error':
                             vscode.window.showErrorMessage(message.value); 
                        break;
                        case 'warn':
                            vscode.window.showWarningMessage(message.value); 
                        break;
                        case 'refresh':
                            {
                                var device = Configuration.getCurrentDevice();
                                if(device!==null)
                                {
                                    if(Configuration.isDeviceBusy(device.mac)===true)
                                    {
                                        this._panel.webview.postMessage({ type: 'endRequest'});
                                        vscode.window.showWarningMessage("Device '"+device.name+"' is busy, please try again later");   
                                    }
                                    else
                                    {
                                        this.doGetDeviceInfo(device.mac);
                                        Providers.btdevices.showWait(true);
                                    }
                                }
                                else
                                {
                                    this._panel.webview.postMessage({ type: 'endRequest'});
                                    Providers.btdevices.showWait(false);

                                    vscode.window.showWarningMessage("WOWCube device is not selected"); 
                                }
                            }
                        break;
                        case 'deleteapp':
                            {
                                var device = Configuration.getCurrentDevice();
                                if(device===null)
                                {
                                    this._panel.webview.postMessage({ type: 'endRequest'});
                                    Providers.btdevices.showWait(false);

                                    vscode.window.showWarningMessage("WOWCube device is not selected"); 
                                }
                                else
                                {
                                    if(Configuration.isDeviceBusy(device.mac)===true)
                                    {
                                        vscode.window.showWarningMessage("Device '"+device.name+"' is busy, please try again later");   
                                    }
                                    else
                                    {
                                        var appname = message.value;
                                        if(appname!==null)
                                        {
                                            vscode.window.showInformationMessage(
                                                "Application '"+appname+"' will be deleted from the device",
                                                ...["Delete Application", "Cancel"]
                                            ).then((answer)=>
                                            {
                                                if(answer==="Delete Application")
                                                {
                                                    this.doDeleteApp(device.mac,appname);
                                                    Providers.btdevices.showWait(true); 
                                                }
                                                else
                                                {
                                                    this._panel.webview.postMessage({ type: 'endRequest'});
                                                    Providers.btdevices.showWait(false);
                                                }
                                            });
                                        }
                                        else
                                        {
                                            this._panel.webview.postMessage({ type: 'endRequest'});
                                            Providers.btdevices.showWait(false);

                                            vscode.window.showWarningMessage("Unable to delete this app");   
                                        }
                                    }   
                                }
                            }
                        break;
                    }
                },
                null,
                this._disposables 
            );
        }

        public dispose() {    
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

        private _update() 
        {
            const webview = this._panel.webview;    
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        
            if(this._panel.visible)
            {
                this._currentState = 1;

                var device = Configuration.getCurrentDevice();
                if(device!==null)
                {
                    if(!Configuration.isDeviceBusy(device.mac)===true)
                    {
                        this._panel.webview.postMessage({ type: 'setDeviceName',value: {name:device.name+' ('+device.mac+')'}}); 
                        this._panel.webview.postMessage({ type: 'startRequest'});
                        Providers.btdevices.showWait(true);

                        this.doGetDeviceInfo(device.mac);
                    }
                    else
                    {
                        this._panel.webview.postMessage({ type: 'endRequest'});    
                        vscode.window.showWarningMessage("Device '"+device.name+"' is busy, please try again later");   
                    }
                }
                else
                {
                    this._panel.webview.postMessage({ type: 'endRequest'});
                    Providers.btdevices.showWait(false);

                    vscode.window.showWarningMessage("WOWCube device is not selected"); 
                }
            }
            else
            {
                this._currentState = 0;
            }
        }
        
        private _getHtmlForWebview(webview: vscode.Webview) {    
            const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
            const styleVSCodeUri = webview.asWebviewUri( vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
            const styleMainCodeUri = webview.asWebviewUri( vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
            const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));

            const scriptUri = webview.asWebviewUri( vscode.Uri.joinPath(this._extensionUri, "media", "devicedetails.js"));

            const nonce = getNonce();  
            const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media')
                ).toString().replace('%22', '');

            var lastPath = Configuration.getLastPath();
            if(typeof(lastPath)==='undefined') lastPath='';

            var ret =  `      
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

                        <div style="margin-top:20px;margin-bottom:5px;">
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
                        <div style="display:inline-block;font-size:14px;"><strong>Installed Applications</strong></div>
                    
                        <div id="applist" class="items" style="top:280px;">
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

        private async doGetDeviceInfo(mac:string): Promise<void>
        {
            return new Promise<void>((resolve) =>
            {
                var out:Array<string> = new Array();
                var err:boolean = false;
                var info:string = "";
                var utilspath = Configuration.getUtilsPath();
                var command = '"'+utilspath+Configuration.getLoader()+'"';
    
                command+=" ci -f -a ";
                command+=mac;
    
                Configuration.setDeviceBusy(mac,true);
                var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
                {    
                    Configuration.setDeviceBusy(mac,false);                    
                    if (stderr && stderr.length > 0) 
                    {
                        out.push(stderr);
                    }
    
                    if (stdout && stdout.length > 0) 
                    {
                        out.push(stdout);
                    }
                    
                    if(child.exitCode===0)
                    {
                        out.forEach(line=>{
                            
                            line = line.replace('\n','');
    
                            if(line.indexOf('Error:')!==-1)
                            {
                                err = true;
                            }
    
                            if(line.indexOf('Build name')!==-1)
                            {
                                var l:string[] = line.split('\n');
    
                                l.forEach(s=>{
                                    if(s.indexOf('Build name:')!==-1) {info = s;}
                                });
                            }
                        });
                    }
                    else
                    {
                        err = true;
                    }
    
                    if(err)
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:-1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,-1);

                            this._panel.webview.postMessage({ type: 'endRequest'});
                            Providers.btdevices.showWait(false);
                        }
                    else
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,1);

                            if(info.length>0)
                            {
                                this._panel?.webview.postMessage({ type: 'setDeviceInfo',value: {mac:mac,info:info}}); 
                            }

                            this.doGetBatteryInfo(mac);
                        }
        
                    resolve();
                });	
            });
        }

        private async doGetBatteryInfo(mac:string): Promise<void>
        {
            return new Promise<void>((resolve) =>
            {
                var out:Array<string> = new Array();
                var err:boolean = false;
                var info:string = "";
                var utilspath = Configuration.getUtilsPath();
                var command = '"'+utilspath+Configuration.getLoader()+'"';
    
                command+=" ci -c -a ";
                command+=mac;
    
                Configuration.setDeviceBusy(mac,true);
                var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
                {    
                    Configuration.setDeviceBusy(mac,false);

                    if (stderr && stderr.length > 0) 
                    {
                        out.push(stderr);
                    }
    
                    if (stdout && stdout.length > 0) 
                    {
                        out.push(stdout);
                    }
    
                    if(child.exitCode===0)
                    {
                        out.forEach(line=>{
                            
                            line = line.replace('\n','');
    
                            if(line.indexOf('Error:')!==-1)
                            {
                                err = true;
                            }
                            else
                            {
                                var l:string[] = line.split('\n');
    
                                l.forEach(s=>{
                                    if(s.indexOf('%')!==-1) {info = s;}
                                });
                            }
                        });
                    }
                    else
                    {
                        err = true;
                    }
    
                    if(err)
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:-1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,-1);

                            this._panel.webview.postMessage({ type: 'endRequest'});
                            Providers.btdevices.showWait(false);

                            vscode.commands.executeCommand('WOWCubeSDK.scanDevices');
                        }
                    else
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,1);

                            if(info.length>0)
                            {
                                this._panel?.webview.postMessage({ type: 'setBatteryInfo',value: {mac:mac,info:info}}); 
                            }

                            this.doAppsList(mac);
                        }
                    resolve();
                });	
            });
        }

        private async doAppsList(mac:string): Promise<void>
        {
            return new Promise<void>((resolve) =>
            {
                var out:Array<string> = new Array();
                var err:boolean = false;
                var info:Array<string> = new Array();
                var utilspath = Configuration.getUtilsPath();
                var command = '"'+utilspath+Configuration.getLoader()+'"';
    
                command+=" ci -al -a ";
                command+=mac;
    
                Configuration.setDeviceBusy(mac,true);
                var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
                {    
                    Configuration.setDeviceBusy(mac,false);
                    if (stderr && stderr.length > 0) 
                    {
                        out.push(stderr);
                    }
    
                    if (stdout && stdout.length > 0) 
                    {
                        out.push(stdout);
                    }
    
                    if(child.exitCode===0)
                    {
                        out.forEach(line=>{
                            
                            line = line.replace('\n','');
    
                            if(line.indexOf('Error:')!==-1)
                            {
                                err = true;
                            }
                            else
                            {
                                var l:string[] = line.split('\n');
    
                                l.forEach(s=>{
                                    if(s.length>0) {info.push(s);}
                                });
                            }
                        });
                    }
                    else
                    {
                        err = true;
                    }
    
                    if(err)
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:-1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,-1);

                            this._panel.webview.postMessage({ type: 'endRequest'});    
                            Providers.btdevices.showWait(false);

                        }
                    else
                        { 
                            this._panel?.webview.postMessage({ type: 'setDeviceStatus',value: {mac:mac,status:1}} ); 
                            Providers.btdevices.setDeviceStatus(mac,1);

                            if(info.length>0)
                            {
                                this._panel?.webview.postMessage({ type: 'setAppsList',value: {mac:mac,info:info}}); 
                            }
                            
                            this._panel.webview.postMessage({ type: 'endRequest'});
                            Providers.btdevices.showWait(false);

                        }
                    resolve();
                });	
            });
        }

        private async doDeleteApp(mac:string, name:string): Promise<void>
        {
            return new Promise<void>((resolve) =>
            {
                var out:Array<string> = new Array();
                var err:boolean = false;
                var info:Array<string> = new Array();
                var utilspath = Configuration.getUtilsPath();
                var command = '"'+utilspath+Configuration.getLoader()+'"';
    
                command+=" rm -n ";
                command+=name;
                command+=" -a ";
                command+=mac;
    
                Configuration.setDeviceBusy(mac,true);
                var child:cp.ChildProcess = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => 
                {    
                    Configuration.setDeviceBusy(mac,false);
                    if (stderr && stderr.length > 0) 
                    {
                        out.push(stderr);
                    }
    
                    if (stdout && stdout.length > 0) 
                    {
                        out.push(stdout);
                    }
    
                    if(child.exitCode===0)
                    {
                        out.forEach(line=>{
                            
                            line = line.replace('\n','');
    
                            if(line.indexOf('Error:')!==-1)
                            {
                                err = true;
                            }
                        });
                    }
                    else
                    {
                        err = true;
                    }
    
                    if(err)
                        { 
                            if(out.length>0)
                                vscode.window.showErrorMessage("Unable to delete this app: "+out[0]);   
                            else
                                vscode.window.showErrorMessage("Unable to delete this app");
                        }
                    else
                        { 
                            this._panel.webview.postMessage({ type: 'deleteAppItem',value: {name:name}});
                        }

                        this._panel.webview.postMessage({ type: 'endRequest'});
                        Providers.btdevices.showWait(false);

                    resolve();
                });	
            });
        }
}
function getWebviewOptions(extensionUri: vscode.Uri): 
vscode.WebviewOptions {    
    return {
        // Enable javascript in the webview
        enableScripts: true,

        localResourceRoots: [  
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}