/* eslint-disable eqeqeq */
// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
   
    window.onload = function()
    { 
        try
        {
            var items = document.getElementsByClassName("item");

            var i;        
            for (i = 0; i < items.length; i++) 
            {
                items[i].addEventListener("click", function() 
                {
                    var doc = this.getAttribute('doc');
                    var path = this.getAttribute('folder');
                    var fname = this.getAttribute('fname');
                    var lang = this.getAttribute('lang');
                    var fullpath = this.getAttribute('path');
                    var pos = this.getAttribute('pos');

                    vscode.postMessage({ type: 'selected', value: {doc:doc, lang:lang, path:path, fname:fname, fullpath:fullpath, pos:pos} });
                });
            } 
        }
        catch(e){}
        
        window.addEventListener('message', event =>  
        {
            const message = event.data; // The json data that the extension sent
            switch (message.type) 
            {
            }
        });
    };
}());