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

    public static doUnzip(zipFilename:string, outFolder:string)
    {
        fs.createReadStream(zipFilename)
        .pipe(unzipper.Extract({ path: outFolder }))
        .on('close',()=>
        {
            var t; 
            t=0;
        })
        .on('finish',()=>
        {
            var t; 
            t=0;
        })   
        .on('error',()=>
        {
            var t; 
            t=0;
        });
    }
    /*
    public static doDownload(url:string, destFilename:string, fileLength:any, progressCallback:Function)
    {
        var http = require('https');
        var progress = require('progress-stream');
        
        return new Promise((resolve, reject) => 
        {
            const file = fs.createWriteStream(destFilename, { flags: "w" });
    
            var str = progress({
                time: 100,
                length:fileLength
            });
             
            str.on('progress', function(progress:any) 
            {
                console.log(Math.round(progress.percentage)+'%');
                console.log(progress.transferred);

                try
                {
                    if( DownloadManager._currentSession !== null)
                    {
                        DownloadManager._currentSession.progress = Math.round(progress.percentage);
                        progressCallback(DownloadManager._currentSession.progress, progress);
                    }
                }
                catch(e){}
            });

            //delete file if exists
            try
            {
                if(fs.existsSync(destFilename))
                {
                    fs.unlink(destFilename, () => {}); // Delete temp file
                }
            }
            catch(e)
            {
                this._channel.appendLine(`Download manager: Unable to delete file '${destFilename}', skipping download!`);
                this._channel.show(true);

                this._currentSession = null;
                reject("Unable to delete file '"+destFilename+"', skipping download!");
            }

            const request = http.get(url, { headers: { 'user-agent': 'VSCode' }}, (response:any) => 
            {
                if (response.statusCode === 200) 
                {
                    this._currentSession = {url:url,progress:0};
                    response.pipe(str).pipe(file);
                }
                 else 
                 {
                    file.close();
                    fs.unlink(destFilename, () => {}); // Delete temp file

                    this._currentSession = null;

                    this._channel.appendLine(`Download manager: Unable to download, server response is ${response.statusCode}: ${response.statusMessage}`);
                    this._channel.show(true)

                    reject(`Unable to download, server responded with ${response.statusCode}: ${response.statusMessage}`);
                }
            });
    
            request.on("error", (err:any) => 
            {
                file.close();
                fs.unlink(destFilename, () => {}); // Delete temp file

                this._currentSession = null;

                this._channel.appendLine(`Download manager: Unable to download, ${err.message}`);
                this._channel.show(true)

                reject(err.message);
            });
    
            file.on("finish", () => 
            {
                this._currentSession = null;
                resolve(destFilename);
            });
    
            file.on("error", err => 
            {
                file.close();
                fs.unlink(destFilename, () => {}); // Delete temp file
                
                this._currentSession = null;

                this._channel.appendLine(`Download manager: Unable to download, ${err.message}`);
                this._channel.show(true)

                reject(err.message);
            });
        });
        
    }
    */
}