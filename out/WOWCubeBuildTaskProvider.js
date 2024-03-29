"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WOWCubeBuildTaskProvider = void 0;
const path = require("path");
const fs = require("fs");
const vscode = require("vscode");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Project_1 = require("./Project");
const Providers_1 = require("./Providers");
const Output_1 = require("./Output");
class WOWCubeBuildTaskProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    async provideTasks() {
        return this.getTasks();
    }
    resolveTask(_task) {
        const action = _task.definition.action;
        if (action) {
            const definition = _task.definition;
            return this.getTask(definition.action, definition.target, definition);
        }
        return undefined;
    }
    getTasks() {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        this.tasks = [];
        this.tasks.push(this.getTask('compile', ''));
        this.tasks.push(this.getTask('build', 'emulator'));
        this.tasks.push(this.getTask('build', 'device'));
        return this.tasks;
    }
    getTask(action, target, definition) {
        if (definition === undefined) {
            definition =
                {
                    type: WOWCubeBuildTaskProvider.wowCubeBuildScriptType,
                    action,
                    target
                };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, `${action} ${target}`, WOWCubeBuildTaskProvider.wowCubeBuildScriptType, new vscode.CustomExecution(async () => {
            // When the task is executed, this callback will run. Here, we setup for running the task.
            return new WOWCubeBuildTaskTerminal(this.workspaceRoot, action, target, () => this.sharedState, (state) => this.sharedState = state);
        }));
    }
}
exports.WOWCubeBuildTaskProvider = WOWCubeBuildTaskProvider;
WOWCubeBuildTaskProvider.wowCubeBuildScriptType = 'wowsdkbuild';
class WOWCubeBuildTaskTerminal {
    constructor(workspaceRoot, action, target, getSharedState, setSharedState) {
        this.workspaceRoot = workspaceRoot;
        this.action = action;
        this.target = target;
        this.getSharedState = getSharedState;
        this.setSharedState = setSharedState;
        this.writeEmitter = Output_1.Output.terminal();
        this.onDidWrite = this.writeEmitter.event;
        this.closeEmitter = Output_1.Output.terminalClose();
        this.onDidClose = this.closeEmitter.event;
        this._channel = Output_1.Output.channel();
        this.workspace = workspaceRoot;
    }
    open(initialDimensions) {
        /*
        // At this point we can start using the terminal.
        if (this.flags.indexOf('watch') > -1)
        {
            const pattern = path.join(this.workspaceRoot, 'customBuildFile');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            this.fileWatcher.onDidChange(() => this.doBuild());
            this.fileWatcher.onDidCreate(() => this.doBuild());
            this.fileWatcher.onDidDelete(() => this.doBuild());
        }
        */
        //pre-process json file
        if (Project_1.Project.validateAssets(this.workspace, true) === false) {
            this._channel.appendLine('Project file failed to validate, the project may produce build or runtime errors! Please check the project file.\r\n');
            return;
        }
        switch (Project_1.Project.CurrentLanguage) {
            case 'pawn':
                {
                    this.doCompilePawn(this.action);
                }
                break;
            case 'cpp':
                {
                    this.doCompileCpp(this.action);
                }
                break;
        }
    }
    close() {
        // The terminal has been closed. Shutdown the build.
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
    printOutput(data) {
        this._channel.appendLine(data);
        this._channel.show(true);
    }
    doCompileCpp(action) {
        return new Promise((resolve, reject) => {
            this._channel.clear();
            this._channel.appendLine('Compiling cub file...\r\n');
            const initialVersion = Configuration_1.Configuration.getCurrentVersion();
            const build_json = JSON.parse(fs.readFileSync(this.workspace + '/wowcubeapp-build.json', 'utf-8'));
            this._channel.appendLine('Project name: ' + build_json.name);
            this._channel.appendLine('Project version: ' + build_json.version);
            if (typeof (build_json.sdkVersion) !== 'undefined') {
                this._channel.appendLine('Target SDK version: ' + build_json.sdkVersion + '\r\n');
                if (build_json.sdkVersion !== Configuration_1.Configuration.getCurrentVersion()) {
                    this._channel.appendLine("NOTE: Target SDK version of the application (" + build_json.sdkVersion + ") differs from current SDK version (" + Configuration_1.Configuration.getCurrentVersion() + ")");
                    var versions = Configuration_1.Configuration.getVersions();
                    var detected = false;
                    for (var i = 0; i < versions.length; i++) {
                        if (versions[i] === build_json.sdkVersion) {
                            detected = true;
                            break;
                        }
                    }
                    if (detected === false) {
                        this._channel.appendLine("NOTE: SDK version " + build_json.sdkVersion + " is not installed. Please install required version of SDK or change application Target SDK version to one of the following:\r\n");
                        for (var i = 0; i < versions.length; i++) {
                            this._channel.appendLine("\tVersion " + versions[i]);
                        }
                        this._channel.appendLine('\r\nFailed to compile.\r\n');
                        return;
                    }
                    else {
                        this._channel.appendLine("\r\nNOTE: Building with SDK version " + build_json.sdkVersion + "\r\n");
                        Configuration_1.Configuration.setCurrentVersion(build_json.sdkVersion);
                    }
                }
            }
            else {
                this._channel.appendLine("\r\nNOTE: SDK version is missing from the build file");
                if (Project_1.Project.setSDKVersion(this.workspace, Configuration_1.Configuration.getCurrentVersion())) {
                    this._channel.appendLine("Target SDK version is set to '" + Configuration_1.Configuration.getCurrentVersion() + "'\r\n");
                }
                else {
                    this._channel.appendLine("Failed to modify the build file, please make sure the file exists and can be written!\r\n");
                }
            }
            var compilerpath = Configuration_1.Configuration.getCompilerPath("cpp");
            //compilerpath = "d:/WOW/WOWCube Development Kit/sdk/tools/cpp/";
            compilerpath += 'em/upstream/emscripten/';
            var command = '"' + compilerpath + Configuration_1.Configuration.getCC("cpp") + '"';
            var sourcefile = this.workspace + '/' + build_json.sourceFile;
            var currDir = this.workspace + "\\src";
            var srcdir = build_json.sourceFile;
            var pos = srcdir.indexOf('/');
            if (pos !== -1) {
                if (srcdir.substring(0, pos) !== 'src') {
                    this._channel.appendLine('NOTE: Non-standard source files folder name is used. Please consider using `src` as a name of the folder.\r\n');
                }
                currDir = this.workspace + "\\" + srcdir.substring(0, pos);
            }
            var builddir = this.workspace + "/binary";
            pos = build_json.scriptFile.indexOf('/');
            if (pos !== -1) {
                if (build_json.scriptFile.substring(0, pos) !== 'binary') {
                    this._channel.appendLine('NOTE: Non-standard intermediary binary files folder name is used. Please consider using `binary` as a name of the folder.\r\n');
                }
                builddir = this.workspace + "/" + build_json.scriptFile.substring(0, pos);
            }
            var destfile = this.workspace + '/' + build_json.scriptFile;
            this.makeDirSync(builddir);
            //-X$100000 -d0 -O3 -v2 -i../PawnLibs -DSource ladybug.pwn
            var includepath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/';
            /*
            if(Configuration.isWindows())
            {
                //This is weird, but it seems that pawncc treats include directories differently on different platforms
                //On windows, it auto-searches for "standard" include folder on level up bin/ folder
                //On mac, it does the opposite - auto-searches for inc files in source folder, but does not know where the "standard" folder is
                
                includepath=currDir;
            }
            */
            var vers = Configuration_1.Configuration.getCurrentVersion().split('.');
            var maj = '0';
            var min = '1';
            if (vers.length === 2) {
                maj = vers[0];
                min = vers[1];
            }
            if (this.target === 'emulator') {
            }
            else {
                //command+=" -v";
                command += ' -std=c++11';
                command += ' -g0';
                command += ' -O3';
            }
            //C:/Users/Dev/emsdk/upstream/emscripten/em++.bat -std=c++11 -g0 -O3 -s STRICT=1 -s WASM=1 -s INITIAL_MEMORY=131072 -s TOTAL_STACK=65536 -s ERROR_ON_UNDEFINED_SYMBOLS=0 -ID:\WOW\WasmLibs\cpp 
            //--no-entry -o D:\WOW\binary\WorkAndRelax.wasm D:\WOW\WorkAndRelax\src\work_relax.cpp D:\WOW\WasmLibs\cpp\AppManager.cpp D:\WOW\WasmLibs\cpp\native.cpp D:\WOW\WasmLibs\cpp\Screen.cpp D:\WOW\WasmLibs\cpp\GuiObjects.cpp
            command += ' -s STRICT=1';
            command += ' -s WASM=1';
            command += ' -s INITIAL_MEMORY=131072';
            command += ' -s TOTAL_STACK=65536';
            command += ' -s ERROR_ON_UNDEFINED_SYMBOLS=0';
            command += ' -ID:/WOW/WasmLibs/cpp';
            command += ' --no-entry';
            command += ' -o D:/WOW/binary/c1.wasm';
            command += ' D:/WOW/WorkAndRelax/src/work_relax.cpp';
            command += ' D:/WOW/WasmLibs/cpp/AppManager.cpp';
            command += ' D:/WOW/WasmLibs/cpp/native.cpp';
            command += ' D:/WOW/WasmLibs/cpp/Screen.cpp';
            command += ' D:/WOW/WasmLibs/cpp/GuiObjects.cpp';
            //command+='-o"'+destfile+'" ';
            //command+='"'+sourcefile+'"';	
            //command+=' ABI_VERSION_MAJOR='+maj;
            //command+=' ABI_VERSION_MINOR='+min;
            //return version value in case it was changed
            Configuration_1.Configuration.setCurrentVersion(initialVersion);
            if (compilerpath.length === 0) {
                vscode.window.showErrorMessage("C++ Compiler support package for WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed, it is up to date and C++ support package for WOWCube SDK is installed");
                this._channel.appendLine('C++ Compiler support package for WOWCube SDK is not detected.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                return;
            }
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
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
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                if (child.exitCode === 0) {
                    this._channel.appendLine('File compiled successfully.\r\n');
                    if (action === 'compile') {
                        this.closeEmitter.fire(0);
                        resolve();
                    }
                    else {
                        //this.doBuild(this.target);
                    }
                }
                else {
                    this._channel.appendLine('Failed to compile.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
            });
        });
    }
    doCompilePawn(action) {
        return new Promise((resolve, reject) => {
            this._channel.clear();
            this._channel.appendLine('Compiling cub file...\r\n');
            const initialVersion = Configuration_1.Configuration.getCurrentVersion();
            const build_json = JSON.parse(fs.readFileSync(this.workspace + '/wowcubeapp-build.json', 'utf-8'));
            this._channel.appendLine('Project name: ' + build_json.name);
            this._channel.appendLine('Project version: ' + build_json.version);
            if (typeof (build_json.sdkVersion) !== 'undefined') {
                this._channel.appendLine('Target SDK version: ' + build_json.sdkVersion + '\r\n');
                if (build_json.sdkVersion !== Configuration_1.Configuration.getCurrentVersion()) {
                    this._channel.appendLine("NOTE: Target SDK version of the application (" + build_json.sdkVersion + ") differs from current SDK version (" + Configuration_1.Configuration.getCurrentVersion() + ")");
                    var versions = Configuration_1.Configuration.getVersions();
                    var detected = false;
                    for (var i = 0; i < versions.length; i++) {
                        if (versions[i] === build_json.sdkVersion) {
                            detected = true;
                            break;
                        }
                    }
                    if (detected === false) {
                        this._channel.appendLine("NOTE: SDK version " + build_json.sdkVersion + " is not installed. Please install required version of SDK or change application Target SDK version to one of the following:\r\n");
                        for (var i = 0; i < versions.length; i++) {
                            this._channel.appendLine("\tVersion " + versions[i]);
                        }
                        this._channel.appendLine('\r\nFailed to compile.\r\n');
                        return;
                    }
                    else {
                        this._channel.appendLine("\r\nNOTE: Building with SDK version " + build_json.sdkVersion + "\r\n");
                        Configuration_1.Configuration.setCurrentVersion(build_json.sdkVersion);
                    }
                }
            }
            else {
                this._channel.appendLine("\r\nNOTE: SDK version is missing from the build file");
                if (Project_1.Project.setSDKVersion(this.workspace, Configuration_1.Configuration.getCurrentVersion())) {
                    this._channel.appendLine("Target SDK version is set to '" + Configuration_1.Configuration.getCurrentVersion() + "'\r\n");
                }
                else {
                    this._channel.appendLine("Failed to modify the build file, please make sure the file exists and can be written!\r\n");
                }
            }
            var pawnpath = Configuration_1.Configuration.getPawnPath();
            var command = '"' + pawnpath + Configuration_1.Configuration.getPawnCC() + '"';
            var sourcefile = this.workspace + '/' + build_json.sourceFile;
            var currDir = this.workspace + "\\src";
            var srcdir = build_json.sourceFile;
            var pos = srcdir.indexOf('/');
            if (pos !== -1) {
                if (srcdir.substring(0, pos) !== 'src') {
                    this._channel.appendLine('NOTE: Non-standard source files folder name is used. Please consider using `src` as a name of the folder.\r\n');
                }
                currDir = this.workspace + "\\" + srcdir.substring(0, pos);
            }
            var builddir = this.workspace + "/binary";
            pos = build_json.scriptFile.indexOf('/');
            if (pos !== -1) {
                if (build_json.scriptFile.substring(0, pos) !== 'binary') {
                    this._channel.appendLine('NOTE: Non-standard intermediary binary files folder name is used. Please consider using `binary` as a name of the folder.\r\n');
                }
                builddir = this.workspace + "/" + build_json.scriptFile.substring(0, pos);
            }
            var destfile = this.workspace + '/' + build_json.scriptFile;
            this.makeDirSync(builddir);
            //-X$100000 -d0 -O3 -v2 -i../PawnLibs -DSource ladybug.pwn
            var includepath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/pawn/include/';
            if (Configuration_1.Configuration.isWindows()) {
                //This is weird, but it seems that pawncc treats include directories differently on different platforms
                //On windows, it auto-searches for "standard" include folder on level up bin/ folder
                //On mac, it does the opposite - auto-searches for inc files in source folder, but does not know where the "standard" folder is 
                includepath = currDir;
            }
            var vers = Configuration_1.Configuration.getCurrentVersion().split('.');
            var maj = '0';
            var min = '1';
            if (vers.length === 2) {
                maj = vers[0];
                min = vers[1];
            }
            if (this.target === 'emulator') {
                command += ' -d3 -v2 -i"' + includepath + '" ';
            }
            else {
                command += ' -d1 -O3 -v2 -i"' + includepath + '" ';
            }
            command += '-o"' + destfile + '" ';
            command += '"' + sourcefile + '"';
            command += ' ABI_VERSION_MAJOR=' + maj;
            command += ' ABI_VERSION_MINOR=' + min;
            //return version value in case it was changed
            Configuration_1.Configuration.setCurrentVersion(initialVersion);
            if (pawnpath.length === 0) {
                vscode.window.showErrorMessage("WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed and up to date");
                this._channel.appendLine('WOWCube SDK path is not set or operating system is not supported.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                return;
            }
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
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
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                if (child.exitCode === 0) {
                    this._channel.appendLine('File compiled successfully.\r\n');
                    if (action === 'compile') {
                        this.closeEmitter.fire(0);
                        resolve();
                    }
                    else {
                        this.doBuild(this.target);
                    }
                }
                else {
                    this._channel.appendLine('Failed to compile.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
            });
        });
    }
    async doBuild(target) {
        return new Promise((resolve, reject) => {
            this._channel.appendLine('Building cub file...');
            this._channel.appendLine('Validating project file');
            /*
            //pre-process json file
            if(Project.validateAssets(this.workspace,true)===false)
            {
                this._channel.appendLine('Project file failed to validate, the project may produce build or runtime errors! Please check the project file.\r\n');
            }
            */
            const build_json = JSON.parse(fs.readFileSync(this.workspace + '/wowcubeapp-build.json', 'utf-8'));
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getBuilder() + '"';
            const project = '"' + this.workspace + '/wowcubeapp-build.json"';
            const output = '"' + this.workspace + '/binary/' + build_json.name + '.cub"';
            command += " " + project + " " + output;
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
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
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                if (child.exitCode === 0) {
                    this._channel.appendLine('Build complete.\r\n');
                    if (target === 'emulator') {
                        this.doRunInEmulator(build_json.name + '.cub');
                    }
                    else {
                        this.doRunOnDevice(build_json.name + '.cub');
                    }
                }
                else {
                    this._channel.appendLine('Failed to build.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
            });
        });
    }
    async doRunOnDevice(cubename) {
        return new Promise((resolve, reject) => {
            this._channel.appendLine('Running app on selected WOWCube device...\r\n');
            var device = Configuration_1.Configuration.getCurrentDevice();
            if (device === null) {
                this._channel.appendLine('Failed to run on device, no device selected.\r\n');
                this.closeEmitter.fire(0);
                resolve();
            }
            if (Configuration_1.Configuration.isDeviceBusy(device.mac) === true) {
                this._channel.appendLine('Failed to run on device, device is busy. Please wait before current operation is finished and try again.\r\n');
                this.closeEmitter.fire(0);
                resolve();
            }
            var utilspath = Configuration_1.Configuration.getUtilsPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getLoader() + '"';
            const source = this.workspace + '/binary/' + cubename;
            command += " up -p ";
            command += '"' + source + '"';
            command += " -a ";
            command += device.mac;
            command += " -r";
            Providers_1.Providers.btdevices.showWait(true);
            Configuration_1.Configuration.setDeviceBusy(device.mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(device.mac, false);
                Providers_1.Providers.btdevices.showWait(false);
                if (child.exitCode === 0) {
                    Providers_1.Providers.btdevices.setDeviceStatus(device.mac, 1);
                    this._channel.appendLine('Done.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
                else {
                    this._channel.appendLine('Failed to start cubeapp application on selected device.\r\n');
                    this.closeEmitter.fire(0);
                    resolve();
                }
            });
            var that = this;
            child?.stdout?.on('data', function (data) {
                that._channel.appendLine(data);
                that._channel.show(true);
            });
            child?.stderr?.on('data', function (data) {
                that._channel.appendLine(data);
                that._channel.show(true);
            });
        });
    }
    async doRunInEmulator(cubename) {
        return new Promise((resolve, reject) => {
            this._channel.appendLine('Running app in WOWCube emulator...\r\n');
            //"/Applications/WOWCube SDK.app/Contents/MacOS//bin//wowcube-sdk" --run --firmware-globals "FLASH_DIR=/Users/apple 1/Test/y5/binary" --firmware-build --firmware-cubelet "y5.cub" 
            var utilspath = Configuration_1.Configuration.getEmulPath();
            var command = '"' + utilspath + Configuration_1.Configuration.getEmulator() + '"';
            const source = this.workspace + '/binary/' + cubename;
            const output = '--project-run "' + source + '" --run';
            command += " " + output;
            cp.exec(command, { cwd: "" });
            this._channel.appendLine('Done.\r\n');
            this.closeEmitter.fire(0);
            resolve();
        });
    }
    makeDirSync(dir) {
        if (fs.existsSync(dir)) {
            return;
        }
        if (!fs.existsSync(path.dirname(dir))) {
            this.makeDirSync(path.dirname(dir));
        }
        fs.mkdirSync(dir);
    }
    createVirtualFlashDir(cubename) {
        var ret = true;
        try {
            const source = this.workspace + '/binary/' + cubename;
            const flashdir = this.workspace + '/flash';
            const dest = flashdir + '/0/games/' + cubename;
            this.makeDirSync(flashdir);
            this.makeDirSync(flashdir + '/0');
            this.makeDirSync(flashdir + '/0/games');
            fs.copyFileSync(source, dest);
        }
        catch (error) {
            this._channel.appendLine('Failed to copy ' + cubename + ' file to flash directory:' + error + '\r\n');
            ret = false;
        }
        return ret;
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
//# sourceMappingURL=WOWCubeBuildTaskProvider.js.map