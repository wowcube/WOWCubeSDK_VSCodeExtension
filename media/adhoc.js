/* eslint-disable eqeqeq */
// @ts-nocheck

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    function showWait(b)
    {
        if(b)
        {
            document.getElementById('wait').className = 'fullscreen topmost visible';
        }
        else
        {
            document.getElementById('wait').className = 'fullscreen topmost hidden';
        }
    }

    /*
    function validate()
    {
        let n = document.getElementById('projectname');
        let f = document.getElementById('foldername');
        var ret = true;

        if(typeof(n.value)==='undefined' || n.value.length==0) {vscode.postMessage({ type: 'error', value: "Please provide a name for the project" }); ret = false;}
        if(typeof(f.value)==='undefined' || f.value.length==0) {vscode.postMessage({ type: 'error', value: "Please choose a destination folder for the project" }); ret = false;}

        var name = n.value;
       
        if(ret)
        {
            if (!name.replace(/\s/g, '').length) 
            {
                vscode.postMessage({ type: 'error', value: "Invalid project name"}); ret = false;
            }

            if(name.length>64)
            {
                vscode.postMessage({ type: 'error', value: "Project name must be 64 characters long or less"}); ret = false;
            }
        }   
        
        if(selectedItem==null) 
        {
            vscode.postMessage({ type: 'error', value: "Please select a project template"}); ret = false;
        }

        if(ret==true)
        {
            return {
                   name:name.replace(/[\/|\\: *?"<>]/g, "_"),
                   path:f.value,
                   item: selectedItem 
                   };
        }
        else
        {
            return null;
        }
    }
    */

    window.onload = function()
    { 
        document.getElementById('generate_button').addEventListener('click', () => 
        {
            //var val = validate();

            //if(val!=null)
            //{               
                vscode.postMessage({ type: 'generate', value: '' });
            //}
            //else
            //{
                //vscode.postMessage({ type: 'error', value: "Unable to generate the project, please provide correct values first" });
            //}
        }); 

        window.addEventListener('message', event =>  
    {  
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'startRequest':
                {
                    showWait(true);
                }
                break;
            case 'endRequest':
                {
                    showWait(false);
                }
                break;
        }
    });
    };
}());