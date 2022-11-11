import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";
import {Configuration} from './Configuration';
import {Output} from './Output';

export class DownloadManager 
{
    private static writeEmitter = Output.terminal();
	onDidWrite: vscode.Event<string> = DownloadManager.writeEmitter.event;
	private static closeEmitter = Output.terminalClose();
	onDidClose?: vscode.Event<number> = DownloadManager.closeEmitter.event;
	private static _channel: vscode.OutputChannel = Output.channel();

    private static _currentSession:any = null;

    public static isDownloading():any
    {
        return this._currentSession;
    }

    public static getFileLength(url:string)
    {
        const http = require('https');

        return new Promise((resolve, reject) => 
        {
            this._currentSession = {url:url,progress:0};

            http.request(url, { method: 'HEAD', headers: { 'user-agent': 'VSCode' } }, (res:any) => 
            {
                if(res.statusCode == 200)
                {
                    var contentLength = res.headers['content-length']; 
                    if(contentLength>0)
                    {
                        this._channel.appendLine(`Download manager: requested file length: ${contentLength}`);
                        this._channel.show(true);

                        resolve({length:contentLength,url:url});
                    }
                    else
                    {
                        this._channel.appendLine(`Download manager: Unable to download, requested file length is 0`);
                        this._channel.show(true);

                        this._currentSession = null;
                        reject(`Unable to download, requested file length is 0`);
                    }
                }
                else
                {
                    this._channel.appendLine(`Download manager: Unable to download, server response is ${res.statusCode}`);
                    this._channel.show(true);

                    this._currentSession = null;
                    reject(`Unable to download, server response is ${res.statusCode}`);
                }
            }).on('error', (err:any) => 
            {
                this._channel.appendLine(`Download manager: Unable to download, ${err}`);
                this._channel.show(true);

                this._currentSession = null;
                reject(`Unable to download, ${err}`);
            }).end();   
        });
    }       
 
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
}