/* eslint-disable eqeqeq */
// @ts-nocheck
class TemplateItem
{
    constructor(id, el)
    {
        this.id = id;
        this.el = el;
        this.selected = false;

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
        if(this.selected==true) {this.el.className="item selected";} else {this.el.className="item";}
    }
}

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    var items = new Array();
    var selectedItem = null;

    function validate()
    {
        let n = document.getElementById('projectname');
        let f = document.getElementById('foldername');
        var ret = true;

        if(typeof(n.value)==='undefined' || n.value.length==0) {vscode.postMessage({ type: 'error', value: "Please provide a name for the project" }); ret = false;}
        if(typeof(f.value)==='undefined' || f.value.length==0) {vscode.postMessage({ type: 'error', value: "Please choose a destination folder for the project" }); ret = false;}

        var name = n.value;
       
        if(ret)
        {
            if (!name.replace(/\s/g, '').length) 
            {
                vscode.postMessage({ type: 'error', value: "Invalid project name"}); ret = false;
            }

            if(name.length>60)
            {
                vscode.postMessage({ type: 'error', value: "Project name must be 60 characters long or less"}); ret = false;
            }
        }   
        
        if(selectedItem==null) 
        {
            vscode.postMessage({ type: 'error', value: "Please select a project template"}); ret = false;
        }

        if(ret==true)
        {
            return {
                   name:name.replace(/[\/|\\: *?"<>]/g, "_"),
                   path:f.value,
                   item: selectedItem 
                   };
        }
        else
        {
            return null;
        }
    }

    window.onload = function()
    { 
        document.getElementById('folder_button').addEventListener('click', () => 
        {
            vscode.postMessage({ type: 'folder', value: "" });
        });

        document.getElementById('plang').addEventListener('change',() =>
        {
            vscode.postMessage({ type: 'languageChanged', value: document.getElementById('plang').value });
        });

        document.getElementById('generate_button').addEventListener('click', () => 
        {
            var val = validate();

            if(val!=null)
            {               
                vscode.postMessage({ type: 'generate', value: val });
            }
            else
            {
                vscode.postMessage({ type: 'error', value: "Unable to generate the project, please provide correct values first" });
            }
        }); 

           for(var i=1;i<7;i++)
           {
               items.push(new TemplateItem(i,document.getElementById("i"+i)));
           }
    };
 
    window.addEventListener('itempressed', (e)=>
    {        
            for(var i=1;i<7;i++)
           {
               items[i-1].setSelected(false);
               
               if(items[i-1].id==e.detail.id) 
               {
                   items[i-1].setSelected(true);
                   selectedItem = items[i-1].id;
                }
           }
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
        const message = event.data; // The json data that the extension sent
        switch (message.type) 
        {
            case 'folderSelected':
                {
                    document.getElementById('foldername').value = message.value;
                    break;
                }
            case 'languageChange':
                {
                    if(message.value=='pawn')
                    {
                        document.getElementById('i5').style.display = 'none';
                        document.getElementById('i6').style.display = 'none';
                    }
                    else
                    {
                        document.getElementById('i5').style.display = 'block';
                        document.getElementById('i6').style.display = 'block';
                    }
                }
        }
    });
}());