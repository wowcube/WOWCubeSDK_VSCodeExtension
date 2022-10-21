// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    function validate()
    {
        let n = document.getElementById('appname');
        let v = document.getElementById('appversion');
        let t = document.getElementById('targetsdk');
        let b = document.getElementById('badge');
        let ai = document.getElementById('appicon');
        let aibg = document.getElementById('appiconbg');
        let sf = document.getElementById('sourcefile');
        let scf = document.getElementById('scriptfile');

        let nt = document.getElementById('appnamet');
        let vt = document.getElementById('appversiont');
        let tt = document.getElementById('targetsdkt');
        let ait = document.getElementById('appicont');
        let sft = document.getElementById('sourcefilet');
        let scft = document.getElementById('scriptfilet');

        let lng = document.getElementById('language_');
        let intpr = document.getElementById('interpreter_');

        let cmpflags = document.getElementById('compilerflags');
        let cmpsettings = document.getElementById('compilersettings');
        let cmpdefines = document.getElementById('defines');

        let incdir1 = document.getElementById('incdir1');
        let incdir2 = document.getElementById('incdir2');
        let incdir3 = document.getElementById('incdir3');
        let incdir4 = document.getElementById('incdir4');
        let incdir5 = document.getElementById('incdir5');

        var ret = true;

        nt.className="";
        vt.className="";
        tt.className="";
        ait.className="";
        sft.className="";
        scft.className="";

        if(typeof(n.value)==='undefined' || n.value.length==0) {nt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a name for the project" }); ret = false;}
        if(typeof(v.value)==='undefined' || v.value.length==0) {vt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a version of the cubeapp application" }); ret = false;}
        if(typeof(ai.value)==='undefined' || ai.value.length==0) {ait.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a full path and filename of cubeapp application icon" }); ret = false;}
        if(typeof(sf.value)==='undefined' || sf.value.length==0) {sft.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid name for the source file" }); ret = false;}
        if(typeof(scf.value)==='undefined' || scf.value.length==0) {scft.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid name for the object file" }); ret = false;}

        var name = n.value;
       
        if(ret)
        {
            if (!name.replace(/\s/g, '').length) 
            {
                nt.className="negative";
                vscode.postMessage({ type: 'error', value: "Invalid project name"}); ret = false;
            }

            if(name.length>60)
            {
                nt.className="negative";
                vscode.postMessage({ type: 'error', value: "Project name must be 60 characters long or less"}); ret = false;
            }
        }   
        
        if(ret)
        {
            if(/\d{1,2}\.\d{1,2}\.\d{1,2}?/.test(v.value))
            {
                // Successful match
            } 
            else
            {
                vt.className="negative";
                vscode.postMessage({ type: 'error', value: "Please make sure cubeapp version format is X.X.X"}); ret = false;
            }
        }

        var imageAssets = new Array();
        var soundAssets = new Array();

        var imp = document.getElementsByClassName('imageassetalias');

        if(typeof imp !== 'undefined')
        {
            for(var i=0;i<imp.length;i++)
            {
                try
                {
                    var did = 'imageassetalias'+i;
                    var alias = document.getElementById(did).value;

                    did = 'imageassetpath'+i;
                    var pathd = document.getElementById(did);
                    var path = pathd.innerHTML.trim();
                    pathd.className = "";

                    if(typeof(alias)==='undefined' || alias.length==0) {pathd.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide an identifier for resource '"+path+"'" }); ret = false; break;}
                    if(alias.length>15) {pathd.className="negative"; vscode.postMessage({ type: 'error', value: "Identifier of the resource '"+path+"' must not be longer than 15 characters" }); ret = false; break;}

                    did = 'imageassetpixeldepth'+i;
                    var pd = document.getElementById(did).value; 

                    if(pd.length>0)
                    {
                        imageAssets.push(
                        {
                            path:path,
                            alias:alias,
                            encoding:pd
                        });
                    }
                    else
                    {
                        imageAssets.push(
                            {
                                path:path,
                                alias:alias
                            });    
                    }
                }
                catch(e){}
            }
        }


        imp = document.getElementsByClassName('soundassetalias');

        if(typeof imp !== 'undefined')
        {
            for(var i=0;i<imp.length;i++)
            {
                try
                {
                    var did = 'soundassetalias'+i;
                    var alias = document.getElementById(did).value;

                    did = 'soundassetpath'+i;
                    var pathd = document.getElementById(did);
                    var path = pathd.innerHTML.trim();
                    pathd.className = "";

                    if(typeof(alias)==='undefined' || alias.length==0) {pathd.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide an identifier for resource '"+path+"'" }); ret = false; break;}
                    if(alias.length>15) {pathd.className="negative"; vscode.postMessage({ type: 'error', value: "Identifier of the resource '"+path+"' must not be longer than 15 characters" }); ret = false; break;}

                    soundAssets.push(
                            {
                                path:path,
                                alias:alias
                            });    
                }
                catch(e){}
            }
        }

        if(ret===true)
        {
            var obj = new Object({
                   name:name.replace(/[\/|\\: *?"<>]/g, "_"),
                   version:v.value,
                   sdkVersion: t.value,
                   appIcon:{path:ai.value},
                   appIconBg:{path:aibg.value},
                   sourceFile:sf.value,
                   scriptFile:scf.value,
                   imageAssets:imageAssets,
                   soundAssets:soundAssets,
                   appFlags:parseInt(b.value),
                   language:lng.value,
                   interpreter:intpr.value
                   });

            if(obj.language==='cpp' && obj.interpreter === 'wasm')
            {
                obj.projectOptions = new Object();
                obj.projectOptions.cpp = new Object(
                {
                    defines: cmpdefines.value,
                    flags: cmpflags.value,
                    compilerSettings: cmpsettings.value,
                    includeFolders: new Array()
                }
                );

                obj.projectOptions.cpp.includeFolders.push(incdir1.value);
                obj.projectOptions.cpp.includeFolders.push(incdir2.value);
                obj.projectOptions.cpp.includeFolders.push(incdir3.value);
                obj.projectOptions.cpp.includeFolders.push(incdir4.value);
                obj.projectOptions.cpp.includeFolders.push(incdir5.value);
            }

            return obj;
        }
        else
        {
            return null;
        }
    };

    function updateAssets(d)
    {
        var imageAssets = d.imageAssets;
        var soundAssets = d.soundAssets;

        //sound
        var p = document.getElementById('sounditems');
        p.innerHTML = "";

        for(var i=0;i<soundAssets.length;i++)
        {
            var ass = soundAssets[i];

            try
            {
                var path = ass.path;
                var alias = ass.alias;

                if(typeof path==='undefined' || typeof alias==='undefined') {continue;}

                var el = document.createElement('div');
                el.className = 'assetitem sound';
                
                el.innerHTML = 
                `<div style="display:inline-block; min-width:25%;"> 
                <input id="soundassetalias${i}" class="soundassetalias" style="display:inline-block; width: calc(100% - 40px);" value="${alias}"></input>
                </div>
                <div id="soundassetpath${i}" style="display:inline-block; min-width:calc(75% - 130px);">${path}</div>`;

                p.appendChild(el);
            }
            catch(e){}
        }

        //images
        var p = document.getElementById('imageitems');
        p.innerHTML = "";

        for(var i=0;i<imageAssets.length;i++)
        {
            var ass = imageAssets[i];

            try
            {
                var path = ass.path;
                var alias = ass.alias;
                var encoding = ass.encoding;


                if(typeof path==='undefined' || typeof alias==='undefined') {continue;}

                if(i===0)
                {
                    var h = document.createElement('div');
                    h.style.padding = '5px';
                    h.innerHTML = `
                    <div style="display:inline-block; min-width:25%;"> 
                    Resource Identifier
                    </div>

                    <div style="display:inline-block; min-width:calc(75% - 130px);"> 
                        Resource File Name
                    </div>

                    <div style="display:inline-block; min-width:120px;"> 
                        Image Pixel Depth
                    </div>`;

                    p.appendChild(h);
                }

                var el = document.createElement('div');
                el.className = 'assetitem image';
                
                var body = 
                `<div style="display:inline-block; min-width:25%;"> 
				 <input id="imageassetalias${i}" class='imageassetalias' style="display:inline-block; width: calc(100% - 40px);" value="${alias}"></input>
				 </div>
				 <div id="imageassetpath${i}" style="display:inline-block; min-width:calc(75% - 130px);">${path} </div>
			     <div style="display:inline-block; min-width:120px;"> 
				 <select id='imageassetpixeldepth${i}' class='selector imagepixeldepth' tag='${i}' style="min-width:100px;">`;

									if(typeof encoding === 'undefined')
									{
										body+=`
										<option value="" selected>AUTO</option>
										<option value="RGB565">RGB 565</option>
										<option value="ARGB6666">ARGB 6666</option>
										<option value="ARGB8888">ARGB 8888</option>
										`;
									}
									else
									{
										if(encoding === 'RGB565')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" selected>RGB 565</option>
											<option value="ARGB6666">ARGB 6666</option>
											<option value="ARGB8888">ARGB 8888</option>
											`;											
										}
                                        else
										if(encoding === 'ARGB6666')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" >RGB 565</option>
											<option value="ARGB6666" selected>ARGB 6666</option>
											<option value="ARGB8888">ARGB 8888</option>
											`;											
										}
                                        else
										if(encoding === 'ARGB8888')
										{
											body+=`
											<option value="">AUTO</option>
											<option value="RGB565" >RGB 565</option>
											<option value="ARGB6666">ARGB 6666</option>
											<option value="ARGB8888" selected>ARGB 8888</option>
											`;											
										}
                                        else
                                        {
                                            body+=`
                                            <option value="" selected>AUTO</option>
                                            <option value="RGB565">RGB 565</option>
                                            <option value="ARGB6666">ARGB 6666</option>
                                            <option value="ARGB8888">ARGB 8888</option>
                                            `;     
                                        }
									}

									body+=`</select>
								                   </div>`;

                 el.innerHTML = body;
                 p.appendChild(el);
            }
            catch(e){}
        }

        addListeners();
    };

    function addListeners()
    {
        var imp = document.getElementsByClassName('selector imagepixeldepth');

        if(typeof imp !== 'undefined')
        {
            for(var i=0;i<imp.length;i++)
            {
                imp[i].addEventListener('change',() => { vscode.postMessage({ type: 'update', value: validate() });});
            }
        }

        imp = document.getElementsByClassName('imageassetalias');

        if(typeof imp !== 'undefined')
        {
            for(var i=0;i<imp.length;i++)
            {
                imp[i].addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            }
        }

        imp = document.getElementsByClassName('soundassetalias');

        if(typeof imp !== 'undefined')
        {
            for(var i=0;i<imp.length;i++)
            {
                imp[i].addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            }
        }
    };

    window.onload = function()
    {
        try
        {
            document.getElementById('appname').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('appversion').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('appicon').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('appiconbg').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('sourcefile').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('scriptfile').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});

            try
            {
                document.getElementById('compilerflags').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('defines').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('compilersettings').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});

                document.getElementById('incdir1').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('incdir2').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('incdir3').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('incdir4').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
                document.getElementById('incdir5').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});

                document.getElementById('incdir_button1').addEventListener('click', () => { vscode.postMessage({ type: 'folder', value: 1 });});
                document.getElementById('incdir_button2').addEventListener('click', () => { vscode.postMessage({ type: 'folder', value: 2 });});
                document.getElementById('incdir_button3').addEventListener('click', () => { vscode.postMessage({ type: 'folder', value: 3 });});
                document.getElementById('incdir_button4').addEventListener('click', () => { vscode.postMessage({ type: 'folder', value: 4 });});
                document.getElementById('incdir_button5').addEventListener('click', () => { vscode.postMessage({ type: 'folder', value: 5 });});
            }
            catch(e){}

            document.getElementById('targetsdk').addEventListener('change',() =>
            {
               vscode.postMessage({ type: 'update', value: validate() });
            });

            document.getElementById('badge').addEventListener('change',() =>
            {
               vscode.postMessage({ type: 'update', value: validate() });
            });

            document.getElementById('save_button').addEventListener('click', () => 
            {
                var resp = validate();
                vscode.postMessage({ type: 'save', value: resp });
            });
            
            addListeners();
        }
        catch(e){}
    };

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data;
        switch (message.type) 
        {
            case 'folderSelected':
                {
                    try
                    {
                    switch(message.value.num)
                    {
                        case 1:  document.getElementById('incdir1').value = message.value.path; break;
                        case 2:  document.getElementById('incdir2').value = message.value.path; break;
                        case 3:  document.getElementById('incdir3').value = message.value.path; break;
                        case 4:  document.getElementById('incdir4').value = message.value.path; break;
                        case 5:  document.getElementById('incdir5').value = message.value.path; break;
                    }

                    vscode.postMessage({ type: 'update', value: validate() });

                    break;
                    }
                    catch(e) {}
                }
            break;
            case 'update':
                {
                    try
                    {                        
                        var d = JSON.parse(message.text);

                        document.getElementById('appname').value = d.name;
                        document.getElementById('appversion').value = d.version;
                        document.getElementById('appicon').value = d.appIcon.path;

                        if(typeof d.appIconBg!=='undefined')
                        {
                            if(typeof d.appIconBg.path!=='undefined')
                            {
                                document.getElementById('appiconbg').value = d.appIconBg.path;
                            }
                            else
                            {
                                document.getElementById('appiconbg').value = "";
                            }
                        }
                        else
                        {
                            document.getElementById('appiconbg').value = "";
                        }

                        document.getElementById('sourcefile').value = d.sourceFile;
                        document.getElementById('scriptfile').value = d.scriptFile;

                        document.getElementById('badge').value = d.appFlags;

                        document.getElementById('targetsdk').value = d.sdkVersion;

                        var sel = document.getElementById("targetsdk");
                        var found = false;

                        for (i = 0; i < sel.length; i++) 
                        {
                            if(sel.options[i].value === d.sdkVersion)
                            {
                              found = true;
                              break;           
                            }
                        }

                        if(found)
                        {
                            document.getElementById('targetsdkwarn').style.display = 'none';
                        }
                        else
                        {
                            document.getElementById('targetsdkwarn').style.display = 'block';
                            document.getElementById('targetsdkwarn').innerHTML = 'Application target SDK version '+d.sdkVersion+' is not installed.';
                        }
                        
                        document.getElementById('language_').value = d.language;
                        document.getElementById('interpreter_').value = d.interpreter;

                        try
                        {
                            if(d.language==='cpp' && d.interpreter==='wasm')
                            {
                              document.getElementById('compilerflags').value = d.projectOptions.cpp.flags;
                              document.getElementById('defines').value = d.projectOptions.cpp.defines;
                              document.getElementById('compilersettings').value = d.projectOptions.cpp.compilerSettings;

                              document.getElementById('incdir1').value = d.projectOptions.cpp.includeFolders[0];
                              document.getElementById('incdir2').value = d.projectOptions.cpp.includeFolders[1];
                              document.getElementById('incdir3').value = d.projectOptions.cpp.includeFolders[2];
                              document.getElementById('incdir4').value = d.projectOptions.cpp.includeFolders[3];
                              document.getElementById('incdir5').value = d.projectOptions.cpp.includeFolders[4];
                            }
                        }
                        catch(e){}

                        updateAssets(d);

                        validate();
                    }
                    catch(e){}
                }
                break;
        }
    });
}());

function onChange(e)
{
    vscode.postMessage({ type: 'update', value: validate() });
};