import * as vscode from "vscode";
import * as os from 'os';
import * as fs from 'fs';
import { deepStrictEqual } from "assert";
import { Z_FIXED } from "zlib";

export class Configuration 
{
    private static _currentDevice:any = null;
    private static _lastSetSDKPath:any = null;
    private static _lastSetSDKVersion:any = null;

    private static _busyDevices:Map<string,boolean> = new Map<string,boolean>();
    private static _detectedSDKVersions:Array<string> = new Array<string>();

    public static context:any;
    
    public static getString(key:string)
    {
        var ret:string = "";
        try
        {
            const conf = vscode.workspace.getConfiguration();
            ret = conf.get(key) as string;

            //ret = vscode.workspace.getConfiguration().get(key) as string;
        }
        catch(e)
        {
            ret = "";
        }

        return ret;
    }

    public static setString(key:string, value:string)
    {
        try
        {
            vscode.workspace.getConfiguration().update(key, value,vscode.ConfigurationTarget.Global);
        }
        catch(e)
        {
            var t;
            t=0;
        }
    }

    public static setDeviceBusy(mac:string, busy:boolean)
    {
        Configuration._busyDevices.set(mac,busy);
    }

    public static isDeviceBusy(mac:string):boolean
    {
        var b = Configuration._busyDevices.get(mac);
        if(typeof(b)=== 'undefined') { return false;}

        return b;
    }

    public static isAnyDeviceBusy():boolean
    {
        Configuration._busyDevices.forEach((value: boolean, key: string, map: Map<string, boolean>) =>
        {
            if(value===true) {return true;}
        });

        return false;
    }
    public static setCurrentDevice(device:object)
    {
        try
        {
            const d = JSON.stringify(device);
            Configuration._currentDevice = device;
            Configuration.setString('wowsdk.conf.currentdevice',d);
        }
        catch(e){}
    }

    public static getCurrentDevice()
    {
        var obj = null;
        try
        {
            if(Configuration._currentDevice!==null) {return Configuration._currentDevice;}

            const d = Configuration.getString('wowsdk.conf.currentdevice');   
            obj = JSON.parse(d);
            
            if(typeof(obj.name)==='undefined' || typeof(obj.mac) === 'undefined') {obj = null;}
        }
        catch(e)
        {
            obj = null;
        }

        return obj;
    }

    public static setLastDetectedDevices(devices:Array<object>)
    {
        try
        {
            const d = JSON.stringify(devices);
            Configuration.setString('wowsdk.conf.detecteddevices',d);
        }
        catch(e){}
    }

    public static getLastDetectedDevices()
    {
        var devices:Array<object> = new Array();

            var d = Configuration.getString('wowsdk.conf.detecteddevices');
            
            try
            {
              devices = JSON.parse(d);
            }
            catch(e){}

        return devices;
    }

    public static getLastPath() { return Configuration.getString('wowsdk.conf.wizard');}
    public static setLastPath(value:string) {Configuration.setString('wowsdk.conf.wizard',value);}


    public static getWDKPrivate()
    {
        var p = os.platform();
        var homedir = os.homedir();
        var json = null;

        switch(p)
        {
            case 'darwin'://mac
            {
                homedir+="/Library/WOWCube Development Kit/WDK_private";

                try
                {
                    json = JSON.parse(fs.readFileSync(homedir, 'utf-8'));
                }
                catch(e)
                {}
            }
            break;
            case 'win32': //windows
            {
                homedir+="/AppData/Local/WOWCube Development Kit/WDK_private";

                try
                {
                    json = JSON.parse(fs.readFileSync(homedir, 'utf-8'));
                }
                catch(e)
                {}
            }
            break;
            case 'linux':
            default:
            //unsupported os
            break;        
        }

        return json;
    }

    public static getWDKGlobals()
    {
        var json = null;
        try
        {
            var path = Configuration.getWOWSDKPath()+'sdk/globals';
            json = JSON.parse(fs.readFileSync(path, 'utf-8'));

            var pr = this.getWDKPrivate();

            if(pr!==null)
            {
                if(typeof pr.updateEndpoint!=='undefined')
                {
                    json.updateEndpoint = pr.updateEndpoint;
                }
            }
        }
        catch(e){}

        return json;
    }

