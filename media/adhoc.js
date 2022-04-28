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

    window.onload = function()
    { 
        try
        {
            document.getElementById('generate_button').addEventListener('click', () => 
            {
                vscode.postMessage({ type: 'generate', value: document.getElementById('description').value });
            }); 
        }
        catch(e){}

        try
        {
            document.getElementById('close_button').addEventListener('click', () => 
            {
                vscode.postMessage({ type: 'close', value: "" });
            }); 
        }
        catch(e){}

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