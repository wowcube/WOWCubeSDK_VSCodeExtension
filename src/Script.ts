import * as vscode from "vscode";
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export class Script
{
    private static content:string="";
    private static filename:string="";

    public static load(filename:string)
    {
        var ret:boolean = true;
        try
        {
            if(Script.filename.length==0)
            {
                Script.filename = filename;
                Script.content = fs.readFileSync(Script.filename,'utf-8');
            }
            else
            {
                 ret = false;
            }
        }
        catch(e)
        {
            ret = false;
        }
        return ret;
    }

    public static save()
    {
        var ret:boolean = true;
        try
        {
            if(Script.filename.length!=0)
            {
                fs.writeFileSync(Script.filename,Script.content);
                Script.filename = "";
            }
            else
            {
                 ret = false;
            }
        }
        catch(e)
        {
            ret = false;
        }
        return ret;
    }

    public static setValue(key:string, val:string)
    {
        var ret:boolean = true;
        try
        {
            if(Script.filename.length>0)
            {
                Script.content = Script.content.replace(key,val);
            }
        }
        catch(e)
        {
            ret = false;
        }
        return ret;
    }
}