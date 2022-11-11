"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Configuration = void 0;
const vscode = require("vscode");
const os = require("os");
const fs = require("fs");
const path = require("path");
class Configuration {
    static getString(key) {
        var ret = "";
        try {
            const conf = vscode.workspace.getConfiguration();
            ret = conf.get(key);
        }
        catch (e) {
            ret = "";
        }
        return ret;
    }
    static setString(key, value) {
        try {
            vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
        }
        catch (e) {
        }
    }
    static setDeviceBusy(mac, busy) {
        Configuration._busyDevices.set(mac, busy);
    }
    static isDeviceBusy(mac) {
        var b = Configuration._busyDevices.get(mac);
        if (typeof (b) === 'undefined') {
            return false;
        }
        return b;
    }
    static isAnyDeviceBusy() {
        Configuration._busyDevices.forEach((value, key, map) => {
            if (value === true) {
                return true;
            }
        });
        return false;
    }
    static setCurrentDevice(device) {
        try {
            const d = JSON.stringify(device);
            Configuration._currentDevice = device;
            Configuration.setString('wowsdk.conf.currentdevice', d);
        }
        catch (e) { }
    }
    static getCurrentDevice() {
        var obj = null;
        try {
            if (Configuration._currentDevice !== null) {
                return Configuration._currentDevice;
            }
            const d = Configuration.getString('wowsdk.conf.currentdevice');
            obj = JSON.parse(d);
            if (typeof (obj.name) === 'undefined' || typeof (obj.mac) === 'undefined') {
                obj = null;
            }
        }
        catch (e) {
            obj = null;
        }
        return obj;
    }
    static setLastDetectedDevices(devices) {
        try {
            const d = JSON.stringify(devices);
            Configuration.setString('wowsdk.conf.detecteddevices', d);
        }
        catch (e) { }
    }
    static getLastDetectedDevices() {
        var devices = new Array();
        var d = Configuration.getString('wowsdk.conf.detecteddevices');
        try {
            devices = JSON.parse(d);
        }
        catch (e) { }
        return devices;
    }
    static getLastPath() { return Configuration.getString('wowsdk.conf.wizard'); }
    static setLastPath(value) { Configuration.setString('wowsdk.conf.wizard', value); }
    static getLastLanguage() { return Configuration.getString('wowsdk.conf.language'); }
    static setLastLanguage(value) { Configuration.setString('wowsdk.conf.language', value); }
    static getWDKPrivate() {
        var p = os.platform();
        var homedir = os.homedir();
        var json = null;
        switch (p) {
            case 'darwin': //mac
                {
                    homedir += "/Library/WOWCube Development Kit/WDK_private";
                    try {
                        json = JSON.parse(fs.readFileSync(homedir, 'utf-8'));
                    }
                    catch (e) { }
                }
                break;
            case 'win32': //windows
                {
                    homedir += "/AppData/Local/WOWCube Development Kit/WDK_private";
                    try {
                        json = JSON.parse(fs.readFileSync(homedir, 'utf-8'));
                    }
                    catch (e) { }
                }
                break;
            case 'linux':
            default:
                //unsupported os
                break;
        }
        return json;
    }
    static getWDKGlobals() {
        var json = null;
        try {
            var path = Configuration.getWOWSDKPath() + 'sdk/globals';
            json = JSON.parse(fs.readFileSync(path, 'utf-8'));
            var pr = this.getWDKPrivate();
            if (pr !== null) {
                if (typeof pr.updateEndpoint !== 'undefined') {
                    json.updateEndpoint = pr.updateEndpoint;
                }
            }
        }
        catch (e) { }
        return json;
    }
    static getWOWSDKContainingFolder() {
        var p = os.platform();
        var path = Configuration.getWOWSDKPath();
        var folder = "/";
        switch (p) {
            case 'darwin': //mac
                {
                    const fname = "/WOWCube Development Kit.app";
                    var pos = path.indexOf(fname);
                    folder = path.substring(0, pos);
                }
                break;
            case 'win32': //windows
                break;
            case 'linux':
            default:
                //unsupported os
                break;
        }
        return folder;
    }
    static async getWOWSDKPathAsync() {
        var path = Configuration.getString('wowsdk.conf.wowsdkpath');
        var p = os.platform();
        if (typeof (path) === 'undefined' || path.length === 0) {
            //try to find the SDK
            switch (p) {
                case 'darwin': //mac
                    {
                        if (fs.existsSync("/Applications/WOWCube Development Kit.app")) {
                            path = "/Applications/WOWCube Development Kit.app/Contents/";
                            this.setWOWSDKPath(path);
                        }
                    }
                    break;
                case 'win32': //windows
                    {
                        var regedit = require('regedit');
                        var done = false;
                        path = "/";
                        regedit.list('HKCU\\SOFTWARE\\WOWCube Development Kit', (err, result) => {
                            if (err === null) {
                                var key = result['HKCU\\SOFTWARE\\WOWCube Development Kit'];
                                if (key.exists) {
                                    //the value doesn't have a name, hence '' 
                                    var p = key.values[''].value;
                                    path = p.replace(/\\/g, '/') + '/';
                                }
                            }
                            this.setWOWSDKPath(path);
                            done = true;
                        });
                        while (!done) {
                            await Configuration.sleep(100);
                        }
                    }
                    break;
                case 'linux':
                    path = "/";
                    break;
                default:
                    //unsupported os
                    path = "";
                    break;
            }
        }
        return path;
    }
    static getWOWSDKPath() {
        var path = "";
        if (Configuration._lastSetSDKPath !== null) {
            path = Configuration._lastSetSDKPath;
        }
        else {
            path = Configuration.getString('wowsdk.conf.wowsdkpath');
        }
        var p = os.platform();
        if (typeof (path) === 'undefined' || path.length === 0) {
            //try to find the SDK
            switch (p) {
                case 'darwin': //mac
                    {
                        if (fs.existsSync("/Applications/WOWCube Development Kit.app")) {
                            path = "/Applications/WOWCube Development Kit.app/Contents/";
                            this.setWOWSDKPath(path);
                        }
                    }
                    break;
                case 'win32': //windows
                    {
                        path = "/";
                    }
                    break;
                case 'linux':
                    path = "/";
                    break;
                default:
                    //unsupported os
                    path = "";
                    break;
            }
        }
        return path;
    }
    static getVersions() {
        return Configuration._detectedSDKVersions;
    }
    static reloadVersions() {
        Configuration.loadVersionFolders(Configuration.getWOWSDKPath());
    }
    static loadVersionFolders(path) {
        //clear versions, if any
        while (Configuration._detectedSDKVersions.length > 0) {
            Configuration._detectedSDKVersions.pop();
        }
        //enumerate available sdk versions, if any
        if (fs.existsSync(path) === false || fs.existsSync(path + '/sdk') === false) {
            Configuration._detectedSDKVersions.push('1.0.0');
            return;
        }
        var dirs = fs.readdirSync(path + '/sdk').filter(function (file) {
            return fs.statSync(path + '/sdk/' + file).isDirectory();
        });
        for (var i = 0; i < dirs.length; i++) {
            //version format is NN.NNNN-NNNN
            if (/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(dirs[i])) {
                // Successful match
                Configuration._detectedSDKVersions.push(dirs[i]);
            }
        }
    }
    static getCurrentVersion() {
        var v;
        if (Configuration._lastSetSDKVersion !== null) {
            v = Configuration._lastSetSDKVersion;
        }
        else {
            v = Configuration.getString('wowsdk.conf.wowsdkversion');
        }
        let versionFound = false;
        for (var i = 0; i < Configuration._detectedSDKVersions.length; i++) {
            if (versionFound === false) {
                if (v === Configuration._detectedSDKVersions[i]) {
                    versionFound = true;
                }
            }
        }
        if (versionFound === false) {
            //if current saved version is not in the list of versions present in the bundle, reset to the first version in the list
            if (Configuration._detectedSDKVersions.length > 0)
                v = Configuration._detectedSDKVersions[0];
            Configuration.setCurrentVersion(v);
        }
        return v;
    }
    static setCurrentVersion(v) {
        try {
            Configuration.setString('wowsdk.conf.wowsdkversion', v);
            Configuration._lastSetSDKVersion = v;
        }
        catch (e) { }
    }
    static getCC(language) {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
            case 'linux':
                {
                    switch (language) {
                        case 'cpp':
                            return 'em++';
                        default:
                            return '';
                    }
                }
            case 'win32': //windows
                {
                    switch (language) {
                        case 'cpp':
                            return 'em++.bat';
                        default:
                            return '';
                    }
                }
            default:
                //unsupported os
                return '';
        }
    }
    static getPawnCC() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
            case 'linux':
                return 'pawncc';
            case 'win32': //windows
                return 'pawncc.exe';
            default:
                //unsupported os
                return 'pawncc';
        }
    }
    static getBuilder() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
            case 'linux':
                return 'wowcube-build';
            case 'win32': //windows
                return 'wowcube-build.exe';
            default:
                //unsupported os
                return 'wowcube-build';
        }
    }
    static getEmulator() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
            case 'linux':
                return 'WOWCube Emulator';
            case 'win32': //windows
                return 'WOWCube Emulator.exe';
            default:
                //unsupported os
                return 'WOWCube Emulator';
        }
    }
    static getLoader() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
                return 'wowcube-loader.app/Contents/MacOS/wowcube-loader';
            case 'linux':
                return 'wowcube-loader';
            case 'win32': //windows
                return 'wowcube-loader.exe';
            default:
                //unsupported os
                return 'wowcube-loader';
        }
    }
    static getUpdater() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
                return { cli: 'wow-updater.app/Contents/MacOS/wow-updater', ui: 'wow-updater.app/Contents/MacOS/wow-updater' };
            case 'linux':
                return { cli: 'wow-updater', ui: 'wow-updater' };
            case 'win32': //windows
                return { cli: 'wow-update_cli.exe', ui: 'wow-update.exe' };
            default:
                //unsupported os
                return { cli: 'wow-updater', ui: 'wow-updater' };
        }
    }
    static setWOWSDKPath(value) {
        Configuration.setString('wowsdk.conf.wowsdkpath', value);
        Configuration._lastSetSDKPath = value;
    }
    static makeDirSync(dir) {
        if (fs.existsSync(dir))
            return;
        if (!fs.existsSync(path.dirname(dir))) {
            this.makeDirSync(path.dirname(dir));
        }
        fs.mkdirSync(dir);
    }
    static getToolsPath() {
        var p = os.platform();
        var homedir = os.homedir();
        switch (p) {
            case 'darwin': //mac
            case 'win32': //windows
                {
                    homedir += "/WOWCube Development Kit/Tools/";
                }
                break;
            case 'linux':
            default:
                //unsupported os
                break;
        }
        //try to create if this folder doesn't exist
        try {
            if (!fs.existsSync(homedir)) {
                this.makeDirSync(homedir);
            }
        }
        catch (e) {
            homedir = "";
        }
        return homedir;
    }
    static getCompilerPath(language) {
        var p = os.platform();
        var homedir = os.homedir();
        switch (p) {
            case 'darwin': //mac
            case 'win32': //windows
                {
                    homedir += "/WOWCube Development Kit/Tools/";
                    homedir += language + '/';
                }
                break;
            case 'linux':
            default:
                //unsupported os
                break;
        }
        return homedir;
    }
    static getPawnPath() {
        var ret = Configuration.getWOWSDKPath();
        if (typeof (ret) === 'undefined' || ret.length === 0) {
            return "";
        }
        //ret+='bin/pawn/';
        ret += 'sdk/' + Configuration.getCurrentVersion() + '/pawn/bin/';
        return ret;
    }
    static getUtilsPath() {
        var ret = Configuration.getWOWSDKPath();
        if (typeof (ret) === 'undefined' || ret.length === 0) {
            return "";
        }
        ret += 'sdk/tools/';
        return ret;
    }
    static getEmulPath() {
        var ret = Configuration.getWOWSDKPath();
        if (typeof (ret) === 'undefined' || ret.length === 0) {
            return "";
        }
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
                {
                    ret += 'MacOS/';
                }
                break;
            case 'linux':
                ret += "bin/";
                break;
            case 'win32': //windows
                ret += 'bin/';
                break;
            default:
                break;
        }
        return ret;
    }
    static getSlash() {
        var p = os.platform();
        switch (p) {
            case 'darwin': //mac
            case 'linux':
                {
                    return '/';
                }
                break;
            case 'win32': //windows
                return '\\';
                break;
            default:
                break;
        }
        return '';
    }
    static isLinux() {
        var p = os.platform();
        switch (p) {
            case 'linux':
                {
                    return true;
                }
                break;
            case 'darwin': //mac
            case 'win32': //windows
                return false;
                break;
        }
        return true;
    }
    static isWindows() {
        var p = os.platform();
        switch (p) {
            case 'win32':
                {
                    return true;
                }
                break;
            case 'linux': //mac
            case 'win32': //windows
                return false;
                break;
        }
        return false;
    }
    static async init() {
        //detect SDK path 
        var path = await Configuration.getWOWSDKPathAsync();
        if (typeof (path) === 'undefined' || path.length === 0) {
            vscode.window.showErrorMessage("WOWCube SDK is not detected.\nPlease make sure WOWCube SDK is installed and up to date");
        }
        else {
            Configuration.loadVersionFolders(path);
        }
    }
    static async sleep(timer) {
        return new Promise(resolve => {
            timer = timer || 2000;
            setTimeout(function () {
                resolve();
            }, timer);
        });
    }
    ;
}
exports.Configuration = Configuration;
Configuration._currentDevice = null;
Configuration._lastSetSDKPath = null;
Configuration._lastSetSDKVersion = null;
Configuration._busyDevices = new Map();
Configuration._detectedSDKVersions = new Array();
//# sourceMappingURL=Configuration.js.map