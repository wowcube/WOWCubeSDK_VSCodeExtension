// Runs without an Extension Host; mocks only the VS Code API boundary.
const assert = require('assert');
const path = require('path');
const Module = require('module');

class TestUri
{
	constructor(value)
	{
		this.path = value;
		this.fsPath = value;
		this.scheme = 'file';
		this.authority = '';
	}

	toString()
	{
		return 'file://'+this.path;
	}

	static joinPath(uri, ...parts)
	{
		return new TestUri(path.posix.join(uri.path, ...parts));
	}
}

class TestFileSystemError extends Error
{
	constructor()
	{
		super('File not found');
		this.code = 'FileNotFound';
	}
}

const files = new Map();
const commands = [];
const dispose = () => ({dispose:function () {}});
let changeDocument;
let paletteNameAnswer;
let deleteAnswer = 'Delete';
const confirmations = [];
let text = JSON.stringify({schemaVersion:2, sourceFolders:[], resources:[], registries:{groups:[], types:[], tags:[]}});
const projectUri = new TestUri('/project');
const document = {
	uri:TestUri.joinPath(projectUri, 'wowcubeapp-resources.json'), version:1, isDirty:false, lineCount:1,
	getText:function () { return text; },
	save:async function () { this.isDirty = false; files.set(this.uri.path, text); return true; }
};

const vscode = {
	EventEmitter:class {},
	Uri:TestUri, FileSystemError:TestFileSystemError, Range:class {}, RelativePattern:class {},
	FileType:{File:1, Directory:2, SymbolicLink:64},
	WorkspaceEdit:class
	{
		replace(uri, range, value)
		{
			this.value = value;
		}
	},
	workspace:{
		workspaceFolders:[{uri:projectUri}],
		getWorkspaceFolder:function (uri) { return uri.path.startsWith('/project/') || uri.path === '/project' ? this.workspaceFolders[0] : undefined; },
		fs:{
			stat:async function (uri)
			{
				if(!files.has(uri.path))
				{
					throw new TestFileSystemError();
				}
				return {type:files.get(uri.path) === 'directory' ? 2 : 1, mtime:123};
			},
			writeFile:async function (uri, value) { files.set(uri.path, value.toString()); },
			readFile:async function (uri)
			{
				if(!files.has(uri.path)) { throw new TestFileSystemError(); }
				if(Buffer.isBuffer(files.get(uri.path))) { return files.get(uri.path); }
				const png = Buffer.alloc(33);
				Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
				png.writeUInt32BE(13, 8);
				png.write('IHDR', 12);
				png.writeUInt32BE(64, 16);
				png.writeUInt32BE(64, 20);
				png[24] = 8; png[25] = 6;
				return png;
			},
			readDirectory:async function (uri)
			{
				return Array.from(files.keys()).filter(name => path.posix.dirname(name) === uri.path)
					.map(name => [path.posix.basename(name), files.get(name) === 'directory' ? 2 : 1]);
			}
		},
		createFileSystemWatcher:function () { return {dispose:function () {}, onDidCreate:dispose, onDidChange:dispose, onDidDelete:dispose}; },
		onDidChangeTextDocument:function (handler) { changeDocument = handler; return dispose(); },
		onDidSaveTextDocument:dispose,
		applyEdit:async function (edit)
		{
			text = edit.value;
			document.version++;
			document.isDirty = true;
			changeDocument({document});
			return true;
		}
	},
	window:{createOutputChannel:function () { return {append:function () {}, appendLine:function () {}, show:function () {}}; },
		showInformationMessage:function () {}, showErrorMessage:function (message) { throw new Error(message); },
		showWarningMessage:async function (message) { confirmations.push(message); return deleteAnswer; },
		showInputBox:async function () { return paletteNameAnswer; },
		showOpenDialog:async function () { return [new TestUri('/project/characters'), new TestUri('/project/effects')]; }},
	commands:{executeCommand:async function (...args) { commands.push(args); }}
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain)
{
	return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain);
};
const {ResourceStudioProvider} = require('../../out/ResourceStudioProvider');
const {PaletteBuilder} = require('../../out/PaletteBuilder');
const {ResourceTypes} = require('../../out/ResourceBundle');
Module._load = originalLoad;
const generations = [];
let failGeneration = false;
let editDuringGeneration = false;
PaletteBuilder.generate = async function (sources, size, reserveTransparent)
{
	generations.push({sources, size, reserveTransparent});
	if(failGeneration)
	{
		throw new Error('Test palette builder failure');
	}
	if(editDuringGeneration)
	{
		document.version++;
	}
	return Array(Math.min(size, sources.length*2)).fill('#12345684');
};

