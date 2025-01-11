"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardPanel = void 0;
/* eslint-disable curly */
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const path = require("path");
const vscode_1 = require("vscode");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const NameBeautifier_1 = require("./NameBeautifier");
const crypto = require("crypto");
const canvas = require("canvas");
//import * as canvas from '@napi-rs/canvas';
class WizardPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.      
        if (WizardPanel.currentPanel) {
            WizardPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(WizardPanel.viewType, 'WOWCube Cubeapp Project Wizard', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        WizardPanel.currentPanel = new WizardPanel(panel, extensionUri);
    }
    static kill() {
        WizardPanel.currentPanel?.dispose();
        WizardPanel.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        WizardPanel.currentPanel = new WizardPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
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
                        const options = {
                            canSelectMany: false,
                            openLabel: 'Select Project Folder',
                            canSelectFiles: false,
                            canSelectFolders: true
                        };
                        vscode.window.showOpenDialog(options).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                if (this._panel) {
                                    //save configuration
                                    var path = fileUri[0].fsPath;
                                    if (!path.endsWith(Configuration_1.Configuration.getSlash())) {
                                        path = path + Configuration_1.Configuration.getSlash();
                                    }
                                    Configuration_1.Configuration.setLastPath(path);
                                    this._panel.webview.postMessage({ type: 'folderSelected', value: path });
                                }
                            }
                        });
                    }
                    break;
                case 'generate':
                    {
                        var ret = this.generate(message.value.name, message.value.path, message.value.item);
                        if (ret.path.length === 0) {
                            //error
                            vscode.window.showErrorMessage("Unable to generate new project: " + ret.desc);
                        }
                        else {
                            //all good
                            let uri = vscode_1.Uri.file(ret.path);
                            this.generate_icon(message.value.name, message.value.path, message.value.item, uri);
                            //let success = vscode.commands.executeCommand('vscode.openFolder', uri);
                        }
                    }
                    break;
                case 'languageChanged':
                    {
                        WizardPanel.currentLanguage = message.value;
                        Configuration_1.Configuration.setLastLanguage(WizardPanel.currentLanguage);
                        this._panel.webview.postMessage({ type: 'languageChange', value: message.value });
                    }
            }
        }, null, this._disposables);
    }
    generate(name, path, template) {
        var ret = { path: '', desc: '' };
        if (WizardPanel.currentLanguage == 'pawn') {
            ret = this.generate_pawn(name, path, template);
        }
        if (WizardPanel.currentLanguage == 'cpp') {
            ret = this.generate_cpp(name, path, template);
        }
        if (WizardPanel.currentLanguage == 'rust') {
            ret = this.generate_rust(name, path, template);
        }
        return ret;
    }
    generate_abbreviation(projectName) {
        // Trim any extra spaces and ensure the name is not empty
        projectName = projectName.trim();
        // Case 1: If the name length is 1, use the character itself
        if (projectName.length === 1) {
            return projectName.toUpperCase();
        }
        // Case 2: If it's a single word, take the first two characters
        const words = projectName.split('_').filter(Boolean);
        if (words.length === 1) {
            return words[0].slice(0, 2).toUpperCase();
        }
        // Case 3: If it's multiple words, take the first character of the first two words
        //The words assumed to be separated with an underscorr
        const firstTwoWords = words.slice(0, 2);
        return firstTwoWords.map(word => word[0].toUpperCase()).join('');
    }
    generate_icon(name, path, template, uri) {
        const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/' + WizardPanel.currentLanguage + '/';
        const templates = require(templatespath + 'templates.json');
        var fullpath = '';
        path = path.replace(/\\/g, "/");
        if (!path.endsWith("/")) {
            path += '/';
        }
        fullpath = path + name;
        const randomPlaceholder = Math.floor(Math.random() * 6) + 1;
        const iconFilename = this._extensionUri.fsPath + `/media/${randomPlaceholder}.png`;
        //const iconFilename:string = templatespath+"icon.png";  
        const outputImagePath = fullpath + '/assets/icon.png'; // Path to save the output image
        const text = this.generate_abbreviation(name);
        const fontSize = 48;
        const textX = 80; // X-coordinate for the text
        const textY = 80 + 26; // Y-coordinate for the text
        // Load the PNG image and draw text on it
        canvas.loadImage(iconFilename).then(image => {
            try {
                canvas.registerFont(this._extensionUri.fsPath + '/media/Rubik-ExtraBold.ttf', { family: 'CustomFont' });
            }
            catch (error) {
                console.error('Error');
            }
            // Create a canvas with the same dimensions as the loaded image
            const c = canvas.createCanvas(image.width, image.height);
            const ctx = c.getContext('2d');
            // Draw the loaded image onto the canvas
            ctx.drawImage(image, 0, 0);
            // Set the text style
            //ctx.font = `${fontSize}px Arial`;
            //console.log(ctx.font);
            ctx.font = `70px CustomFont`;
            console.log(ctx.font); // Log the current font style
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Text color (white in this case)
            ctx.fillText(text, textX, textY + 3); // Draw the text at the specified position
            ctx.fillStyle = 'rgba(180, 180, 180, 1.0)'; // Text color (white in this case)
            ctx.fillText(text, textX, textY); // Draw the text at the specified position
            ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'; // Text color (white in this case)
            ctx.fillText(text, textX, textY - 3); // Draw the text at the specified position
            // Save the modified image to the output path
            const out = fs.createWriteStream(outputImagePath);
            const stream = c.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => {
                vscode.commands.executeCommand('vscode.openFolder', uri);
            });
        }).catch(err => {
            vscode.window.showErrorMessage("Unable to generate an icon for new project, using default one");
        });
    }
    generate_rust(name, path, template) {
        var ret = { path: '', desc: '' };
        const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/' + WizardPanel.currentLanguage + '/';
        if (!fs.existsSync(templatespath)) {
            ret.desc = "Project templates are missing, please check WOWCube Development Kit installaton...";
            ret.path = '';
            return ret;
        }
        const templates = require(templatespath + 'templates.json');
        var fullpath = '';
        var needDeleteFolder = false;
        try {
            path = path.replace(/\\/g, "/");
            if (!path.endsWith("/")) {
                path += '/';
            }
            fullpath = path + name;
            ret.path = fullpath;
            if (fs.existsSync(fullpath)) {
                throw new Error("Project with such name already exists in this folder");
            }
            var currentTemplate = null;
            for (var i = 0; i < templates.length; i++) {
                if (templates[i].id === template) {
                    currentTemplate = templates[i];
                    break;
                }
            }
            if (currentTemplate === null) {
                throw new Error("Unable to find template source files");
            }
            this.makeDirSync(fullpath);
            needDeleteFolder = true;
            this.makeDirSync(fullpath + '/.vscode');
            this.makeDirSync(fullpath + '/binary');
            this.makeDirSync(fullpath + '/src');
            this.makeDirSync(fullpath + '/assets');
            this.makeDirSync(fullpath + '/assets/images');
            this.makeDirSync(fullpath + '/assets/sounds');
            //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";
            const iconFilename = templatespath + "icon.png";
            fs.copyFileSync(iconFilename, fullpath + '/assets/icon.png');
            var br = NameBeautifier_1.NameBeautifier.rustClassName(name);
            //application UUID
            var arr = crypto.pseudoRandomBytes(10);
            var uuid = arr.reduce(((t, e) => t += (e &= 63) < 36 ? e.toString(36) : e < 62 ? (e - 26).toString(36).toUpperCase() : e > 62 ? "-" : "_"), "");
            if (br.err === 1) {
                this._channel.appendLine('Project wizard: class name beautification error: ' + br.desc);
                this._channel.appendLine('Project wizard: default class name will be used instead');
            }
            else {
                if (br.length !== 0) {
                    this._channel.appendLine('Project wizard: ' + br.desc);
                }
            }
            for (var i = 0; i < currentTemplate.files.length; i++) {
                if (currentTemplate.files[i] === '_cubeapp.rs') {
                    if (!this.replaceInFileAndSave(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/cubeapp.rs', '##CNAME##', br.str)) {
                        throw new Error("Unable to generate main source file");
                    }
                    if (!this.replaceInFileAndSave(fullpath + '/src/cubeapp.rs', fullpath + '/src/cubeapp.rs', '##APPUUID##', uuid)) {
                        throw new Error("Unable to generate main source file");
                    }
                }
                else if ((currentTemplate.files[i] === '_main.rs')) {
                    if (!this.replaceInFileAndSave(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/main.rs', '##CNAME##', br.str)) {
                        throw new Error("Unable to generate main header file");
                    }
                    /*
                if(!this.replaceInFileAndSave(fullpath+'/src/'+br.str+'.h',
                                                 fullpath+'/src/'+br.str+'.h',
                                                 '##APPUUID##',
                                                 uuid))
                                                 {
                                                  throw new Error("Unable to generate main header file");
                                                 }
                     */
                }
                else {
                    fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + currentTemplate.files[i]);
                }
            }
            for (var i = 0; i < currentTemplate.images.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.images[i], fullpath + '/assets/images/' + currentTemplate.images[i]);
            }
            for (var i = 0; i < currentTemplate.sounds.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.sounds[i], fullpath + '/assets/sounds/' + currentTemplate.sounds[i]);
            }
            //create json file for build
            const json = fs.readFileSync(templatespath + currentTemplate.id + "/_build.json").toString();
            var str = json.replace(/##NAME##/gi, name);
            str = str.replace(/##CNAME##/gi, br.str);
            str = str.replace(/##SDKVERSION##/gi, Configuration_1.Configuration.getCurrentVersion());
            fs.writeFileSync(fullpath + '/wowcubeapp-build.json', str);
            //create vscode-related configs
            fs.copyFileSync(templatespath + "_launch.json", fullpath + '/.vscode/launch.json');
            fs.copyFileSync(templatespath + "_tasks.json", fullpath + '/.vscode/tasks.json');
            fs.copyFileSync(templatespath + "_extensions.json", fullpath + '/.vscode/extensions.json');
            //copy TOML file
            fs.copyFileSync(templatespath + "_Cargo.toml", fullpath + '/Cargo.toml');
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
    generate_cpp(name, path, template) {
        var ret = { path: '', desc: '' };
        const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/' + WizardPanel.currentLanguage + '/';
        if (!fs.existsSync(templatespath)) {
            ret.desc = "Project templates are missing, please check WOWCube Development Kit installaton...";
            ret.path = '';
            return ret;
        }
        const templates = require(templatespath + 'templates.json');
        var fullpath = '';
        var needDeleteFolder = false;
        try {
            path = path.replace(/\\/g, "/");
            if (!path.endsWith("/")) {
                path += '/';
            }
            fullpath = path + name;
            ret.path = fullpath;
            if (fs.existsSync(fullpath)) {
                throw new Error("Project with such name already exists in this folder");
            }
            var currentTemplate = null;
            for (var i = 0; i < templates.length; i++) {
                if (templates[i].id === template) {
                    currentTemplate = templates[i];
                    break;
                }
            }
            if (currentTemplate === null) {
                throw new Error("Unable to find template source files");
            }
            this.makeDirSync(fullpath);
            needDeleteFolder = true;
            this.makeDirSync(fullpath + '/.vscode');
            this.makeDirSync(fullpath + '/binary');
            this.makeDirSync(fullpath + '/src');
            this.makeDirSync(fullpath + '/assets');
            this.makeDirSync(fullpath + '/assets/images');
            this.makeDirSync(fullpath + '/assets/sounds');
            const iconFilename = templatespath + "icon.png";
            fs.copyFileSync(iconFilename, fullpath + '/assets/icon.png');
            var br = NameBeautifier_1.NameBeautifier.cppClassName(name);
            //application UUID
            var arr = crypto.pseudoRandomBytes(10);
            var uuid = arr.reduce(((t, e) => t += (e &= 63) < 36 ? e.toString(36) : e < 62 ? (e - 26).toString(36).toUpperCase() : e > 62 ? "-" : "_"), "");
            if (br.err === 1) {
                this._channel.appendLine('Project wizard: class name beautification error: ' + br.desc);
                this._channel.appendLine('Project wizard: default class name will be used instead');
            }
            else {
                if (br.length !== 0) {
                    this._channel.appendLine('Project wizard: ' + br.desc);
                }
            }
            for (var i = 0; i < currentTemplate.files.length; i++) {
                if (currentTemplate.files[i] === '_main.cpp') {
                    if (!this.replaceInFileAndSave(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + br.str + '.cpp', '##CNAME##', br.str)) {
                        throw new Error("Unable to generate main source file");
                    }
                    if (!this.replaceInFileAndSave(fullpath + '/src/' + br.str + '.cpp', fullpath + '/src/' + br.str + '.cpp', '##APPUUID##', uuid)) {
                        throw new Error("Unable to generate main source file");
                    }
                }
                else if ((currentTemplate.files[i] === '_main.h')) {
                    if (!this.replaceInFileAndSave(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + br.str + '.h', '##CNAME##', br.str)) {
                        throw new Error("Unable to generate main header file");
                    }
                    if (!this.replaceInFileAndSave(fullpath + '/src/' + br.str + '.h', fullpath + '/src/' + br.str + '.h', '##APPUUID##', uuid)) {
                        throw new Error("Unable to generate main header file");
                    }
                }
                else {
                    fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + currentTemplate.files[i]);
                }
            }
            for (var i = 0; i < currentTemplate.images.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.images[i], fullpath + '/assets/images/' + currentTemplate.images[i]);
            }
            for (var i = 0; i < currentTemplate.sounds.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.sounds[i], fullpath + '/assets/sounds/' + currentTemplate.sounds[i]);
            }
            //create json file for build
            const json = fs.readFileSync(templatespath + currentTemplate.id + "/_build.json").toString();
            var str = json.replace(/##NAME##/gi, name);
            str = str.replace(/##CNAME##/gi, br.str);
            str = str.replace(/##SDKVERSION##/gi, Configuration_1.Configuration.getCurrentVersion());
            fs.writeFileSync(fullpath + '/wowcubeapp-build.json', str);
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
    generate_pawn(name, path, template) {
        var ret = { path: '', desc: '' };
        const templatespath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/templates/' + Configuration_1.Configuration.getCurrentVersion() + '/' + WizardPanel.currentLanguage + '/';
        if (!fs.existsSync(templatespath)) {
            ret.desc = "Project templates are missing, please check WOWCube Development Kit installaton...";
            ret.path = '';
            return ret;
        }
        //const templatespath = Configuration.getWOWSDKPath()+'sdk/templates/'+Configuration.getCurrentVersion()+'/';//+WizardPanel.currentLanguage+'/';
        const templates = require(templatespath + 'templates.json');
        var fullpath = '';
        var needDeleteFolder = false;
        try {
            path = path.replace(/\\/g, "/");
            if (!path.endsWith("/")) {
                path += '/';
            }
            fullpath = path + name;
            ret.path = fullpath;
            if (fs.existsSync(fullpath)) {
                throw new Error("Project with such name already exists in this folder");
            }
            var currentTemplate = null;
            for (var i = 0; i < templates.length; i++) {
                if (templates[i].id === template) {
                    currentTemplate = templates[i];
                    break;
                }
            }
            if (currentTemplate === null) {
                throw new Error("Unable to find template source files");
            }
            this.makeDirSync(fullpath);
            needDeleteFolder = true;
            this.makeDirSync(fullpath + '/.vscode');
            this.makeDirSync(fullpath + '/binary');
            this.makeDirSync(fullpath + '/src');
            this.makeDirSync(fullpath + '/assets');
            this.makeDirSync(fullpath + '/assets/images');
            this.makeDirSync(fullpath + '/assets/sounds');
            //const iconFilename:string = this._extensionUri.fsPath+"/media/templates/icon.png";
            const iconFilename = templatespath + "icon.png";
            fs.copyFileSync(iconFilename, fullpath + '/assets/icon.png');
            for (var i = 0; i < currentTemplate.files.length; i++) {
                if (currentTemplate.files[i] === '_main.pwn') {
                    fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + name + '.pwn');
                }
                else {
                    fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.files[i], fullpath + '/src/' + currentTemplate.files[i]);
                }
            }
            for (var i = 0; i < currentTemplate.images.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.images[i], fullpath + '/assets/images/' + currentTemplate.images[i]);
            }
            for (var i = 0; i < currentTemplate.sounds.length; i++) {
                fs.copyFileSync(templatespath + currentTemplate.id + "/" + currentTemplate.sounds[i], fullpath + '/assets/sounds/' + currentTemplate.sounds[i]);
            }
            //create json file for build
            const json = fs.readFileSync(templatespath + currentTemplate.id + "/_build.json").toString();
            var str = json.replace(/##NAME##/gi, name);
            str = str.replace(/##SDKVERSION##/gi, Configuration_1.Configuration.getCurrentVersion());
            fs.writeFileSync(fullpath + '/wowcubeapp-build.json', str);
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
        WizardPanel.currentPanel = undefined;
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
    }
    _getHtmlForWebview(webview) {
        //check if rust support is enabled
        var privateSettings = Configuration_1.Configuration.getWDKPrivate();
        var enableRust = false;
        if (privateSettings !== null) {
            if (privateSettings.enableRustSupport == 'true') {
                enableRust = true;
            }
        }
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "wizard.js"));
        const nonce = (0, getNonce_1.getNonce)();
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media')).toString().replace('%22', '');
        var lastPath = Configuration_1.Configuration.getLastPath();
        if (typeof (lastPath) === 'undefined')
            lastPath = '';
        var lastLanguage = Configuration_1.Configuration.getLastLanguage();
        if (typeof (lastLanguage) === 'undefined')
            lastLanguage = 'pawn';
        WizardPanel.currentLanguage = lastLanguage;
        var ret = `      
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet"> 
                    <link href="${styleMainCodeUri}" rel="stylesheet"> 
                    <title>New Cubeapp Wizard</title>
                </head>
                <body style="min-width:500px;">
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;">
                        <div id="t1" style="margin-top:10px;margin-bottom:10px;font-size:24px;">New Cubeapp Wizard</div>
                        <div id="t2" style="margin-top:10px;margin-bottom:10px;font-size:16px;">Create new WOWCube cubeapp application project from template</div>
                        <div class="separator"></div>

                        <div class="view" style="min-width:500px;">
                        
                            <div style="margin-top:0px;">
                                <div class="badge"> <div class="badge_text">1</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Name of your new project</div>
                                <input id="projectname" style="display:block;width:50%;"></input>
                            </div>
                          
                            <div style="margin-top:30px;">
                                <div class="badge"> <div class="badge_text">2</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Choose the folder for your project</div>
                                <br/>
                                <input id="foldername" style="display:inline-block; width:50%;" readonly value="${lastPath}"></input> <button id="folder_button" style="display:inline-block; width:70px;">...</button>
                            </div>
                        
                            
                            <div style="margin-top:30px;">
                            <div class="badge"> <div class="badge_text">3</div></div>
                            <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Choose programming language</div>
                            <br/>
                            <select id="plang" class='selector' style="display:inline-block; width:50%;padding-left:4px; padding-right:4px;">;`;
        if (lastLanguage === 'pawn') {
            ret += `<option value="pawn" selected>Pawn</option>`;
        }
        else {
            ret += `<option value="pawn">Pawn</option>`;
        }
        if (lastLanguage === 'cpp') {
            ret += ` <option value="cpp" selected>C++</option>`;
        }
        else {
            ret += ` <option value="cpp">C++</option>`;
        }
        if (enableRust) {
            if (lastLanguage === 'rust') {
                ret += ` <option value="rust" selected>Rust</option>`;
            }
            else {
                ret += ` <option value="rust">Rust</option>`;
            }
        }
        ret += `
                            </select>
                            </div>
                            

                            <div style="margin-top:30px;margin-bottom:5px;">
                                <div class="badge"> <div class="badge_text">4</div></div>
                                <div style="display:inline-block;margin:10px;margin-left: 2px;font-size:14px;">Select project template</div>
                            </div>

                            <div class="items">
                                <div id="i1" class="item">
                                    <div style="margin:5px;"><strong>Empty project</strong></div>
                                    <div class="itemdesc">Creates an empty project with a bare minimum of functions needed to build WOWCube cubeapp application</div>
                                </div>

                                <div id="i2" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with basic rendering support</div>
                                    <div class="itemdesc">Demonstrates principles of work with a compound multi-screen device</div>
                                </div>

                                <div id="i3" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp with resources</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with some resources</div>
                                    <div class="itemdesc">Demonstrates how to find and use application resources</div>
                                </div>
                                
                                <div id="i4" class="item">
                                    <div style="margin:5px;"><strong>Basic cubeapp with splash screens</strong></div>
                                    <div class="itemdesc">Creates a project of WOWCube cubeapp application with in-game splash screens support</div>
                                    <div class="itemdesc">Demonstrates the use of in-game splash screens</div>
                                </div>`;
        if (lastLanguage == 'cpp') {
            ret += `
                                    <div id="i5" class="item">
                                        <div style="margin:5px;"><strong>Basic cubeapp with Gfx Engine support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support</div>
                                        <div class="itemdesc">Demonstrates principles of work with a compound multi-screen device</div>
                                    </div>
                                    <div id="i6" class="item">
                                        <div style="margin:5px;"><strong>Basic cubeapp with resources and Gfx Engine support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support and some resources</div>
                                        <div class="itemdesc">Demonstrates how to use application resources with Gfx Engine</div>
                                    </div>
                                    <div id="i7" class="item">
                                        <div style="margin:5px;"><strong>GFX cubeapp with splash screen support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support, splash screen and resources</div>
                                        <div class="itemdesc">Demonstrates how to use splash screens with Gfx Engine</div>
                                    </div>
                                    `;
        }
        else {
            ret += `
                                    <div id="i5" class="item" style="display:none">
                                        <div style="margin:5px;"><strong>Basic cubeapp with Gfx Engine support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support</div>
                                        <div class="itemdesc">Demonstrates principles of work with a compound multi-screen device</div>
                                    </div>
                                    <div id="i6" class="item" style="display:none">
                                        <div style="margin:5px;"><strong>Basic cubeapp with resources and Gfx Engine support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support and some resources</div>
                                        <div class="itemdesc">Demonstrates how to use application resources with Gfx Engine</div>
                                     </div> 
                                     <div id="i7" class="item" style="display:none">
                                        <div style="margin:5px;"><strong>GFX cubeapp with splash screen support</strong></div>
                                        <div class="itemdesc">Creates a project of WOWCube cubeapp application with Gfx Engine support, splash screen and resources</div>
                                         <div class="itemdesc">Demonstrates how to use splash screens with Gfx Engine</div>
                                     </div>
                                    `;
        }
        ret += `</div>
                            
                        </div>

                        <button id="generate_button" style="min-width:500px; position:absolute; left:20px; right:20px; bottom:20px; height:40px; width:calc(100% - 40px);">GENERATE NEW PROJECT</button>
                    </div>
                </body>
                </html> 
            `;
        return ret;
    }
    replaceInFileAndSave(sourcefile, destfile, template, value) {
        var ret = true;
        try {
            //read source file
            const src = fs.readFileSync(sourcefile).toString();
            //replace template with value
            var str = src.replace(new RegExp(template, 'g'), value);
            //save file
            fs.writeFileSync(destfile, str);
        }
        catch (e) {
            ret = false;
        }
        return ret;
    }
}
exports.WizardPanel = WizardPanel;
WizardPanel.viewType = "WOWCubeSDK.wizardPanel";
WizardPanel.currentLanguage = "pawn";
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=WizardPanel.js.map