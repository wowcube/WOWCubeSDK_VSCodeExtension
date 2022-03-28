/* eslint-disable eqeqeq */
// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    
    window.onload = function()
    { 
        document.getElementById('versions').addEventListener('change',() =>
        {
            vscode.postMessage({ type: 'versionChanged', value: document.getElementById('versions').value });
        });

        try
        {
            document.getElementById('viewdiv').addEventListener('scroll', () => 
            {
                vscode.postMessage({ type: 'scrollChanged', value: document.getElementById('viewdiv').scrollTop });
            });
        }
        catch(e){}

        try
        {
            document.getElementById('prev_button').addEventListener('click', () => 
            {
                var key = document.getElementById('prev_button').getAttribute('key');
                vscode.postMessage({ type: 'prev', value: key });
            });
        }
        catch(e){}

        try
        {  
            document.getElementById('next_button').addEventListener('click', () => 
            {
                var key = document.getElementById('next_button').getAttribute('key');
                vscode.postMessage({ type: 'next', value: key });
            });
        }
        catch(e){}
        
        document.getElementById('generate_button').addEventListener('click', () => 
        {
            var key = document.getElementById('generate_button').getAttribute('key');
            vscode.postMessage({ type: 'generate', value: key });
        }); 

        window.addEventListener('message', event =>  
        {
            const message = event.data; // The json data that the extension sent
            switch (message.type) 
            {
                case 'scrollTo':
                    {
                        document.getElementById('viewdiv').scrollTop = message.value;
                        break;
                    }
            }
        });
    };
}());