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
        this.docs = [];
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
                        ExamplePanel_1.ExamplePanel.createOrShow(Configuration_1.Configuration.context.extensionUri, data.value);
                    }
                    break;
                case 'docSelected':
                    {
                        DocumentPanel_1.DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, data.value.folder, data.value.file, this._currentDocsVersion);
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
    getExamples() {
        var categories = new Array();
        //Get existing categories of examples
        var catInfoPath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/categories.json';
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
                var path = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/examples/' + versions[i] + '/' + categories[j] + '/';
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
    getDocumentation() {
        var topics = new Array();
        this._currentDocsVersion = Configuration_1.Configuration.getCurrentVersion();
        var sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/';
        var sourceDocsRoot = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/';
        //check if we have documentation of needed version
        if (fs.existsSync(sourceDocsRoot) === true) {
            if (fs.existsSync(sourceDocs) === false) {
                //current version doesn't have its own docs. Let's look for a "base" version
                var v1r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(this._currentDocsVersion);
                var majs = v1r?.groups?.maj;
                var mins = v1r?.groups?.min;
                this._currentDocsVersion = majs + '.' + mins;
                //this must MUST be present. If there is no path of a such, it means that DevKit folder structure is incomplete! 
                sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + this._currentDocsVersion + '/';
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
    getSDKFiles() {
        var files = new Array();
        try {
            var sourceFiles = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + this._currentDocsVersion + '/pawn/include/';
            if (fs.existsSync(sourceFiles) === true) {
                fs.readdirSync(sourceFiles).forEach(file => {
                    if (file !== '.DS_Store') {
                        files.push([file, sourceFiles + file]);
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
            this.examples = this.getExamples();
            var categories = this.examples.c;
            var articles = this.examples.e;
            var names = this.examples.n;
            //get docs
            this.docs = this.getDocumentation();
            //get online resources
            var sites = this.getOnlineResources();
            //get sdk files
            var files = this.getSDKFiles();
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
					<ul class="nested">`;
            for (var i = 0; i < categories.length; i++) {
                body += `<li><span class="caret">${categories[i]}</span>
						<ul class="nested">`;
                articles.forEach((value, key) => {
                    if (key.indexOf(categories[i] + '/') === 0) {
                        try {
                            if (names.has(key)) {
                                var articleName = names.get(key);
                                body += `<li class="liitem" key="${key}">${articleName}</li>`;
                            }
                            else {
                                body += `<li class="liitem" key="${key}">Unnamed Article</li>`;
                            }
                        }
                        catch (e) { }
                    }
                });
                body += `</ul>
						</li>`;
            }
            body += ` </ul>
				</li>      					
				<li><span class="caret">Documentation (SDK Version ${this._currentDocsVersion})</span>
					<ul class="nested">`;
            for (var i = 0; i < this.docs.length; i++) {
                var topic = this.docs[i][0];
                body += `<li><span class="caret">${topic.substring(topic.indexOf('.') + 1)}</span>
						<ul class="nested">`;
                for (var j = 0; j < this.docs[i][1].length; j++) {
                    var item = this.docs[i][1][j];
                    item = item.substring(0, item.length - 3);
                    item = item.substring(item.indexOf('.') + 1);
                    body += `<li class="liitem" file="${this.docs[i][1][j]}" folder="${topic}" doc="1">${item}</li>`;
                }
                body += `</ul>
						</li>`;
            }
            body += `</ul></li>`;
            body += `<li><span class="caret">SDK Files</span>
				<ul class="nested">`;
            for (var i = 0; i < files.length; i++) {
                body += `<li class="liitem" path="${files[i][1]}">${files[i][0]}</li>`;
            }
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