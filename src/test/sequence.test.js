const assert = require('assert');
const Module = require('module');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');
const {SpriteSequences} = require('../../out/SpriteSequence');
const dialogs = {input:[], pick:[], open:[]};
const vscode = {FileType:{File:1}, window:{
	showOpenDialog:async () => dialogs.open.shift(),
	showInputBox:async options => { const value = dialogs.input.shift(); if(value !== undefined && options.validateInput) { assert.strictEqual(options.validateInput(value), undefined); } return value; },
	showQuickPick:async items => { const value = dialogs.pick.shift(); return value === undefined ? undefined : items[value]; }
}, workspace:{fs:{readDirectory:async () => [['run10.png',1],['run2.png',1],['readme.txt',1],['nested',2]]}}};
const original = Module._load;
Module._load = function(name, ...args) { return name === 'vscode' ? vscode : original.call(this, name, ...args); };
const {SequenceEditor} = require('../../out/SequenceEditor'); Module._load = original;
async function run()
{
	const bundle = ResourceBundles.create();
	const frames = SpriteSequences.createFrames(bundle, 'jump', [{source:'small.png',width:30,height:40},{source:'large.png',width:80,height:90}], 0);
	frames.forEach(frame => { frame.colorMode = 'rgb565'; frame.paletteId = null; frame.blend = 'opaque'; frame.compression = 'plain'; }); bundle.resources.push(...frames);
	assert.deepStrictEqual(ResourceBundles.validate(bundle), []);
	assert.deepStrictEqual(frames.map(frame => frame.pivot), [{x:15,y:20},{x:40,y:45}]);
	frames[1].pivot = {x:-12.5,y:100};
	assert.deepStrictEqual(ResourceBundles.validate(bundle), [], 'Pivots may lie outside an image.');
	const invalid = change => { const clone = structuredClone(bundle); change(clone); assert(ResourceBundles.validate(clone).length); };
	invalid(b => b.resources[1].sequence.index = 0);
	invalid(b => b.resources[1].sequence.name = 'other');
	invalid(b => b.resources[1].name = 'jump');
	invalid(b => b.resources[1].sequence = null);
	invalid(b => b.resources[1].frameRate = 128);
	let builds = 0, generatedSources;
	const services = {relative:uri => uri.path.replace('/project/', ''), size:async source => ({width:source.includes('10') ? 80 : 30,height:40}), palette:async palette => { builds++; generatedSources = bundle.resources.filter(frame => frame.paletteId === palette.id).map(frame => frame.source); }};
	const staticSprite = ResourceTypes.get('sprite').create('static','static_sprite','static.png',{colorMode:'rgb565'});
	bundle.resources.push(staticSprite, {...staticSprite,id:'static2',name:'another_static'});
	assert.deepStrictEqual(SpriteSequences.frames(bundle,undefined),[], 'Static sprites are never members of a new sequence.');
	const id = frames[0].sequence.id;
	await SequenceEditor.change(bundle, {action:'sequenceDuplicate',sequenceId:id,ids:[frames[0].id]}, {}, services);
	let ordered = SpriteSequences.frames(bundle,id);
	assert.strictEqual(ordered.length,3); assert.strictEqual(new Set(ordered.map(frame => frame.id)).size,3); assert.strictEqual(new Set(ordered.map(frame => frame.name)).size,3);
	assert.strictEqual(ordered[0].source,ordered[1].source); assert.notStrictEqual(ordered[0].id,ordered[1].id);
	assert.deepStrictEqual(ResourceBundles.validate(bundle), []);
	await SequenceEditor.change(bundle,{action:'sequenceUpdate',sequenceId:id,name:'jump',frames:[...ordered].reverse().map(frame => ({...frame,pivot:{x:-21,y:55}}))}, {},services);
	assert.strictEqual(SpriteSequences.frames(bundle,id)[0].id,ordered.at(-1).id);
	assert.deepStrictEqual(SpriteSequences.frames(bundle,id)[0].pivot,{x:-21,y:55});
	await SequenceEditor.change(bundle,{action:'sequenceRemove',sequenceId:id,ids:[ordered[1].id]}, {},services);
	assert.deepStrictEqual(SpriteSequences.frames(bundle,id).map(frame => frame.sequence.index),[0,1]);

	await assert.rejects(SequenceEditor.change(bundle,{action:'sequenceRemove',sequenceId:id,ids:[SpriteSequences.frames(bundle,id)[0].id]}, {},services),/only one frame left/);
	const single=structuredClone(bundle);single.resources=single.resources.filter(resource=>!resource.sequence||resource.sequence.index===0);
	assert(ResourceBundles.getBuildErrors(single).some(error=>error.includes('at least two frames')));
	const collision=structuredClone(bundle);collision.resources.push({...staticSprite,id:'alias',name:'jump_end'});
	assert(ResourceBundles.getBuildErrors(collision).some(error=>error.includes('jump_end')));
	const validation=require('../../media/resourcevalidation');
	assert(validation.name('jump_end',SpriteSequences.usedNames(bundle)));
	assert(validation.animationName('jump', ['jump_end']));
	assert.strictEqual(validation.deriveAnimationName('jump',['jump_end']),'jump_1');
	dialogs.open.push([{path:'/project/only.png'}]);
	await assert.rejects(SequenceEditor.change(bundle,{action:'sequenceImport'}, {},services),/at least two/);
	const compatibility=require('../../media/palettecompatibility');
	const legacy={name:'legacy',colors:['#12345684','#789abcff'],mappingColors:['#11223384','#778899ff'],transparentIndex:null,colorCount:2};
	compatibility.reserve(legacy);
	assert.deepStrictEqual(legacy.colors,['#00000000','#12345684','#789abcff']);
	assert.deepStrictEqual(legacy.mappingColors,['#00000000','#11223384','#778899ff']);assert.strictEqual(legacy.colorCount,3);assert.strictEqual(compatibility.issue(legacy),undefined);
	const moved={name:'moved',colors:['#ff0000ff','#00000000'],mappingColors:['#ff0000ff','#00000000'],transparentIndex:1,colorCount:2};
	compatibility.reserve(moved);assert.deepStrictEqual(moved.colors,['#00000000','#ff0000ff']);assert.strictEqual(moved.transparentIndex,0);
	const full={name:'full',colors:Array.from({length:256},(_,i)=>'#'+(i+1).toString(16).padStart(6,'0')),transparentIndex:null,colorCount:256};full.mappingColors=full.colors.slice();
	const fullBefore=JSON.stringify(full);assert.throws(()=>compatibility.reserve(full),/all 256 entries/);assert.strictEqual(JSON.stringify(full),fullBefore);
	full.colors[255]=full.colors[254];full.mappingColors[255]=full.mappingColors[254];compatibility.reserve(full);assert.strictEqual(full.colors.length,256);assert.strictEqual(full.colors[0],'#00000000');
	const before = JSON.stringify(bundle);
	dialogs.open.push(undefined);
	assert.strictEqual(await SequenceEditor.change(bundle,{action:'sequenceImport'}, {},services),false); assert.strictEqual(JSON.stringify(bundle),before);
	dialogs.open.push([{path:'/project/run10.png'},{path:'/project/run2.png'}]); dialogs.input.push('run','100','run_palette','64'); dialogs.pick.push(0,0);
	assert.strictEqual(await SequenceEditor.change(bundle,{action:'sequenceImport'}, {},services),true);
	let imported = bundle.resources.filter(frame => frame.sequence?.name === 'run');
	assert.deepStrictEqual(imported.map(frame => frame.source),['run2.png','run10.png']); assert.strictEqual(builds,1);
	assert.deepStrictEqual(generatedSources,['run2.png','run10.png']); assert.strictEqual(imported[0].frameRate,1);
	assert.deepStrictEqual(ResourceBundles.validate(bundle),[]);
	dialogs.open.push([{path:'/project/frames'}]); dialogs.input.push('walk','50'); dialogs.pick.push(2,0); // Existing palette appears between new and RGB565.
	await SequenceEditor.change(bundle,{action:'sequenceImport',folder:true}, {},services);
	imported = bundle.resources.filter(frame => frame.sequence?.name === 'walk');
	assert.deepStrictEqual(imported.map(frame => frame.source),['frames/run2.png','frames/run10.png']); assert.strictEqual(imported[0].frameRate,0); assert.strictEqual(imported[0].paletteId,null);
	assert.strictEqual(builds,1);
	dialogs.open.push([{path:'/project/frames'}]); dialogs.input.push('50'); dialogs.pick.push(2,0);
	await SequenceEditor.change(bundle,{action:'sequenceImport',sequenceId:imported[0].sequence.id,folder:true}, {},services);
	assert.strictEqual(SpriteSequences.frames(bundle,imported[0].sequence.id).length,4);
	assert.deepStrictEqual(ResourceBundles.validate(bundle),[]);
	dialogs.input.push('new_walk_palette','32');
	await SequenceEditor.change(bundle,{action:'sequenceGeneratePalette',sequenceId:imported[0].sequence.id}, {},services);
	assert.strictEqual(builds,2); assert.strictEqual(SpriteSequences.frames(bundle,imported[0].sequence.id).every(frame => frame.paletteId === bundle.resources.find(item => item.name === 'new_walk_palette').id),true);
	assert.deepStrictEqual(ResourceBundles.validate(bundle),[]);
	// Removing a mapped frame is blocked rather than leaving a dangling reference.
	const map = ResourceTypes.get('map').create('map','test_map'); map.placements = [{id:'place',spriteId:imported[0].id,side:0,x:0,y:0}]; bundle.resources.push(map);
	await assert.rejects(SequenceEditor.change(bundle,{action:'sequenceRemove',sequenceId:imported[0].sequence.id,ids:[imported[0].id]}, {},services),/referenced/);

	// The JSON schema retains sprite-mode constraints alongside the new contract.
	const Ajv=require('ajv'), schema=require('../../schemas/wowcubeapp-resources.schema.json');
	const validateSchema=new Ajv({allErrors:true}).compile(schema), schemaBundle=ResourceBundles.create();
	const schemaSprite=ResourceTypes.get('sprite').create('schema','schema_sprite','file.png',{colorMode:'rgb565'});schemaBundle.resources.push(schemaSprite);
	assert.strictEqual(validateSchema(schemaBundle),true,JSON.stringify(validateSchema.errors));
	schemaSprite.name='icon';assert.strictEqual(validateSchema(schemaBundle),true,JSON.stringify(validateSchema.errors));
	schemaSprite.name='schema_sprite';
	for(const type of ['palette','map','font','sound']) { assert.strictEqual(validateSchema({...schemaBundle,resources:[{id:'reserved',type,name:'icon'}]}),false); }
	schemaSprite.paletteId='unexpected';assert.strictEqual(validateSchema(schemaBundle),false);schemaSprite.paletteId=null;
	const schemaPalette=ResourceTypes.get('palette').create('schema_pal','schema_palette');schemaBundle.resources.push(schemaPalette);assert.strictEqual(validateSchema(schemaBundle),true);
	schemaPalette.transparentIndex=null;assert.strictEqual(validateSchema(schemaBundle),false);
	console.log('Sequence checks passed: names, distinct frames, ordering, variable-size pivots, timing, file/folder import, palette batching, cancellation and references.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
