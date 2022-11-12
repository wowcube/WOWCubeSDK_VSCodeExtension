import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import {Output} from './Output';
import * as unzipper from 'unzipper';

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
}