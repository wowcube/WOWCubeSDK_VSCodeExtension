import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';

export class Project 
{
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
}