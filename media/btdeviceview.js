// @ts-nocheck

const vscode = acquireVsCodeApi();

class BtItem
{
    constructor(id, el,s_el,i_el, item)
    {
        this.id = id;
        this.el = el;
        this.s_el = s_el;
        this.i_el = i_el;
        this.selected = false;
        this.item = item;
        this.status = 0;
        this.info = "";

        try
        {
            this.el.addEventListener('click',()=>
            {
                this.selected = true;
                window.dispatchEvent(new CustomEvent('itempressed',{ detail: this }));
            });
        }
        catch(e){}
    }

    setSelected(v)
    {
        this.selected = v;      
         if(this.selected===true) 
        {
            this.el.className="bt-item selected";            
        }
         else
        {
            this.el.className="bt-item";
        };
    }

    setStatus(s)
    {
        this.status = s;

        if(this.status===1)
        {
            this.i_el.innerHTML = this.info;
        }
        else
        {
            this.i_el.innerHTML = '';
        }

        this.s_el.className = "fontnormal "+this.getStatusClass();
        this.s_el.innerHTML = this.getStatusLine();
    }

    setInfo(s)
    {
        this.info = s;

        //this.i_el.className = "fontnormal";
        //this.i_el.innerHTML = this.info;
    }

    getStatusLine()
    {
        switch(this.status)
        {
            case 0: return 'Connecting...';
            case 1: return 'Connected';
            case -1: return 'Not Connected';
        }

        return 'Unknown';
    }

    getStatusClass()
    {
        switch(this.status)
        {
            case 0: return 'neutral';
            case 1: return 'positive';
            case -1: return 'negative';
        }

        return 'neutral';
    }
}

class BtList
{
    constructor(el)
    {
        this.el = el;
        this.items = new Array();
        this.selectedDevice = null;
    }

    addDevice(dev)
    {
        var n = this.items.length;

        const li = document.createElement('li');
        li.className = "bt-item";
        li.id = "bti"+n;

        const d = document.createElement('div');
        d.className = "bt-info";

        const d1 = document.createElement('div');
        d1.className = "fontbold gap-bottom";
        d1.innerHTML = dev.name;

        const d2 = document.createElement('div');
        d2.className = "fontnormal gap-bottom";
        d2.innerHTML = "Mac: "+dev.mac;

        const d3 = document.createElement('div');
        const d4 = document.createElement('div');

        d.appendChild(d1);

        d.appendChild(d4);
        d.appendChild(d2);

        d.appendChild(d3);

        const manage = document.createElement('button');
        manage.innerHTML = 'Manage';
        manage.className = 'bt-manage-btn';
        manage.addEventListener('click',()=>
        {
            window.dispatchEvent(new CustomEvent('managepressed'));
        });


        li.appendChild(d);
        li.appendChild(manage);

        this.el.appendChild(li);

        var item = new BtItem(n,li,d3,d4,dev);
        item.setStatus(0);

        this.items.push(item);       

        vscode.postMessage({ type: 'checkDeviceConnection', value: dev }); 
    }

    clearDevices()
    {
        this.items = new Array();
        this.el.innerHTML = "";
    }

    setSelected(id)
    {
        this.selectedDevice = null;

        for(var i=0;i<this.items.length;i++)
        {
            this.items[i].setSelected(false);

            if(this.items[i].id===id)
            {         
                this.items[i].setSelected(true);
                this.selectedDevice = this.items[i].item;

                vscode.postMessage({ type: 'deviceSelected', value: this.items[i].item }); 
            }
        }
    }

    setSelectedByMac(mac)
    {
        this.selectedDevice = null;

        for(var i=0;i<this.items.length;i++)
        {
            this.items[i].setSelected(false);

            if(this.items[i].item.mac===mac)
            {         
                this.items[i].setSelected(true);
                this.selectedDevice = this.items[i].item;

                vscode.postMessage({ type: 'deviceSelected', value: this.items[i].item }); 
            }
        }
    }

    setDeviceStatus(mac,status)
    {
        for(var i=0;i<this.items.length;i++)
        {
            if(this.items[i].item.mac===mac)
            {         
                this.items[i].setStatus(status);
            }
        }
    }

    setDeviceInfo(mac,info)
    {
        for(var i=0;i<this.items.length;i++)
        {
            if(this.items[i].item.mac===mac)
            {         
                this.items[i].setInfo(info);
            }
        }
    }
}

(function () {
    // @ts-ignore
    var devices = null;

    document.querySelector('.bt-scan-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonPressed', value: "" });
    });
    

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'beginDiscovery':
                {
                    devices.clearDevices();

                    document.getElementById('wait').className = 'wait visible';
                    document.getElementById('list').className = 'hidden';
                }
                break;
                case 'endDiscovery':
                    {                        
                        document.getElementById('wait').className = 'wait';
                        document.getElementById('list').className = 'visible';

                        //fill in found devices
                        try
                        {
                        for(var i=0;i<message.value.length;i++)
                            {
                                devices.addDevice(message.value[i]);
                            }

                            if(devices.items.length>=1)
                            {
                                devices.setSelected(0);      
                            }
                        }
                        catch(e)
                        {
                            document.getElementById('debug').innerHTML = e;
                        }
                    } 
                break;    
                case 'selectDevice':
                    {                        
                        try
                        {
                            devices.setSelectedByMac(message.value.mac);
                        }
                        catch(e)
                        {
                            document.getElementById('debug').innerHTML = e;
                        }
                    } 
                break;     
                case 'setDeviceStatus':
                    {
                        try
                        {
                            devices.setDeviceStatus(message.value.mac,message.value.status);
                        }
                        catch(e)
                        {
                            document.getElementById('debug').innerHTML = e;
                        }
                    }
                    break;
                    case 'setDeviceInfo':
                        {
                            try
                            {
                                devices.setDeviceInfo(message.value.mac,message.value.info);
                            }
                            catch(e)
                            {
                                document.getElementById('debug').innerHTML = e;
                            }
                        }
                        break;                    
        }
    });

    window.addEventListener('itempressed', (e)=>
    {            
        devices.setSelected(e.detail.id);
    });

    window.addEventListener('managepressed', (e)=>
    {            
        vscode.postMessage({ type: 'manageButtonPressed', value: "" });
    });

    devices = new BtList(document.getElementById("bt-list"));
}());