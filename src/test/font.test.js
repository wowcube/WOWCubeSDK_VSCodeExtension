const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const path = require('path');
const {fontFixture,pngHeader} = require('./fontFixture');
const {parseBitmapFont} = require('../../out/BitmapFont');
const {ResourceBundles,ResourceTypes} = require('../../out/ResourceBundle');
const validation = require('../../media/resourcevalidation');
const dialogs = {open:[],input:[],pick:[]}, files = new Map([['/project/fonts/demo.fnt',fontFixture()],['/project/fonts/atlas.png',pngHeader()]]);
const vscode = {Uri:{joinPath:(base,...parts) => ({path:path.posix.join(base.path,...parts)})},workspace:{fs:{readFile:async uri => { if(!files.has(uri.path)) { throw new Error('File missing: '+uri.path); } return files.get(uri.path); }}},window:{
	showOpenDialog:async () => dialogs.open.shift(), showInputBox:async options => { const value = dialogs.input.shift(); if(value !== undefined) { assert.strictEqual(options.validateInput?.(value),undefined); } return value; }, showQuickPick:async choices => { const index = dialogs.pick.shift(); return choices[index]; }
}};
const original = Module._load; Module._load = function(name,...args) { return name === 'vscode' ? vscode : original.call(this,name,...args); }; const {FontEditor} = require('../../out/FontEditor'); Module._load = original;
async function run()
{
	const parsed = parseBitmapFont(fontFixture()); assert.strictEqual(parsed.page,'atlas.png'); assert.strictEqual(parsed.glyphs[0].xOffset,-1); assert.strictEqual(parsed.glyphs.length,4);
	assert.throws(() => parseBitmapFont(Buffer.from('invalid')),/binary BMFont/);
	assert.throws(() => parseBitmapFont(fontFixture().subarray(0,-1)),/truncated/);
	assert.throws(() => parseBitmapFont(fontFixture([65])),/must contain/);
	assert.throws(() => parseBitmapFont(fontFixture([110,110])),/Duplicate/);
	assert.deepStrictEqual(parseBitmapFont(fontFixture([110,1000])).ignored,[1000]);
	const bad = fontFixture(); bad.writeUInt16LE(500,bad.length - 20 + 4); assert.throws(() => parseBitmapFont(bad),/atlas bounds/);
	const bundle = ResourceBundles.create(), project = {path:'/project'}, relative = uri => uri.path.slice('/project/'.length); let generations = 0;
	const change = message => FontEditor.change(bundle,message,project,relative,async () => { generations++; });
	dialogs.open.push([{path:'/project/fonts/demo.fnt'}]); dialogs.input.push('font_1','font_1_palette','32'); dialogs.pick.push(0);
	assert.strictEqual(await change({action:'fontImport'}),true); assert.strictEqual(generations,1);
	const font = bundle.resources.find(item => item.type === 'font'); assert.strictEqual(font.atlas,'fonts/atlas.png'); assert.strictEqual(font.slot,1); assert.strictEqual(font.fullsize,true); assert.strictEqual((await FontEditor.read(project,font)).glyphs.length,4);
	assert.deepStrictEqual(ResourceBundles.validate(bundle),[]); assert.deepStrictEqual(ResourceBundles.getBuildErrors(bundle),[]);
	const invalid = mutate => { const b = structuredClone(bundle); mutate(b); assert(ResourceBundles.validate(b).length); };
	invalid(b => b.resources.find(r => r.type === 'font').slot = 0);
	invalid(b => b.resources.push({...font,id:'second',name:'second'}));
	invalid(b => b.resources.find(r => r.type === 'font').atlas = '../atlas.png');
	invalid(b => b.resources.find(r => r.type === 'font').paletteId = 'missing');
	invalid(b => b.resources.push(ResourceTypes.get('sprite').create('s','font_1_00065','a.png',{paletteId:font.paletteId})));
	invalid(b => { const sprite = ResourceTypes.get('sprite').create('s','opaque','a.png',{paletteId:font.paletteId}); sprite.blend='opaque'; b.resources.push(sprite); });
	assert(validation.name('font_1_00065')); assert.strictEqual(validation.deriveName('font_1_00065'),'font_1_00065_1');
	assert.deepStrictEqual(ResourceBundles.getDependents(bundle,font.paletteId).map(r => r.id),[font.id]);
	files.set('/project/fonts/atlas.png',pngHeader(64,64)); await assert.rejects(FontEditor.read(project,font),/dimensions/); files.set('/project/fonts/atlas.png',pngHeader());
	// The embedded page can differ from the .fnt basename; source folders are irrelevant.
	files.set('/project/fonts/demo.fnt',fontFixture([32,65,110],'different.png')); files.set('/project/fonts/different.png',pngHeader());
	dialogs.open.push([{path:'/project/fonts/demo.fnt'}]); dialogs.input.push('font_2'); dialogs.pick.push(1);
	assert.strictEqual(await change({action:'fontImport'}),true); assert.strictEqual(bundle.resources.find(r => r.slot === 2).atlas,'fonts/different.png'); assert.strictEqual(generations,2);
	const before = JSON.stringify(bundle); dialogs.open.push(undefined); assert.strictEqual(await change({action:'fontImport'}),false); assert.strictEqual(JSON.stringify(bundle),before);
	// Real sample files are optional; no dependency on a developer's test project.
	if(process.env.WOWCUBE_FONT_SAMPLES)
	{
		for(const name of ['font_1','font_2','font_3'])
		{
			const file = path.join(process.env.WOWCUBE_FONT_SAMPLES,name+'.fnt'), font = parseBitmapFont(fs.readFileSync(file)); assert.strictEqual(font.glyphs.length,95);
			const atlas = path.join(path.dirname(file),font.page); assert(fs.existsSync(atlas));
			files.set(file,fs.readFileSync(file)); files.set(atlas,fs.readFileSync(atlas));
			assert.strictEqual((await FontEditor.read({path:path.dirname(file)},{source:path.basename(file),atlas:font.page})).glyphs.length,95);
			if(process.env.WOWCUBE_PALETTE_BUILDER)
			{
				const folder = fs.mkdtempSync(path.join(require('os').tmpdir(),'wowcube-font-palette-'));
				try
				{
					const output = path.join(folder,'palette.json');
					require('child_process').execFileSync(process.env.WOWCUBE_PALETTE_BUILDER,['-n','32','-o',output,'-t',atlas],{stdio:'pipe'});
					const colors = JSON.parse(fs.readFileSync(output,'utf8')).colors;
					assert.strictEqual(colors[0],'#00000000'); assert(colors.length <= 32); assert(colors.some(c => c.length === 9 && parseInt(c.slice(7),16) > 0 && parseInt(c.slice(7),16) < 255));
				}
				finally { fs.rmSync(folder,{recursive:true,force:true}); }
			}
		}
	}
	console.log('Font checks passed: binary parsing, names, slots, atlas resolution/validation, alpha sharing, atomic cancellation, palette generation and compiler-ready font records.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
