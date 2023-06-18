"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamplesViewProvider = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const ExamplePanel_1 = require("./ExamplePanel");
const DocumentPanel_1 = require("./DocumentPanel");
class ExamplesViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        this.docs_pawn = [];
        this.docs_cpp = [];
        this._currentDocsVersion = "";
    }
    reload() {
        if (typeof (this._view) !== 'undefined') {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
    async resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        this._view?.onDidChangeVisibility(e => {
            if (this._view?.visible) {
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
                case 'itemSelected':
                    {
                        ExamplePanel_1.ExamplePanel.createOrShow(Configuration_1.Configuration.context.extensionUri, data.value.key, data.value.lang);
                    }
                    break;
                case 'docSelected':
                    {
                        DocumentPanel_1.DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, data.value.folder, data.value.file, this._currentDocsVersion, data.value.lang);
                    }
                    break;
                case 'urlSelected':
                    {
                        vscode.env.openExternal(vscode.Uri.parse(data.value));
                    }
                    break;
                case 'fileSelected':
                    {
                        var openPath = vscode.Uri.file(data.value);
                        vscode.workspace.openTextDocument(openPath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                    break;
            }
        });
    }
    getExamples(lang) {
        var categories = new Array();
        //Get existing categories of examples
        var catInfoPath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/categories_' + lang + '.json';
        const cat = require(catInfoPath);
        for (var i = 0; i < cat.categories.length; i++) {
            categories.push(cat.categories[i]);
        }
        //enumerate versions
        catInfoPath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/';
        var versions = new Array();
        if (fs.existsSync(catInfoPath) === true) {
            fs.readdirSync(catInfoPath).forEach(folder => {
                versions.push(folder);
            });
        }
        //iterate through versions to collect all examples
        var examples = new Map();
        var names = new Map();
        for (var i = 0; i < versions.length; i++) {
            for (var j = 0; j < categories.length; j++) {
                var path = '';
                switch (lang) {
                    case 'pawn':
                        path = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/' + versions[i] + '/pawn/' + categories[j] + '/';
                        break;
                    case 'cpp':
                        path = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/' + versions[i] + '/cpp/' + categories[j] + '/';
                        break;
                }
                Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/' + versions[i] + '/' + categories[j] + '/';
                if (fs.existsSync(path)) {
                    fs.readdirSync(path).forEach(exampleFolder => {
                        if (exampleFolder === '.DS_Store')
                            return;
                        var key = categories[j] + '/' + exampleFolder;
                        if (examples.has(key) === false) {
                            examples.set(key, new Array());
                            examples.get(key)?.push(versions[i]);
                            try {
                                const info = require(path + '/' + exampleFolder + '/info.json');
                                names.set(key, info.name);
                            }
                            catch (e) {
                                names.set(key, "Unnamed Example " + exampleFolder);
                            }
                        }
                        else {
                            examples.get(key)?.push(versions[i]);
                        }
                    });
                }
            }
        }
        return { c: categories, e: examples, n: names };
    }
    getDocumentation(lang) {
        var topics = new Array();
        this._currentDocsVersion = Configuration_1.Configuration.getCurrentVersion();
        var sourceDocsRoot = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/';
        var sourceDocs = '';
        var sourceDocsRoot = '';
        switch (lang) {
            default:
            case 'pawn':
                {
                    sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/pawn/';
                }
                break;
            case 'cpp':
                {
                    sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/cpp/';
                }
                break;
        }
        //check if we have documentation of needed version
        if (fs.existsSync(sourceDocsRoot) === true) {
            if (fs.existsSync(sourceDocs) === false) {
                //current version doesn't have its own docs. Let's look for a "base" version
                var v1r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(this._currentDocsVersion);
                var majs = v1r?.groups?.maj;
                var mins = v1r?.groups?.min;
                this._currentDocsVersion = majs + '.' + mins;
                //this must MUST be present. If there is no path of a such, it means that DevKit folder structure is incomplete! 
                //sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+this._currentDocsVersion+'/';
                switch (lang) {
                    default:
                    case 'pawn':
                        {
                            sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/pawn/';
                        }
                        break;
                    case 'cpp':
                        {
                            sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/cpp/';
                        }
                        break;
                }
            }
        }
        //fetch docs folder for topics
        if (fs.existsSync(sourceDocs) === true) {
            fs.readdirSync(sourceDocs).forEach(folder => {
                topics.push([folder, new Array()]);
            });
            for (var i = 0; i < topics.length; i++) {
                var path = sourceDocs + topics[i][0];
                if (fs.existsSync(path) === true) {
                    fs.readdirSync(path).forEach(file => {
                        var ext = file.substring(file.lastIndexOf('.'));
                        if (ext === '.md') {
                            topics[i][1].push(file);
                        }
                    });
                }
            }
        }
        return topics;
    }
    getOnlineResources() {
        var sites = new Array();
        try {
            var sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/';
            //fetch docs folder for topics
            if (fs.existsSync(sourceDocs) === true) {
                const res = require(sourceDocs + "online-resources.json").resources;
                for (var i = 0; i < res.length; i++) {
                    sites.push([res[i].name, res[i].url]);
                }
            }
        }
        catch (e) {
        }
        return sites;
    }
    getSDKFiles(lang) {
        var files = new Array();
        try {
            var sourceFiles = "";
            switch (lang) {
                default:
                case 'pawn':
                    {
                        sourceFiles = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + this._currentDocsVersion + '/pawn/include/';
                    }
                    break;
                case 'cpp':
                    {
                        sourceFiles = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + this._currentDocsVersion + '/cpp/';
                    }
                    break;
            }
            if (fs.existsSync(sourceFiles) === true) {
                fs.readdirSync(sourceFiles).forEach(file => {
                    if (file !== '.DS_Store') {
                        if (!fs.lstatSync(sourceFiles + file).isDirectory()) {
                            files.push([file, sourceFiles + file]);
                        }
                        else {
                            var dir = file;
                            //at the moment, only one level of inner folders is supported
                            fs.readdirSync(sourceFiles + file).forEach(f => {
                                if (f !== '.DS_Store') {
                                    files.push([dir + ' / ' + f, sourceFiles + dir + '/' + f]);
                                }
                            });
                        }
                    }
                });
            }
        }
        catch (e) { }
        files.sort();
        return files;
    }
    _getHtmlForWebview(webview) {
        //get examples
        try {
            this.examples_pawn = this.getExamples('pawn');
            this.examples_cpp = this.getExamples('cpp');
            var categories_pawn = this.examples_pawn.c;
            var articles_pawn = this.examples_pawn.e;
            var names_pawn = this.examples_pawn.n;
            var categories_cpp = this.examples_cpp.c;
            var articles_cpp = this.examples_cpp.e;
            var names_cpp = this.examples_cpp.n;
            //get docs
            this.docs_pawn = this.getDocumentation('pawn');
            this.docs_cpp = this.getDocumentation('cpp');
            //get online resources
            var sites = this.getOnlineResources();
            //get sdk files
            var files_pawn = this.getSDKFiles('pawn');
            var files_cpp = this.getSDKFiles('cpp');
            //setup web page
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'examplesview.js'));
            // Do the same for the stylesheet.
            const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
            const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
            const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
            const styleExamplesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'examples.css'));
            // Use a nonce to only allow a specific script to be run.
            const nonce = (0, getNonce_1.getNonce)();
            var body = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleExamplesUri}" rel="stylesheet">

				<title>Code Examples</title>
			</head>
			<body>
			<div>
			<ul id="myUL">
				<li><span class="caret">Built-in Examples</span>
					<ul class="nested">
					<li><span class="caret">Pawn</span>
					<ul class="nested">`;
            for (var i = 0; i < categories_pawn.length; i++) {
                body += `<li><span class="caret">${categories_pawn[i]}</span>
						<ul class="nested">`;
                articles_pawn.forEach((value, key) => {
                    if (key.indexOf(categories_pawn[i] + '/') === 0) {
                        try {
                            if (names_pawn.has(key)) {
                                var articleName = names_pawn.get(key);
                                body += `<li class="liitem" key="${key}" lang="pawn">${articleName}</li>`;
                            }
                            else {
                                body += `<li class="liitem" key="${key}">Unnamed Article</li>`;
                            }
                        }
                        catch (e) { }
                    }
                });
                body += `</ul></li>`;
            }
            body += `</ul></li>`;
            body += `<li><span class="caret">C++</span>
					<ul class="nested">`;
            for (var i = 0; i < categories_cpp.length; i++) {
                body += `<li><span class="caret">${categories_cpp[i]}</span>
						<ul class="nested">`;
                articles_cpp.forEach((value, key) => {
                    if (key.indexOf(categories_cpp[i] + '/') === 0) {
                        try {
                            if (names_cpp.has(key)) {
                                var articleName = names_cpp.get(key);
                                body += `<li class="liitem" key="${key}" lang="cpp">${articleName}</li>`;
                            }
                            else {
                                body += `<li class="liitem" key="${key}">Unnamed Article</li>`;
                            }
                        }
                        catch (e) { }
                    }
                });
                body += `</ul></li>`;
            }
            body += `</ul></li>`;
            body += ` </ul>
				</li>      					
				<li><span class="caret">Documentation (SDK Version ${this._currentDocsVersion})</span>
					<ul class="nested">
					<li><span class="caret">Pawn</span>
					<ul class="nested">`;
            for (var i = 0; i < this.docs_pawn.length; i++) {
                var topic = this.docs_pawn[i][0];
                body += `<li><span class="caret">${topic.substring(topic.indexOf('.') + 1)}</span>
						<ul class="nested">`;
                for (var j = 0; j < this.docs_pawn[i][1].length; j++) {
                    var item = this.docs_pawn[i][1][j];
                    item = item.substring(0, item.length - 3);
                    item = item.substring(item.indexOf('.') + 1);
                    body += `<li class="liitem" file="${this.docs_pawn[i][1][j]}" folder="${topic}" doc="1" lang="pawn">${item}</li>`;
                }
                body += `</ul></li>`;
            }
            body += `</ul></li>`;
            body += `<li><span class="caret">C++</span>
				<ul class="nested">`;
            for (var i = 0; i < this.docs_cpp.length; i++) {
                var topic = this.docs_cpp[i][0];
                body += `<li><span class="caret">${topic.substring(topic.indexOf('.') + 1)}</span>
						<ul class="nested">`;
                for (var j = 0; j < this.docs_cpp[i][1].length; j++) {
                    var item = this.docs_cpp[i][1][j];
                    item = item.substring(0, item.length - 3);
                    item = item.substring(item.indexOf('.') + 1);
                    body += `<li class="liitem" file="${this.docs_cpp[i][1][j]}" folder="${topic}" doc="1" lang="cpp">${item}</li>`;
                }
                body += `</ul></li>`;
            }
            body += `</ul></li>`;
            body += `<li class="liitem" file="${Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/changelog.md'}" folder="SDK Version Changelog" doc="1" lang="none">SDK Version Changelog</li>`;
            body += `</ul></li>`;
            body += `<li><span class="caret">SDK Files</span>
				<ul class="nested">

					<li><span class="caret">Pawn</span>
					<ul class="nested">`;
            for (var i = 0; i < files_pawn.length; i++) {
                body += `<li class="liitem" path="${files_pawn[i][1]}">${files_pawn[i][0]}</li>`;
            }
            body += `</ul></li>`;
            body += `<li><span class="caret">C++</span>
					<ul class="nested">`;
            for (var i = 0; i < files_cpp.length; i++) {
                body += `<li class="liitem" path="${files_cpp[i][1]}">${files_cpp[i][0]}</li>`;
            }
            body += `</ul></li>`;
            body += `</ul></li>`;
            body += `<li><span class="caret">Online Resources</span>
				<ul class="nested">`;
            for (var i = 0; i < sites.length; i++) {
                body += `<li class="liitem" url="${sites[i][1]}">${sites[i][0]}</li>`;
            }
            body += `</ul>
			</li>
			</ul> 
		</div>			
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
            return body;
        }
        catch (e) {
            //setup web page
            // Do the same for the stylesheet.
            const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
            const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
            const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
            const styleExamplesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'examples.css'));
            // Use a nonce to only allow a specific script to be run.
            const nonce = (0, getNonce_1.getNonce)();
            var body = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleExamplesUri}" rel="stylesheet">

				<title>Code Examples</title>
			</head>
			<body>
				<div>
				<br/>		
				No documents found			
				</div>	
			</body>
			</html>`;
            return body;
        }
    }
}
exports.ExamplesViewProvider = ExamplesViewProvider;
ExamplesViewProvider.viewType = 'WOWCubeSDK.examplesView';
//# sourceMappingURL=ExamplesViewProvider.js.map