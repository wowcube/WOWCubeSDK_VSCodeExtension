"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamplePanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const path = require("path");
const vscode_1 = require("vscode");
const Configuration_1 = require("./Configuration");
const Providers_1 = require("./Providers");
const Version_1 = require("./Version");
class ExamplePanel {
    constructor(panel, extensionUri, key, forceVersion, language) {
        this._disposables = [];
        this._key = "";
        this._language = "";
        this._version = "";
        this._forceVersion = "";
        this._viewLoaded = false;
        this._scrollPos = 0;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._key = key;
        this._forceVersion = forceVersion;
        this._language = language;
        // Set the webview's initial html content    
        this._update();
        this._panel.onDidDispose(() => {
            this.dispose();
        }, null, this._disposables);
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
                case 'folder':
                    {
                    }
                    break;
                case 'generate':
                    {
                        const options = {
                            canSelectMany: false,
                            openLabel: 'Select Folder and Create Project',
                            canSelectFiles: false,
                            canSelectFolders: true
                        };
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                if (this._panel) {
                                    //save project
                                    var path = fileUri[0].fsPath;
                                    var ret;
                                    switch (this._language) {
                                        case 'pawn':
                                            ret = this.generateExamplePawn(message.value, path);
                                            break;
                                        case 'cpp':
                                            ret = this.generateExampleCpp(message.value, path);
                                            break;
                                    }
                                    if (ret.path.length === 0) {
                                        //error
                                        vscode.window.showErrorMessage("Unable to create example project: " + ret.desc);
                                    }
                                    else {
                                        //all good
                                        let uri = vscode_1.Uri.file(ret.path);
                                        let success = vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
                                    }
                                }
                            }
                        });
                    }
                    break;
                case 'prev':
                case 'next':
                    {
                        ExamplePanel.panels.delete(this._language + '___' + message.value);
                        ExamplePanel.createOrShow(Configuration_1.Configuration.context.extensionUri, message.value, this._language);
                        this.dispose();
                    }
                    break;
                case 'versionChanged':
                    {
                        ExamplePanel.panels.delete(this._language + '___' + this._key);
                        ExamplePanel.createOrShowForce(Configuration_1.Configuration.context.extensionUri, this._key, message.value, this._language);
                        this.dispose();
                    }
                    break;
                case 'scrollChanged':
                    {
                        this._scrollPos = message.value;
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri, exampleKey, language) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (ExamplePanel.panels.has(language + '___' + exampleKey)) {
            if (ExamplePanel.panels.get(language + '___' + exampleKey)?._version === Configuration_1.Configuration.getCurrentVersion()) {
                ExamplePanel.panels.get(language + '___' + exampleKey)?._panel.reveal(column);
                return;
            }
            else {
                ExamplePanel.panels.get(language + '___' + exampleKey)?._panel.dispose();
            }
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(ExamplePanel.viewType, 'WOWCube SDK Document', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        ExamplePanel.panels.set(language + '___' + exampleKey, new ExamplePanel(panel, extensionUri, exampleKey, "", language));
    }
    static createOrShowForce(extensionUri, exampleKey, forceVersion, language) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (ExamplePanel.panels.has(language + '___' + exampleKey)) {
            if (ExamplePanel.panels.get(language + '___' + exampleKey)?._version === forceVersion) {
                ExamplePanel.panels.get(language + '___' + exampleKey)?._panel.reveal(column);
                return;
            }
            else {
                ExamplePanel.panels.get(language + '___' + exampleKey)?._panel.dispose();
            }
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(ExamplePanel.viewType, 'WOWCube SDK Document', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        ExamplePanel.panels.set(language + '___' + exampleKey, new ExamplePanel(panel, extensionUri, exampleKey, forceVersion, language));
    }
    generateExampleCpp(key, path) {
        var ret = { path: '', desc: '' };
        var fullpath = '';
        var needDeleteFolder = false;
        try {
            var ex = Providers_1.Providers.examples.examples_cpp.e;
            var availableVersions = ex.get(this._key);
            var currVersion = Configuration_1.Configuration.getCurrentVersion();
            if (this._forceVersion !== "") {
                currVersion = this._forceVersion;
            }
            //check if document is available for this version
            var available = false;
            this._version = currVersion;
            for (var i = 0; i < availableVersions.length; i++) {
                if (availableVersions[i] === currVersion) {
                    available = true;
                    break;
                }
            }
            if (available === false) {
                //there is no document for this version, so take a first available one
                this._version = availableVersions[0];
            }
            var info = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/cpp/' + this._key;
            var minfo = info;
            var title = "Untitled Project";
            var desc = "No description";
            var prev = -1;
            var next = -1;
            var hasProject = false;
            if (fs.existsSync(info) === false) {
                throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
            }
            else {
                info += '/info.md';
                minfo += '/info.json';
                if (fs.existsSync(info) === false) {
                    throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
                }
                else {
                    try {
                        const meta = require(minfo);
                        title = meta.name;
                        desc = meta.desc;
                        prev = meta.prev_key;
                        next = meta.next_key;
                        hasProject = meta.has_project;
                    }
                    catch (e) {
                        throw new Error("Unable to find example project metadata, please try to re-install WOWCube SDK extension");
                    }
                }
            }
            path = path.replace(/\\/g, "/");
            if (!path.endsWith("/")) {
                path += '/';
            }
            fullpath = path + title + "(" + this._version + "-Cpp)";
            ret.path = fullpath;
            if (fs.existsSync(fullpath)) {
                throw new Error("Project with such name already exists in this folder");
            }
            this.makeDirSync(fullpath);
            needDeleteFolder = true;
            this.makeDirSync(fullpath + '/.vscode');
            this.makeDirSync(fullpath + '/binary');
            this.makeDirSync(fullpath + '/src');
            this.makeDirSync(fullpath + '/assets');
            this.makeDirSync(fullpath + '/assets/images');
            this.makeDirSync(fullpath + '/assets/sounds');
            const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/';
            //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";     
            const iconFilename = templatespath + "icon.png";
            fs.copyFileSync(iconFilename, fullpath + '/assets/icon.png');
            //copy project files
            var sourcePrj = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/cpp/' + this._key + "/project/src/";
            if (fs.existsSync(sourcePrj) === true) {
                fs.readdirSync(sourcePrj).forEach(file => {
                    fs.copyFileSync(sourcePrj + file, fullpath + '/src/' + file);
                });
            }
            //copy resources
            var sourceImg = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/cpp/' + this._key + "/project/assets/images/";
            var sourceSnd = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/cpp/' + this._key + "/project/assets/sounds/";
            if (fs.existsSync(sourceImg) === true) {
                fs.readdirSync(sourceImg).forEach(file => {
                    fs.copyFileSync(sourceImg + file, fullpath + '/assets/images/' + file);
                });
            }
            if (fs.existsSync(sourceSnd) === true) {
                fs.readdirSync(sourceSnd).forEach(file => {
                    fs.copyFileSync(sourceSnd + file, fullpath + '/assets/sounds/' + file);
                });
            }
            //copy build json
            fs.copyFileSync(Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/cpp/' + this._key + "/project/wowcubeapp-build.json", fullpath + '/wowcubeapp-build.json');
            //create vscode-related configs
            fs.copyFileSync(templatespath + "_launch.json", fullpath + '/.vscode/launch.json');
            fs.copyFileSync(templatespath + "_tasks.json", fullpath + '/.vscode/tasks.json');
            fs.copyFileSync(templatespath + "_extensions.json", fullpath + '/.vscode/extensions.json');
        }
        catch (error) {
            ret.desc = error;
            ret.path = '';
            if (needDeleteFolder === true) {
                if (!this.deleteDir(fullpath)) {
                    ret.desc += '; unalbe to delete recently created project folder!';
                }
            }
        }
        return ret;
    }
    generateExamplePawn(key, path) {
        var ret = { path: '', desc: '' };
        var fullpath = '';
        var needDeleteFolder = false;
        try {
            var ex = Providers_1.Providers.examples.examples_pawn.e;
            var availableVersions = ex.get(this._key);
            var currVersion = Configuration_1.Configuration.getCurrentVersion();
            if (this._forceVersion !== "") {
                currVersion = this._forceVersion;
            }
            //check if document is available for this version
            var available = false;
            this._version = currVersion;
            for (var i = 0; i < availableVersions.length; i++) {
                if (availableVersions[i] === currVersion) {
                    available = true;
                    break;
                }
            }
            if (available === false) {
                //there is no document for this version, so take a first available one
                this._version = availableVersions[0];
            }
            var info = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/pawn/' + this._key;
            var minfo = info;
            var title = "Untitled Project";
            var desc = "No description";
            var prev = -1;
            var next = -1;
            var hasProject = false;
            if (fs.existsSync(info) === false) {
                throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
            }
            else {
                info += '/info.md';
                minfo += '/info.json';
                if (fs.existsSync(info) === false) {
                    throw new Error("Unable to find example project source folder, please try to re-install WOWCube SDK extension");
                }
                else {
                    try {
                        const meta = require(minfo);
                        title = meta.name;
                        desc = meta.desc;
                        prev = meta.prev_key;
                        next = meta.next_key;
                        hasProject = meta.has_project;
                    }
                    catch (e) {
                        throw new Error("Unable to find example project metadata, please try to re-install WOWCube SDK extension");
                    }
                }
            }
            path = path.replace(/\\/g, "/");
            if (!path.endsWith("/")) {
                path += '/';
            }
            fullpath = path + title + "(" + this._version + "-Pawn)";
            ret.path = fullpath;
            if (fs.existsSync(fullpath)) {
                throw new Error("Project with such name already exists in this folder");
            }
            this.makeDirSync(fullpath);
            needDeleteFolder = true;
            this.makeDirSync(fullpath + '/.vscode');
            this.makeDirSync(fullpath + '/binary');
            this.makeDirSync(fullpath + '/src');
            this.makeDirSync(fullpath + '/assets');
            this.makeDirSync(fullpath + '/assets/images');
            this.makeDirSync(fullpath + '/assets/sounds');
            const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/pawn/';
            //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";     
            const iconFilename = templatespath + "icon.png";
            fs.copyFileSync(iconFilename, fullpath + '/assets/icon.png');
            //copy project files
            var sourcePrj = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/pawn/' + this._key + "/project/src/";
            if (fs.existsSync(sourcePrj) === true) {
                fs.readdirSync(sourcePrj).forEach(file => {
                    fs.copyFileSync(sourcePrj + file, fullpath + '/src/' + file);
                });
            }
            //copy resources
            var sourceImg = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/pawn/' + this._key + "/project/assets/images/";
            var sourceSnd = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/pawn/' + this._key + "/project/assets/sounds/";
            if (fs.existsSync(sourceImg) === true) {
                fs.readdirSync(sourceImg).forEach(file => {
                    fs.copyFileSync(sourceImg + file, fullpath + '/assets/images/' + file);
                });
            }
            if (fs.existsSync(sourceSnd) === true) {
                fs.readdirSync(sourceSnd).forEach(file => {
                    fs.copyFileSync(sourceSnd + file, fullpath + '/assets/sounds/' + file);
                });
            }
            //copy build json
            fs.copyFileSync(Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/pawn/' + this._key + "/project/wowcubeapp-build.json", fullpath + '/wowcubeapp-build.json');
            //create vscode-related configs
            fs.copyFileSync(templatespath + "_launch.json", fullpath + '/.vscode/launch.json');
            fs.copyFileSync(templatespath + "_tasks.json", fullpath + '/.vscode/tasks.json');
            fs.copyFileSync(templatespath + "_extensions.json", fullpath + '/.vscode/extensions.json');
        }
        catch (error) {
            ret.desc = error;
            ret.path = '';
            if (needDeleteFolder === true) {
                if (!this.deleteDir(fullpath)) {
                    ret.desc += '; unalbe to delete recently created project folder!';
                }
            }
        }
        return ret;
    }
    makefiles(filepaths) {
        filepaths.forEach(filepath => this.makeFileSync(filepath));
    }
    makefolders(files) {
        files.forEach(file => this.makeDirSync(file));
    }
    makeDirSync(dir) {
        if (fs.existsSync(dir))
            return;
        if (!fs.existsSync(path.dirname(dir))) {
            this.makeDirSync(path.dirname(dir));
        }
        fs.mkdirSync(dir);
    }
    makeFileSync(filename) {
        if (!fs.existsSync(filename)) {
            this.makeDirSync(path.dirname(filename));
            fs.createWriteStream(filename).close();
        }
    }
    findDir(filePath) {
        if (!filePath)
            return null;
        if (fs.statSync(filePath).isFile())
            return path.dirname(filePath);
        return filePath;
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
        ExamplePanel.panels.delete(this._language + '___' + this._key);
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
        webview.postMessage({ type: 'scrollTo', value: this._scrollPos });
        if (this._viewLoaded === false)
            this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _createTempMediaFolder() {
        try {
            var tempmedia = this._extensionUri.fsPath + "/media/temp/";
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            tempmedia += this._version + '/';
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            var key = this._key.replace('/', '_');
            key = key.replace('\\', '_');
            tempmedia += key + '/';
            if (fs.existsSync(tempmedia) === false) {
                fs.mkdirSync(tempmedia);
            }
            return tempmedia;
        }
        catch (e) {
            var t;
            t = 0;
        }
        return "";
    }
    _getHtmlForWebview(webview) {
        var MarkdownIt = require('markdown-it');
        var md = new MarkdownIt({
            html: true
        });
        var content = "";
        var tempfolder = "";
        var ex;
        switch (this._language) {
            case 'pawn':
                ex = Providers_1.Providers.examples.examples_pawn.e;
                break;
            case 'cpp':
                ex = Providers_1.Providers.examples.examples_cpp.e;
                break;
        }
        var availableVersions = ex.get(this._key);
        var currVersion = Configuration_1.Configuration.getCurrentVersion();
        if (this._forceVersion !== "") {
            currVersion = this._forceVersion;
        }
        //check if document is available for this version
        var available = false;
        this._version = currVersion;
        for (var i = 0; i < availableVersions.length; i++) {
            if (availableVersions[i] === currVersion) {
                available = true;
                break;
            }
        }
        if (available === false) {
            //there is no document for this version, so take a first available one
            this._version = availableVersions[0];
        }
        var info = Configuration_1.Configuration.getWOWSDKPath() + "/sdk/examples/" + this._version + '/' + this._language + '/' + this._key + '/';
        var minfo = info;
        var title = "No title";
        var desc = "No description";
        var prev = -1;
        var next = -1;
        var hasProject = false;
        var correctSDK = false;
        var versionClass = "neutral-blue";
        //Look for external resources and copy them into extension temp folder
        if (fs.existsSync(info) === true) {
            fs.readdirSync(info).forEach(file => {
                var ext = file.substring(file.lastIndexOf('.'));
                if (ext !== '.md' && ext !== '.json' && ext !== '.DS_Store' && ext !== 'project') {
                    tempfolder = this._createTempMediaFolder();
                    if (tempfolder !== "") {
                        try {
                            fs.copyFileSync(info + file, tempfolder + file);
                        }
                        catch (e) {
                        }
                    }
                }
            });
        }
        if (fs.existsSync(info) === false) {
            content = '# this document is empty';
        }
        else {
            info += '/info.md';
            minfo += '/info.json';
            if (fs.existsSync(info) === false) {
                content = '# this document is empty';
            }
            else {
                try {
                    var contentmd = fs.readFileSync(info, 'utf8');
                    //split md file into lines 
                    var lines = contentmd.split('\n');
                    var re = /[!][[](?<name>[\s\S]+)][(](?<path>[\s\S]+)[)]/g;
                    var m;
                    var toReplace = new Array();
                    lines.forEach(line => {
                        m = re.exec(line);
                        if (m) {
                            toReplace.push(m[2]);
                        }
                    });
                    content = md.render(contentmd.toString());
                    //replace pathes with secure alternatives provided by VSCode
                    if (tempfolder !== '') {
                        toReplace.forEach(element => {
                            var name = element.substring(element.lastIndexOf('/') + 1);
                            var fullpath = tempfolder + name;
                            const imgUri = webview.asWebviewUri(vscode.Uri.file(fullpath));
                            content = content.replace(new RegExp(element, 'g'), `${imgUri}`);
                        });
                    }
                    const meta = require(minfo);
                    title = meta.name;
                    desc = meta.desc;
                    prev = meta.prev_key;
                    next = meta.next_key;
                    hasProject = meta.has_project;
                    const vc = Version_1.Version.compare(this._version, Configuration_1.Configuration.getCurrentVersion());
                    //if the version is lesser or equal the one that is currently used, OK
                    if (vc <= 0) {
                        correctSDK = true;
                    }
                    else {
                        correctSDK = false;
                        versionClass = "negative";
                    }
                    switch (this._language) {
                        case 'pawn':
                            this._panel.title = 'Pawn : ' + title;
                            break;
                        case 'cpp':
                            this._panel.title = 'C++ : ' + title;
                            break;
                    }
                }
                catch (e) {
                    content = '# this document is empty';
                }
            }
        }
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const styleMDUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "markdown.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "example.js"));
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
                    <link href="${styleMDUri}" rel="stylesheet"> 
                    <title>Example</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:30px;line-height: 35px;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">${title}</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">${desc}</div>

                        <!--<div class='${versionClass}' id="t3" style="position: absolute;right: 10px;top: 0;font-size: 12px;">SDK version ${this._version}</div>-->

                        <div class='${versionClass}' id="t3" style="position: absolute;right: 10px;top: 0;font-size: 12px;">`;
        if (available === false) {
            ret += `<select id="versions" class='selector_docs no_version'>`;
        }
        else {
            ret += `<select id="versions" class='selector_docs'>`;
        }
        for (var i = 0; i < availableVersions.length; i++) {
            if (availableVersions[i] !== this._version) {
                ret += `<option value="${availableVersions[i]}">SDK Version ${availableVersions[i]}</option>`;
            }
            else {
                ret += `<option value="${availableVersions[i]}" selected>SDK Version ${availableVersions[i]}</option>`;
            }
        }
        ret += `</select>
                        </div>

                        <div class="separator"></div>

                        <div id="viewdiv" class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px;">`;
        ret += content;
        ret += `</div>`;
        if (prev !== -1) {
            ret += `<button id="prev_button" style="position:absolute; left:20px; bottom:20px; height:40px; width:90px;" key="${prev}"><< PREV</button>`;
        }
        else {
            ret += `<div class="inactive" style="position: absolute;left: 20px;bottom: 20px;height: 52px;width: 90px;line-height: 52px;text-align: center;"><< PREV</div>`;
        }
        if (hasProject === true) {
            ret += `<button id="generate_button" style="position:absolute; left:130px; right:20px; bottom:20px; height:40px; width:calc(100% - 270px);" key="${this._key}"}>CREATE EXAMPLE PROJECT</button>`;
        }
        if (next !== -1) {
            ret += `<button id="next_button" style="position:absolute; right:20px; bottom:20px; height:40px; width:90px;" key="${next}">NEXT >> </button>`;
        }
        else {
            ret += `<div class="inactive" style="position:absolute; right:20px; bottom:20px; height:52px; width:90px;line-height: 52px;text-align: center;">NEXT >> </div>`;
        }
        ret += `
                         </div>
                </body>
                </html> 
            `;
        this._viewLoaded = true;
        return ret;
    }
}
exports.ExamplePanel = ExamplePanel;
ExamplePanel.panels = new Map();
ExamplePanel.viewType = "WOWCubeSDK.examplePanel";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=ExamplePanel.js.map