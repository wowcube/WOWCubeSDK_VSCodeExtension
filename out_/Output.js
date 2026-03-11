"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Output = void 0;
const vscode = require("vscode");
class Output {
    static channel() {
        return Output._channel;
    }
    static terminal() {
        return Output._writeEmitter;
    }
    static terminalClose() {
        return Output._closeEmitter;
    }
}
exports.Output = Output;
Output._channel = vscode.window.createOutputChannel('WOWCube SDK');
Output._writeEmitter = new vscode.EventEmitter();
Output._closeEmitter = new vscode.EventEmitter();
//# sourceMappingURL=Output.js.map