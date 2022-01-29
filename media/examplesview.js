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
            /*
            case 'folderSelected':
                {
                    document.getElementById('sdkpath').value = message.value;
                }
                break;
                case 'checkPath':
                    {
                        vscode.postMessage({ type: 'checkPath', value: "" });
                    }    
                break;
                case 'pathError':
                    {
                        if(message.value==true)
                        {
                            document.getElementById('path_err').className = 'visible';
                        }
                        else
                        {
                            document.getElementById('path_err').className = 'hidden';
                        }
                    }
                break;
                case 'setVersion':
                    {
                        document.getElementById('versions').value = message.value;
                     }
                break;                     
                case 'clearVersions':
                    {
                        document.getElementById('versions').innerHTML = "";
                    }
                break;    
                case 'addVersion':
                    {
                        var s = document.getElementById('versions');
                        s.options[s.options.length] = new Option(message.value, message.value);
                    } 
                break;    
                */                                     
        }
    });
}());