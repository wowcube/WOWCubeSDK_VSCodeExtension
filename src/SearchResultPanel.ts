import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import * as fs from 'fs';
import * as path from 'path';
import {Configuration} from './Configuration';
import { DocumentPanel } from './DocumentPanel';
import { ExamplePanel } from "./ExamplePanel";
import { Version } from "./Version";
import { Providers } from "./Providers";
import * as lunr from 'lunr';

export class SearchResultPanel
{
    public static panels = new Map<string, SearchResultPanel>();
    public static readonly viewType = "WOWCubeSDK.searchResultPanel";

    public static searchIndex:any = null; 
    public static searchTOC: { id: number; path:string, folder: string, title: string; content: string; type:string; lang: string; }[] = [];

    private readonly _panel: vscode.WebviewPanel;  
    private readonly _extensionUri: vscode.Uri;  
    private _disposables: vscode.Disposable[] = [];

    private readonly _key:string = "";
    private readonly _searchtext:string = "";

    private _viewLoaded:Boolean = false;   

    public static createOrShowDoc(extensionUri: vscode.Uri,search:string) 
    { 
        const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn: undefined;

        var exampleKey:string = '___'+search;
        
        // If we already have a panel, show it.      
        if(SearchResultPanel.panels.has(exampleKey))
        {
            SearchResultPanel.panels.get(exampleKey)?._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel. 
        const panel = vscode.window.createWebviewPanel
        (
            SearchResultPanel.viewType,
            'WOWCube SDK Search Result',
            column || vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        SearchResultPanel.panels.set(exampleKey,new SearchResultPanel(panel, extensionUri,search));
    } 
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, search:string) 
        {
            this._panel = panel;    
            this._extensionUri = extensionUri;
            this._key = '___'+search;
            this._searchtext = search;

            // Set the webview's initial html content    
            this._update();

            this._panel.onDidDispose(() => 
            {
                 this.dispose();
                }, 
                null, this._disposables);
               
            // Update the content based on view changes 
            this._panel.onDidChangeViewState(  
                        e => {
                            if (this._panel.visible) 
                            {  
                                this._update();
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
                        case 'selected':
                            {
                                switch(message.value.doc)
                                {
                                    case 'doc':
                                        {
                                            DocumentPanel.textToSearch = this._searchtext;

                                            if(message.value.lang=='wowconnect') 
                                            {
                                                 DocumentPanel.createOrShowDoc(Configuration.context.extensionUri,message.value.path, message.value.fullpath,Configuration.getCurrentVersion(),'none');
                                            }
                                            else
                                            {
                                                DocumentPanel.createOrShowDoc(Configuration.context.extensionUri,message.value.path, message.value.fname+".md",Configuration.getCurrentVersion(),message.value.lang);
                                            }
                                        }
                                    break;
                                    case 'example':
                                        {
                                            ExamplePanel.textToSearch = this._searchtext;

                                            ExamplePanel.createOrShow(Configuration.context.extensionUri,message.value.path,message.value.lang);	
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

        public dispose() 
        {    
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

        private async _update() 
        {
            const webview = this._panel.webview;    

            //webview.postMessage({ type: 'scrollTo',value: this._scrollPos} );

            if(this._viewLoaded===false)
            this._panel.webview.html = this._getHtmlForWebview(webview);  
        }        

        private getExamples(lang:string)
        {
            var categories:Array<string> = new Array<string>();
    
            //Get existing categories of examples
            var catInfoPath = Configuration.getWOWSDKPath()+'sdk/examples/categories_'+lang+'.json';
            const cat = require(catInfoPath);
    
            for(var i=0;i<cat.categories.length;i++)
            {
                categories.push(cat.categories[i]);
            }
    
            //enumerate versions
            catInfoPath = Configuration.getWOWSDKPath()+'sdk/examples/';
    
            var versions:Array<string> = new Array<string>();
            if(fs.existsSync(catInfoPath)===true)
            {
                fs.readdirSync(catInfoPath).forEach(folder => 
                    {
                        versions.push(folder);
                    });
            }
    
            //iterate through versions to collect all examples
            var examples: Map<string,Array<string>> = new Map<string,Array<string>>();
            var names: Map<string,string> = new Map<string,string>();
    
            for(var i=0;i<versions.length;i++)
            {
                for(var j=0;j<categories.length;j++)
                {
                    var path = '';
                    
                    switch(lang)
                    {
                        case 'pawn':
                            path = Configuration.getWOWSDKPath()+'sdk/examples/'+versions[i]+'/pawn/'+categories[j]+'/';
                        break;
                        case 'cpp':
                            path = Configuration.getWOWSDKPath()+'sdk/examples/'+versions[i]+'/cpp/'+categories[j]+'/';
                        break;
                        case 'rust':
                            path = Configuration.getWOWSDKPath()+'sdk/examples/'+versions[i]+'/rust/'+categories[j]+'/';
                        break;					
                    }
                    Configuration.getWOWSDKPath()+'sdk/examples/'+versions[i]+'/'+categories[j]+'/';
    
                    if(fs.existsSync(path))
                    {
                        fs.readdirSync(path).forEach(exampleFolder => 
                            {
                                if(exampleFolder==='.DS_Store') return;
    
                                var key = categories[j]+'/'+exampleFolder;
    
                                if(examples.has(key)===false)
                                {
                                    examples.set(key, new Array<string>());
                                    examples.get(key)?.push(versions[i]);
    
                                    try
                                    {
                                        const info = require(path+'/'+exampleFolder+'/info.json');
                                        names.set(key,info.name);
                                    }
                                    catch(e)
                                    {
                                        names.set(key,"Unnamed Example "+exampleFolder);
                                    }
                                }
                                else
                                {
                                    examples.get(key)?.push(versions[i]);
                                }
                            });
                    }
                }
            }
    
            return {c:categories,e:examples,n:names};
        }

    private getDocumentation(lang:string)
	{
		var topics:Array<[string, Array<string>]> = new Array<[string, Array<string>]>();

		let currentDocsVersion:string = Configuration.getCurrentVersion();
		var sourceDocsRoot = Configuration.getWOWSDKPath()+'sdk/docs/';

		var sourceDocs='';
		var sourceDocsRoot='';

		switch(lang)
		{
			default:
			case 'pawn':
				{
					sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/pawn/';
				}
				break;
			case 'cpp':
				{
					sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/cpp/';
				}
				break;	
			case 'rust':
				{
					sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/rust/';
				}
				break;							 			
		}


		//check if we have documentation of needed version
		if(fs.existsSync(sourceDocsRoot)===true)
		{
			if(fs.existsSync(sourceDocs)===false)
			{
				//current version doesn't have its own docs. Let's look for a "base" version

				var v1r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(currentDocsVersion);

                var majs = v1r?.groups?.maj;
                var mins = v1r?.groups?.min;

				currentDocsVersion = majs+'.'+mins;

				//this must MUST be present. If there is no path of a such, it means that DevKit folder structure is incomplete! 
				//sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+this._currentDocsVersion+'/';

				switch(lang)
				{
					default:
					case 'pawn':
						{
							sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/pawn/';
						}
						break;
					case 'cpp':
						{
							sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/cpp/';
						}
						break;		 	
					case 'rust':
						{
							sourceDocs = Configuration.getWOWSDKPath()+'sdk/docs/'+currentDocsVersion+'/rust/';
						}
						break;										
				}
			}
		}

		 //fetch docs folder for topics
         if(fs.existsSync(sourceDocs)===true)
                {
                    fs.readdirSync(sourceDocs).forEach(folder => 
                        {
							topics.push([folder,new Array<string>()]);
                        });

					for(var i=0;i<topics.length;i++)
					{
						var path = sourceDocs+topics[i][0];

						if(fs.existsSync(path)===true)
						{
							fs.readdirSync(path).forEach(file => 
								{
								  var ext = file.substring(file.lastIndexOf('.'));

								  if(ext==='.md')
								  {
										topics[i][1].push(file);
								  }
								});	
						}
					}
                }
		
		return topics;
	}

        private buildIndex()
        {
            var examples_pawn:any = this.getExamples('pawn');
			var examples_cpp:any = this.getExamples('cpp');
			var examples_rust:any = this.getExamples('rust');

			var categories_pawn:Array<string> = examples_pawn.c;
			var articles_pawn = examples_pawn.e;
			var names_pawn = examples_pawn.n;

			var categories_cpp:Array<string> = examples_cpp.c;
			var articles_cpp = examples_cpp.e;
			var names_cpp = examples_cpp.n;

			var categories_rust:Array<string> = examples_rust.c;
			var articles_rust = examples_rust.e;
			var names_rust = examples_rust.n;

            var docs_pawn:Array<[string, Array<string>]> = [];
            var docs_cpp:Array<[string, Array<string>]> = [];
            var docs_rust:Array<[string, Array<string>]> = [];

			//get docs
			docs_pawn = this.getDocumentation('pawn');
			docs_cpp = this.getDocumentation('cpp');
			docs_rust = this.getDocumentation('rust');

            SearchResultPanel.searchTOC.length = 0;
            
            SearchResultPanel.searchIndex = lunr(function () 
			{
				this.ref('id');
                this.field('path');
				this.field('title');
				this.field('content');
                this.field('type');
                this.field('lang');

				this.metadataWhitelist = ['position'];

                var root_path = Configuration.getWOWSDKPath();
                var docs_path = "";
                var docs_title = "";

                var ind:number = 0;

                for(var i=0;i<categories_pawn.length;i++)
                {
                    articles_pawn.forEach((value: Array<string>, key: string) => 
                    {
                        if(key.indexOf(categories_pawn[i]+'/')===0)
						{
                            try
                            {
                                var articleName:string;

                                if(names_pawn.has(key))
                                {
                                    articleName = names_pawn.get(key);
                                }
                                else
                                {
                                    articleName = "Unnamed Article";
                                }

                                docs_path = root_path+'sdk/examples/'+Configuration.getCurrentVersion()+'/pawn/'+key+'/info.md';
                                docs_title = articleName;

                                const content = fs.readFileSync(docs_path, 'utf8');
                                const title = articleName;
                                const doc = { id: ind, path:docs_path, folder:key, title: title, content: content, type:'example', lang:'pawn'};
                                SearchResultPanel.searchTOC.push(doc);
                                this.add(doc);
                                ind++;
                            }
                            catch(e){}
                        }   
                    });
                }

                for(var i=0;i<categories_cpp.length;i++)
                {
                    articles_cpp.forEach((value: Array<string>, key: string) => 
                    {
                        if(key.indexOf(categories_cpp[i]+'/')===0)
						{
                            try
                            {
                                var articleName:string;

                                if(names_cpp.has(key))
                                {
                                    articleName = names_cpp.get(key);
                                }
                                else
                                {
                                    articleName = "Unnamed Article";
                                }

                                docs_path = root_path+'sdk/examples/'+Configuration.getCurrentVersion()+'/cpp/'+key+'/info.md';
                                docs_title = articleName;

                                const content = fs.readFileSync(docs_path, 'utf8');
                                const title = articleName;
                                const doc = { id: ind, path:docs_path, folder:key, title: title, content: content, type:'example', lang:'cpp'};
                                SearchResultPanel.searchTOC.push(doc);
                                this.add(doc);
                                ind++;
                            }
                            catch(e){}
                        }   
                    });
                }

                for(var i=0;i<categories_rust.length;i++)
                {
                    articles_rust.forEach((value: Array<string>, key: string) => 
                    {
                        if(key.indexOf(categories_rust[i]+'/')===0)
						{
                            try
                            {
                                var articleName:string;

                                if(names_rust.has(key))
                                {
                                    articleName = names_rust.get(key);
                                }
                                else
                                {
                                    articleName = "Unnamed Article";
                                }

                                docs_path = root_path+'sdk/examples/'+Configuration.getCurrentVersion()+'/rust/'+key+'/info.md';
                                docs_title = articleName;

                                const content = fs.readFileSync(docs_path, 'utf8');
                                const title = articleName;
                                const doc = { id: ind, path:docs_path, folder:key, title: title, content: content, type:'example', lang:'rust'};
                                SearchResultPanel.searchTOC.push(doc);
                                this.add(doc);
                                ind++;
                            }
                            catch(e){}
                        }   
                    });
                } 

                //pawn
                for(var i=0;i<docs_pawn.length; i++)
                {
                    docs_path = root_path+'sdk/docs/'+Configuration.getCurrentVersion()+'/pawn/'+docs_pawn[i][0]+'/';
                    docs_title = docs_pawn[i][0];

                    fs.readdirSync(docs_path).forEach((file, index) => 
                    {
                        const filePath = path.join(docs_path, file);
    
                        if (path.extname(file) === '.md') 
                        {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const title = path.basename(file, '.md');
                            const doc = { id: ind, path:filePath, folder:docs_title, title: title, content: content, type:'doc', lang:'pawn'};
                            SearchResultPanel.searchTOC.push(doc);
                            this.add(doc);
                            ind++;
                        }
                    });
                }

                //cpp
                for(var i=0;i<docs_cpp.length; i++)
                {
                    docs_path = root_path+'sdk/docs/'+Configuration.getCurrentVersion()+'/cpp/'+docs_cpp[i][0]+'/';
                    docs_title = docs_cpp[i][0];

                    fs.readdirSync(docs_path).forEach((file, index) => 
                    {
                        const filePath = path.join(docs_path, file);
    
                        if (path.extname(file) === '.md') 
                        {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const title = path.basename(file, '.md');
                            const doc = { id: ind, path:filePath, folder:docs_title, title: title, content: content, type:'doc', lang:'cpp'};
                            SearchResultPanel.searchTOC.push(doc);
                            this.add(doc);
                            ind++;
                        }
                    });
                }   
                
                //rust
                for(var i=0;i<docs_rust.length; i++)
                {
                    docs_path = root_path+'sdk/docs/'+Configuration.getCurrentVersion()+'/rust/'+docs_rust[i][0]+'/';
                    docs_title = docs_rust[i][0];

                    fs.readdirSync(docs_path).forEach((file, index) => 
                    {
                        const filePath = path.join(docs_path, file);
    
                        if (path.extname(file) === '.md') 
                        {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const title = path.basename(file, '.md');
                            const doc = { id: ind, path:filePath, folder:docs_title, title: title, content: content, type:'doc', lang:'rust'};
                            SearchResultPanel.searchTOC.push(doc);
                            this.add(doc);
                            ind++;
                        }
                    });
                }  

                //wowconnect
                for(var i=0;i<docs_rust.length; i++)
                {
                    docs_path = root_path+'sdk/docs/wowconnect/';

                    fs.readdirSync(docs_path).forEach((file, index) => 
                    {
                        const filePath = path.join(docs_path, file);
    
                        if (path.extname(file) === '.md') 
                        {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const title = path.basename(file, '.md');
                            const doc = { id: ind, path:filePath, folder:"WOW Connect Library", title: title, content: content, type:'doc', lang:'wowconnect'};
                            SearchResultPanel.searchTOC.push(doc);
                            this.add(doc);
                            ind++;
                        }
                    });
                }  
			});

            for(var i=0;i<SearchResultPanel.searchTOC.length;i++)
            {
                SearchResultPanel.searchTOC[i].content = "";
            }
        }

        private doIndexing()
        {
            try
            {
                let indexpath = Configuration.getFullToolPath("SearchIndex.json");
                let tocpath = Configuration.getFullToolPath("SearchTOC.json");

                let indexversionpath = Configuration.getFullToolPath("SearchIndexVersion.json");
                let version:string = Configuration.getCurrentVersion();

                if(!fs.existsSync(indexpath) || !fs.existsSync(tocpath))
                {
                    //index doesnt exist and needs to be built. 

                    //DO INDEXING
                    this.buildIndex();
                    fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                    fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));

                    //save version
                    let json: string = '{"version":"'+version+'"}'
                    fs.writeFileSync(indexversionpath,json);
                    return;
                }

                if(!fs.existsSync(indexversionpath))
                {
                    //index version doesn't exist, do indexig and save current version 
                    let json: string = '{"version":"'+version+'"}'

                    //DO INDEXING 
                    this.buildIndex();
                    fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                    fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));

                    //save version
                    fs.writeFileSync(indexversionpath,json);
                }
                else
                {
                    var ver = fs.readFileSync(indexversionpath,'utf-8');
                    var json = JSON.parse(ver);

                    if(json.version!== version)
                    {
                        //the index is built for different version, has to be rebuilt

                        //DO INDEXING
                        this.buildIndex();
                        fs.writeFileSync(indexpath, JSON.stringify(SearchResultPanel.searchIndex));
                        fs.writeFileSync(tocpath, JSON.stringify(SearchResultPanel.searchTOC));

                        //save new version
                        let json: string = '{"version":"'+version+'"}'
                        fs.writeFileSync(indexversionpath,json);
                    }
                    else
                    {
                        //the index should be fine
                        if(SearchResultPanel.searchIndex == null)
                        {
                            SearchResultPanel.searchIndex = lunr.Index.load(JSON.parse(fs.readFileSync(indexpath, 'utf-8')));
                            SearchResultPanel.searchTOC = JSON.parse(fs.readFileSync(tocpath,'utf-8'));
                        }
                    }
                }
            }
            catch(e)
            {
                var t;
                t=0;
            }
        }

        private _getHtmlForWebview(webview: vscode.Webview) 
        {
            this.doIndexing();

            var search_result = SearchResultPanel.searchIndex.search(this._searchtext);//.map(result => result.ref);
			
            var title:string = this._searchtext;
         
            if(title.length>40)
            {
                title = title.substring(0,37);
                title+="...";
            }
            this._panel.title = "Search Result : "+title;
                    
            const styleResetUri = webview.asWebviewUri(      
                vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")   
            );

            const styleVSCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
            );

            const styleMainCodeUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
            );

            const styleMDUri = webview.asWebviewUri(    
                vscode.Uri.joinPath(this._extensionUri, "media", "markdown.css")
            );

            const scriptUri = webview.asWebviewUri( 
                vscode.Uri.joinPath(this._extensionUri, "media", "searchresult.js")
            );
            
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
                    <link href="${styleMDUri}" rel="stylesheet"> 
                    <title>Document</title>
                </head>
                <body>
                    <script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
                      
                    <div style="padding:0px;max-height: 77px;overflow: hidden;">

                        <div id="viewdiv" class="view" style="padding:26px;margin-top: 10px; margin-bottom: 10px; top:0px;">`;
                        
                        ret+= `<h3> SEARCH RESULT FOR: <h1>`+this._searchtext+`</h1></h3>`;

                        if(search_result.length>0)
                        {
                            for(var i:number = 0; i<search_result.length;i++)
                            {
                                var el = search_result[i];
                
                                var j:number = parseInt(el.ref,10);
                                const doc = SearchResultPanel.searchTOC[j];

                                var content:string = fs.readFileSync(doc.path, 'utf8');
                                var content_pos = 0;

                                if(content.length>0)
                                {
                                    const keys = Object.keys(el.matchData.metadata);
                                    if(keys.length>0)
                                    {
                                        var pos = el.matchData.metadata[keys[0]].content.position;

                                        if(pos.length>0)
                                        {
                                            content = content.substring(pos[0][0],pos[0][0]+200);
                                            content_pos = pos[0][0];
                                        }
                                        else
                                        {
                                            content = "No search result preview available... ";
                                        }
                                    }
                                    else
                                    {
                                        content = "No search result preview available... ";
                                    }
                                }
                                else
                                {
                                    content = "No search result preview available... "; 
                                }

                                var title:string = doc.title;
                                if(title.length>2)
                                {
                                    if(title[1]=='.')
                                    {
                                        title = title.substring(2);
                                    }
                                }
                                else
                                if(title.length>3)
                                {
                                    if(title[2]=='.')
                                    {
                                        title = title.substring(3);
                                    }
                                }

                                ret+=`
                                <div class='item' style="padding:5px;" doc="`+doc.type+`" lang="`+doc.lang+`" folder="`+doc.folder+`" fname="`+doc.title+`" path="`+doc.path+`" pos="`+content_pos+`">
                                <p><strong>`+title+`<strong></p>
                                <p>`+content+`</p>
                                <div>`;
                                
                                switch(doc.type)
                                {
                                    case 'doc':
                                        ret+=`<p class='searchresultitemtag'>Documenation</p> `;
                                        break;
                                    case 'example':
                                            ret+=`<p class='searchresultitemtag'>Examples</p> `;
                                        break;                                        
                                    default:
                                        break;
                                }

                                switch(doc.lang)
                                {
                                    case 'pawn':
                                        ret+=`<p class='searchresultitemtag'>Pawn</p> `;
                                        break;
                                    case 'cpp':
                                        ret+=`<p class='searchresultitemtag'>C++</p> `;
                                        break;
                                    case 'rust':
                                        ret+=`<p class='searchresultitemtag'>Rust</p> `;
                                        break;
                                    case 'wowconnect':
                                            ret+=`<p class='searchresultitemtag'>WOW Connect</p> `;
                                            break;                                    
                                    default:
                                        break;
                                }
                                ret+=`</div> </div>`;
                                
                            }
                        }
                        else
                        {
                            ret+=`<h4>No results</h4>`;
                        }
                        ret+=`
                         </div>
                </body>
                </html> 
            `;  
            this._viewLoaded = true;
            return ret;
            
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