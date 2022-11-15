"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveManager = void 0;
const fs = require("fs");
const Output_1 = require("./Output");
const unzipper = require("unzipper");
const cp = require("child_process");
const os = require("os");
class ArchiveManager {
    constructor() {
        this.onDidWrite = ArchiveManager.writeEmitter.event;
        this.onDidClose = ArchiveManager.closeEmitter.event;
    }
    static isBusy() {
        return this._currentSession;
    }
    static doUnzip(zipFilename, outFolder, finishedCallback, errorCallback) {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
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
    static doUnzipNode(zipFilename, outFolder, finishedCallback, errorCallback) {
        if (this._currentSession !== null)
            return;
        this._currentSession = zipFilename;
        fs.createReadStream(zipFilename)
            .pipe(unzipper.Extract({ path: outFolder }))
            .on('close', () => {
            this._currentSession = null;
            finishedCallback();
        })
            .on('error', (e) => {
            this._currentSession = null;
            errorCallback(e);
        });
    }
    static doUnzipSystem(zipFilename, outFolder, finishedCallback, errorCallback) {
        if (this._currentSession !== null)
            return;
        this._currentSession = zipFilename;
        var command = 'unzip -X -K -o ';
        command += '"' + zipFilename + '" ';
        command += '-d ';
        command += '"' + outFolder + '" ';
        var child = cp.exec(command, { cwd: "", maxBuffer: 2048 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                //reject({ error, stdout, stderr });
            }
            if (stderr && stderr.length > 0) {
                this._channel.appendLine(stderr);
                this._channel.show(true);
            }
            if (stdout && stdout.length > 0) {
                this._channel.appendLine(stdout);
                this._channel.show(true);
            }
            if (child.exitCode === 0) {
                this._currentSession = null;
                finishedCallback();
            }
            else {
                this._currentSession = null;
                errorCallback(`Unable to unpack the package, process exit code is ${child.exitCode}`);
            }
        });
    }
}
exports.ArchiveManager = ArchiveManager;
ArchiveManager.writeEmitter = Output_1.Output.terminal();
ArchiveManager.closeEmitter = Output_1.Output.terminalClose();
ArchiveManager._channel = Output_1.Output.channel();
ArchiveManager._currentSession = null;
//# sourceMappingURL=ArchiveManager.js.map