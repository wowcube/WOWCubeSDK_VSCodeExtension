"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WOWCubeBuildTaskProvider = void 0;
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const vscode = require("vscode");
class WOWCubeBuildTaskProvider {
    constructor(workspaceRoot) {
        this.rakePromise = undefined;
        const pattern = path.join(workspaceRoot, 'Rakefile');
        const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        fileWatcher.onDidChange(() => this.rakePromise = undefined);
        fileWatcher.onDidCreate(() => this.rakePromise = undefined);
        fileWatcher.onDidDelete(() => this.rakePromise = undefined);
    }
    provideTasks() {
        if (!this.rakePromise) {
            this.rakePromise = getRakeTasks();
        }
        return this.rakePromise;
    }
    resolveTask(_task) {
        const task = _task.definition.task;
        // A Rake task consists of a task and an optional file as specified in RakeTaskDefinition
        // Make sure that this looks like a Rake task by checking that there is a task.
        if (task) {
            // resolveTask requires that the same definition object be used.
            const definition = _task.definition;
            return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, 'rake', new vscode.ShellExecution(`rake ${definition.task}`));
        }
        return undefined;
    }
}
exports.WOWCubeBuildTaskProvider = WOWCubeBuildTaskProvider;
WOWCubeBuildTaskProvider.RakeType = 'rake';
function exists(file) {
    return new Promise((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        });
    });
}
function exec(command, options) {
    return new Promise((resolve, reject) => {
        cp.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}
let _channel;
function getOutputChannel() {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('Rake Auto Detection');
    }
    return _channel;
}
const buildNames = ['build', 'compile', 'watch'];
function isBuildTask(name) {
    for (const buildName of buildNames) {
        if (name.indexOf(buildName) !== -1) {
            return true;
        }
    }
    return false;
}
const testNames = ['test'];
function isTestTask(name) {
    for (const testName of testNames) {
        if (name.indexOf(testName) !== -1) {
            return true;
        }
    }
    return false;
}
async function getRakeTasks() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const result = [];
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return result;
    }
    for (const workspaceFolder of workspaceFolders) {
        const folderString = workspaceFolder.uri.fsPath;
        if (!folderString) {
            continue;
        }
        const rakeFile = path.join(folderString, 'Rakefile');
        if (!await exists(rakeFile)) {
            continue;
        }
        const commandLine = 'rake -AT -f Rakefile';
        try {
            const { stdout, stderr } = await exec(commandLine, { cwd: folderString });
            if (stderr && stderr.length > 0) {
                getOutputChannel().appendLine(stderr);
                getOutputChannel().show(true);
            }
            if (stdout) {
                const lines = stdout.split(/\r{0,1}\n/);
                for (const line of lines) {
                    if (line.length === 0) {
                        continue;
                    }
                    const regExp = /rake\s(.*)#/;
                    const matches = regExp.exec(line);
                    if (matches && matches.length === 2) {
                        const taskName = matches[1].trim();
                        const kind = {
                            type: 'rake',
                            task: taskName
                        };
                        const task = new vscode.Task(kind, workspaceFolder, taskName, 'rake', new vscode.ShellExecution(`rake ${taskName}`));
                        result.push(task);
                        const lowerCaseLine = line.toLowerCase();
                        if (isBuildTask(lowerCaseLine)) {
                            task.group = vscode.TaskGroup.Build;
                        }
                        else if (isTestTask(lowerCaseLine)) {
                            task.group = vscode.TaskGroup.Test;
                        }
                    }
                }
            }
        }
        catch (err) {
            const channel = getOutputChannel();
            if (err.stderr) {
                channel.appendLine(err.stderr);
            }
            if (err.stdout) {
                channel.appendLine(err.stdout);
            }
            channel.appendLine('Auto detecting rake tasks failed.');
            channel.show(true);
        }
    }
    return result;
}
//# sourceMappingURL=RakeTaskProvider.js.map