"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomBuildTaskProvider = void 0;
const path = require("path");
const vscode = require("vscode");
const cp = require("child_process");
class CustomBuildTaskProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    async provideTasks() {
        return this.getTasks();
    }
    resolveTask(_task) {
        const flavor = _task.definition.flavor;
        if (flavor) {
            const definition = _task.definition;
            return this.getTask(definition.flavor, definition.flags ? definition.flags : [], definition);
        }
        return undefined;
    }
    getTasks() {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        // In our fictional build, we have two build flavors
        const flavors = ['32', '64'];
        // Each flavor can have some options.
        const flags = [['watch', 'incremental'], ['incremental'], []];
        this.tasks = [];
        flavors.forEach(flavor => {
            flags.forEach(flagGroup => {
                this.tasks.push(this.getTask(flavor, flagGroup));
            });
        });
        return this.tasks;
    }
    getTask(flavor, flags, definition) {
        if (definition === undefined) {
            definition =
                {
                    type: CustomBuildTaskProvider.CustomBuildScriptType,
                    flavor,
                    flags
                };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, `${flavor} ${flags.join(' ')}`, CustomBuildTaskProvider.CustomBuildScriptType, new vscode.CustomExecution(async () => {
            // When the task is executed, this callback will run. Here, we setup for running the task.
            return new CustomBuildTaskTerminal(this.workspaceRoot, flavor, flags, () => this.sharedState, (state) => this.sharedState = state);
        }));
    }
}
exports.CustomBuildTaskProvider = CustomBuildTaskProvider;
CustomBuildTaskProvider.CustomBuildScriptType = 'custombuildscript';
class CustomBuildTaskTerminal {
    constructor(workspaceRoot, flavor, flags, getSharedState, setSharedState) {
        this.workspaceRoot = workspaceRoot;
        this.flavor = flavor;
        this.flags = flags;
        this.getSharedState = getSharedState;
        this.setSharedState = setSharedState;
        this.writeEmitter = new vscode.EventEmitter();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = new vscode.EventEmitter();
        this.onDidClose = this.closeEmitter.event;
        this.process = null;
        this._channel = vscode.window.createOutputChannel('WOWCube SDK');
    }
    getOutputChannel() {
        return this._channel;
    }
    open(initialDimensions) {
        // At this point we can start using the terminal.
        if (this.flags.indexOf('watch') > -1) {
            const pattern = path.join(this.workspaceRoot, 'customBuildFile');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            this.fileWatcher.onDidChange(() => this.doBuild());
            this.fileWatcher.onDidCreate(() => this.doBuild());
            this.fileWatcher.onDidDelete(() => this.doBuild());
        }
        this.doBuild();
        this.doBuild2();
    }
    close() {
        // The terminal has been closed. Shutdown the build.
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
    printOutput(data) {
        this.getOutputChannel().appendLine(data);
        this.getOutputChannel().show(true);
    }
    async doBuild() {
        return new Promise((resolve, reject) => {
            this.writeEmitter.fire('Starting build...\r\n');
            this._channel.appendLine('Starting build...\r\n');
            const command = "'/Users/apple 1/WOWSDK/bin/pawn/macos/pawncc'";
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                if (error) {
                    //reject({ error, stdout, stderr });
                }
                if (stderr && stderr.length > 0) {
                    this.getOutputChannel().appendLine(stderr);
                    this.getOutputChannel().show(true);
                }
                if (stdout && stdout.length > 0) {
                    this.getOutputChannel().appendLine(stdout);
                    this.getOutputChannel().show(true);
                }
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                //this.writeEmitter.fire('Build complete.\r\n\r\n');
                this.getOutputChannel().appendLine('Build complete.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                this.getOutputChannel().appendLine('Exit code: ' + child.exitCode + '\r\n\r\n');
            });
        });
    }
    async doBuild2() {
        return new Promise((resolve, reject) => {
            this.writeEmitter.fire('Starting link...\r\n');
            this._channel.appendLine('Starting link...\r\n');
            const command = "'/Users/apple 1/WOWSDK/bin/pawn/macos/pawncc'";
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                if (error) {
                    //reject({ error, stdout, stderr });
                }
                if (stderr && stderr.length > 0) {
                    this.getOutputChannel().appendLine(stderr);
                    this.getOutputChannel().show(true);
                }
                if (stdout && stdout.length > 0) {
                    this.getOutputChannel().appendLine(stdout);
                    this.getOutputChannel().show(true);
                }
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                //this.writeEmitter.fire('Build complete.\r\n\r\n');
                this.getOutputChannel().appendLine('Link complete.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                this.getOutputChannel().appendLine('Exit code: ' + child.exitCode + '\r\n\r\n');
            });
        });
    }
    async exec(command, options) {
        return new Promise((resolve, reject) => {
            cp.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stdout, stderr });
                }
                resolve({ stdout, stderr });
            });
        });
    }
}
//# sourceMappingURL=CustomBuildTaskProvider.js.map