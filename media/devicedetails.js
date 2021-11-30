/* eslint-disable eqeqeq */
// @ts-nocheck
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

class AppItem
{
    constructor(id, el, item)
    {
        this.id = id;
        this.el = el;
        this.item = item;
    }
}

class AppList
{
    constructor(el)
    {
        this.el = el;
        this.items = new Array();
    }

    addApp(app)
    {
        var n = this.items.length;


        /*
                            <div id="i1" class="item" style="min-height: 20px;padding: 8px;">
                                <div style="margin:5px; margin-top:0px; margin-bottom:0px;"><strong>Example1.cub</strong></div>
                                <button class="bt-manage-btn">Delete</button>
                            </div>
        */

        const d = document.createElement('div');
        d.id = 'i'+n;
        d.className = 'item';
        d.style.padding = '8px';
        d.style.minHeight = '20px';
        
        const d1 = document.createElement('div');
        d1.style.margin = '5px';
        d1.style.marginTop = '0px';
        d1.style.marginBottom = '0px';

        d1.innerHTML = '<strong>'+app.name+'</strong>';

        d.appendChild(d1);

        const b = document.createElement('button');
        b.className = 'bt-manage-btn';
        b.innerHTML = 'Delete';

        b.addEventListener('click',()=>
        {
            window.dispatchEvent(new CustomEvent('deleteressed',{app:app.name}));
        });

        d.appendChild(b);
        this.el.appendChild(d);

        var item = new AppItem(n,d,app);
        this.items.push(item);       
    }

    clearApps()
    {
        this.items = new Array();
        this.el.innerHTML = "";
    }
}

(function () {

    var apps = null;
    
    // @ts-ignore
    window.onload = function()
    {        
        apps = new AppList(document.getElementById("applist"));

        for(var i=0;i<10;i++)
        {
           apps.addApp({name:'Application '+i+'.cub'});
        }

        document.getElementById('generate_button').addEventListener('click', () => 
        {
            showWait(true);

            
            /*
            if(val!=null)
            {               
                vscode.postMessage({ type: 'generate', value: val });
            }
            else
            {
                vscode.postMessage({ type: 'error', value: "Unable to generate the project, please provide correct values first" });
            }
            */
        }); 
    };
 
    window.addEventListener('itempressed', (e)=>
    {        
        /*
            for(var i=1;i<7;i++)
           {
               items[i-1].setSelected(false);
               
               if(items[i-1].id==e.detail.id) 
               {
                   items[i-1].setSelected(true);
                   selectedItem = items[i-1].id;
                }
           }
           */
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        /*
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'folderSelected':
                {
                    document.getElementById('foldername').value = message.value;
                    break;
                }
        }
        */
    });
}());