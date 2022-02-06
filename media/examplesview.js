// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
 
    var toggler = document.getElementsByClassName("caret");
    var items = document.getElementsByClassName("liitem");
    var i;

    for (i = 0; i < toggler.length; i++) 
    {
        toggler[i].addEventListener("click", function() 
        {
            this.parentElement.querySelector(".nested").classList.toggle("active");
            this.classList.toggle("caret-down");
        });
    } 

    for(i=0;i<items.length;i++)
    {
        items[i].addEventListener("click",function()
            {
                var key = this.getAttribute('key');
                var url = this.getAttribute('url');

                if(url!==null)
                {
                    vscode.postMessage({ type: 'urlSelected', value: url });
                    return;
                }
                
                if(key!==null)
                {
                    vscode.postMessage({ type: 'itemSelected', value: key });
                }
                else
                {
                    var folder = this.getAttribute('folder');
                    var file = this.getAttribute('file');

                    vscode.postMessage({ type: 'docSelected', value: {folder:folder,file:file} });
                }
            }
        );
    }

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {                          
        }
    });
}());