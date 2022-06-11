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

    //sets SDK version to currently opened project file
    public static setSDKVersion(workspace:string, version:string):boolean
    {
        try
        {
            if(/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(version))
            {
                var json = require(workspace+'/wowcubeapp-build.json');
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

    public static validateAssets(workspace:string):boolean
    {
        try
        {
            //load current project file
            var json = JSON.parse(fs.readFileSync(workspace+'/wowcubeapp-build.json', 'utf-8'));// require(workspace+'/wowcubeapp-build.json');

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

                        asset.path = 'assets/images/'+file;
                        asset.alias = file.substring(0,15);

                        this.Images.push(asset);
                    });
            }

            //fetch sounds
            if(fs.existsSync(sounddir)===true)
            {                    
                fs.readdirSync(sounddir).forEach(file => 
                    {
                        var asset:Asset = new Asset();

                        asset.path = 'assets/sounds/'+file;
                        asset.alias = file.substring(0,15);

                        this.Sounds.push(asset);
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

            //save changes
            var str = JSON.stringify(json);
            fs.writeFileSync(workspace+'/wowcubeapp-build.json',str);

            return true;
        }
        catch(e)
        {}

        return false;
    }
}