// Optional installed-SDK renderer integration. See README for required environment paths.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const sdk=process.env.WOWCUBE_SDK_C,tests=process.env.WOWCUBE_ENGINE_TESTS,builder=process.env.WOWCUBE_RESOURCE_BUILDER;
for(const [name,value] of Object.entries({WOWCUBE_SDK_C:sdk,WOWCUBE_ENGINE_TESTS:tests,WOWCUBE_RESOURCE_BUILDER:builder}))assert(value,'Set '+name+' before running this optional integration test.');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'wowcube-simulator-render-'));
function run(file,args){const result=cp.spawnSync(file,args,{cwd:folder,encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000});assert.strictEqual(result.status,0,result.error?.message||result.stdout+result.stderr);if(result.stdout)process.stdout.write(result.stdout);}
try{
 run(process.execPath,[path.join(__dirname,'rawSimulatorFixture.js'),folder]);
 run(builder,[path.join(folder,'wowcubeapp-resources.json'),'--build',path.join(folder,'wowcubeapp-build.json')]);
 const output=path.join(folder,'render_matrix');
 run(process.env.CXX||'clang++',['-std=c++20','-DOCTSIM','-g','-fsanitize=address,undefined','-Wno-deprecated-volatile','-Wno-format','-I',path.join(sdk,'octavios/engine'),'-I',path.join(sdk,'octavios/sim/src'),'-I',tests,path.join(__dirname,'simulatorRawFormats.cpp'),'-o',output]);
 run(output,[path.join(folder,'app_raw/art/packed')]);
}finally{fs.rmSync(folder,{recursive:true,force:true});}
