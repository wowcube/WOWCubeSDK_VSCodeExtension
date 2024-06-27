"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResultPanel = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
const fs = require("fs");
const path = require("path");
const Configuration_1 = require("./Configuration");
const DocumentPanel_1 = require("./DocumentPanel");
const lunr = require("lunr");
class SearchResultPanel {
    constructor(panel, extensionUri, search) {
        this._disposables = [];
        this._key = "";
        this._searchtext = "";
        this._viewLoaded = false;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._key = '___' + search;
        this._searchtext = search;
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
                case 'selected':
                    {
                        switch (message.value.doc) {
                            case 'doc':
                                {
                                    if (message.value.lang == 'wowconnect') {
                                        DocumentPanel_1.DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, message.value.path, message.value.fullpath, Configuration_1.Configuration.getCurrentVersion(), 'none');
                                    }
                                    else {
                                        DocumentPanel_1.DocumentPanel.createOrShowDoc(Configuration_1.Configuration.context.extensionUri, message.value.path, message.value.fname + ".md", Configuration_1.Configuration.getCurrentVersion(), message.value.lang);
                                    }
                                }
                                break;
                        }
                    }
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShowDoc(extensionUri, search) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn : undefined;
        var exampleKey = '___' + search;
        // If we already have a panel, show it.      
        if (SearchResultPanel.panels.has(exampleKey)) {
            SearchResultPanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel(SearchResultPanel.viewType, 'WOWCube SDK Search Result', column || vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        SearchResultPanel.panels.set(exampleKey, new SearchResultPanel(panel, extensionUri, search));
    }
    dispose() {
        SearchResultPanel.panels.delete(this._key);
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
        //webview.postMessage({ type: 'scrollTo',value: this._scrollPos} );
        if (this._viewLoaded === false)
            this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    getDocumentation(lang) {
        var topics = new Array();
        let currentDocsVersion = Configuration_1.Configuration.getCurrentVersion();
        var sourceDocsRoot = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/';
        var sourceDocs = '';
        var sourceDocsRoot = '';
        switch (lang) {
            default:
            case 'pawn':
                {
                    sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/pawn/';
                }
                break;
            case 'cpp':
                {
                    sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/cpp/';
                }
                break;
            case 'rust':
                {
                    sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/rust/';
                }
                break;
        }
        //check if we have documentation of needed version
        if (fs.existsSync(sourceDocsRoot) === true) {
            if (fs.existsSync(sourceDocs) === false) {
                //current version doesn't have its own docs. Let's look for a "base" version
                var v1r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(currentDocsVersion);
                var majs = v1r?.groups?.maj;
                var mins = v1r?.groups?.min;
                currentDocsVersion = majs + '.' + mins;
                //this must MUST be present. If there is no path of a such, it means that DevKit folder structure is incomplete! 
                //sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+this._currentDocsVersion+'/';
                switch (lang) {
                    default:
                    case 'pawn':
                        {
                            sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/pawn/';
                        }
                        break;
                    case 'cpp':
                        {
                            sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/cpp/';
                        }
                        break;
                    case 'rust':
                        {
                            sourceDocs = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/docs/' + currentDocsVersion + '/rust/';
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
    buildIndex() {
        var docs_pawn = [];
        var docs_cpp = [];
        var docs_rust = [];
        //get docs
        docs_pawn = this.getDocumentation('pawn');
        docs_cpp = this.getDocumentation('cpp');
        docs_rust = this.getDocumentation('rust');
        //var documents: { id: number; title: string; content: string; type:string; lang: string; }[] = [];
        SearchResultPanel.searchIndex = lunr(function () {
            this.ref('id');
            this.field('path');
            this.field('title');
            this.field('content');
            this.field('type');
            this.field('lang');
            this.metadataWhitelist = ['position'];
            var root_path = Configuration_1.Configuration.getWOWSDKPath();
            var docs_path = "";
            var docs_title = "";
            var ind = 0;
            //pawn
            for (var i = 0; i < docs_pawn.length; i++) {
                docs_path = root_path + 'sdk/docs/' + Configuration_1.Configuration.getCurrentVersion() + '/pawn/' + docs_pawn[i][0] + '/';
                docs_title = docs_pawn[i][0];
                fs.readdirSync(docs_path).forEach((file, index) => {
                    const filePath = path.join(docs_path, file);
                    if (path.extname(file) === '.md') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const title = path.basename(file, '.md');
                        const doc = { id: ind, path: filePath, folder: docs_title, title: title, content: content, type: 'doc', lang: 'pawn' };
                        SearchResultPanel.searchTOC.push(doc);
                        this.add(doc);
                        ind++;
                    }
                });
            }
            //cpp
            for (var i = 0; i < docs_cpp.length; i++) {
                docs_path = root_path + 'sdk/docs/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/' + docs_cpp[i][0] + '/';
                docs_title = docs_cpp[i][0];
                fs.readdirSync(docs_path).forEach((file, index) => {
                    const filePath = path.join(docs_path, file);
                    if (path.extname(file) === '.md') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const title = path.basename(file, '.md');
                        const doc = { id: ind, path: filePath, folder: docs_title, title: title, content: content, type: 'doc', lang: 'cpp' };
                        SearchResultPanel.searchTOC.push(doc);
                        this.add(doc);
                        ind++;
                    }
                });
            }
            //rust
            for (var i = 0; i < docs_rust.length; i++) {
                docs_path = root_path + 'sdk/docs/' + Configuration_1.Configuration.getCurrentVersion() + '/rust/' + docs_rust[i][0] + '/';
                docs_title = docs_rust[i][0];
                fs.readdirSync(docs_path).forEach((file, index) => {
                    const filePath = path.join(docs_path, file);
                    if (path.extname(file) === '.md') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const title = path.basename(file, '.md');
                        const doc = { id: ind, path: filePath, folder: docs_title, title: title, content: content, type: 'doc', lang: 'rust' };
                        SearchResultPanel.searchTOC.push(doc);
                        this.add(doc);
                        ind++;
                    }
                });
            }
            //wowconnect
            for (var i = 0; i < docs_rust.length; i++) {
                docs_path = root_path + 'sdk/docs/wowconnect/';
                fs.readdirSync(docs_path).forEach((file, index) => {
                    const filePath = path.join(docs_path, file);
                    if (path.extname(file) === '.md') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const title = path.basename(file, '.md');
                        const doc = { id: ind, path: filePath, folder: "WOW Connect Library", title: title, content: content, type: 'doc', lang: 'wowconnect' };
                        SearchResultPanel.searchTOC.push(doc);
                        this.add(doc);
                        ind++;
                    }
                });
            }
        });
        for (var i = 0; i < SearchResultPanel.searchTOC.length; i++) {
            SearchResultPanel.searchTOC[i].content = "";
        }
    }
    doIndexing() {
        try {
            let indexpath = Configuration_1.Configuration.getFullToolPath("SearchIndex.json");
            let tocpath = Configuration_1.Configuration.getFullToolPath("SearchTOC.json");
            let indexversionpath = Configuration_1.Configuration.getFullToolPath("SearchIndexVersion.json");
            let version = Configuration_1.Configuration.getCurrentVersion();
            if (!fs.existsSync(indexpath) || !fs.existsSync(tocpath)) {
                //index doesnt exist and needs to be built. 
                //DO INDEXING
                this.buildIndex();
                fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));
                //save version
                let json = '{"version":"' + version + '"}';
                fs.writeFileSync(indexversionpath, json);
                return;
            }
            if (!fs.existsSync(indexversionpath)) {
                //index version doesn't exist, do indexig and save current version 
                let json = '{"version":"' + version + '"}';
                //DO INDEXING 
                this.buildIndex();
                fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));
                //save version
                fs.writeFileSync(indexversionpath, json);
            }
            else {
                var ver = fs.readFileSync(indexversionpath, 'utf-8');
                var json = JSON.parse(ver);
                if (json.version !== version) {
                    //the index is built for different version, has to be rebuilt
                    //DO INDEXING
                    this.buildIndex();
                    fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                    fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));
                    //save new version
                    let json = '{"version":"' + version + '"}';
                    fs.writeFileSync(indexversionpath, json);
                }
                else {
                    //the index should be fine
                    if (SearchResultPanel.searchIndex == null) {
                        SearchResultPanel.searchIndex = lunr.Index.load(JSON.parse(fs.readFileSync(indexpath, 'utf-8')));
                        SearchResultPanel.searchTOC = JSON.parse(fs.readFileSync(tocpath, 'utf-8'));
                    }
                }
            }
        }
        catch (e) {
        }
    }
    _getHtmlForWebview(webview) {
        this.doIndexing();
        var search_result = SearchResultPanel.searchIndex.search(this._searchtext); //.map(result => result.ref);
        var title = this._searchtext;
        if (title.length > 40) {
            title = title.substring(0, 37);
            title += "...";
        }
        this._panel.title = "Search Result : " + title;
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        const styleMDUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "markdown.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "searchresult.js"));
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
                    <title>Document</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">

                        <div id="viewdiv" class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px; top:0px;">`;
        ret += `<h3> SEARCH RESULT FOR: <h1>` + this._searchtext + `</h1></h3>`;
        if (search_result.length > 0) {
            for (var i = 0; i < search_result.length; i++) {
                var el = search_result[i];
                var j = parseInt(el.ref, 10);
                const doc = SearchResultPanel.searchTOC[j];
                var content = fs.readFileSync(doc.path, 'utf8');
                var content_pos = 0;
                if (content.length > 0) {
                    const keys = Object.keys(el.matchData.metadata);
                    if (keys.length > 0) {
                        var pos = el.matchData.metadata[keys[0]].content.position;
                        if (pos.length > 0) {
                            content = content.substring(pos[0][0], pos[0][0] + 200);
                            content_pos = pos[0][0];
                        }
                        else {
                            content = "No search result preview available... ";
                        }
                    }
                    else {
                        content = "No search result preview available... ";
                    }
                }
                else {
                    content = "No search result preview available... ";
                }
                var title = doc.title;
                if (title.length > 2) {
                    if (title[1] == '.') {
                        title = title.substring(2);
                    }
                }
                else if (title.length > 3) {
                    if (title[2] == '.') {
                        title = title.substring(3);
                    }
                }
                ret += `
                                <div class='item' style="padding:5px;" doc="` + doc.type + `" lang="` + doc.lang + `" folder="` + doc.folder + `" fname="` + doc.title + `" path="` + doc.path + `" pos="` + content_pos + `">
                                <p><strong>` + title + `<strong></p>
                                <p>` + content + `</p>
                                <div>`;
                switch (doc.type) {
                    case 'doc':
                        ret += `<p class='searchresultitemtag'>Documenation</p> `;
                        break;
                    default:
                        break;
                }
                switch (doc.lang) {
                    case 'pawn':
                        ret += `<p class='searchresultitemtag'>Pawn</p> `;
                        break;
                    case 'cpp':
                        ret += `<p class='searchresultitemtag'>C++</p> `;
                        break;
                    case 'rust':
                        ret += `<p class='searchresultitemtag'>Rust</p> `;
                        break;
                    case 'wowconnect':
                        ret += `<p class='searchresultitemtag'>WOW Connect</p> `;
                        break;
                    default:
                        break;
                }
                ret += `</div> </div>`;
            }
        }
        else {
            ret += `<h4>No results</h4>`;
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
exports.SearchResultPanel = SearchResultPanel;
SearchResultPanel.panels = new Map();
SearchResultPanel.viewType = "WOWCubeSDK.searchResultPanel";
SearchResultPanel.searchIndex = null;
SearchResultPanel.searchTOC = [];
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}
//# sourceMappingURL=SearchResultPanel.js.map