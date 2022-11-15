import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import {Output} from './Output';
import * as unzipper from 'unzipper';
import * as cp from 'child_process';
import * as os from 'os';

export class ArchiveManager 
{
    private static writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = ArchiveManager.writeEmitter.event;
	private static closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = ArchiveManager.closeEmitter.event;
	private static _channel: vscode.OutputChannel = Output.channel();

    private static _currentSession:any = null;

    public static isBusy():any
    {
        return this._currentSession;
    }

    public static doUnzip(zipFilename:string, outFolder:string, finishedCallback:Function, errorCallback:Function)
    {
        var p = os.platform();

        switch(p)
        {
            case 'darwin'://mac
            {
                this.doUnzipSystem(zipFilename, outFolder, finishedCallback, errorCallback);
            }
            case 'win32': //windows
            {
                this.doUnzipNode(zipFilename, outFolder, finishedCallback, errorCallback);
            }
            break;
            case 'linux':
            default:
            //unsupported os
            break;        
        }
    }

    public static doUnzipNode(zipFilename:string, outFolder:string, finishedCallback:Function, errorCallback:Function)
    {
        if(this._currentSession!==null) return;

        this._currentSession = zipFilename;
        
        fs.createReadStream(zipFilename)
        .pipe(unzipper.Extract({ path: outFolder }))
        .on('close',()=>
        {
            this._currentSession = null;
            finishedCallback();
        }) 
        .on('error',(e)=>
        {
            this._currentSession = null;
            errorCallback(e);
        });
    }

    public static doUnzipSystem(zipFilename:string, outFolder:string, finishedCallback:Function, errorCallback:Function)
    {
        if(this._currentSession!==null) return;
        
        this._currentSession = zipFilename;
        
        var command:string = 'unzip -X -K -o ';
        command+='"'+zipFilename+'" ';
        command+='-d ';
        command+='"'+outFolder+'" ';

        var child:cp.ChildProcess = cp.exec(command, { cwd: "", maxBuffer:2048*1024}, (error, stdout, stderr) => 
        {
            if (error) 
            {
                //reject({ error, stdout, stderr });
            }
            if (stderr && stderr.length > 0) 
            {
                this._channel.appendLine(stderr);
                this._channel.show(true);
            }

            if (stdout && stdout.length > 0) 
            {
                this._channel.appendLine(stdout);
                this._channel.show(true);
            }

            if(child.exitCode===0)
            {
                this._currentSession = null;
                finishedCallback();
            }
            else
            {
                this._currentSession = null;
                errorCallback(`Unable to unpack the package, process exit code is ${child.exitCode}`);
            }
        });	
    }
}