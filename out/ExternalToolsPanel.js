"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalToolsPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const DownloadManager_1 = require("./DownloadManager");
const ArchiveManager_1 = require("./ArchiveManager");
const Script_1 = require("./Script");
class ExternalToolsPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        //downloader
        this._url = "";
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content    
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes 
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
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
                case 'installButtonPressed':
                    {
                        var toolspath = Configuration_1.Configuration.getToolsPath();
                        if (toolspath === '') {
                            this._channel.appendLine("External Tools management: Unable to create a folder for saving the package");
                            this._channel.show(true);
                            return;
                        }
                        //check if some cleanup's required
                        var problem = Configuration_1.Configuration.checkCurrentInstallation();
                        if (problem != Configuration_1.InstallationProblem.None) {
                            switch (problem) {
                                case Configuration_1.InstallationProblem.EmscriptedPresent:
                                    {
                                        //remove emscripten
                                        if (message.value.pack === 'cpp') {
                                            if (!ExternalToolsPanel.currentPanel?.deleteDir(toolspath + message.value.pack)) {
                                                vscode.window.showErrorMessage("Failed to remove previous installation of the package");
                                                this._channel.appendLine("External Tools management: The required cleanup of the previous installation of C++ package has failed!");
                                                this._channel.appendLine("Please restart VSCode and try again");
                                                this._channel.show(true);
                                                return;
                                            }
                                            else {
                                                this._channel.appendLine("External Tools management: Previous version of C++ support package has been successfully deleted, installing new version...");
                                                this._channel.show(true);
                                            }
                                        }
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }
                        this._url = Configuration_1.Configuration.getPackageDownloadURL(message.value.pack);
                        ExternalToolsPanel.currentPack = message.value.pack;
                        ExternalToolsPanel._filename = toolspath + "package.zip";
                        if (this._url === '') {
                            this._channel.appendLine("External Tools management: Unable to find download url for the package");
                            this._channel.show(true);
                            return;
                        }
                        ExternalToolsPanel.currentPanel?.setProgress('Getting ready to download the package...');
                        ExternalToolsPanel.currentPanel?.showWait(true);
                        DownloadManager_1.DownloadManager.getFileLength(this._url).then(function (value) {
                            const url = value.url;
                            const len = value.length;
                            if (ExternalToolsPanel.currentPack == 'rust') {
                                DownloadManager_1.DownloadManager.doDownload(url, ExternalToolsPanel._filename, len, (value, progress) => {
                                    console.log(value + '%');
                                    console.log(progress.transferred);
                                    ExternalToolsPanel.currentPanel?._channel.appendLine(`Downloaded ${value}% / ${progress.transferred} of ${len}`);
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    ExternalToolsPanel.currentPanel?.setProgress('Package is being downloaded: ' + value + '%');
                                }).then(function (value) {
                                    var toolspath = Configuration_1.Configuration.getToolsPath();
                                    ExternalToolsPanel.currentPanel?.setProgress('Package is being installed...');
                                    ExternalToolsPanel.currentPanel?._channel.appendLine(`\nDownloading and installing Rust compiler package components, please wait...\n`);
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    ArchiveManager_1.ArchiveManager.doUnzip(value, toolspath, () => {
                                        if (Configuration_1.Configuration.isMac()) {
                                            try {
                                                var rustini_script = Configuration_1.Configuration.getFullToolPath("install.sh");
                                                if (Script_1.Script.load(rustini_script)) {
                                                    var cargo = Configuration_1.Configuration.getToolsPath() + 'rust/cargo';
                                                    var rustup = Configuration_1.Configuration.getToolsPath() + 'rust/rustup';
                                                    var ruinit = Configuration_1.Configuration.getFullToolPath("rustup-init.sh");
                                                    Script_1.Script.setValue("%%CARGOHOME%%", cargo);
                                                    Script_1.Script.setValue("%%RUSTUPHOME%%", rustup);
                                                    Script_1.Script.setValue("%%RUSTUPINIT%%", ruinit);
                                                    if (!Script_1.Script.save()) {
                                                        throw new Error("Unable to generate installation script, failed to save " + rustini_script);
                                                    }
                                                }
                                                else {
                                                    throw new Error("Unable to generate installation script, failed to load " + rustini_script);
                                                }
                                                var rustinit_command = '"' + Configuration_1.Configuration.getFullToolPath("install.sh") + '"';
                                                var child = cp.exec(rustinit_command, { cwd: "" }, (error, stdout, stderr) => {
                                                    if (stderr && stderr.length > 0) {
                                                        if (stderr.length > 2) {
                                                            ExternalToolsPanel.currentPanel?._channel.appendLine(stderr);
                                                            ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        }
                                                    }
                                                    if (stdout && stdout.length > 0) {
                                                        if (stdout.includes("Rust is installed now")) {
                                                            stdout = "Rust is installed now. Great!";
                                                        }
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine(stdout);
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                    }
                                                    if (child.exitCode === 0) {
                                                        //success
                                                        var fname = Configuration_1.Configuration.getFullToolPath("install.sh");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete installation script
                                                        }
                                                        fname = Configuration_1.Configuration.getFullToolPath("rustup-init.sh");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete rustup-init
                                                        }
                                                        fname = Configuration_1.Configuration.getFullToolPath("package.zip");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete downloaded archive
                                                        }
                                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: The package has been successfully installed");
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        ExternalToolsPanel.currentPanel?.reload();
                                                    }
                                                    else {
                                                        vscode.window.showErrorMessage("Unable to install Rust package");
                                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unalbe to completely install the package");
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        ExternalToolsPanel.currentPanel?.reload();
                                                    }
                                                });
                                            }
                                            catch (e) {
                                                ExternalToolsPanel.currentPanel?._channel.appendLine(`External Tools management: Unalbe to completely install the package, ${e}`);
                                                vscode.window.showErrorMessage(e.message);
                                                ExternalToolsPanel.currentPanel?.showWait(false);
                                                ExternalToolsPanel.currentPanel?.reload();
                                            }
                                        }
                                        if (Configuration_1.Configuration.isWindows()) {
                                            try {
                                                var rustini_script = Configuration_1.Configuration.getFullToolPath("rust/install.bat");
                                                if (Script_1.Script.load(rustini_script)) {
                                                    var cargo = Configuration_1.Configuration.getToolsPath() + 'rust/cargo';
                                                    var rustup = Configuration_1.Configuration.getToolsPath() + 'rust/rustup';
                                                    var ruinit = Configuration_1.Configuration.getFullToolPath("rust/rustup-init.exe");
                                                    Script_1.Script.setValue("%%CARGOHOME%%", cargo);
                                                    Script_1.Script.setValue("%%RUSTUPHOME%%", rustup);
                                                    Script_1.Script.setValue("%%RUSTUPINIT", ruinit);
                                                    if (!Script_1.Script.save()) {
                                                        throw new Error("Unable to generate installation script, failed to save " + rustini_script);
                                                    }
                                                }
                                                else {
                                                    throw new Error("Unable to generate installation script, failed to load " + rustini_script);
                                                }
                                                var rustinit_command = '"' + Configuration_1.Configuration.getFullToolPath("rust/install.bat") + '"';
                                                var child = cp.exec(rustinit_command, { cwd: "" }, (error, stdout, stderr) => {
                                                    if (stderr && stderr.length > 0) {
                                                        if (stderr.length > 2) {
                                                            ExternalToolsPanel.currentPanel?._channel.appendLine(stderr);
                                                            ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        }
                                                    }
                                                    if (stdout && stdout.length > 0) {
                                                        if (stdout.includes("Rust is installed now")) {
                                                            stdout = "Rust is installed now. Great!";
                                                        }
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine(stdout);
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                    }
                                                    if (child.exitCode === 0) {
                                                        //success
                                                        var fname = Configuration_1.Configuration.getFullToolPath("rust/install.bat");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete installation script
                                                        }
                                                        fname = Configuration_1.Configuration.getFullToolPath("rust/rustup-init.exe");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete rustup-init
                                                        }
                                                        fname = Configuration_1.Configuration.getFullToolPath("package.zip");
                                                        if (fs.existsSync(fname)) {
                                                            fs.unlink(fname, () => { }); // Delete downloaded archive
                                                        }
                                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: The package has been successfully installed");
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        ExternalToolsPanel.currentPanel?.reload();
                                                    }
                                                    else {
                                                        vscode.window.showErrorMessage("Unable to install Rust package");
                                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                                        ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unalbe to completely install the package");
                                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                                        ExternalToolsPanel.currentPanel?.reload();
                                                    }
                                                });
                                            }
                                            catch (e) {
                                                ExternalToolsPanel.currentPanel?._channel.appendLine(`External Tools management: Unalbe to completely install the package, ${e}`);
                                            }
                                        } //isWindows   
                                    }, (e) => {
                                        vscode.window.showErrorMessage(e);
                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                        ExternalToolsPanel.currentPanel?._channel.appendLine(`External Tools management: Unalbe to install the package, ${e}`);
                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                        ExternalToolsPanel.currentPanel?.reload();
                                    });
                                });
                            }
                            else {
                                DownloadManager_1.DownloadManager.doDownload(url, ExternalToolsPanel._filename, len, (value, progress) => {
                                    console.log(value + '%');
                                    console.log(progress.transferred);
                                    ExternalToolsPanel.currentPanel?._channel.appendLine(`Downloaded ${value}% / ${progress.transferred} of ${len}`);
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    ExternalToolsPanel.currentPanel?.setProgress('Package is being downloaded: ' + value + '%');
                                }).then(function (value) {
                                    var toolspath = Configuration_1.Configuration.getToolsPath();
                                    ExternalToolsPanel.currentPanel?.setProgress('Package is being installed...');
                                    ArchiveManager_1.ArchiveManager.doUnzip(value, toolspath, () => {
                                        ExternalToolsPanel.currentPanel?.fixPackageFilesPermissons(() => {
                                            //success;
                                            ExternalToolsPanel.currentPanel?.showWait(false);
                                            ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: The package has been successfully installed");
                                            ExternalToolsPanel.currentPanel?._channel.show(true);
                                            //delete source package file
                                            try {
                                                if (fs.existsSync(value)) {
                                                    fs.unlink(value, () => { }); // Delete temp file
                                                }
                                            }
                                            catch (e) {
                                                ExternalToolsPanel.currentPanel?._channel.appendLine(`External Tools management: but the temporary file has not been deleted due error: ${e}`);
                                            }
                                            ExternalToolsPanel.currentPanel?.reload();
                                        }, (e) => {
                                            //error
                                            vscode.window.showErrorMessage(e);
                                            ExternalToolsPanel.currentPanel?.showWait(false);
                                            ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unalbe to completely install the package, the following error has ocurred while changing package file permissions: " + e);
                                            ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Please try to install the package again or allow file execution permissions to all package files recursively");
                                            ExternalToolsPanel.currentPanel?._channel.show(true);
                                            ExternalToolsPanel.currentPanel?.reload();
                                        });
                                    }, (e) => {
                                        vscode.window.showErrorMessage(e);
                                        ExternalToolsPanel.currentPanel?.showWait(false);
                                        ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unalbe to install the package, " + e);
                                        ExternalToolsPanel.currentPanel?._channel.show(true);
                                        ExternalToolsPanel.currentPanel?.reload();
                                    });
                                }, function (error) {
                                    vscode.window.showErrorMessage(error);
                                    ExternalToolsPanel.currentPanel?.showWait(false);
                                });
                            }
                        }, function (error) {
                            vscode.window.showErrorMessage(error);
                            ExternalToolsPanel.currentPanel?.showWait(false);
                        });
                    }
                    break;
                case 'removeButtonPressed':
                    {
                        vscode.window.showInformationMessage("Package '" + message.value.packname + "' will be removed from the computer", ...["Remove Package", "Cancel"]).then((answer) => {
                            if (answer === "Remove Package") {
                                var toolspath = Configuration_1.Configuration.getToolsPath();
                                ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management:  Uninstalling '" + message.value.packname + "' package");
                                ExternalToolsPanel.currentPanel?._channel.show(true);
                                if (toolspath === '') {
                                    ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management: Unable to locate tools folder");
                                    ExternalToolsPanel.currentPanel?._channel.show(true);
                                    return;
                                }
                                ExternalToolsPanel.currentPanel?.setProgress('Package is being uninstalled...');
                                ExternalToolsPanel.currentPanel?.showWait(true);
                                if (!ExternalToolsPanel.currentPanel?.deleteDir(toolspath + message.value.pack)) {
                                    vscode.window.showErrorMessage("Failed to uninstall the package");
                                }
                                ExternalToolsPanel.currentPanel?._channel.appendLine("External Tools management:  Package '" + message.value.packname + "' has been successfully uninstalled");
                                ExternalToolsPanel.currentPanel?._channel.show(true);
                                ExternalToolsPanel.currentPanel?.showWait(false);
                                ExternalToolsPanel.currentPanel?.reload();
                            }
                        });
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (ExternalToolsPanel.currentPanel) {
            ExternalToolsPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(ExternalToolsPanel.viewType, 'Manage External Tools', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);
    }
    static kill() {
        ExternalToolsPanel.currentPanel?.dispose();
        ExternalToolsPanel.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        ExternalToolsPanel.currentPanel = new ExternalToolsPanel(panel, extensionUri);
    }
    setProgress(v) {
        this._panel.webview.postMessage({ type: 'setProgress', value: v });
    }
    showWait(b) {
        if (b) {
            this._panel.webview.postMessage({ type: 'showWait', value: { show: b } });
        }
        else {
            this._panel.webview.postMessage({ type: 'hideWait', value: { show: b } });
            this.setProgress('');
        }
    }
    deleteDir(dir) {
        var ret = true;
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true });
            }
        }
        catch (error) {
            ret = false;
        }
        return ret;
    }
    dispose() {
        ExternalToolsPanel.currentPanel = undefined;
        // Clean up our resources  
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        if (DownloadManager_1.DownloadManager.isDownloading()) {
            this.showWait(true);
        }
        else {
            if (ArchiveManager_1.ArchiveManager.isBusy()) {
                this.setProgress('Package is being installed...');
                this.showWait(true);
            }
        }
    }
    reload() {
        if (typeof (this._panel) !== 'undefined') {
            this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        }
    }
    fixPackageFilesPermissons(onSuccess, onError) {
        var p = os.platform();
        switch (p) {
            /*
            case 'darwin'://mac
            {
                //on mac, package files should have RWX (700) permission to avoid 'permission denied' error after package installation
                try
                {
                    var rootpath = Configuration.getToolsPath();
                    if(rootpath!=='')
                    {
                        var chmodr = require('chmodr');

                        chmodr(rootpath, 0o700, (err:string) =>
                        {
                        if (err)
                        {
                            ExternalToolsPanel.currentPanel?._channel.appendLine('Failed to set package file permissions,'+err);
                            onError('Failed to set package file permissions,'+err);
                        }
                         else
                         {
                            ExternalToolsPanel.currentPanel?._channel.appendLine('Package file permissions have been successfully changed');
                            onSuccess();
                         }
                        });
                    }
                }
                catch(e)
                {}
            }
            break;
            */
            case 'darwin': //mac
            case 'win32': //windows
            case 'linux':
            default:
                onSuccess();
                break;
        }
    }
    _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "externaltoolsview.js"));
        const styleWaitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wait.css'));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var emInstall = this.validateToolInstallation('emscripten');
        var clangInstall = this.validateToolInstallation('clang');
        var rustInstall = this.validateToolInstallation('rust');
        var privateSettings = Configuration_1.Configuration.getWDKPrivate();
        var enableRust = false;
        if (privateSettings !== null) {
            if (privateSettings.enableRustSupport == 'true') {
                enableRust = true;
            }
        }
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
                    <title>External Tools</title>
                </head>
                <body style="min-width:500px;">
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">External Tools</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Manage external tools supported by WOWCube Development Kit</div>
                        <div class="separator"></div>

                        <div class="view" style="min-width:430px;">

                            <div class="items">
                                <div id="i1" class="item">`;
        if (!Configuration_1.Configuration.isClang()) {
            ret += `<div style="margin:5px;"><strong>C++ Compiler support package for WOWCube SDK (Emscripten)</strong></div>`;
        }
        else {
            ret += `<div style="margin:5px;"><strong>C++ Compiler support package for WOWCube SDK (WASI)</strong></div>`;
        }
        ret += `<div style="display:inline-block; width: calc(100% - 145px);">
                                        <div class="itemdesc">The package provides the toolset for compiling and building cubeapps with C++ programming language.</div>
                                        </div>`;
        if (emInstall == true) {
            ret += `  <button class="remove_button" style="display:inline-block;width:120px;" pack="cpp" packname="C++ Compiler support">Remove</button>
                                            <div class="itemstatus itemdesc positive" style="margin-top:10px" pack="cpp">INSTALLED</div>`;
        }
        else {
            if (clangInstall == true) {
                ret += `  <button class="remove_button" style="display:inline-block;width:120px;" pack="cpp" packname="C++ Compiler support">Remove</button>
                                        <div class="itemstatus itemdesc positive" style="margin-top:10px" pack="cpp">INSTALLED</div>`;
            }
            else {
                ret += `   <button class="install_button" style="display:inline-block;width:120px;" pack="cpp" packname="C++ Compiler support">Install</button>
                                             <div class="itemstatus itemdesc neutral" style="margin-top:10px" pack="cpp">NOT INSTALLED</div>`;
            }
        }
        if (enableRust) {
            ret += `</div>

                                    <div id="i2" class="item">
                                        <div style="margin:5px;"><strong>RUST Compiler support package for WOWCube SDK (WASI) - <span><i class="negative">EXPERIMENTAL</i></span></strong></div>
                                        
                                        <div style="display:inline-block; width: calc(100% - 145px);">
                                            <div class="itemdesc">The package provides an experimental set of development tools required for writing cubeapps with Rust programming language.</div>
                                            </div>`;
            if (rustInstall == true) {
                ret += `<button class="remove_button" style="display:inline-block;width:120px;" pack="rust" packname="RUST Compiler support">Remove</button>
                                            <div class="itemstatus itemdesc positive" style="margin-top:10px" pack="rust">INSTALLED</div>`;
            }
            else {
                ret += `<button class="install_button" style="display:inline-block;width:120px;" pack="rust" packname="RUST Compiler support">Install</button>
                                            <div class="itemstatus itemdesc neutral" style="margin-top:10px" pack="rust">NOT INSTALLED</div>`;
            }
        }
        else {
            ret += `</div>

                                    <div id="i2" class="item">
                                        <div style="margin:5px;"><strong>RUST Compiler support package for WOWCube SDK - <span><i class="neutral">COMING SOON</i></span></strong></div>
                                        
                                        <div style="display:inline-block; width: calc(100% - 145px);">
                                            <div class="itemdesc">The package provides an experimental set of development tools required for writing cubeapps with Rust programming language.</div>
                                            </div>`;
        }
        ret += `</div>
                            </div>
                            
                            <div class="wait" id="wait">
                            <div class="centered">
                                <div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                            </div>
                            <div class="centered" style="top:calc(50% - 60px);left:0;width:100%;text-align:center;">
                                <div style="margin:5px;"><strong id='progresstext'>Package is being downloaded</strong></div>
                            </div>
                        </div>

                        </div>
                    </div>
                </body>
                </html> 
            `;
        return ret;
    }
    validateToolInstallation(tool) {
        if (typeof (tool) === 'undefined') {
            tool = '';
        }
        if (tool.length > 0) {
            switch (tool) {
                case 'rust':
                    {
                        var compilerpath = Configuration_1.Configuration.getCompilerPath("rust");
                        if (compilerpath.length == 0)
                            return false;
                        compilerpath += 'cargo/';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: Path \"" + compilerpath + "\" is invalid, Rust Compiler support package for WOWCube Development Kit is not installed");
                            this._channel.show(true);
                            return false;
                        }
                        compilerpath = Configuration_1.Configuration.getCompilerPath("rust");
                        compilerpath += 'rustup/';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: Path \"" + compilerpath + "\" is invalid, Rust Compiler support package for WOWCube Development Kit is not installed");
                            this._channel.show(true);
                            return false;
                        }
                    }
                    break;
                case 'emscripten':
                    {
                        /*
                        var compilerpath = Configuration.getCompilerPath("cpp");
                        if(compilerpath.length==0) return false;

                        compilerpath+='em/upstream/emscripten/';

                        if(fs.existsSync(compilerpath)===false)
                        {
                            this._channel.appendLine("External Tools management: Path \""+compilerpath+"\" is invalid, C++ Compiler support package for WOWCube Development Kit is not installed");
                            this._channel.show(true);
            
                            return false;
                        }

                        var command = '"'+compilerpath+ Configuration.getCC("cpp")+'"';

                        if(fs.existsSync(compilerpath)===false)
                        {
                            this._channel.appendLine("External Tools management: File \""+command+"\" does not exist, C++ Compiler support package for WWOWCube Development Kit is not installed or corrupted");
                            this._channel.show(true);
            
                            return false;
                        }
                        */
                        return false;
                    }
                    break;
                case 'clang':
                    {
                        var compilerpath = Configuration_1.Configuration.getCompilerPath("cpp");
                        if (compilerpath.length == 0)
                            return false;
                        compilerpath += 'bin/';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: Path \"" + compilerpath + "\" is invalid, Clang C++ Compiler support package for WOWCube Development Kit is not installed");
                            this._channel.show(true);
                            return false;
                        }
                        var command = '"' + compilerpath + Configuration_1.Configuration.getCC("cpp") + '"';
                        if (fs.existsSync(compilerpath) === false) {
                            this._channel.appendLine("External Tools management: File \"" + command + "\" does not exist, Clang C++ Compiler support package for WWOWCube Development Kit is not installed or corrupted");
                            this._channel.show(true);
                            return false;
                        }
                    }
                    break;
                    break;
                default:
                    return false;
                    break;
            }
        }
        else {
            return false;
        }
        return true;
    }
}
exports.ExternalToolsPanel = ExternalToolsPanel;
ExternalToolsPanel.viewType = "WOWCubeSDK.externalToolsPanel";
ExternalToolsPanel.currentPack = "";
ExternalToolsPanel._filename = "";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=ExternalToolsPanel.js.map