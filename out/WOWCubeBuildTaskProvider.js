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
            this._channel.show(true);
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
                        this.closeEmitter.fire(0);
                        resolve();
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
            if (compilerpath.length === 0) {
                vscode.window.showErrorMessage("C++ Compiler support package for WOWCube Development Kit is not detected.\nPlease make sure WOWCube Development Kit is installed, it is up to date and C++ support package for WOWCube Development Kit is installed", ...["Manage Packages"]).then((answer) => {
                    if (answer === "Manage Packages") {
                        vscode.commands.executeCommand('WOWCubeSDK.openExternalTools');
                    }
                });
                //vscode.window.showErrorMessage("C++ Compiler support package for WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed, it is up to date and C++ support package for WOWCube SDK is installed"); 
                this._channel.appendLine('C++ Compiler support package for WOWCube Development Kit is not detected!');
                this._channel.appendLine('Please use Manage External Tools panel to install the package first.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                return;
            }
            compilerpath += 'em/upstream/emscripten/';
            var command = '"' + compilerpath + Configuration_1.Configuration.getCC("cpp") + '"';
            var sourcefile = this.workspace + '/' + build_json.sourceFile;
            var currDir = this.workspace + Configuration_1.Configuration.getSlash() + 'src';
            var srcdir = build_json.sourceFile;
            var pos = srcdir.indexOf('/');
            if (pos !== -1) {
                if (srcdir.substring(0, pos) !== 'src') {
                    this._channel.appendLine('NOTE: Non-standard source files folder name is used. Please consider using `src` as a name of the folder.\r\n');
                }
                currDir = this.workspace + Configuration_1.Configuration.getSlash() + srcdir.substring(0, pos);
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
            var includepath = Configuration_1.Configuration.getWOWSDKPath() + 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/';
            var vers = Configuration_1.Configuration.getCurrentVersion().split('.');
            var maj = '0';
            var min = '1';
            var maj_i = 0;
            var min_i = 1;
            if (vers.length === 2) {
                maj = vers[0];
                min = vers[1];
                maj_i = +maj;
                min_i = +min;
            }
            /*
            if(this.target==='emulator')
            {
                command+=' -std=c++11';
                command+=' -g0';
                command+=' -O3';
            }
            else
            {
                //command+=" -v";
                command+=' -std=c++11';
                command+=' -g0';
                command+=' -O3';
            }
            */
            //compiler flags
            command += ' ' + Project_1.Project.Options.cpp.flags;
            //C:/Users/Dev/emsdk/upstream/emscripten/em++.bat -std=c++11 -g0 -O3 -s STRICT=1 -s WASM=1 -s INITIAL_MEMORY=131072 -s TOTAL_STACK=65536 -s ERROR_ON_UNDEFINED_SYMBOLS=0 -ID:\WOW\WasmLibs\cpp 
            //--no-entry -o D:\WOW\binary\WorkAndRelax.wasm D:\WOW\WorkAndRelax\src\work_relax.cpp D:\WOW\WasmLibs\cpp\AppManager.cpp D:\WOW\WasmLibs\cpp\native.cpp D:\WOW\WasmLibs\cpp\Screen.cpp D:\WOW\WasmLibs\cpp\GuiObjects.cpp
            //add mandatory compiler settings. It has been decided to hardcode these values instead of letting user modify them.
            command += ' -s WASM=1';
            command += ' -s INITIAL_MEMORY=131072';
            command += ' -s TOTAL_STACK=65536';
            //command+=' -s ERROR_ON_UNDEFINED_SYMBOLS=0';
            //command+=' -s STRICT=1';
            //additional compiler settings
            var csett = Project_1.Project.Options.cpp.compilerSettings.split(";");
            for (var i = 0; i < csett.length; i++) {
                if (csett[i].length > 0)
                    command += ' -s ' + csett[i];
            }
            //custom defines 
            var cdefs = Project_1.Project.Options.cpp.defines.split(";");
            for (var i = 0; i < cdefs.length; i++) {
                if (cdefs[i].length > 0)
                    command += ' -D' + cdefs[i];
            }
            //ABI version defines
            command += ' -DABI_VERSION_MAJOR=' + maj;
            command += ' -DABI_VERSION_MINOR=' + min;
            //add SDK include path
            var sdkpath = Configuration_1.Configuration.getWOWSDKPath();
            sdkpath += 'sdk/' + Configuration_1.Configuration.getCurrentVersion() + '/cpp/';
            command += ' -I"' + sdkpath + '"'; //D:/WOW/WasmLibs/cpp';
            //add additional include paths
            for (var i = 0; i < 5; i++) {
                if (Project_1.Project.Options.cpp.includeFolders[i].length > 0) {
                    command += ' -I"' + Project_1.Project.Options.cpp.includeFolders[i] + '"';
                }
            }
            //add destination file
            command += ' --no-entry';
            command += ' -o "' + destfile + '"';
            //add mandatory SDK files depending on SDK version
            if (maj_i >= 5) //5.x
             {
                command += ' "' + sdkpath + 'AppManager.cpp"';
                command += ' "' + sdkpath + 'native.cpp"';
                command += ' "' + sdkpath + 'Screen.cpp"';
                command += ' "' + sdkpath + 'Scene.cpp"';
                command += ' "' + sdkpath + 'NetworkMessage.cpp"';
                command += ' "' + sdkpath + 'Sound.cpp"';
                //gfx
                command += ' "' + sdkpath + 'Gfx/Background.cpp"';
                command += ' "' + sdkpath + 'Gfx/OffscreenRenderTarget.cpp"';
                command += ' "' + sdkpath + 'Gfx/Sprite.cpp"';
                command += ' "' + sdkpath + 'Gfx/Text.cpp"';
                command += ' "' + sdkpath + 'Gfx/AnimatedSprite.cpp"';
            }
            if (maj_i >= 6) //6.x
             {
                command += ' "' + sdkpath + 'SaveMessage.cpp"';
                command += ' "' + sdkpath + 'Scramble.cpp"';
                //gfx
                command += ' "' + sdkpath + 'Gfx/QRCode.cpp"';
            }
            //fetch sources and add them to command line
            if (fs.existsSync(currDir) === true) {
                fs.readdirSync(currDir).forEach(file => {
                    if (file.indexOf('.cpp') !== -1 || file.indexOf('.cxx') !== -1 || file.indexOf('.c++') !== -1 || file.indexOf('.cc') !== -1 || file.indexOf('.c') !== -1 || file.indexOf('.C') !== -1 || file.indexOf('.cppm') !== -1) {
                        var fullpath = currDir + '/' + file;
                        command += ' "' + fullpath + '"';
                    }
                });
            }
            else {
                this._channel.appendLine('WARNING: Folder `' + currDir + '` doesnt exist or can not be opened. Cubeapp may work incorrectly.\r\n');
                this._channel.show(true);
            }
            //return version value in case it was changed
            Configuration_1.Configuration.setCurrentVersion(initialVersion);
            var child = cp.exec(command, { cwd: compilerpath }, (error, stdout, stderr) => {
                if (stderr && stderr.length > 0) {
                    var functionNames = ['sendMessage', 'recvMessage', 'sendPacket', 'recvPacket', 'sendBleData', 'recvBleData', 'getTime', 'getUserName', 'toggleDebugInfo', 'saveState', 'loadState', 'random', 'LOG', 'getTap', 'getAppVersion',
                        'TOPOLOGY_getAdjacentFacelet', 'TOPOLOGY_getFacelet', 'TOPOLOGY_getPlace', 'TOPOLOGY_getOppositeFacelet', 'TOPOLOGY_getAngle', 'TOPOLOGY_getFace',
                        'TOPOLOGY_getFaceletOrientation', 'TOPOLOGY_getPlaceOrientation', 'TOPOLOGY_isAssembled', 'TOPOLOGY_getTwist', 'TopologyDebugGetFace',
                        'TopologyDebugGetPosition', 'TopologyDebugGetHorizontal', 'LB_getInfo', 'LB_getScore', 'MS_getFaceAccelX',
                        'MS_getFaceAccelY', 'MS_getFaceAccelZ', 'MS_getFaceGyroX', 'MS_getFaceGyroY', 'MS_getFaceGyroZ',
                        'GFX_getAssetId', 'GFX_clear', 'GFX_drawText', 'GFX_drawPoint', 'GFX_drawCircle',
                        'GFX_drawSolidCircle', 'GFX_drawArc', 'GFX_drawSector', 'GFX_drawLine', 'GFX_drawRectangle', 'GFX_bakeImage',
                        'GFX_setRenderTarget', 'GFX_drawImage', 'GFX_drawBakedImage', 'GFX_drawParticles', 'GFX_render',
                        'GFX_clearCache', 'GFX_removeBakedImage', 'GFX_cacheImages', 'GFX_setFpsWindow', 'GFX_getAssetsCount', 'GFX_drawQrCode', 'GFX_setFillShader', 'GFX_setLinearGradientShader', 'GFX_setRadialGradientShader', 'GFX_removeShader',
                        'SND_getAssetId', 'SND_play', 'SND_cacheSounds', 'SND_isPlaying', 'SND_stop', 'SND_getAssetsCount', 'EVENT_getList'
                    ];
                    //remove warning for Cubios exports
                    for (var i = 0; i < functionNames.length; i++) {
                        stderr = stderr.replace('warning: undefined symbol: ' + functionNames[i] + ' (referenced by top-level compiled C/C++ code)\n', '');
                    }
                    //remove other warnings
                    stderr = stderr.replace('em++: warning: warnings in JS library compilation [-Wjs-compiler]', '');
                    if (stderr.length > 2) {
                        this._channel.appendLine(stderr);
                        this._channel.show(true);
                    }
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
    doCompilePawn(action) {
        return new Promise((resolve, reject) => {
            this._channel.clear();
            this._channel.show(true);
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
            /*
                        //Uncomment this in order to be able to generate a pawn cubeapp with debug info attached.
                        //This may only come in handy if you use internal debug tools tho, it's not usable anyhow for the most.
                        if(this.target==='emulator')
                        {
                            command+=' -d3 -v2 -i"'+includepath+'" ';
                        }
                        else
                        {
                            command+=' -d1 -O3 -v2 -i"'+includepath+'" ';
                        }
            */
            command += ' -d1 -O3 -v2 -i"' + includepath + '" ';
            command += '-o"' + destfile + '" ';
            command += '"' + sourcefile + '"';
            command += ' ABI_VERSION_MAJOR=' + maj;
            command += ' ABI_VERSION_MINOR=' + min;
            //return version value in case it was changed
            Configuration_1.Configuration.setCurrentVersion(initialVersion);
            if (pawnpath.length === 0) {
                vscode.window.showErrorMessage("WOWCube Development Kit is not detected.\nPlease make sure WOWCube Development Kit is installed and up to date");
                this._channel.appendLine('WOWCube Development Kit path is not set or operating system is not supported.\r\n\r\n');
                this.closeEmitter.fire(0);
                resolve();
                return;
            }
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                var criticalWaring = false;
                if (error) {
                    //reject({ error, stdout, stderr });
                }
                if (stderr && stderr.length > 0) {
                    if (stderr.indexOf('warning 202:') != -1) {
                        criticalWaring = true;
                        stderr = stderr.replace(new RegExp('warning 202:', 'g'), 'critical warning 202:');
                    }
                    this._channel.appendLine(stderr);
                    this._channel.show(true);
                }
                if (stdout && stdout.length > 0) {
                    if (stdout.indexOf('warning 202:') != -1) {
                        criticalWaring = true;
                        stderr = stderr.replace(new RegExp('warning 202:', 'g'), 'critical warning 202:');
                    }
                    this._channel.appendLine(stdout);
                    this._channel.show(true);
                }
                const date = new Date();
                this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
                if (child.exitCode === 0) {
                    if (!criticalWaring) {
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
                        this._channel.appendLine("File compiled with critical warnings, the image can't be run.\r\n");
                        this.closeEmitter.fire(0);
                        resolve();
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
            // logging
            var mn = +Configuration_1.Configuration.getLoggingMode() - 1;
            if (mn != -1) {
                if (mn != 8) {
                    this._channel.appendLine('Application logging is enabled for module ' + mn + '.\r\n');
                }
                else {
                    this._channel.appendLine('Application logging is enabled for all modules.\r\n');
                }
                command += " -l -cid " + mn;
            }
            else {
                this._channel.appendLine('Application logging is disabled.\r\n');
            }
            Providers_1.Providers.btdevices.showWait(true);
            Configuration_1.Configuration.setDeviceBusy(device.mac, true);
            var child = cp.exec(command, { cwd: "" }, (error, stdout, stderr) => {
                Configuration_1.Configuration.setDeviceBusy(device.mac, false);
                Providers_1.Providers.btdevices.showWait(false);
                if (child.exitCode === 0) {
                    Providers_1.Providers.btdevices.setDeviceStatus(device.mac, 1);
                    if (Configuration_1.Configuration.getLoggingMode() == '0') {
                        this._channel.appendLine('Cubeapp is started.\r\n');
                    }
                    else {
                        this._channel.appendLine('Cubeapp is closed.\r\n');
                    }
                    this.closeEmitter.fire(0);
                    resolve();
                }
                else {
                    if (Configuration_1.Configuration.getLoggingMode() == '0') {
                        this._channel.appendLine('Failed to start cubeapp application on selected device.\r\n');
                    }
                    else {
                        this._channel.appendLine('Failed to start cubeapp application on selected device or inconsistent application log data has been received.\r\n');
                    }
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