    public static getWOWSDKContainingFolder()
    {
        var p = os.platform();
        var path = Configuration.getWOWSDKPath();
        var folder = "/";

        switch(p)
        {
            case 'darwin'://mac
            {
                const fname = "/WOWCube Development Kit.app";
                var pos = path.indexOf(fname);

                folder = path.substring(0,pos);
            }
            break;
            case 'win32': //windows
            break;
            case 'linux':
            default:
            //unsupported os
            break;        
        }

        return folder;
    }

    public static async getWOWSDKPathAsync():Promise<string>
    {
         var path:string = Configuration.getString('wowsdk.conf.wowsdkpath');
         var p = os.platform();

         if(typeof(path)==='undefined' || path.length===0)
         {
            //try to find the SDK
            switch(p)
            {
                case 'darwin': //mac
                {
                    if(fs.existsSync("/Applications/WOWCube Development Kit.app"))
                    {
                        path = "/Applications/WOWCube Development Kit.app/Contents/";
                        this.setWOWSDKPath(path);
                    }
                }
                break;
                case 'win32': //windows
                {
                    var regedit = require('regedit');
                    var done:boolean = false;

                    path = "/";

                    regedit.list('HKCU\\SOFTWARE\\WOWCube Development Kit', (err:any, result:any) =>
                    {
                        if(err===null)
                        {
                            var key = result['HKCU\\SOFTWARE\\WOWCube Development Kit'];
                            if(key.exists)
                            {
                              //the value doesn't have a name, hence '' 
                                var p:string = key.values[''].value;
                                path = p.replace(/\\/g,'/')+'/';                                
                            }
                        }

                        this.setWOWSDKPath(path);
                        done = true;
                    });
                    
                    while(!done)
                    {
                        await Configuration.sleep(100);
                    }                    
                }
                break;
                case 'linux':
                    path = "/";
                break;
                default:
                //unsupported os
                path = "";
                break; 
            }
         }

         return path;
    }

    public static getWOWSDKPath():string
    {
        var path:string = "";

         if(Configuration._lastSetSDKPath!==null)
         {
             path = Configuration._lastSetSDKPath;
         }
         else
         {
            path = Configuration.getString('wowsdk.conf.wowsdkpath');
         }
         
         var p = os.platform();

         if(typeof(path)==='undefined' || path.length===0)
         {
            //try to find the SDK
            switch(p)
            {
                case 'darwin': //mac
                {
                    if(fs.existsSync("/Applications/WOWCube Development Kit.app"))
                    {
                        path = "/Applications/WOWCube Development Kit.app/Contents/";
                        this.setWOWSDKPath(path);
                    }
                }
                break;
                case 'win32': //windows
                {
                    path = "/";                 
                }
                break;
                case 'linux':
                    path = "/";
                break;
                default:
                //unsupported os
                path = "";
                break; 
            }
         }

         return path;
    }

    public static getVersions():Array<string>
    {
        return Configuration._detectedSDKVersions;
    }

    public static reloadVersions()
    {
        Configuration.loadVersionFolders(Configuration.getWOWSDKPath());
    }

    private static loadVersionFolders(path:string)
    {
            //clear versions, if any
            while(Configuration._detectedSDKVersions.length > 0) 
            {
                Configuration._detectedSDKVersions.pop();
            }

            //enumerate available sdk versions, if any
            if(fs.existsSync(path)===false || fs.existsSync(path+'/sdk')===false) 
            {
                Configuration._detectedSDKVersions.push('1.0.0');
                return; 
            }


            var dirs:string[] =  fs.readdirSync(path+'/sdk').filter(function (file) 
            {
                return fs.statSync(path+'/sdk/'+file).isDirectory();
            });

            for(var i=0;i<dirs.length;i++)
            {
                //version format is NN.NNNN-NNNN
                if(/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(dirs[i]))
                {
                    // Successful match
                    Configuration._detectedSDKVersions.push(dirs[i]);
                } 
            }           
    }
    
    public static getCurrentVersion()
    {
        var v:string;   

        if(Configuration._lastSetSDKVersion!==null)
        {
            v = Configuration._lastSetSDKVersion;
        }
        else
        {
           v = Configuration.getString('wowsdk.conf.wowsdkversion');
        }


        let versionFound:Boolean = false;

		for(var i=0;i<Configuration._detectedSDKVersions.length;i++)
		{
			if(versionFound===false)
			{
				if(v === Configuration._detectedSDKVersions[i])
				{
					versionFound = true;
				}
			}
		}

		if(versionFound===false)
		{
			//if current saved version is not in the list of versions present in the bundle, reset to the first version in the list
			if(Configuration._detectedSDKVersions.length>0) v = Configuration._detectedSDKVersions[0];
			Configuration.setCurrentVersion(v);
		}

        return v;
    }

