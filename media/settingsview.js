// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
 
    document.querySelector('.sdk-path-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonPressed', value: "" });
    });
    
    document.querySelector('.sdk-path').addEventListener('input',() =>
    {
        vscode.postMessage({ type: 'pathChanged', value: document.getElementById('sdkpath').value });
    });

    document.querySelector('.selector').addEventListener('change',() =>
    {
        vscode.postMessage({ type: 'versionChanged', value: document.getElementById('versions').value });
    });
    
    document.querySelector('.share-adhoc-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonCheckForUpdatesPressed', value: "" });
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
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
        }
    });
}());