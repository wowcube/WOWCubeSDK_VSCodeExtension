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
    }
    static isBusy() {
        return this._currentSession;
    }
    static doUnzip(zipFilename, outFolder, finishedCallback, errorCallback) {
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
}
exports.ArchiveManager = ArchiveManager;
ArchiveManager.writeEmitter = Output_1.Output.terminal();
ArchiveManager.closeEmitter = Output_1.Output.terminalClose();
ArchiveManager._channel = Output_1.Output.channel();
ArchiveManager._currentSession = null;
//# sourceMappingURL=ArchiveManager.js.map