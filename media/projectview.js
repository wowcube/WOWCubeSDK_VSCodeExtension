// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    function validate()
    {
        let n = document.getElementById('appname');
        let v = document.getElementById('appversion');
        let t = document.getElementById('targetsdk');
        let ai = document.getElementById('appicon');
        let sf = document.getElementById('sourcefile');
        let scf = document.getElementById('scriptfile');
        let idir = document.getElementById('imagedir');
        let sdir = document.getElementById('sounddir');

        let nt = document.getElementById('appnamet');
        let vt = document.getElementById('appversiont');
        let tt = document.getElementById('targetsdkt');
        let ait = document.getElementById('appicont');
        let sft = document.getElementById('sourcefilet');
        let scft = document.getElementById('scriptfilet');
        let idirt = document.getElementById('imagedirt');
        let sdirt = document.getElementById('sounddirt');

        var ret = true;

        nt.className="";
        vt.className="";
        tt.className="";
        ait.className="";
        sft.className="";
        scft.className="";
        idirt.className="";
        sdirt.className="";

        if(typeof(n.value)==='undefined' || n.value.length==0) {nt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a name for the project" }); ret = false;}
        if(typeof(v.value)==='undefined' || v.value.length==0) {vt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a version of the cubeapp application" }); ret = false;}
        if(typeof(ai.value)==='undefined' || ai.value.length==0) {ait.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a full path and filename of cubeapp application icon" }); ret = false;}
        if(typeof(sf.value)==='undefined' || sf.value.length==0) {sft.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid name for the source file" }); ret = false;}
        if(typeof(scf.value)==='undefined' || scf.value.length==0) {scft.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid name for the object file" }); ret = false;}
        if(typeof(idir.value)==='undefined' || idir.value.length==0) {idirt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid path to image assets directory" }); ret = false;}
        if(typeof(sdir.value)==='undefined' || sdir.value.length==0) {sdirt.className="negative"; vscode.postMessage({ type: 'error', value: "Please provide a valid path to sound assets directory" }); ret = false;}

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
        if(ret===true)
        {
            return {
                   name:name.replace(/[\/|\\: *?"<>]/g, "_"),
                   version:v.value,
                   sdkVersion: t.value,
                   appIcon:ai.value,
                   sourceFile:sf.value,
                   scriptFile:scf.value,
                   imageAssetsDir:idir.value,
                   soundAssetsDir:sdir.value 
                   };
        }
        else
        {
            return null;
        }
    };

    window.onload = function()
    {
        try
        {
            document.getElementById('appname').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('appversion').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('appicon').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('sourcefile').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('scriptfile').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('imagedir').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});
            document.getElementById('sounddir').addEventListener('input',() => { vscode.postMessage({ type: 'update', value: validate() });});

            document.getElementById('targetsdk').addEventListener('change',() =>
            {
               vscode.postMessage({ type: 'update', value: validate() });
            });

            document.getElementById('save_button').addEventListener('click', () => 
            {
                var resp = validate();
                vscode.postMessage({ type: 'save', value: resp });
            });
        }
        catch(e){}
    };

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data;
        switch (message.type) 
        {
            case 'update':
                {
                    try
                    {                        
                        var d = JSON.parse(message.text);

                        document.getElementById('appname').value = d.name;
                        document.getElementById('appversion').value = d.version;
                        document.getElementById('appicon').value = d.appIcon;
                        document.getElementById('sourcefile').value = d.sourceFile;
                        document.getElementById('scriptfile').value = d.scriptFile;
                        document.getElementById('imagedir').value = d.imageAssetsDir;
                        document.getElementById('sounddir').value = d.soundAssetsDir;
            
                        document.getElementById('targetsdk').value = d.sdkVersion;

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