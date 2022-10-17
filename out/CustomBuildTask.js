"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomBuildTaskProvider = void 0;
const path = require("path");
const vscode = require("vscode");
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
    }
    close() {
        // The terminal has been closed. Shutdown the build.
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
    async doBuild() {
        return new Promise((resolve) => {
            this.writeEmitter.fire('Starting build...\r\n');
            let isIncremental = this.flags.indexOf('incremental') > -1;
            if (isIncremental) {
                if (this.getSharedState()) {
                    this.writeEmitter.fire('Using last build results: ' + this.getSharedState() + '\r\n');
                }
                else {
                    isIncremental = false;
                    this.writeEmitter.fire('No result from last build. Doing full build.\r\n');
                }
            }
            // Since we don't actually build anything in this example set a timeout instead.
            setTimeout(() => {
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                this.writeEmitter.fire('Build complete.\r\n\r\n');
                if (this.flags.indexOf('watch') === -1) {
                    this.closeEmitter.fire(0);
                    resolve();
                }
            }, isIncremental ? 1000 : 4000);
        });
    }
}
//# sourceMappingURL=CustomBuildTask.js.map