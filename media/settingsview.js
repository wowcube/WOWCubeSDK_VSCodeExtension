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

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'folderSelected':
                {
                    document.getElementById('sdkpath').value = message.value;
                    break;
                }
                case 'checkPath':
                    {
                        vscode.postMessage({ type: 'checkPath', value: "" });
                        break;
                    }    
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
                        break;
                    }
        }
    });
}());