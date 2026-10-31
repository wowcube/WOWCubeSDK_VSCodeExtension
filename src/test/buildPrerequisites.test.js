// Exercise tool discovery and execution on macOS and Windows without installing tools.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const Module = require('module');
const messages = [];
const channel = {appendLine() {}};
const vscode = {window:{createOutputChannel:() => channel,showErrorMessage:(...args) => messages.push(args)},EventEmitter:class {}};
const load = Module._load;
Module._load = function(name,parent,isMain) { return name === 'vscode' ? vscode : load.call(this,name,parent,isMain); };
const {BuildPrerequisites: Tools} = require('../../out/BuildPrerequisites');
const {Configuration} = require('../../out/Configuration');
Module._load = load;
const original = {env:process.env,platform:os.platform,execFile:cp.execFile,stat:fs.promises.stat,readdir:fs.promises.readdir,
    paths:Configuration.getBuildToolPaths,utils:Configuration.getUtilsPath};
let files, folders, failures, calls, overrides, configured, platform;
function file(name) { files.add(name); let folder=path.dirname(name); while(folder !== path.dirname(folder)) { folders.add(folder); folder=path.dirname(folder); } }
function exe(name,folder='/custom tools 色/bin') { const value=path.join(folder,name+(platform==='win32'?'.exe':''));file(value);return value; }
function reset(host='darwin') {
    platform=host;files=new Set();folders=new Set();failures=new Set();calls=[];overrides=new Map();configured=['/custom tools 色'];
    process.env=host==='win32'?{Path:'/path tools;/other tools',ProgramFiles:'/Program Files','ProgramFiles(x86)':'/Program Files (x86)'}:{PATH:'/path tools:/other tools'};
    os.platform=()=>host;Configuration.getBuildToolPaths=()=>configured;Configuration.getUtilsPath=()=>'/sdk/tools';
}
function device() { for(const name of ['cmake','ninja','arm-none-eabi-gcc','arm-none-eabi-g++','arm-none-eabi-ar','arm-none-eabi-objcopy','arm-none-eabi-objdump','arm-none-eabi-size','arm-none-eabi-nm']) { exe(name); } }
fs.promises.stat=async filename=>{if(!files.has(filename)) {throw new Error('missing');}return{isFile:()=>true};};
fs.promises.readdir=async folder=>[...folders].filter(name=>path.dirname(name)===folder).map(name=>({name:path.basename(name),isDirectory:()=>true,isSymbolicLink:()=>false}));
cp.execFile=(filename,args,options,callback)=>{
    calls.push({filename,args,options});
    assert.strictEqual(options.windowsHide,true);assert.strictEqual(options.timeout,10000);assert(!options.shell);
    if(failures.has(filename)) { callback(new Error('cannot execute'),'','not available');return; }
    let result=overrides.get(filename+' '+args.join(' '));
    if(result===undefined) {
        if(args[0]==='-dumpmachine') {result='arm-none-eabi';}
        else if(args[0]==='-p') {result='/Library/Developer/CommandLineTools';}
        else if(args[0]==='--show-sdk-path') {result='/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk';}
        else if(args[0]==='--find') {result='/apple/bin/clang++';}
        else if(filename.endsWith('vswhere.exe')) {result='/VS';}
        else {result=path.basename(filename).startsWith('cmake')?'cmake version 3.30.5':'version 14.2.1';}
    }
    callback(null,result,'');
};
async function run() {
    for(const host of ['darwin','win32']) {
        reset(host);device();const result=await Tools.check('device');
        assert.deepStrictEqual(result.issues,[]);assert.strictEqual(result.cmake,exe('cmake'));
        const key=host==='win32'?'Path':'PATH';assert(result.env[key].startsWith('/custom tools 色/bin'));
        assert.strictEqual(process.env[key],host==='win32'?'/path tools;/other tools':'/path tools:/other tools');
        assert(!calls.some(call=>call.filename.includes('xcrun')||call.filename.includes('vswhere')));
    }
    reset('win32');device();configured=[];
    for(const name of [...files]) {files.delete(name);file(name.replace('/custom tools 色/bin','/path tools'));}
    assert.deepStrictEqual((await Tools.check('device')).issues,[],'Windows PATH uses semicolons and .exe names.');
    reset('darwin');device();files.delete(exe('arm-none-eabi-g++'));files.delete(exe('ninja'));
    let result=await Tools.check('device');assert(result.issues.some(issue=>issue.includes('g++')));assert(result.issues.some(issue=>issue.includes('Ninja')));
    reset();device();overrides.set(exe('cmake')+' --version','cmake version 3.12.0');assert((await Tools.check('device')).issues.some(issue=>issue.includes('3.13')));
    reset();device();failures.add(exe('ninja'));assert((await Tools.check('device')).issues.some(issue=>issue.includes('cannot run')));
    reset();device();overrides.set(exe('arm-none-eabi-gcc')+' -dumpmachine','aarch64-linux-gnu');assert((await Tools.check('device')).issues.some(issue=>issue.includes('must target')));
    reset();exe('cmake');exe('ninja');file('/opt/homebrew/lib/cmake/SDL3/SDL3Config.cmake');
    result=await Tools.check('simulator');assert.deepStrictEqual(result.issues,[]);assert(result.env.CMAKE_PREFIX_PATH.includes('/opt/homebrew'));
    assert(calls.some(call=>call.filename==='/usr/bin/xcrun'&&call.args[0]==='--show-sdk-path'));
    assert(!calls.some(call=>call.filename.includes('arm-none-eabi')));
    failures.add('/usr/bin/xcode-select');files.delete('/opt/homebrew/lib/cmake/SDL3/SDL3Config.cmake');
    result=await Tools.check('simulator');assert(result.issues.some(issue=>issue.includes('Apple Command Line Tools')));assert(result.issues.some(issue=>issue.includes('SDL3')));
    reset('win32');process.env.PROGRAMFILES=process.env.ProgramFiles;delete process.env.ProgramFiles;process.env['PROGRAMFILES(X86)']=process.env['ProgramFiles(x86)'];delete process.env['ProgramFiles(x86)'];file('/VS/Common7/Tools/VsDevCmd.bat');file('/Program Files (x86)/Windows Kits/10/Include/10.0/um/Windows.h');
    result=await Tools.check('simulator');assert.deepStrictEqual(result.issues,[]);assert.strictEqual(calls.length,1);assert(calls[0].filename.endsWith('vswhere.exe'));
    files.clear();assert((await Tools.check('simulator')).issues.some(issue=>issue.includes('Windows SDK')));
    reset();configured=['relative/path'];assert((await Tools.check('device')).issues.some(issue=>issue.includes('must be absolute')));
    reset();await assert.rejects(Tools.require('device'),/Install or repair/);assert.strictEqual(messages.at(-1).length,1,'Only a message: no installer button.');
    assert(calls.every(call=>call.args[0]==='--version'||call.args[0]==='-dumpmachine'));
    console.log('Prerequisite checks passed: macOS/Windows discovery, scoped PATH, toolchain completeness, versions, failures, simulator-specific dependencies and message-only guidance.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
    process.env=original.env;os.platform=original.platform;cp.execFile=original.execFile;fs.promises.stat=original.stat;fs.promises.readdir=original.readdir;
    Configuration.getBuildToolPaths=original.paths;Configuration.getUtilsPath=original.utils;
});
