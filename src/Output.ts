import * as vscode from "vscode";

export class Output 
{
    private static _channel: vscode.OutputChannel = vscode.window.createOutputChannel('WOWCube SDK');
    private static _writeEmitter = new vscode.EventEmitter<string>();
    private static _closeEmitter = new vscode.EventEmitter<number>();

    public static channel()
    {
        return Output._channel;
    }

    public static terminal()
    {
        return Output._writeEmitter;
    }

    public static terminalClose()
    {
        return Output._closeEmitter;
    }
}