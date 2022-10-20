import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import { Asset } from "./Asset";

export class Project 
{
    public static Images: Array<Asset> = new Array<Asset>();
    public static Sounds: Array<Asset> = new Array<Asset>();
    public static Json:any;

    public static CurrentLanguage:string = 'pawn';

    public static Options:any = null;

    //sets SDK version to currently opened project file
    public static setSDKVersion(workspace:string, version:string):boolean
    {
        try
        {
            if(/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(version))
            {
                var json = JSON.parse(fs.readFileSync(workspace+'/wowcubeapp-build.json', 'utf-8'));
                json.sdkVersion = version;

                var str = JSON.stringify(json);
                fs.writeFileSync(workspace+'/wowcubeapp-build.json',str);

                return true;
            }
        }
        catch(e)
        {}

        return false;
    }

    public static validateAssets(workspace:string,autosave:boolean):boolean
    {
        try
        {
            //load current project file
            var json = JSON.parse(fs.readFileSync(workspace+'/wowcubeapp-build.json', 'utf-8'));

            //check icon 
            if(typeof json.appIcon!=='undefined' && typeof json.appIcon.path==='undefined')
            {
                //old project format? 

                var v = json.appIcon;
                json.appIcon = {path:v, encoding:'ARGB6666'};
            }

            //check app flags
            if(typeof json.appFlags==='undefined')
            {
                json.appFlags = '0';
            }
            
            //check language
            if(typeof json.language==='undefined')
            {
                Project.CurrentLanguage = "pawn";
            }
            else
            {
                Project.CurrentLanguage = json.language;
            }
            
            //fetch images
            var imagedir = workspace+'/assets/images';
            var sounddir = workspace+'/assets/sounds';

            this.Images = new Array<Asset>();
            this.Sounds = new Array<Asset>();

            if(fs.existsSync(imagedir)===true)
            {                    
                fs.readdirSync(imagedir).forEach(file => 
                    {
                        var asset:Asset = new Asset();

                        if(file!=='.DS_Store')
                        {
                            asset.path = 'assets/images/'+file;
                            asset.alias = file.substring(0,15);

                            this.Images.push(asset);
                        }
                    });
            }

            //fetch sounds
            if(fs.existsSync(sounddir)===true)
            {                    
                fs.readdirSync(sounddir).forEach(file => 
                    {
                        var asset:Asset = new Asset();

                        if(file!=='.DS_Store')
                        {
                            asset.path = 'assets/sounds/'+file;
                            asset.alias = file.substring(0,15);

                            this.Sounds.push(asset);
                        }
                    });
            }

            //now see what's in the json and fix any missing files
            var found:boolean = false;
            try
            {
                var imageAssets = json.imageAssets;
                if(typeof imageAssets !== 'undefined')
                {
                    found = true;
                }
            }
            catch(e){}

            if(!found)
            {
                json.imageAssets = new Array();
            }

            var missingAssets:Array<Asset> = new Array<Asset>();

            for(var j=0;j<this.Images.length;j++)
            {
                var b:Asset = this.Images[j];
                var found:boolean = false;

                for(var i=0;i<json.imageAssets.length;i++)
                {
                    var a:Asset = json.imageAssets[i];

                    if(a.path===b.path)
                    {
                        found = true;
                        if(typeof a.alias === 'undefined')
                        {
                            json.imageAssets[i].alias = b.alias;
                        }

                        break;
                    }
                }

                if(!found)
                {
                    missingAssets.push(b);
                }
            }

            if(missingAssets.length>0)
            {
                missingAssets.forEach(asset => {
                    json.imageAssets.push({path:asset.path,alias:asset.alias});
                });
            }

            for(var i=0;i<json.imageAssets.length;i++)
            {
                var found:boolean = false;

                for(var j=0;j<this.Images.length;j++)
                {
                    if(json.imageAssets[i].path === this.Images[j].path)
                    {
                        found = true;
                        break;
                    }
                }

                if(found===false)
                {
                    json.imageAssets.splice(i, 1);
                    i--;
                }
            }


            found = false;
            try
            {
                var soundAssets = json.soundAssets;
                if(typeof soundAssets !== 'undefined')
                {
                    found = true;
                }
            }
            catch(e){}

            if(!found)
            {
                json.soundAssets = new Array();
            }

            missingAssets = new Array<Asset>();

            for(var j=0;j<this.Sounds.length;j++)
            {
                var b:Asset = this.Sounds[j];
                var found:boolean = false;

                for(var i=0;i<json.soundAssets.length;i++)
                {
                    var a:Asset = json.soundAssets[i];

                    if(a.path===b.path)
                    {
                        found = true;

                        if(typeof a.alias === 'undefined')
                        {
                            json.imageAssets[i].alias = b.alias;
                        }

                        break;
                    }
                }

                if(!found)
                {
                    missingAssets.push(b);
                }
            }

            if(missingAssets.length>0)
            {
                missingAssets.forEach(asset => {
                    json.soundAssets.push({path:asset.path,alias:asset.alias});
                });
            }

            for(var i=0;i<json.soundAssets.length;i++)
            {
                var found:boolean = false;

                for(var j=0;j<this.Sounds.length;j++)
                {
                    if(json.soundAssets[i].path === this.Sounds[j].path)
                    {
                        found = true;
                        break;
                    }
                }

                if(found===false)
                {
                    json.soundAssets.splice(i, 1);
                    i--;
                }
            }

            var v:any = json.appFlags;
            if(typeof(v) === 'string' || v instanceof String)
            {
                //New format of project file requres appFlags to be an integer.
                json.appFlags = parseInt(json.appFlags);
            }

            //check language-related settings
            if(typeof(json.language) === 'undefined')
            {
                json.language = 'pawn';
            }

            if(typeof(json.interpreter) === 'undefined')
            {
                json.interpreter = 'pawn';
            }

            //check options
            /*
            "projectOptions": {
                "cpp": {
                "defines": "",
                "flags": "-std=c++11 -g0 -O3",
                "includeFolders": []
                }
            }
            */
            if(json.interpreter === 'wasm' && json.language === 'cpp')
            {
                if(typeof(json.projectOptions) === 'undefined')
                {
                    json.projectOptions = new Object(); 
                }

                if(typeof(json.projectOptions.cpp) === 'undefined')
                {
                    json.projectOptions.cpp = new Object();
                    json.projectOptions.cpp.defines = "";
                    json.projectOptions.cpp.flags = "-std=c++11 -g0 -O3";
                    json.projectOptions.cpp.includeFolders = new Array();
                }
            }

            Project.Options = json.projectOptions;

            //save changes
            var str = JSON.stringify(json,null,2);
            if(autosave===true)
            {
                fs.writeFileSync(workspace+'/wowcubeapp-build.json',str);
            }
            Project.Json = json;
            
            return true;
        }
        catch(e)
        {}

        return false;
    }
}