    public static setCurrentVersion(v:string)
    {
        try
        {
            Configuration.setString('wowsdk.conf.wowsdkversion',v);
            Configuration._lastSetSDKVersion = v;
        }
        catch(e){}
    }

    public static getPawnCC()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            case 'linux':
                return 'pawncc';
            case 'win32': //windows
                return 'pawncc.exe';
            default:
            //unsupported os
            return 'pawncc';
        }
    }

    public static getBuilder()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            case 'linux':
                return 'wowcube-build';
            case 'win32': //windows
                return 'wowcube-build.exe';
            default:
            //unsupported os
            return 'wowcube-build';
        }
    }

    public static getEmulator()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            case 'linux':
                return 'WOWCube Emulator';
            case 'win32': //windows
                return 'WOWCube Emulator.exe';
            default:
            //unsupported os
            return 'WOWCube Emulator';
        }
    }

    public static getLoader()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
                return 'wowcube-loader.app/Contents/MacOS/wowcube-loader';
            case 'linux':
                return 'wowcube-loader';
            case 'win32': //windows
                return 'wowcube-loader.exe';
            default:
            //unsupported os
            return 'wowcube-loader';
        }
    }

    public static getUpdater()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
                return {cli:'wow-updater.app/Contents/MacOS/wow-updater',ui:'wow-updater.app/Contents/MacOS/wow-updater'};
            case 'linux':
                return {cli:'wow-updater',ui:'wow-updater'};
            case 'win32': //windows
                return {cli:'wow-update_cli.exe',ui:'wow-update.exe'};
            default:
            //unsupported os
            return {cli:'wow-updater',ui:'wow-updater'};
        }
    }

    public static setWOWSDKPath(value:string) 
    {
        Configuration.setString('wowsdk.conf.wowsdkpath',value);
        Configuration._lastSetSDKPath = value;
    }

    public static getPawnPath()
    {
        var ret:string =  Configuration.getWOWSDKPath();

        if(typeof(ret)==='undefined' || ret.length===0)
        {
            return "";
        }

        //ret+='bin/pawn/';
        ret+='sdk/'+Configuration.getCurrentVersion()+'/pawn/bin/';
        return ret;
    }

    public static getUtilsPath()
    {
        var ret:string = Configuration.getWOWSDKPath();

        if(typeof(ret)==='undefined' || ret.length===0)
        {
            return "";
        }

        ret+='sdk/tools/';
        return ret;
    }

    public static getEmulPath()
    {
        var ret:string = Configuration.getWOWSDKPath();

        if(typeof(ret)==='undefined' || ret.length===0)
        {
            return "";
        }

        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            {
                ret+='MacOS/';
            }
            break;
            case 'linux':
                ret+="bin/";
            break;
            case 'win32': //windows
                ret+='bin/';
            break;
            default:
            break;
        }
        return ret;
    }

    public static getSlash()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            case 'linux':
            {
                return '/';
            }
            break;
            case 'win32': //windows
                return '\\';
            break;
            default:
            break;
        }
        return '';
    }

    public static isLinux()
    {
        var p = os.platform();

        switch(p)
        {
            case 'linux':
            {
                return true;
            }
            break;
            case 'darwin': //mac
            case 'win32': //windows
                return false;
            break;
        }
        return true;
    }

    public static isWindows()
    {
        var p = os.platform();

        switch(p)
        {
            case 'win32':
            {
                return true;
            }
            break;
            case 'linux': //mac
            case 'win32': //windows
                return false;
            break;
        }
        return false;
    }

    public static async init()
    {
        //detect SDK path 

        var path:string = await Configuration.getWOWSDKPathAsync();
        if(typeof(path)==='undefined' || path.length===0)
        {
            vscode.window.showErrorMessage("WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed and up to date"); 
        }
        else
        {
            Configuration.loadVersionFolders(path);
        }
    }

    static async sleep(timer:number) 
    {
        return new Promise<void>(resolve => 
            {
            timer = timer || 2000;
            setTimeout(function () 
            {
                resolve();
            }, timer);
        });
    };
}