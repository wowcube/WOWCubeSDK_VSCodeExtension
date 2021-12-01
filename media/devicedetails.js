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
            window.dispatchEvent(new CustomEvent('deleteressed',{detail:app.name}));
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

    setDeviceStatus(status)
    {
        var el = document.getElementById('status');

        el.className = "fontnormal "+this.getStatusClass(status);
        el.innerHTML = this.getStatusLine(status);
    }

    setDeviceInfo(info)
    {
        var el = document.getElementById('firmware');

        el.className = "fontnormal";
        el.innerHTML = info;
    }

    setBatteryInfo(info)
    {
        var el = document.getElementById('charge');

        el.className = "fontnormal";
        el.innerHTML = info;
    }

    setAppsList(info)
    {
        try
        {
            this.clearApps();

            for(var i=0;i<info.length;i++)
            {
                this.addApp({name:info[i]});
            }
         }
         catch(e){}
    }

    clear()
    {
        document.getElementById('status').innerHTML = "";
        document.getElementById('firmware').innerHTML = "";
        document.getElementById('charge').innerHTML = "";

        this.clearApps();
    }

    getStatusLine(status)
    {
        switch(status)
        {
            case 0: return 'Connecting...';
            case 1: return 'Connected';
            case -1: return 'Not Connected';
        }
        return 'Unknown';
    }

    getStatusClass(status)
    {
        switch(status)
        {
            case 0: return 'neutral';
            case 1: return 'positive';
            case -1: return 'negative';
        }
        return 'neutral';
    }
}

(function () {

    var apps = null;
    
    // @ts-ignore
    window.onload = function()
    {                
        apps = new AppList(document.getElementById("applist"));

        document.getElementById('refresh_button').addEventListener('click', () => 
        {
            showWait(true);
            apps.clear();
            vscode.postMessage({ type: 'refresh', value: "" });
        }); 
    };

    window.addEventListener('deleteressed', (e)=>
    {        
        showWait(true);
        vscode.postMessage({ type: 'deleteapp', value: e.detail }); 
    });

    // Handle messages sent from the extension to the webview

    window.addEventListener('message', event =>  
    {  
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'startRequest':
                {
                    apps.clear();
                    showWait(true);
                }
                break;
            case 'endRequest':
                {
                    showWait(false);
                }
                break;
            case 'setDeviceStatus':
                {
                    try
                    {
                        apps.setDeviceStatus(message.value.status);
                    }
                    catch(e){}
                }
                break;
            case 'setDeviceInfo':
                {
                    try
                    {
                        apps.setDeviceInfo(message.value.info);
                    }
                    catch(e){}
                }
                break;
            case 'setBatteryInfo':
                {
                    try
                    {
                        apps.setBatteryInfo(message.value.info);
                    }
                    catch(e){}
                }
                break;
            case 'setAppsList':
                {
                    try
                    {
                        apps.setAppsList(message.value.info);
                    }
                    catch(e){}
                }
                break;
        }
    });
}());