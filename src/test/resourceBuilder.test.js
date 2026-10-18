// Resource build caching, task ordering, failures, and optional installed-tool integration.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const {EventEmitter} = require('events');
const Module = require('module');

let logged = '';
const channel = {append:function (value) { logged += value; }, appendLine:function (value) { logged += value+'\n'; }, clear:function () { logged = ''; }, show:function () {}};
class VSCodeEmitter
{
	constructor() { this.listeners = new Set(); this.event = handler => { this.listeners.add(handler); return {dispose:() => this.listeners.delete(handler)}; }; }
	fire(value) { for(const handler of this.listeners) { handler(value); } }
}
const data = new Map();
let saveHandler;
const saveErrors = [];
const workspaceState = {get:key => data.get(key), update:async (key, value) => data.set(key, value)};
const vscode = {
	EventEmitter:VSCodeEmitter, window:{createOutputChannel:() => channel, showErrorMessage:message => saveErrors.push(message)},
	workspace:{textDocuments:[], onDidSaveTextDocument:handler => { saveHandler = handler; return {dispose:function () {}}; }},
	Uri:{file:value => ({scheme:'file', fsPath:value, toString:() => 'file://'+value})}, TaskScope:{Workspace:1},
	Task:class { constructor(definition, scope, name, source, execution) { Object.assign(this, {definition, execution}); } },
	CustomExecution:class { constructor(callback) { this.callback = callback; } }
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain)
{
	if(name === 'vscode') { return vscode; }
	if(parent?.filename.endsWith('/out/WOWCubeBuildTaskProvider.js') && ['./Project', './Providers', './Script', './NameBeautifier'].includes(name)) { return {}; }
	return originalLoad.call(this, name, parent, isMain);
};
const {Configuration} = require('../../out/Configuration');
const {ResourceBuilder} = require('../../out/ResourceBuilder');
const {ResourceStudioProvider} = require('../../out/ResourceStudioProvider');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');
const {WOWCubeBuildTaskProvider} = require('../../out/WOWCubeBuildTaskProvider');
Module._load = originalLoad;

async function runTask(workspace, target)
{
	const tasks = await new WOWCubeBuildTaskProvider(workspace).provideTasks();
	const task = tasks.find(item => item.definition.target === target);
	const terminal = await task.execution.callback();
	const exits = [];
	await new Promise((resolve, reject) =>
	{
		const timeout = setTimeout(() => reject(new Error('Build task did not finish.')), 3000);
		const listener = terminal.onDidClose(code =>
		{
			exits.push(code);
			clearTimeout(timeout);
			setImmediate(() => { listener.dispose(); resolve(); });
		});
		terminal.open();
	});
	assert.strictEqual(exits.length, 1, 'A task must close exactly once.');
	return exits[0];
}

