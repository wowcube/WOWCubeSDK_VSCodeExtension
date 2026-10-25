// Resource build caching, task ordering, failures, and optional installed-tool integration.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const {EventEmitter} = require('events');
const Module = require('module');

let logged = '';
const waits = [];
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
	FileType:{File:1,Directory:2},
	workspace:{fs:{stat:async uri=>{const stat=await fs.promises.stat(uri.fsPath);return{type:stat.isFile()?1:2,mtime:stat.mtimeMs,size:stat.size};},readFile:uri=>fs.promises.readFile(uri.fsPath)},textDocuments:[], onDidSaveTextDocument:handler => { saveHandler = handler; return {dispose:function () {}}; }},
	Uri:{joinPath:(uri,...parts) => vscode.Uri.file(path.join(uri.fsPath || uri.path,...parts)),file:value => ({scheme:'file', fsPath:value, toString:() => 'file://'+value})}, TaskScope:{Workspace:1},
	Task:class { constructor(definition, scope, name, source, execution) { Object.assign(this, {definition, execution}); } },
	CustomExecution:class { constructor(callback) { this.callback = callback; } }
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain)
{
	if(name === 'vscode') { return vscode; }
	if(parent?.filename.endsWith('/out/DeviceDeployment.js') && name === './Providers') { return {Providers:{btdevices:{showWait:value => waits.push(value)}}}; }
	if(parent?.filename.endsWith('/out/WOWCubeBuildTaskProvider.js') && ['./Project', './Providers', './Script', './NameBeautifier'].includes(name)) { return {}; }
	return originalLoad.call(this, name, parent, isMain);
};
const {Configuration} = require('../../out/Configuration');
const {ResourceBuilder} = require('../../out/ResourceBuilder');
const {ResourceStudioProvider} = require('../../out/ResourceStudioProvider');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');
const {WOWCubeBuildTaskProvider} = require('../../out/WOWCubeBuildTaskProvider');
const {DeviceDeployment} = require('../../out/DeviceDeployment');
Module._load = originalLoad;

