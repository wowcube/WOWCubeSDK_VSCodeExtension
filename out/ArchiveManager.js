"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveManager = void 0;
const fs = require("fs");
const Output_1 = require("./Output");
const unzipper = require("unzipper");
class ArchiveManager {
    constructor() {
        this.onDidWrite = ArchiveManager.writeEmitter.event;
        this.onDidClose = ArchiveManager.closeEmitter.event;
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
    static isBusy() {
        return this._currentSession;
    }
    static doUnzip(zipFilename, outFolder) {
        fs.createReadStream(zipFilename)
            .pipe(unzipper.Extract({ path: outFolder }))
            .on('close', () => {
            var t;
            t = 0;
        })
            .on('finish', () => {
            var t;
            t = 0;
        })
            .on('error', () => {
            var t;
            t = 0;
        });
    }
}
exports.ArchiveManager = ArchiveManager;
ArchiveManager.writeEmitter = Output_1.Output.terminal();
ArchiveManager.closeEmitter = Output_1.Output.terminalClose();
ArchiveManager._channel = Output_1.Output.channel();
ArchiveManager._currentSession = null;
//# sourceMappingURL=ArchiveManager.js.map