async function run()
{
	const provider = new ResourceStudioProvider({extensionUri:new TestUri('/extension')});
	await provider.open(document.uri);
	assert.strictEqual(commands.pop()[1].path, document.uri.path);
	await provider.open(new TestUri('/project/characters/hero.png'));
	assert.ok(files.has('/project/wowcubeapp-resources.json'));
	assert.strictEqual(commands.pop()[2], ResourceStudioProvider.viewType);
	files.set('/project/characters', 'directory');
	files.set('/project/effects', 'directory');
	files.set('/project/characters/hero.png', 'image');
	files.set('/project/effects/spark.png', 'image');
	const messages = [];
	let receive;
	let closePanel;
	const panel = {
		visible:true,
		webview:{cspSource:'test:', asWebviewUri:function (uri) { return uri; },
			postMessage:async function (message) { messages.push(message); return true; },
			onDidReceiveMessage:function (handler) { receive = handler; return dispose(); }},
		onDidChangeViewState:dispose,
		onDidDispose:function (handler) { closePanel = handler; return dispose(); }
	};
	await provider.resolveCustomTextEditor(document, panel);
	try
	{
		await receive({type:'ready'});
		assert.strictEqual(messages.at(-1).selectedSource, 'characters/hero.png');
		assert.strictEqual(messages.at(-1).sources[0].path, 'characters/hero.png');
		assert.strictEqual(JSON.parse(text).resources.length, 0);
		await receive({type:'addFolder', version:document.version});
		assert.deepStrictEqual(JSON.parse(text).sourceFolders, ['characters', 'effects']);
		assert.strictEqual(messages.at(-1).sources.length, 2);
		assert.strictEqual(JSON.parse(text).resources.length, 0);

		const rgbGenerations = generations.length;
		failGeneration = true;
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'rgb_first', source:'effects/spark.png', options:{colorMode:'rgb565'}});
		const firstRgb = JSON.parse(text).resources[0];
		assert.strictEqual(firstRgb.colorMode, 'rgb565');
		assert.strictEqual(firstRgb.paletteId, null);
		assert.strictEqual(firstRgb.blend, 'opaque');
		assert.strictEqual(generations.length, rgbGenerations);
		for(const collider of [{enabled:true, x:0, y:0, width:65, height:64}, {enabled:true, x:1, y:0, width:64, height:64}, {enabled:true, x:0, y:1, width:64, height:64}])
		{
			const before = text;
			await receive({type:'change', action:'update', version:document.version, resource:{...firstRgb, collider}});
			assert.strictEqual(text, before);
			assert.match(messages.at(-1).message, /within the sprite/);
		}
		await receive({type:'change', action:'update', version:document.version, resource:{...firstRgb, collider:{enabled:true, x:0, y:0, width:64, height:64}}});
		assert.strictEqual(JSON.parse(text).resources[0].collider.width, 64);
		await receive({type:'change', action:'remove', version:document.version, id:firstRgb.id});
		failGeneration = false;

		await receive({type:'change', action:'create', version:document.version, resourceType:'palette', name:'world'});
		assert.strictEqual(JSON.parse(text).resources.length, 0);
		assert.match(messages.at(-1).message, /cannot be created independently/);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'hero', source:'characters/hero.png'});
		assert.strictEqual(JSON.parse(text).resources.length, 0);
		assert.match(messages.at(-1).message, /palette name/);
		failGeneration = true;
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'hero', source:'characters/hero.png', options:{paletteName:'world', colorCount:256}});
		assert.strictEqual(JSON.parse(text).resources.length, 0);
		assert.match(messages.at(-1).message, /builder failure/);
		failGeneration = false;
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'hero', source:'characters/hero.png', options:{paletteName:'world', colorCount:256}});
		const palette = JSON.parse(text).resources[0];
		let sprite = JSON.parse(text).resources[1];
		assert.strictEqual(sprite.paletteId, palette.id);
		assert.strictEqual(palette.colorCount, 256);
		assert.strictEqual(palette.colors.length, 2);
		assert.deepStrictEqual(palette.colors, ['#12345684', '#12345684']);
		assert.deepStrictEqual(palette.mappingColors, palette.colors);
		assert.deepStrictEqual(generations.at(-1).sources, ['/project/characters/hero.png']);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'spark', source:'effects/spark.png', options:{paletteId:palette.id}});
		const spark = JSON.parse(text).resources[2];
		assert.deepStrictEqual(generations.at(-1).sources, ['/project/characters/hero.png', '/project/effects/spark.png']);
		assert.strictEqual(generations.at(-1).size, 256);
		await receive({type:'change', action:'resizePalette', version:document.version, id:palette.id, colorCount:16});
		assert.strictEqual(JSON.parse(text).resources[0].colors.length, 4);
		assert.strictEqual(JSON.parse(text).resources[0].colorCount, 16);
		assert.strictEqual(generations.at(-1).sources.length, 2);
		let currentPalette = JSON.parse(text).resources[0];
		const generationCount = generations.length;
		currentPalette.colors[0] = '#7f7f7f7f';
		await receive({type:'change', action:'update', version:document.version, resource:currentPalette});
		assert.strictEqual(generations.length, generationCount);
		assert.strictEqual(JSON.parse(text).resources[0].colors[0], '#7b7d7b7b');
		assert.deepStrictEqual(JSON.parse(text).resources[0].mappingColors, ['#12345684', '#12345684', '#12345684', '#12345684']);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'spark_private', source:'effects/spark.png', options:{paletteName:'private_palette', colorCount:16}});
		const privatePalette = JSON.parse(text).resources[3];
		const privateSprite = JSON.parse(text).resources[4];
		assert.strictEqual(privatePalette.colors.length, 2);
		assert.strictEqual(privateSprite.paletteId, privatePalette.id);
		assert.deepStrictEqual(generations.at(-1).sources, ['/project/effects/spark.png']);
		await receive({type:'change', action:'remove', version:document.version, id:privateSprite.id});
		await receive({type:'change', action:'remove', version:document.version, id:privatePalette.id});
		const beforeGeneration = text;
		failGeneration = true;
		await receive({type:'change', action:'generatePalette', version:document.version, id:spark.id});
		assert.strictEqual(text, beforeGeneration);
		failGeneration = false;
		await receive({type:'change', action:'generatePalette', version:document.version, id:spark.id});
		const generatedPalette = JSON.parse(text).resources.find(item => item.name === 'spark_palette');
		assert.strictEqual(generatedPalette.colorCount, 256);
		assert.strictEqual(JSON.parse(text).resources.find(item => item.id === spark.id).paletteId, generatedPalette.id);
		assert.strictEqual(JSON.parse(text).resources.find(item => item.id === sprite.id).paletteId, palette.id);
		assert.deepStrictEqual(generations.at(-1).sources, ['/project/effects/spark.png']);
		const beforeCancel = text;
		const versionBeforeCancel = document.version;
		await receive({type:'change', action:'generatePalette', version:document.version, id:spark.id});
		assert.strictEqual(text, beforeCancel);
		assert.strictEqual(document.version, versionBeforeCancel);
		paletteNameAnswer = 'another_spark_palette';
		await receive({type:'change', action:'generatePalette', version:document.version, id:spark.id});
		const anotherPalette = JSON.parse(text).resources.find(item => item.name === paletteNameAnswer);
		await receive({type:'change', action:'update', version:document.version, resource:spark});
		await receive({type:'change', action:'remove', version:document.version, id:generatedPalette.id});
		await receive({type:'change', action:'remove', version:document.version, id:anotherPalette.id});
		const beforeCountChange = text;
		await receive({type:'change', action:'update', version:document.version, resource:{...currentPalette, colors:['#000000']}});
		assert.strictEqual(text, beforeCountChange);
		assert.match(messages.at(-1).message, /regenerate/);
		editDuringGeneration = true;
		await receive({type:'change', action:'resizePalette', version:document.version, id:palette.id, colorCount:32});
		editDuringGeneration = false;
		assert.strictEqual(text, beforeCountChange);
		assert.match(messages.at(-1).message, /while generating/);
		await receive({type:'change', action:'remove', version:document.version, id:spark.id});
		assert.strictEqual(document.isDirty, true);
		const before = text;
		await receive({type:'change', action:'remove', id:palette.id, version:document.version});
		assert.strictEqual(text, before);
		assert.match(messages.at(-1).message, /Reassign references/);
		await receive({type:'change', action:'update', version:document.version - 1, resource:{...sprite, name:'stale'}});
		assert.strictEqual(text, before);
		assert.match(messages.at(-1).message, /another editor/);
		await receive({type:'change', action:'update', version:document.version, resource:{...sprite, name:palette.name}});
		assert.strictEqual(text, before);
		assert.match(messages.at(-1).message, /unique/);

		sprite.pivot = {x:10, y:20.5};
		sprite.customProperty = {preserved:true};
		await receive({type:'change', action:'update', version:document.version, resource:sprite});
		assert.deepStrictEqual(JSON.parse(text).resources[1].pivot, sprite.pivot);
		await receive({type:'save'});
		assert.strictEqual(document.isDirty, false);
		assert.strictEqual(files.get(document.uri.path), text);

		files.delete('/project/characters/hero.png');
		await receive({type:'refresh'});
		assert.strictEqual(messages.at(-1).sources.find(source => source.path === sprite.source).missing, true);
		assert.strictEqual(JSON.parse(text).resources.length, 2);
		await receive({type:'change', action:'removeFolder', version:document.version, folder:'characters'});
		assert.strictEqual(JSON.parse(text).resources.length, 2);
		sprite = JSON.parse(text).resources[1];
		sprite.paletteId = null;
		const beforeUnassign = text;
		await receive({type:'change', action:'update', version:document.version, resource:sprite});
		assert.strictEqual(text, beforeUnassign);
		assert.match(messages.at(-1).message, /Choose a palette/);
		await receive({type:'change', action:'resizePalette', version:document.version, id:palette.id, colorCount:16});
		assert.strictEqual(text, beforeUnassign);
		assert.match(messages.at(-1).message, /source is missing/);
		await receive({type:'change', action:'remove', version:document.version, id:sprite.id});
		await receive({type:'change', action:'remove', version:document.version, id:palette.id});
		assert.strictEqual(JSON.parse(text).resources.length, 0);

		const beforeRgb = text;
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'missing_rgb', source:'missing.png', options:{colorMode:'rgb565'}});
		assert.strictEqual(text, beforeRgb);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'rgb', source:'effects/spark.png', options:{colorMode:'rgb565'}});
		let rgb = JSON.parse(text).resources[0];
		paletteNameAnswer = 'props';
		await receive({type:'change', action:'addClassification', version:document.version, id:rgb.id, registry:'groups'});
		assert.deepStrictEqual(JSON.parse(text).registries.groups, ['props']);
		assert.strictEqual(JSON.parse(text).resources[0].group, 'props');
		paletteNameAnswer = 'wood';
		await receive({type:'change', action:'addClassification', version:document.version, id:rgb.id, registry:'types'});
		assert.strictEqual(JSON.parse(text).resources[0].objectType, 'wood');
		paletteNameAnswer = 'breakable';
		await receive({type:'change', action:'addClassification', version:document.version, id:rgb.id, registry:'tags'});
		assert.deepStrictEqual(JSON.parse(text).resources[0].tags, ['breakable']);
		const beforeRegistryCancel = text;
		paletteNameAnswer = undefined;
		await receive({type:'change', action:'addClassification', version:document.version, id:rgb.id, registry:'tags'});
		assert.strictEqual(text, beforeRegistryCancel);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'companion', source:'effects/spark.png', options:{colorMode:'rgb565'}});
		let companion = JSON.parse(text).resources.find(item => item.name === 'companion');
		for(const [registry, name] of [['groups', 'effects'], ['types', 'metal'], ['tags', 'solid']])
		{
			paletteNameAnswer = name;
			await receive({type:'change', action:'addClassification', version:document.version, id:companion.id, registry});
		}
		companion = {...JSON.parse(text).resources.find(item => item.id === companion.id), group:'props', objectType:'wood', tags:['breakable', 'solid']};
		await receive({type:'change', action:'update', version:document.version, resource:companion});
		const beforeDeleteCancel = text;
		const versionBeforeDeleteCancel = document.version;
		deleteAnswer = undefined;
		await receive({type:'change', action:'deleteClassification', version:document.version, registry:'groups', name:'props'});
		assert.strictEqual(text, beforeDeleteCancel);
		assert.strictEqual(document.version, versionBeforeDeleteCancel);
		deleteAnswer = 'Delete';
		for(const [registry, name] of [['groups', 'props'], ['types', 'wood'], ['tags', 'breakable']])
		{
			const beforeDeleteVersion = document.version;
			await receive({type:'change', action:'deleteClassification', version:document.version, registry, name});
			assert.strictEqual(document.version, beforeDeleteVersion + 1);
		}
		assert.ok(confirmations.some(message => message.includes('GROUP_effects: 2 → 1')));
		assert.ok(confirmations.some(message => message.includes('TYPE_metal: 2 → 1')));
		assert.ok(confirmations.some(message => message.includes('TAG_solid: 2 → 1 (bit 1 → 0)')));
		assert.deepStrictEqual(JSON.parse(text).registries, {groups:['effects'], types:['metal'], tags:['solid']});
		for(const item of JSON.parse(text).resources)
		{
			assert.strictEqual(item.group, null);
			assert.strictEqual(item.objectType, null);
			assert.ok(!item.tags.includes('breakable'));
		}
		assert.deepStrictEqual(JSON.parse(text).resources.find(item => item.id === companion.id).tags, ['solid']);
		await receive({type:'change', action:'remove', version:document.version, id:companion.id});
		const beforeBadName = text;
		await receive({type:'change', action:'update', version:document.version, resource:{...JSON.parse(text).resources[0], name:'icon'}});
		assert.strictEqual(text, beforeBadName);
		assert.match(messages.at(-1).message, /V-003/);
		await receive({type:'change', action:'update', version:document.version, resource:{...JSON.parse(text).resources[0], frameRate:128}});
		assert.strictEqual(text, beforeBadName);
		assert.match(messages.at(-1).message, /V-010/);
		const oversized = Buffer.from(await vscode.workspace.fs.readFile(new TestUri('/project/effects/spark.png')));
		oversized.writeUInt32BE(241, 16);
		files.set('/project/effects/large.png', oversized);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'large', source:'effects/large.png', options:{colorMode:'rgb565'}});
		assert.strictEqual(text, beforeBadName);
		assert.match(messages.at(-1).message, /V-007/);
		files.set('/project/effects/bad.png', Buffer.alloc(33));
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'bad', source:'effects/bad.png', options:{colorMode:'rgb565'}});
		assert.strictEqual(text, beforeBadName);
		assert.match(messages.at(-1).message, /V-006/);
		rgb = {...JSON.parse(text).resources[0], dither:true};
		const beforeRgbUpdate = generations.length;
		await receive({type:'change', action:'update', version:document.version, resource:rgb});
		assert.strictEqual(generations.length, beforeRgbUpdate);
		rgb = {...JSON.parse(text).resources[0], compression:'softkey', softkey:{key:'#ff00ff', threshold:1}};
		await receive({type:'change', action:'update', version:document.version, resource:rgb});
		assert.deepStrictEqual(JSON.parse(text).resources[0].softkey, {key:'#ff00ff', threshold:1});
		const beforeBadSoftkey = text;
		await receive({type:'change', action:'update', version:document.version, resource:{...rgb, softkey:{key:'magenta', threshold:1}}});
		assert.strictEqual(text, beforeBadSoftkey);
		assert.match(messages.at(-1).message, /V-020/);
		await receive({type:'change', action:'update', version:document.version, resource:{...rgb, collider:{enabled:false, x:10, y:10, width:20, height:20}}});
		assert.deepStrictEqual(JSON.parse(text).resources[0].collider, {enabled:false, x:0, y:0, width:0, height:0});
		await receive({type:'change', action:'generatePalette', version:document.version, id:rgb.id});
		const indexedRgb = JSON.parse(text).resources.find(item => item.id === rgb.id);
		assert.strictEqual(indexedRgb.colorMode, 'palette');
		assert.strictEqual(indexedRgb.dither, false);
		assert.strictEqual(indexedRgb.softkey, null);
		assert.ok(indexedRgb.paletteId);
		const countBeforeSwitch = generations.length;
		await receive({type:'change', action:'update', version:document.version, resource:{...indexedRgb, paletteId:null, colorMode:'rgb565', blend:'opaque', compression:'plain'}});
		assert.strictEqual(generations.length, countBeforeSwitch);
		assert.strictEqual(JSON.parse(text).resources.find(item => item.id === rgb.id).paletteId, null);
		await receive({type:'change', action:'remove', version:document.version, id:indexedRgb.paletteId});
		await receive({type:'change', action:'remove', version:document.version, id:rgb.id});

		const fullBundle = {schemaVersion:2, sourceFolders:[], registries:{groups:[], types:[], tags:[]}, resources:Array.from({length:64}, (_, index) => ResourceTypes.get('palette').create('p'+index, 'p'+index))};
		text = JSON.stringify(fullBundle);
		document.version++;
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'rgb_at_limit', source:'effects/spark.png', options:{colorMode:'rgb565'}});
		assert.strictEqual(JSON.parse(text).resources.length, 65);
		const rgbAtLimit = JSON.parse(text).resources.at(-1);
		const beforePaletteLimit = text;
		const generationsAtLimit = generations.length;
		await receive({type:'change', action:'generatePalette', version:document.version, id:rgbAtLimit.id});
		assert.strictEqual(text, beforePaletteLimit);
		assert.strictEqual(generations.length, generationsAtLimit);
		assert.match(messages.at(-1).message, /V-016.*64/);
		await receive({type:'change', action:'create', version:document.version, resourceType:'sprite', name:'over_limit', source:'effects/spark.png', options:{paletteName:'over_limit_palette', colorCount:33}});
		assert.strictEqual(text, beforePaletteLimit);
		assert.strictEqual(generations.length, generationsAtLimit);
		assert.match(messages.at(-1).message, /V-016.*64/);

		text = '{broken';
		await receive({type:'refresh'});
		assert.strictEqual(messages.at(-1).type, 'invalid');
		assert.strictEqual(text, '{broken');
		console.log('Resource Studio provider checks passed: automatic/shared palettes, regeneration, atomic failures, document edits/save, folders, references, stale edits, and invalid JSON.');
	}
	finally
	{
		closePanel();
	}
}

run().catch(error =>
{
	console.error(error);
	process.exitCode = 1;
});
