/* eslint-disable eqeqeq */
// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
   
    window.onload = function()
    { 
        /*
        document.getElementById('folder_button').addEventListener('click', () => 
        {
            vscode.postMessage({ type: 'folder', value: "" });
        });

        document.getElementById('generate_button').addEventListener('click', () => 
        {
            var val = validate();

            if(val!=null)
            {               
                vscode.postMessage({ type: 'generate', value: val });
            }
            else
            {
                vscode.postMessage({ type: 'error', value: "Unable to generate the project, please provide correct values first" });
            }
        }); 

           for(var i=1;i<7;i++)
           {
               items.push(new TemplateItem(i,document.getElementById("i"+i)));
           }
        */
    };
 
    /*
    window.addEventListener('itempressed', (e)=>
    {        
            for(var i=1;i<7;i++)
           {
               items[i-1].setSelected(false);
               
               if(items[i-1].id==e.detail.id) 
               {
                   items[i-1].setSelected(true);
                   selectedItem = items[i-1].id;
                }
           }
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'folderSelected':
                {
                    document.getElementById('foldername').value = message.value;
                    break;
                }
        }
    });
    */
}());