async function runTask(workspace, target, timeoutMs = 3000)
{
	const tasks = await new WOWCubeBuildTaskProvider(workspace).provideTasks();
	const task = tasks.find(item => item.definition.target === target);
	const terminal = await task.execution.callback();
	const exits = [];
	await new Promise((resolve, reject) =>
	{
		const timeout = setTimeout(() => reject(new Error('Build task did not finish.')), timeoutMs);
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
		utils:Configuration.getUtilsPath, sdk:Configuration.getWOWSDKPath, version:Configuration.getCurrentVersion, device:Configuration.getCurrentDevice, logging:Configuration.getLoggingMode};
	const calls = [];
	const events = [];
	let failTool;
	let failLaunch = false;
	let beforeResourceClose;
	let packageMode = 'normal';
	let loaderMode;
	let failRun = false;
	let catalogMode;
	let device = {name:'Test cube', mac:'01:02:03:04:05:06'};
	let revision = 0;
	async function changeJson() { await fs.promises.writeFile(resources, JSON.stringify({...ResourceBundles.create(), revision:++revision})); }
	try
	{
		await fs.promises.mkdir(path.dirname(header), {recursive:true});
		await fs.promises.mkdir(tools);
		for(const name of ['resource-builder', 'resource-builder.exe']) { await fs.promises.writeFile(path.join(tools, name), 'test executable'); }
		await fs.promises.writeFile(buildPath, JSON.stringify({appFolder:'app', idsFile:'resource_ids.h', metadata:{application:{guid1:'FEDCBA9876543210',guid2:'0000000000000000'}}}));
		await changeJson();
		Configuration.context = {workspaceState};
		Configuration.getUtilsPath = () => tools;
		Configuration.getWOWSDKPath = () => fixture;
		Configuration.getCurrentVersion = () => 'test';
		Configuration.getCurrentDevice = () => device;
		Configuration.getLoggingMode = () => '0';
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
					if(name === 'oct-builder' && failTool !== name)
					{
						const oct = path.join(workspace, 'app', 'app.oct');
						if(packageMode === 'missing') { await fs.promises.rm(oct, {force:true}); }
						else { await fs.promises.writeFile(oct, packageMode === 'empty' ? '' : 'OCT package'); }
					}
					if(name.startsWith('wowcube-loader'))
					{
						assert.strictEqual(Configuration.isDeviceBusy('01:02:03:04:05:06'), true);
						if(loaderMode === 'spawn') { throw new Error('Loader launch failed'); }
						if(loaderMode === 'reported') { child.stdout.emit('data', Buffer.from('Error: upload rejected')); }
						if(args[0] === 'ci' && catalogMode !== 'missing')
						{
							child.stdout.emit('data', Buffer.from('Other (v1.0) guid1=1111111111111111 guid2=0000000000000000\r\nTest App (v1.0.0, 100 bytes) guid1=fedcba9876543210 guid2=0000000000000000\r\n'));
						}

					}

					child.stdout.emit('data', Buffer.from('tool output\n'));
					child.stderr.emit('data', Buffer.from('tool warning\n'));
					events.push('close:'+name);
					child.emit('close', failTool === name || (failRun && args[0] === 'ra') || (catalogMode === 'error' && args[0] === 'ci') ? 1 : 0);
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
		assert.strictEqual(calls.length, 2, 'Explicit packing must run again for unchanged resources.');
		await fs.promises.utimes(resources, new Date(), new Date());
		await fs.promises.writeFile(path.join(workspace, 'source.png'), 'changed image');
		await ResourceBuilder.build(workspace);
		assert.strictEqual(calls.length, 2, 'Timestamps and source-only edits must not rebuild resources.');
		delete require.cache[require.resolve('../../out/ResourceBuilder')];
		Module._load = function (name, parent, isMain) { return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain); };
		const reloaded = require('../../out/ResourceBuilder').ResourceBuilder;
		Module._load = originalLoad;
		await reloaded.build(workspace);
		assert.strictEqual(calls.length, 2, 'The successful hash must survive a module reload.');

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
		assert.deepStrictEqual(calls.map(call => path.basename(call.file)), ['cmake', 'cmake', 'oct-builder', 'wowcube-loader', 'wowcube-loader', 'wowcube-loader']);
		assert.deepStrictEqual(calls[2].args, [path.join(workspace, 'app'), 'app', '--manifest', buildPath]);
		await changeJson(); calls.length = 0; events.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 0);
		assert.deepStrictEqual(events, ['start:resource-builder', 'close:resource-builder', 'start:cmake', 'close:cmake', 'start:cmake', 'close:cmake', 'start:oct-builder', 'close:oct-builder', 'start:wowcube-loader', 'close:wowcube-loader', 'start:wowcube-loader', 'close:wowcube-loader', 'start:wowcube-loader', 'close:wowcube-loader']);

		assert.deepStrictEqual(calls.at(-3).args, ['up','-p',path.join(workspace,'app','app.oct'),'-a',device.mac]);
		assert.deepStrictEqual(calls.at(-1).args, ['ra','-g1','fedcba9876543210','-g2','0000000000000000','-a',device.mac]);
		assert.deepStrictEqual(calls.at(-2).args,['ci','-f','-c','-al','-a',device.mac]);
		assert.match(logged, /Upload complete\.[\s\S]*Launch command sent\./);
		assert.ok(logged.includes('Uploading app.oct to Test cube (01:02:03:04:05:06)...'));
		assert.strictEqual(Configuration.isDeviceBusy(device.mac), false);
		assert.deepStrictEqual(waits.slice(-2), [true,false]);
		for(const mode of ['missing','empty'])
		{
			packageMode = mode; calls.length = 0;
			assert.strictEqual(await runTask(workspace, 'device'), 1);
			assert.strictEqual(calls.some(call => path.basename(call.file).startsWith('wowcube-loader')), false);
			assert.match(logged, /Compilation succeeded, but deployment failed: Application package is missing or empty/);
			assert.strictEqual(Configuration.isDeviceBusy(device.mac), false);
		}
		packageMode = 'normal';
		const selected = device;
		device = null; calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 1);
		assert.match(logged, /No WOWCube device selected/);
		assert.strictEqual(calls.length, 3);
		device = selected;
		Configuration.setDeviceBusy(device.mac, true); calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 1);
		assert.strictEqual(calls.length, 3);
		assert.strictEqual(Configuration.isDeviceBusy(device.mac), true, 'An existing operation retains its busy state.');
		Configuration.setDeviceBusy(device.mac, false);
		for(const mode of ['exit','spawn','reported'])
		{
			loaderMode = mode; failTool = mode === 'exit' ? 'wowcube-loader' : undefined;
			calls.length = 0;
			assert.strictEqual(await runTask(workspace, 'device'), 1);
			assert.strictEqual(Configuration.isDeviceBusy(device.mac), false);
			assert.strictEqual(waits.at(-1), false);
			assert.strictEqual(calls.some(call => call.args[0] === 'ra'),false,'A failed upload must not launch.');
		}
		loaderMode = undefined; failTool = undefined;
		failRun = true; logged = ''; calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'device'), 1);
		assert.match(logged, /Upload complete/); assert.match(logged, /Device launch failed/);
		assert.ok(!logged.includes('Launch command sent.'));
		assert.strictEqual(calls.at(-1).args[0], 'ra');
		assert.strictEqual(Configuration.isDeviceBusy(device.mac),false);
		assert.strictEqual(waits.at(-1),false);
		failRun = false;
		for(const mode of ['missing','error'])
		{
			catalogMode = mode; calls.length = 0;
			assert.strictEqual(await runTask(workspace,'device',15000),1);
			assert.strictEqual(calls.filter(call => call.args[0] === 'ci').length, mode === 'missing' ? 6 : 1);
			assert.strictEqual(calls.some(call => call.args[0] === 'ra'),false);
			assert.strictEqual(Configuration.isDeviceBusy(device.mac),false);
			assert.strictEqual(waits.at(-1),false);
		}
		catalogMode = undefined;
		for(const application of [undefined,{}, {guid1:'123',guid2:0},{guid1:'not_hex',guid2:'0'}, {guid1:'1'.repeat(17),guid2:'0'}])
		{
			const before = calls.length;
			await assert.rejects(DeviceDeployment.uploadAndRun(path.join(workspace,'app','app.oct'), application), /guid1 and guid2 must be hexadecimal strings/);
			assert.strictEqual(calls.length,before);
		}

		for(const [platform, loader] of [['darwin','wowcube-loader.app/Contents/MacOS/wowcube-loader'],['linux','wowcube-loader'],['win32','wowcube-loader.exe']])
		{
			os.platform = () => platform;
			await DeviceDeployment.upload(device.mac, path.join(workspace,'app','app.oct'));
			assert.strictEqual(calls.at(-1).file, path.join(tools,loader));
			assert.deepStrictEqual(calls.at(-1).args, ['up','-p',path.join(workspace,'app','app.oct'),'-a',device.mac]);
			assert.strictEqual(calls.at(-1).options.windowsHide,true);
		}
		os.platform = () => 'darwin';

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
		calls.length = 0;
		await Promise.all([ResourceBuilder.build(workspace), ResourceBuilder.build(workspace, 'pack')]);
		assert.strictEqual(calls.length, 1, 'Explicit packing must run after an in-flight cache check.');
		calls.length = 0;
		await Promise.all([ResourceBuilder.build(workspace, 'pack'), ResourceBuilder.build(workspace, 'pack')]);
		assert.strictEqual(calls.length, 2, 'Each explicit pack request must invoke the builder without overlapping processes.');
		calls.length = 0; failTool = 'resource-builder';
		assert.strictEqual(await runTask(workspace, 'resources'), 1, 'An unchanged explicit pack must report builder failures.');
		assert.strictEqual(calls.length, 1);
		failTool = undefined; calls.length = 0;
		assert.strictEqual(await runTask(workspace, 'resources'), 0, 'An unchanged explicit pack must retry after failure.');
		assert.strictEqual(calls.length, 1);
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


		// Updating the executable invalidates outputs even when the JSON is unchanged.
		const beforeToolUpdate=calls.length;
		await fs.promises.writeFile(path.join(tools,'resource-builder.exe'),'updated compiler');
		await ResourceBuilder.build(workspace);assert.strictEqual(calls.length,beforeToolUpdate+1);
		await ResourceBuilder.build(workspace);assert.strictEqual(calls.length,beforeToolUpdate+1);
		// Compiler incompatibilities are caught before launching any process.
		const incompatible=ResourceBundles.create();
		const legacyPalette=ResourceTypes.get('palette').create('legacy','legacy_palette');legacyPalette.transparentIndex=null;legacyPalette.colors=['#ff0000ff'];legacyPalette.mappingColors=legacyPalette.colors.slice();incompatible.resources.push(legacyPalette);
		await fs.promises.writeFile(resources,JSON.stringify(incompatible));
		await assert.rejects(ResourceBuilder.build(workspace),/reserve color 0/);assert.strictEqual(calls.length,beforeToolUpdate+1);

		// Valid font and sound records must reach the compiler, even without an SDK in CI.
		const supported = ResourceBundles.create();
		const fontPalette = ResourceTypes.get('palette').create('font_palette','font_palette');
		supported.resources.push(fontPalette,ResourceTypes.get('font').create('font','ui_font','font.fnt',{slot:1,atlas:'atlas.png',paletteId:fontPalette.id}),ResourceTypes.get('sound').create('sound','coin','coin.wav'));
		await fs.promises.writeFile(path.join(workspace,'coin.wav'),require('./soundFixture').wav());
		await fs.promises.writeFile(resources,JSON.stringify(supported));
		const supportedCalls = calls.length;
		await ResourceBuilder.build(workspace); assert.strictEqual(calls.length,supportedCalls+1);
		await ResourceBuilder.build(workspace); assert.strictEqual(calls.length,supportedCalls+1);

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
			assert.match(await fs.promises.readFile(header, 'utf8'), /#include <cstdint>/);
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

			const {SpriteSequences}=require('../../out/SpriteSequence');
			const frames=SpriteSequences.createFrames(bundle,'walk',[{source:'hero.png',width:1,height:1},{source:'hero.png',width:1,height:1}],0);
			frames.forEach((frame,index)=>{frame.paletteId=palette.id;frame.frameRate=index;frame.pivot={x:-2.5,y:3.5};frame.number=42+index;frame.fullsize=index===1;});
			bundle.resources.push(...frames);await fs.promises.writeFile(resources,JSON.stringify(bundle));await ResourceBuilder.build(workspace);
			const compiledPalette=await fs.promises.readFile(path.join(workspace,'app/art/packed/hero_palette.pal'));
			assert.strictEqual(compiledPalette.readUInt32LE(0),0);assert.notStrictEqual(compiledPalette.readUInt32LE(4),0);
			const animationHeader=await fs.promises.readFile(header,'utf8');
			const assetIds=Object.fromEntries([...animationHeader.matchAll(/BMP_([a-z0-9_]+)\s*=\s*(\d+)/g)].map(match=>[match[1],+match[2]]));
			for(const [index,frame] of frames.entries())
			{
				const bytes=await fs.promises.readFile(path.join(workspace,'app/art/packed',frame.name+'.raw'));
				assert.strictEqual(bytes.readUInt16LE(2),assetIds[frames[1-index].name]);assert.strictEqual(bytes.readInt8(45),index);assert.strictEqual(bytes.readInt16LE(40),42+index);
				const scale=frame.fullsize?1:2;assert.strictEqual(bytes.readFloatLE(4),scale*frame.pivot.x-.5);assert.strictEqual(bytes.readFloatLE(8),scale*frame.pivot.y-.5);
			}
			assert.strictEqual(assetIds.walk,assetIds[frames[0].name]);assert.strictEqual(assetIds.walk_end,assetIds[frames[1].name]);
			// Fonts expand into glyph sprites; sounds reach the compiler without extension gates.
			const {fontFixture, atlasPng} = require('./fontFixture');
			await fs.promises.writeFile(path.join(workspace,'font.fnt'),fontFixture());
			await fs.promises.writeFile(path.join(workspace,'atlas.png'),atlasPng());
			const font = ResourceTypes.get('font').create('font','ui_font','font.fnt',{slot:1,atlas:'atlas.png',paletteId:palette.id});
			const scaledFont = {...font,id:'font_two',name:'scaled_font',slot:2,fullsize:false};
			const sound = ResourceTypes.get('sound').create('sound','coin','Coin Pickup.wav');
			await fs.promises.writeFile(path.join(workspace,sound.source),require('./soundFixture').wav());
			bundle.resources.push(font,scaledFont,sound);
			await fs.promises.writeFile(resources,JSON.stringify(bundle));
			await ResourceBuilder.build(workspace);
			const fontSoundHeader = await fs.promises.readFile(header,'utf8');
			assert.match(fontSoundHeader,/BMP_font_1_00065\s*=/); assert.match(fontSoundHeader,/BMP_font_2_00110\s*=/); assert.match(fontSoundHeader,/SND_coin\s*=/);
			for(const [slot,zoom] of [[1,1],[2,2]])
			{
				const glyph = await fs.promises.readFile(path.join(workspace,'app/art/packed','font_'+slot+'_00065.raw'));
				assert.strictEqual(glyph.readFloatLE(4),-zoom); assert.strictEqual(glyph.readFloatLE(8),16*zoom);
				assert.strictEqual(glyph.readFloatLE(20),14); assert.strictEqual(glyph.readFloatLE(24),24*zoom);
				assert.strictEqual(Boolean(glyph.readUInt8(44)&2),zoom===1);
			}
			assert(!fs.existsSync(path.join(workspace,'app/art/packed/font_1_00032.raw')),'Space uses the n glyph width rather than a bitmap asset.');
			const soundPath = path.join(workspace,'app/sound/assets/coin.mp3'), mp3 = await fs.promises.readFile(soundPath);
			assert(mp3.length>0 && mp3.length<=65536); assert.notStrictEqual(mp3.toString('ascii',0,3),'ID3');
			for(let offset=0;offset<mp3.length;)
			{
				assert.strictEqual(mp3[offset],255); assert.strictEqual((mp3[offset+1]>>3)&3,2); assert.strictEqual((mp3[offset+1]>>1)&3,1);
				assert.strictEqual(mp3[offset+2]>>4,4); assert.strictEqual((mp3[offset+2]>>2)&3,0); assert.strictEqual(mp3[offset+3]>>6,3);
				offset += 104 + ((mp3[offset+2]>>1)&1); assert(offset<=mp3.length);
			}
			const soundModified = (await fs.promises.stat(soundPath)).mtimeMs;
			await ResourceBuilder.build(workspace); assert.strictEqual((await fs.promises.stat(soundPath)).mtimeMs,soundModified,'Unchanged font/sound JSON reuses the successful build.');
			console.log('Installed font/sound integration passed: glyph IDs, pivots/metrics, FULLSIZE scaling, MP3 conversion/format/size, SND IDs and cache reuse.');
			console.log('Installed resource-builder integration passed: packed assets, map rename and saved positions decoded from binary, index/header generation, sequence links/timing/pivots and cache reuse.');
		}
		// Sound errors are checked before compiler invocation, with no editor required.
		const soundBundle = ResourceBundles.create(); soundBundle.resources.push(ResourceTypes.get('sound').create('sound','coin','missing.wav'));
		await fs.promises.writeFile(resources,JSON.stringify(soundBundle));
		await assert.rejects(ResourceBuilder.build(workspace), /source file|Source file/);
		console.log('Resource build checks passed: persistent JSON hashing, ordering, shared builds, save handling, output logging, platform names, upload/launch ordering, deployment failures, busy cleanup, and retries.');
	}
	finally
	{
		ResourceStudioProvider.flushEdits = original.flushEdits;
		cp.spawn = original.spawn; cp.exec = original.exec; os.platform = original.platform;
		Configuration.context = original.context; Configuration.getUtilsPath = original.utils;
		Configuration.getWOWSDKPath = original.sdk; Configuration.getCurrentVersion = original.version;
		Configuration.getCurrentDevice = original.device; Configuration.getLoggingMode = original.logging;
		await fs.promises.rm(fixture, {recursive:true, force:true});
	}
}
run().catch(error => { console.error(error); console.error(logged); process.exitCode = 1; });