async function run()
{
	const fixture = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wowcube-resource-build-'));
	const workspace = path.join(fixture, 'project with spaces 色');
	const tools = path.join(fixture, 'SDK tools');
	const resources = path.join(workspace, 'wowcubeapp-resources.json');
	const buildPath = path.join(workspace, 'wowcubeapp-build.json');
	const header = path.join(workspace, 'app', 'src', 'resource_ids.h');
	const original = {flushEdits:ResourceStudioProvider.flushEdits, spawn:cp.spawn, exec:cp.exec, platform:os.platform, context:Configuration.context,
		utils:Configuration.getUtilsPath, sdk:Configuration.getWOWSDKPath, version:Configuration.getCurrentVersion};
	const calls = [];
	const events = [];
	let failTool;
	let failLaunch = false;
	let beforeResourceClose;
	let revision = 0;
	async function changeJson() { await fs.promises.writeFile(resources, JSON.stringify({...ResourceBundles.create(), revision:++revision})); }
	try
	{
		await fs.promises.mkdir(path.dirname(header), {recursive:true});
		await fs.promises.mkdir(tools);
		for(const name of ['resource-builder', 'resource-builder.exe']) { await fs.promises.writeFile(path.join(tools, name), 'test executable'); }
		await fs.promises.writeFile(buildPath, JSON.stringify({appFolder:'app', idsFile:'resource_ids.h'}));
		await changeJson();
		Configuration.context = {workspaceState};
		Configuration.getUtilsPath = () => tools;
		Configuration.getWOWSDKPath = () => fixture;
		Configuration.getCurrentVersion = () => 'test';
		for(const [platform, expected] of [['darwin', 'resource-builder'], ['linux', 'resource-builder'], ['win32', 'resource-builder.exe'], ['unknown', 'resource-builder']])
		{
			os.platform = () => platform;
			assert.strictEqual(Configuration.getResourceBuilder(), expected);
		}
		os.platform = () => 'darwin';
		cp.spawn = function (file, args, options)
		{
			const child = new EventEmitter();
			child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
			const name = path.basename(file);
			calls.push({file, args, options}); events.push('start:'+name);
			setImmediate(async () =>
			{
				try
				{
					if(name.startsWith('resource-builder'))
					{
						assert.deepStrictEqual(args, [resources, '--build', buildPath]);
						assert.strictEqual(options.cwd, workspace);
						assert.strictEqual(options.windowsHide, true);
						if(beforeResourceClose) { await beforeResourceClose(); }
						if(failLaunch) { throw new Error('Tool launch failed'); }
						if(failTool !== name) { await fs.promises.writeFile(header, 'generated resource IDs'); }
					}
					else { assert.strictEqual(await fs.promises.readFile(header, 'utf8'), 'generated resource IDs'); }
					child.stdout.emit('data', Buffer.from('tool output\n'));
					child.stderr.emit('data', Buffer.from('tool warning\n'));
					events.push('close:'+name);
					child.emit('close', failTool === name ? 1 : 0);
				}
				catch(error) { child.emit('error', error); child.emit('close', 1); }
			});
			return child;
		};
		cp.exec = function (command, options) { return cp.spawn('cmd.exe', [command], options); };

		assert.strictEqual(await runTask(workspace, 'resources'), 0);
		assert.strictEqual(calls.length, 1);
		assert.match(logged, /tool output/); assert.match(logged, /tool warning/);
		assert.strictEqual(data.size, 1);
		assert.strictEqual(await runTask(workspace, 'resources'), 0);
		assert.strictEqual(calls.length, 1);
		await fs.promises.utimes(resources, new Date(), new Date());
		await fs.promises.writeFile(path.join(workspace, 'source.png'), 'changed image');
		await ResourceBuilder.build(workspace);
		assert.strictEqual(calls.length, 1, 'Timestamps and source-only edits must not rebuild resources.');
		delete require.cache[require.resolve('../../out/ResourceBuilder')];
		Module._load = function (name, parent, isMain) { return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain); };
		const reloaded = require('../../out/ResourceBuilder').ResourceBuilder;
		Module._load = originalLoad;
		await reloaded.build(workspace);
		assert.strictEqual(calls.length, 1, 'The successful hash must survive a module reload.');

		// Flush a focused map rename before hashing or saving the resource document.
		let focusedRename = true;
		ResourceStudioProvider.flushEdits = async filename =>
		{
			assert.strictEqual(filename, resources);
			if(!focusedRename) { return; }
			focusedRename = false;
			const bundle = ResourceBundles.create();
			bundle.resources.push(ResourceTypes.get('map').create('map', 'renamed_map'));
			await fs.promises.writeFile(resources, JSON.stringify(bundle));
		};
		const beforeRename = calls.length;
		await ResourceBuilder.build(workspace);
		assert.strictEqual(calls.length, beforeRename + 1, 'A focused map rename must trigger resource compilation.');
		await ResourceBuilder.build(workspace);
		assert.strictEqual(calls.length, beforeRename + 1, 'An unchanged map must still reuse the successful hash.');
		ResourceStudioProvider.flushEdits = async () => { throw new Error('Invalid map name'); };
		await assert.rejects(() => ResourceBuilder.build(workspace), /Invalid map name/);
		assert.strictEqual(calls.length, beforeRename + 1, 'Failed editor commits must stop the build.');
		ResourceStudioProvider.flushEdits = original.flushEdits;

		await changeJson(); calls.length = 0; events.length = 0;
		assert.strictEqual(await runTask(workspace, 'emulator'), 0);
		assert.deepStrictEqual(events, ['start:resource-builder', 'close:resource-builder', 'start:bash', 'close:bash']);
		assert.strictEqual(calls[1].args[1], path.join(workspace, 'app'));
		assert.match(logged, /resource-builder/);
		calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 0);
		assert.deepStrictEqual(calls.map(call => path.basename(call.file)), ['cmake', 'cmake', 'oct-builder']);
		assert.deepStrictEqual(calls[2].args, [path.join(workspace, 'app'), 'app', '--manifest', buildPath]);
		await changeJson(); calls.length = 0; events.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 0);
		assert.deepStrictEqual(events, ['start:resource-builder', 'close:resource-builder', 'start:cmake', 'close:cmake', 'start:cmake', 'close:cmake', 'start:oct-builder', 'close:oct-builder']);

		for(const target of ['resources', 'emulator', 'device'])
		{
			await changeJson(); calls.length = 0;
			const previousHash = [...data.values()][0];
			failTool = 'resource-builder';
			assert.strictEqual(await runTask(workspace, target), 1);
			assert.strictEqual(calls.length, 1, 'Compilation must stop when resource generation fails.');
			assert.strictEqual([...data.values()][0], previousHash);
			failTool = undefined;
			assert.strictEqual(await runTask(workspace, target), 0);
		}
		await changeJson(); calls.length = 0; failLaunch = true;
		assert.strictEqual(await runTask(workspace, 'emulator'), 1);
		assert.strictEqual(calls.length, 1);
		failLaunch = false;
		for(const tool of ['cmake', 'oct-builder'])
		{
			calls.length = 0; failTool = tool;
			assert.strictEqual(await runTask(workspace, 'device'), 1);
			assert.strictEqual(path.basename(calls.at(-1).file), tool);
			failTool = undefined;
		}

		await changeJson(); calls.length = 0;
		await Promise.all([ResourceBuilder.build(workspace), ResourceBuilder.build(workspace)]);
		assert.strictEqual(calls.length, 1, 'Concurrent requests must share the pending resource build.');
		const document = {uri:vscode.Uri.file(resources), isDirty:true, save:async function () { await changeJson(); this.isDirty = false; return true; }};
		vscode.workspace.textDocuments = [document]; calls.length = 0;
		await ResourceBuilder.build(workspace);
		assert.strictEqual(calls.length, 1, 'Save pending JSON before comparing the hash.');
		document.isDirty = true; document.save = async () => false; calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'emulator'), 1);
		assert.strictEqual(calls.length, 0);
		vscode.workspace.textDocuments = [];
		await changeJson(); calls.length = 0;
		const previousHash = [...data.values()][0];
		beforeResourceClose = changeJson;
		assert.strictEqual(await runTask(workspace, 'device'), 1);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual([...data.values()][0], previousHash);
		beforeResourceClose = undefined;
		assert.strictEqual(await runTask(workspace, 'device'), 0);

		await changeJson(); calls.length = 0;
		Configuration.getUtilsPath = () => path.join(fixture, 'missing tools');
		assert.strictEqual(await runTask(workspace, 'device'), 1);
		assert.strictEqual(calls.length, 0);
		Configuration.getUtilsPath = () => tools;
		os.platform = () => 'win32';
		assert.strictEqual(await runTask(workspace, 'emulator'), 0);
		assert.strictEqual(path.basename(calls[0].file), 'resource-builder.exe');
		assert.strictEqual(calls[1].file, 'cmd.exe');
		const empty = path.join(fixture, 'no bundle'); await fs.promises.mkdir(empty);
		calls.length = 0; await ResourceBuilder.build(empty);
		assert.strictEqual(calls.length, 0);

		const subscriptions = [];
		ResourceBuilder.register({subscriptions});
		assert.strictEqual(subscriptions.length, 1);
		const savedDocument = {uri:vscode.Uri.file(resources), isDirty:false};
		await changeJson(); calls.length = 0;
		await saveHandler(savedDocument);
		assert.strictEqual(calls.length, 1, 'Saving JSON must refresh resources and the IDs header.');
		assert.strictEqual(await fs.promises.readFile(header, 'utf8'), 'generated resource IDs');
		await saveHandler(savedDocument);
		assert.strictEqual(calls.length, 1, 'An unchanged save must not duplicate compilation.');
		await saveHandler({uri:vscode.Uri.file(buildPath)});
		await saveHandler({uri:{scheme:'untitled', fsPath:resources}});
		assert.strictEqual(calls.length, 1);
		// F5 saves the manifest before its prelaunch task: the save builds resources,
		// then the simulator task reuses that exact successful JSON revision.
		const mapBundle = ResourceBundles.create();
		const mapSprite = ResourceTypes.get('sprite').create('map_sprite', 'hero', 'hero.png', {colorMode:'rgb565'});
		const savedMap = ResourceTypes.get('map').create('map', 'level_before');
		savedMap.placements = [{id:'placed',spriteId:mapSprite.id,side:1,x:138,y:138}];
		mapBundle.resources.push(mapSprite, savedMap);
		await fs.promises.writeFile(resources, JSON.stringify(mapBundle));
		await saveHandler(savedDocument);
		savedMap.name = 'level_after'; savedMap.placements[0].x = -104.5; savedMap.placements[0].y = -131.5;
		await fs.promises.writeFile(resources, JSON.stringify(mapBundle));
		calls.length = 0; events.length = 0; logged = '';
		const onSave = saveHandler(savedDocument);
		await new Promise(resolve => setImmediate(resolve));
		assert.strictEqual(await runTask(workspace, 'emulator'), 0);
		await onSave;
		assert.deepStrictEqual(calls.map(call => path.basename(call.file)), ['resource-builder.exe','cmd.exe']);
		assert.ok(events.indexOf('close:resource-builder.exe') < events.indexOf('start:cmd.exe'));
		// A subsequent F5 launch must use the map just compiled, without another resource run.
		assert.strictEqual(await runTask(workspace, 'emulator'), 0);
		assert.strictEqual(calls.filter(call => path.basename(call.file)==='resource-builder.exe').length, 1);
		assert.match(logged, /Resource file saved\. Building resources/);
		assert.match(logged, /Resources are up to date\./);

		await changeJson(); calls.length = 0;
		let followUp;
		beforeResourceClose = async () =>
		{
			beforeResourceClose = undefined;
			await changeJson();
			followUp = saveHandler(savedDocument);
		};
		await assert.rejects(ResourceBuilder.build(workspace), /changed during/);
		await followUp;
		assert.strictEqual(calls.length, 2, 'A save during compilation must build the latest JSON afterward.');
		const dirtyDocument = {uri:vscode.Uri.file(resources), isDirty:true, save:async function ()
		{
			await changeJson(); this.isDirty = false;
			followUp = saveHandler(this);
			return true;
		}};
		vscode.workspace.textDocuments = [dirtyDocument]; calls.length = 0;
		await ResourceBuilder.build(workspace); await followUp;
		assert.strictEqual(calls.length, 1, 'Saving before an app build must not recurse or duplicate compilation.');
		vscode.workspace.textDocuments = [];
		await changeJson(); failTool = 'resource-builder.exe';
		await saveHandler(savedDocument);
		assert.match(saveErrors.at(-1), /Resource compilation failed/);
		failTool = undefined;
		await saveHandler(savedDocument);

		if(process.env.WOWCUBE_RESOURCE_BUILDER)
		{
			ResourceStudioProvider.flushEdits = original.flushEdits;
			cp.spawn = original.spawn; cp.exec = original.exec; os.platform = original.platform;
			Configuration.getUtilsPath = () => path.dirname(process.env.WOWCUBE_RESOURCE_BUILDER);
			const bundle = ResourceBundles.create();
			const palette = ResourceTypes.get('palette').create('palette', 'hero_palette');
			palette.colors = ['#00000000', '#7b7d7b7b']; palette.mappingColors = palette.colors.slice(); palette.transparentIndex = 0;
			const sprite = ResourceTypes.get('sprite').create('sprite', 'hero', 'hero.png', {paletteId:palette.id});
			bundle.resources.push(palette, sprite);
			await fs.promises.writeFile(resources, JSON.stringify(bundle));
			await fs.promises.writeFile(path.join(workspace, 'hero.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGOoBwIABPsB/YuSj8gAAAAASUVORK5CYII=', 'base64'));
			await ResourceBuilder.build(workspace);
			for(const output of ['app/index.bin', 'app/art/packed/hero.raw', 'app/art/packed/hero_palette.pal', 'app/art/packed/zero.raw', 'app/src/resource_ids.h'])
			{
				assert.ok((await fs.promises.stat(path.join(workspace, output))).size > 0, output);
			}
			const previousSaveErrors = saveErrors.length;
			const map = ResourceTypes.get('map').create('map', 'level_before');
			map.placements = [{id:'first',spriteId:sprite.id,side:1,x:138,y:138}];
			bundle.resources.push(map);
			await fs.promises.writeFile(resources, JSON.stringify(bundle));
			await saveHandler(savedDocument);
			map.name = 'level_after'; map.placements[0].x = -104.5; map.placements[0].y = -131.5;
			await fs.promises.writeFile(resources, JSON.stringify(bundle));
			await saveHandler(savedDocument);
			assert.strictEqual(saveErrors.length, previousSaveErrors);
			const mapPath = path.join(workspace, 'app/art/packed/level_after.raw');
			const mapBytes = await fs.promises.readFile(mapPath);
			assert.strictEqual(mapBytes.readInt32LE(0), 1);
			const places = [];
			for(let n=0; n<mapBytes.readInt32LE(4); n++)
			{
				const offset = 8+n*28;
				if(mapBytes.readInt16LE(offset+16)>0) { places.push([mapBytes.readInt8(offset+22),mapBytes.readFloatLE(offset),mapBytes.readFloatLE(offset+4)]); }
			}
			assert.deepStrictEqual(places, [[1,-104.5,-131.5]], 'Saved map movement must reach the compiled binary.');
			const ids = await fs.promises.readFile(header, 'utf8');
			assert.match(ids, /MAP_level_after\s*=/); assert.doesNotMatch(ids, /MAP_level_before\s*=/);
			const mapModified = (await fs.promises.stat(mapPath)).mtimeMs;
			const modified = (await fs.promises.stat(header)).mtimeMs;
			await ResourceBuilder.build(workspace);
			assert.strictEqual((await fs.promises.stat(header)).mtimeMs, modified);
			assert.strictEqual((await fs.promises.stat(mapPath)).mtimeMs, mapModified);
			console.log('Installed resource-builder integration passed: packed assets, map rename and saved positions decoded from binary, index/header generation, and reuse of compiled JSON.');
		}
		console.log('Resource build checks passed: persistent JSON hashing, ordering, shared builds, save handling, output logging, platform names, failures, and retries.');
	}
	finally
	{
		ResourceStudioProvider.flushEdits = original.flushEdits;
		cp.spawn = original.spawn; cp.exec = original.exec; os.platform = original.platform;
		Configuration.context = original.context; Configuration.getUtilsPath = original.utils;
		Configuration.getWOWSDKPath = original.sdk; Configuration.getCurrentVersion = original.version;
		await fs.promises.rm(fixture, {recursive:true, force:true});
	}
}
run().catch(error => { console.error(error); console.error(logged); process.exitCode = 1; });
