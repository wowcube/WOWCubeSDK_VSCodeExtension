// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    window.onload = function()
    {    
        try
        {
            const collection = document.getElementsByClassName("install_button");

            for (let i = 0; i < collection.length; i++) 
            {
                collection[i].addEventListener('click', (e) => 
                {
                    var pack = e.target.getAttribute('pack');
                    var packname = e.target.getAttribute('packname');
                    vscode.postMessage({ type: 'installButtonPressed', value: {pack:pack, packname:packname} });
                });        
            }
        }
        catch(ex){}

        try
        {
            const collection = document.getElementsByClassName("remove_button");

            for (let i = 0; i < collection.length; i++) 
            {
                collection[i].addEventListener('click', (e) => 
                {
                    var pack = e.target.getAttribute('pack');
                    var packname = e.target.getAttribute('packname');
                    vscode.postMessage({ type: 'removeButtonPressed', value: {pack:pack, packname:packname} });
                });        
            }
        }
        catch(ex){}

        // Handle messages sent from the extension to the webview
        window.addEventListener('message', event =>  
        {
            const message = event.data; // The json data that the extension sent
            switch (message.type) 
            {
            case 'showWait':
                {
                    document.getElementById('wait').className = 'wait visible';
                }
                break;
            case 'hideWait':
                    {
                        document.getElementById('wait').className = 'wait';
                    }
                    break;   
            case 'setProgress':
                {
                    document.getElementById('progresstext').innerHTML = message.value;
                }
                break;
            default:
                break;
            }
        });
    }
}());