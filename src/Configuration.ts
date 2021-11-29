import * as vscode from "vscode";
import * as os from 'os';
import * as fs from 'fs';
import { deepStrictEqual } from "assert";

export class Configuration 
{
    public static getString(key:string)
    {
        var ret:string = "";
        try
        {
            ret = vscode.workspace.getConfiguration().get(key) as string;
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

    public static setCurrentDevice(device:object)
    {
        try
        {
            const d = JSON.stringify(device);
            Configuration.setString('wowsdk.conf.currentdevice',d);
        }
        catch(e){}
    }

    public static getCurrentDevice()
    {
        var obj = null;
        try
        {
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

    public static getWOWSDKPath() 
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
                    if(fs.existsSync("/Applications/WOWCube SDK.app"))
                    {
                        path = "/Applications/WOWCube SDK.app/Contents/MacOS/";
                        this.setWOWSDKPath(path);
                    }
                }
                break;
                case 'win32': //windows
                    path = "/";
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
                return 'wowcube-sdk';
            case 'win32': //windows
                return 'wowcube-sdk.bat';
            default:
            //unsupported os
            return 'wowcube-sdk';
        }
    }

    public static getLoader()
    {
        var p = os.platform();
        switch(p)
        {
            case 'darwin': //mac
            case 'linux':
                return 'wowcube-loader';
            case 'win32': //windows
                return 'wowcube-loader.exe';
            default:
            //unsupported os
            return 'wowcube-loader';
        }
    }

    public static setWOWSDKPath(value:string) {Configuration.setString('wowsdk.conf.wowsdkpath',value);}

    public static getPawnPath()
    {
        var ret:string = Configuration.getWOWSDKPath();

        if(typeof(ret)==='undefined' || ret.length===0)
        {
            return "";
        }

        ret+='bin/';
        return ret;
    }

    public static getUtilsPath()
    {
        var ret:string = Configuration.getWOWSDKPath();

        if(typeof(ret)==='undefined' || ret.length===0)
        {
            return "";
        }

        ret+='bin/';
        return ret;
    }

    public static init()
    {
        //detect SDK path 
        //for now, it's hardcoded
        var path = Configuration.getWOWSDKPath();
        if(typeof(path)==='undefined' || path.length===0)
        {
            vscode.window.showErrorMessage("WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed and up to date"); 
        }
    }
}