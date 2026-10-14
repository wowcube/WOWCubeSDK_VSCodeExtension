// Exercises webview messages and type handlers without a browser or user files.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const rootHandlers = {};
const windowHandlers = {};
const sent = [];
let initialFocus = false;
const elements = {scrollTop:0, textContent:'', dataset:{}, style:{}, focus:function () {}, querySelector:function () { return this; }, querySelectorAll:function () { return []; }};
const root = {
	innerHTML:'',
	contains:function () { return false; },
	querySelector:function (selector) { return selector === '#sprite-canvas' ? null : elements; },
	focus:function (options) { assert.strictEqual(options.preventScroll, true); initialFocus = true; },
	querySelectorAll:function () { return []; },
	addEventListener:function (event, handler) { rootHandlers[event] = handler; }
};
const context = vm.createContext({
	window:{addEventListener:function (event, handler) { windowHandlers[event] = handler; }},
	document:{getElementById:function () { return root; }, activeElement:{}},
	acquireVsCodeApi:function ()
	{
		return {getState:function () { return {tab:'Palettes'}; }, setState:function () {}, postMessage:function (message) { sent.push(message); }};
	}
});
for(const file of ['resourcevalidation.js', 'resourcetypes.js', 'resourcestudio.js'])
{
	vm.runInContext(fs.readFileSync(path.join(__dirname, '../../media', file), 'utf8'), context);
}
let bundle = {schemaVersion:2, sourceFolders:[], resources:[
	{id:'palette-1', name:'world', type:'palette', colors:['#000000', '#ffffff', '#ff0000'], mappingColors:['#000000', '#ffffff', '#ff0000'], colorCount:16, transparentIndex:2}
]};
let version = 1;
function update()
{
	bundle.registries ||= {groups:[], types:[], tags:[]};
	windowHandlers.message({data:{type:'update', bundle:JSON.parse(JSON.stringify(bundle)), version, dirty:version > 1, project:'Test',
		sources:[], resourceTypes:[{type:'palette', label:'Palette'}, {type:'sprite', label:'Sprite'}], sourceWarning:''}});
}
function change(key, value, type = 'text')
{
	rootHandlers.change({target:{dataset:{key}, value, type}});
}
function acknowledge()
{
	const message = sent.at(-1);
	assert.strictEqual(message.type, 'change');
	if(message.action === 'resizePalette')
	{
		bundle.resources[0].colorCount = message.colorCount;
		bundle.resources[0].colors = ['#000000', '#ffffff'];
		bundle.resources[0].mappingColors = ['#000000', '#ffffff'];
		bundle.resources[0].transparentIndex = null;
	}
	else
	{
		bundle.resources[0] = JSON.parse(JSON.stringify(message.resource));
	}
	version++;
	update();
}

assert.strictEqual(sent[0].type, 'ready');
update();
assert.strictEqual(initialFocus, true);
assert.strictEqual(root.tabIndex, -1);
assert.ok(root.innerHTML.includes('wowcubeapp-resources.json'));
change('colorCount', '16', 'select-one');
assert.strictEqual(sent.at(-1).action, 'resizePalette');
assert.strictEqual(sent.at(-1).colorCount, 16);
assert.ok(!root.innerHTML.includes('New palette'));
acknowledge();
change('colorHex', '#347E98');
assert.strictEqual(sent.at(-1).resource.colors[0], '#317d9c');
acknowledge();
change('name', 'renamed');
assert.strictEqual(sent.at(-1).resource.id, 'palette-1');
assert.strictEqual(sent.at(-1).resource.name, 'renamed');
acknowledge();
change('colorHex', 'invalid');
assert.ok(root.innerHTML.includes('six-digit hex color'));

// Saving while the final edit is in flight waits for the document update.
change('name', 'final_name');
windowHandlers.keydown({ctrlKey:true, key:'s', preventDefault:function () {}});
assert.strictEqual(sent.at(-1).type, 'change');
acknowledge();
assert.strictEqual(sent.at(-1).type, 'save');

const spriteType = context.window.ResourceStudioTypes.get('sprite');
const paletteType = context.window.ResourceStudioTypes.get('palette');
const editedPalette = {colors:['#ff0000ff'], mappingColors:['#ff0000ff'], transparentIndex:0};
const colorHelpers = {state:{colorIndex:0}};
paletteType.change(editedPalette, 'colorHex', {value:'#7f7f7f7f'}, colorHelpers);
assert.strictEqual(editedPalette.colors[0], '#7b7d7b7b');
assert.strictEqual(editedPalette.transparentIndex, null);
assert.deepStrictEqual(editedPalette.mappingColors, ['#ff0000ff']);
for(const [channel, value, expected] of [['R', 128, '#847d7b7b'], ['G', 128, '#84827b7b'], ['B', 128, '#8482847b'], ['A', 128, '#84828484']])
{
	paletteType.change(editedPalette, 'channel'+channel, {value:String(value)}, colorHelpers);
	assert.strictEqual(editedPalette.colors[0], expected);
}
editedPalette.transparentIndex = 0;
paletteType.change(editedPalette, 'channelA', {value:'7'}, colorHelpers);
assert.strictEqual(editedPalette.colors[0], '#84828400');
assert.strictEqual(editedPalette.transparentIndex, 0);
paletteType.change(editedPalette, 'channelA', {value:'8'}, colorHelpers);
assert.strictEqual(editedPalette.colors[0], '#84828408');
assert.strictEqual(editedPalette.transparentIndex, null);
const sprite = {pivot:null, collider:{enabled:false, x:0, y:0, width:0, height:0}};
spriteType.change(sprite, 'colliderWidth', {value:'12'}, {state:{imageSizes:{undefined:{width:40, height:60}}}});
spriteType.change(sprite, 'pivotX', {value:'10.5'}, {state:{imageSizes:{undefined:{width:40, height:60}}}});
spriteType.change(sprite, 'paletteId', {value:'palette-1'});
assert.strictEqual(sprite.collider.width, 12);
assert.deepStrictEqual(JSON.parse(JSON.stringify(sprite.pivot)), {x:10.5, y:30});

assert.strictEqual(sprite.paletteId, 'palette-1');
spriteType.change(sprite, 'paletteId', {value:'__rgb565__'});
assert.strictEqual(sprite.paletteId, null);
assert.strictEqual(sprite.colorMode, 'rgb565');
assert.strictEqual(sprite.blend, 'opaque');
assert.throws(() => spriteType.validateCreate({name:'hero', source:''}, {bundle:{resources:[]}}), /source image/);

// The first sprite requires palette details; canceling never sends a creation request.
bundle = {schemaVersion:2, sourceFolders:[], resources:[]};
version++;
update();
function click(dataset)
{
	rootHandlers.click({target:{closest:function () { return {dataset, disabled:false}; }}});
}
function dialogChange(key, value)
{
	rootHandlers.change({target:{dataset:{dialog:key}, value}});
}
click({registerSource:'hero.png'});
assert.ok(root.innerHTML.includes('RGB565 — no palette'));
dialogChange('paletteId', '__rgb565__');
assert.ok(!root.innerHTML.includes('data-dialog="paletteName"'));
rootHandlers.submit({preventDefault:function () {}});
assert.strictEqual(sent.at(-1).options.paletteId, null);
assert.strictEqual(sent.at(-1).options.colorMode, 'rgb565');
version++;
update();
click({registerSource:'hero.png'});
assert.ok(root.innerHTML.includes('value="hero_palette"'));
assert.ok(root.innerHTML.includes('value="256"'));
assert.ok(!root.innerHTML.includes('value="palette"'));
const beforeCancel = sent.length;
click({action:'cancel'});
assert.strictEqual(sent.length, beforeCancel);
click({registerSource:'hero.png'});
dialogChange('paletteName', '');
rootHandlers.submit({preventDefault:function () {}});
assert.strictEqual(sent.length, beforeCancel);
assert.ok(root.innerHTML.includes('V-001'));
dialogChange('paletteName', 'hero_palette');
rootHandlers.submit({preventDefault:function () {}});
assert.strictEqual(sent.at(-1).action, 'create');
assert.strictEqual(sent.at(-1).options.paletteName, 'hero_palette');
assert.strictEqual(sent.at(-1).options.colorCount, 256);
assert.strictEqual(sent.at(-1).resourceType, 'sprite');

// Later registrations offer both existing and new palettes.
bundle.resources = [{id:'palette-1', name:'world', type:'palette', colors:['#000000'], mappingColors:['#000000'], colorCount:256, transparentIndex:null}];
version++;
update();
click({registerSource:'second.png'});
assert.ok(root.innerHTML.includes('Generate a new palette'));
assert.ok(root.innerHTML.includes('value="palette-1" selected'));
dialogChange('paletteId', '');
assert.ok(root.innerHTML.includes('value="second_palette"'));
dialogChange('paletteId', 'palette-1');
rootHandlers.submit({preventDefault:function () {}});
assert.strictEqual(sent.at(-1).options.paletteId, 'palette-1');

// Editing an embedded palette keeps the sprite selected and redraws during slider input.
const originalMountPreview = spriteType.mountPreview;
let liveRefreshes = 0;
let scrollNodes;
let studioState;
let studioHelpers;
let previewReady;
spriteType.mountPreview = function (resource, helpers)
{
	studioState = helpers.state;
	studioHelpers = helpers;
	previewReady = helpers.onPreviewReady;
	if(scrollNodes)
	{
		scrollNodes['#sprite-preview'].scrollTop = helpers.previewScroll.top;
		scrollNodes['#sprite-preview'].scrollLeft = helpers.previewScroll.left;
	}
	const dispose = function () {};
	dispose.refreshPalette = function () { liveRefreshes++; };
	return dispose;
};
bundle.resources.push({id:'sprite-1', name:'hero', type:'sprite', source:'hero.png', paletteId:'palette-1', colorMode:'palette', blend:'alpha', fullsize:false, dither:false, compression:null, number:0, frameRate:1, group:null, objectType:null, tags:[], pivot:null, collider:{enabled:false, x:0, y:0, width:0, height:0}});
version++;
update();
click({select:'sprite-1'});
let spacePrevented = false;
windowHandlers.keydown({code:'Space', key:' ', target:{tagName:'CANVAS'}, preventDefault:function () { spacePrevented = true; }});
assert.strictEqual(studioState.spacePressed, true);
assert.strictEqual(spacePrevented, true);
windowHandlers.keyup({code:'Space'});
assert.strictEqual(studioState.spacePressed, false);
windowHandlers.keydown({code:'Space', key:' ', target:{tagName:'INPUT'}, preventDefault:function () { throw new Error('Space must remain available for typing.'); }});
assert.strictEqual(studioState.spacePressed, true);
windowHandlers.keyup({code:'Space'});
assert.strictEqual(studioState.spacePressed, false);
windowHandlers.keydown({code:'Space', key:' ', target:{tagName:'CANVAS'}, preventDefault:function () {}});
windowHandlers.blur();
assert.strictEqual(studioState.spacePressed, false);
assert.ok(root.innerHTML.includes('palette-current'));
assert.ok(root.innerHTML.includes('palette-controls'));
assert.ok(root.innerHTML.includes('data-palette-id="palette-1" data-key="channelA"'));
const scrollSelectors = ['main', '.palette-grid', '.library', '#sprite-preview', '.resource-inspector', '.visual-editor', '[data-classification-manager]'];
scrollNodes = Object.fromEntries(scrollSelectors.map(selector => [selector, {...elements, scrollTop:0, scrollLeft:0}]));
let html = root.innerHTML;
let revealFixture;
Object.defineProperty(root, 'innerHTML', {get:function () { return html; }, set:function (value)
{
	html = value;
	scrollNodes = Object.fromEntries(scrollSelectors.map(selector => [selector, {...elements, scrollTop:0, scrollLeft:0}]));
	if(revealFixture)
	{
		scrollNodes['.palette-grid'].clientHeight = 100;
		scrollNodes['.palette-grid'].querySelector = function () { return revealFixture; };
		scrollNodes['.visual-editor'].getBoundingClientRect = function () { return {top:0, bottom:300}; };
	}
	let inspectorTop = 0;
	Object.defineProperty(scrollNodes['.resource-inspector'], 'scrollTop', {
		get:function () { return inspectorTop; },
		set:function (value) { inspectorTop = scrollNodes['[data-classification-manager]'].open ? value : Math.min(value, 100); }
	});
}});
root.querySelector = function (selector) { return scrollNodes[selector] || elements; };
scrollNodes.main.scrollTop = 420;
scrollNodes['.palette-grid'].scrollTop = 180;
scrollNodes['.library'].scrollTop = 65;
scrollNodes['#sprite-preview'].scrollTop = 90;
scrollNodes['#sprite-preview'].scrollLeft = 24;
scrollNodes['.resource-inspector'].scrollTop = 135;
scrollNodes['.visual-editor'].scrollTop = 80;
scrollNodes['[data-classification-manager]'].open = true;
function assertScrollPreserved()
{
	assert.strictEqual(scrollNodes.main.scrollTop, 420);
	assert.strictEqual(scrollNodes['.palette-grid'].scrollTop, 180);
	assert.strictEqual(scrollNodes['.library'].scrollTop, 65);
	assert.strictEqual(scrollNodes['#sprite-preview'].scrollTop, 90);
	assert.strictEqual(scrollNodes['#sprite-preview'].scrollLeft, 24);
	assert.strictEqual(scrollNodes['.resource-inspector'].scrollTop, 135);
	assert.strictEqual(scrollNodes['.visual-editor'].scrollTop, 80);
	assert.strictEqual(scrollNodes['[data-classification-manager]'].open, true);
}

// Disabling the active checkbox blurs it. Restore focus and scroll after layout settles.
const previousContains = root.contains;
const previousQueryAll = root.querySelectorAll;
let colliderFocused = false;
const colliderCheckbox = {dataset:{key:'colliderEnabled'}, type:'checkbox', checked:true};
Object.defineProperty(colliderCheckbox, 'disabled', {set:function () { context.document.activeElement = {}; }});
const restoredCheckbox = {dataset:{key:'colliderEnabled'}, type:'checkbox', focus:function (options)
{
	assert.strictEqual(options.preventScroll, true);
	colliderFocused = true;
	context.document.activeElement = this;
}};
root.contains = function (element) { return element === colliderCheckbox || element === restoredCheckbox; };
root.querySelectorAll = function (selector) { return selector === '[data-key]' ? [restoredCheckbox] : selector === 'input, select, button' ? [colliderCheckbox] : []; };
studioState.imageSizes = {'hero.png':{width:63, height:91}};
for(const checked of [true, false])
{
	colliderFocused = false;
	colliderCheckbox.checked = checked;
	context.document.activeElement = colliderCheckbox;
	rootHandlers.change({target:colliderCheckbox});
	assert.strictEqual(sent.at(-1).resource.collider.enabled, checked);
	bundle.resources[1] = JSON.parse(JSON.stringify(sent.at(-1).resource));
	version++;
	update();
	assert.strictEqual(colliderFocused, true);
	assertScrollPreserved();
	// Simulate another layout adjustment while the image is being loaded.
	scrollNodes['.resource-inspector'].scrollTop = 17;
	scrollNodes['.visual-editor'].scrollTop = 11;
	previewReady();
	assertScrollPreserved();
}
root.contains = previousContains;
root.querySelectorAll = previousQueryAll;
context.document.activeElement = {};
click({colorIndex:'0'});
assertScrollPreserved();
assert.ok(root.innerHTML.includes('Generate a new palette…'));
rootHandlers.change({target:{dataset:{key:'paletteId'}, value:'__new_palette__', type:'select-one'}});
assert.strictEqual(sent.at(-1).action, 'generatePalette');
assert.strictEqual(sent.at(-1).id, 'sprite-1');
update();
const beforeSlider = sent.length;
rootHandlers.input({target:{dataset:{paletteId:'palette-1', key:'channelR'}, value:'42', type:'range'}});
assert.strictEqual(liveRefreshes, 1);
assert.strictEqual(sent.length, beforeSlider);
rootHandlers.change({target:{dataset:{paletteId:'palette-1', key:'channelR'}, value:'42', type:'range'}});
assert.strictEqual(sent.at(-1).resource.id, 'palette-1');
assert.strictEqual(sent.at(-1).resource.colors[0], '#290000ff');
acknowledge();
assert.ok(root.innerHTML.includes('Sprite preview'));
assert.ok(root.innerHTML.includes('value="0.5"'));
assert.ok(!root.innerHTML.includes('value="0.25"'));
assert.ok(!root.innerHTML.includes('value="0.125"'));
assert.ok(!root.innerHTML.includes('value="0.0625"'));
assertScrollPreserved();
rootHandlers.change({target:{dataset:{paletteId:'palette-1', key:'colorCount'}, value:'16', type:'number'}});
assert.strictEqual(sent.at(-1).action, 'resizePalette');
assert.strictEqual(sent.at(-1).id, 'palette-1');
acknowledge();
assert.ok(root.innerHTML.includes('Sprite preview'));
assert.ok(root.innerHTML.includes('data-preview-mode="indexed" aria-pressed="true"'));
// Picking reveals the swatch in both scroll panes, including after delayed image layout.
for(const [offsetTop, top, expectedGrid, expectedVisual] of [[500, 450, 448, 278], [0, -10, 0, 64], [200, 100, 180, 80]])
{
	scrollNodes['.palette-grid'].scrollTop = 180;
	scrollNodes['.visual-editor'].scrollTop = 80;
	revealFixture = {offsetTop, offsetHeight:42, getBoundingClientRect:function ()
	{
		const currentTop = top - (scrollNodes['.visual-editor'].scrollTop - 80);
		return {top:currentTop, bottom:currentTop + 42};
	}};
	studioHelpers.selectPaletteColor(1, true);
	assert.strictEqual(scrollNodes['.palette-grid'].scrollTop, expectedGrid);
	assert.strictEqual(scrollNodes['.visual-editor'].scrollTop, expectedVisual);
	scrollNodes['.palette-grid'].scrollTop = 0;
	scrollNodes['.visual-editor'].scrollTop = 0;
	previewReady();
	assert.strictEqual(scrollNodes['.palette-grid'].scrollTop, expectedGrid);
	assert.strictEqual(scrollNodes['.visual-editor'].scrollTop, expectedVisual);
	assert.strictEqual(scrollNodes['#sprite-preview'].scrollTop, 90);
	assert.strictEqual(scrollNodes['#sprite-preview'].scrollLeft, 24);
	assert.strictEqual(scrollNodes['.resource-inspector'].scrollTop, 135);
}
revealFixture = undefined;
spriteType.mountPreview = originalMountPreview;

// Check actual indexed pixel conversion, alpha, and re-conversion after palette changes.
const images = [];
let imageWidth = 1;
let imageHeight = 1;
context.Image = class
{
	constructor() { this.naturalWidth = imageWidth; this.naturalHeight = imageHeight; images.push(this); }
};
let disconnected = false;
context.ResizeObserver = class
{
	observe() {}
	disconnect() { disconnected = true; }
};
const drawing = {save:function () {}, restore:function () {}, translate:function () {}, scale:function () {}, drawImage:function () {},
	strokeRect:function () {}, beginPath:function () {}, arc:function () {}, moveTo:function () {}, lineTo:function () {}, stroke:function () {}};
let focusOptions;
const canvas = {style:{}, getContext:function () { return drawing; }, focus:function (options) { focusOptions = options; },
	setPointerCapture:function () {}, getBoundingClientRect:function () { return {left:0, top:0, width:8, height:8}; }};
let wheelHandler;
const stage = {style:{}, clientWidth:400, clientHeight:300,
	addEventListener:function (event, handler, options) { assert.strictEqual(event, 'wheel'); assert.strictEqual(options.passive, false); wheelHandler = handler; },
	removeEventListener:function (event, handler) { assert.strictEqual(handler, wheelHandler); }};
let capturedPointer;
const overlay = {setAttribute:function () {}, setPointerCapture:function (id) { capturedPointer = id; }};
let converted;
let sourcePixels = [255, 0, 0, 255];
context.document.createElement = function ()
{
	return {getContext:function () { return {drawImage:function () {},
		getImageData:function () { return {data:new Uint8ClampedArray(sourcePixels)}; },
		putImageData:function (data) { converted = Array.from(data.data); }}; }};
};
const previewPalette = {id:'preview-palette', type:'palette', colors:['#ff000080', '#e70000'], mappingColors:['#ff0000', '#e70000'], transparentIndex:null};
const previewSprite = {...bundle.resources[1], paletteId:previewPalette.id};
const zoomState = {zoom:'4', previewMode:'indexed'};
const preview = spriteType.mountPreview(previewSprite, {state:zoomState, previewScroll:{top:90, left:24}, bundle:{resources:[previewPalette]},
	sources:[{path:'hero.png', uri:'test:hero.png', image:true}], main:{querySelectorAll:function () { return []; },
		querySelector:function (selector) { return selector === '#sprite-canvas' ? canvas : selector === '#sprite-preview' ? stage : selector === '#sprite-overlay' ? overlay : {}; }}, saveState:function () {}});
images[0].onload();
assert.deepStrictEqual(converted, [255, 0, 0, 128]);
assert.strictEqual(stage.scrollTop, 90);
assert.strictEqual(stage.scrollLeft, 24);
let prevented = false;
canvas.onpointerdown({button:0, pointerId:1, clientX:4, clientY:4, preventDefault:function () { prevented = true; }});
assert.strictEqual(prevented, true);
assert.strictEqual(focusOptions.preventScroll, true);
stage.scrollTop = 135;
previewPalette.colors[0] = '#00ff0040';
preview.refreshPalette();
assert.deepStrictEqual(converted, [0, 255, 0, 64]);
assert.strictEqual(stage.scrollTop, 135);
canvas.onpointercancel();
previewPalette.colors[0] = '#0000ff';
preview.refreshPalette();
assert.deepStrictEqual(converted, [0, 0, 255, 255]);
function wheel(deltaY)
{
	wheelHandler({deltaY, shiftKey:true, deltaMode:0, clientX:4, clientY:4, preventDefault:function () {}});
}
let scrollingPrevented = false;
wheelHandler({deltaY:-100, shiftKey:false, preventDefault:function () { scrollingPrevented = true; }});
assert.strictEqual(zoomState.zoom, '4');
assert.strictEqual(scrollingPrevented, false);
wheel(-100);
assert.strictEqual(zoomState.zoom, '8');
wheel(100);
assert.strictEqual(zoomState.zoom, '4');
wheelHandler({deltaY:0, deltaX:-100, shiftKey:true, deltaMode:0, clientX:4, clientY:4, preventDefault:function () {}});
assert.strictEqual(zoomState.zoom, '8');
wheelHandler({deltaY:0, deltaX:100, shiftKey:true, deltaMode:0, clientX:4, clientY:4, preventDefault:function () {}});
assert.strictEqual(zoomState.zoom, '4');
for(let i = 0; i < 10; i++) { wheel(-100); }
assert.strictEqual(zoomState.zoom, '128');
assert.strictEqual(canvas.style.width, '128px');
assert.strictEqual(canvas.width, 1);
for(let i = 0; i < 20; i++) { wheel(100); }
assert.strictEqual(zoomState.zoom, '0.5');
preview();
assert.strictEqual(disconnected, true);

// An edited entry keeps its pixels even when another display color is now closer.
// This must also hold after closing and reopening the preview from saved JSON.
const reopenedPalette = JSON.parse(JSON.stringify(previewPalette));
const pickedColors = [];
const pickingState = {zoom:'fit', previewMode:'indexed', spacePressed:false};
function mountPalette(palette, state = pickingState)
{
	const mounted = spriteType.mountPreview(previewSprite, {state, bundle:{resources:[palette]},
		sources:[{path:'hero.png', uri:'test:hero.png', image:true}], main:{querySelectorAll:function () { return []; },
			querySelector:function (selector) { return selector === '#sprite-canvas' ? canvas : selector === '#sprite-preview' ? stage : selector === '#sprite-overlay' ? overlay : {}; }}, saveState:function () {},
		selectPaletteColor:function (index, reveal) { assert.strictEqual(reveal, true); pickedColors.push(index); }});
	images.at(-1).onload();
	return mounted;
}
const reopened = mountPalette(reopenedPalette);
assert.deepStrictEqual(converted, [0, 0, 255, 255]);
reopened();
const rebuiltPalette = {...reopenedPalette, mappingColors:['#e70000', '#ff0000'], colors:['#e70000', '#ff00ff']};
const rebuilt = mountPalette(rebuiltPalette);
assert.deepStrictEqual(converted, [255, 0, 255, 255]);
rebuilt();

// Pick the stored index, even when edited display colors are identical; honor flips/bounds.
imageWidth = 2;
sourcePixels = [255, 0, 0, 255, 0, 0, 255, 255];
const pickingPalette = {...reopenedPalette, mappingColors:['#ff0000', '#0000ff'], colors:['#00ff00', '#00ff00']};
// The first Space + click must pick a color even if Space started in an inspector input.
studioState.previewMode = 'indexed';
studioState.zoom = 'fit';
const firstSpaceClick = mountPalette(pickingPalette, studioState);
windowHandlers.keydown({code:'Space', key:' ', target:{tagName:'INPUT'}});
canvas.onpointerdown({button:0, clientX:1, clientY:4, preventDefault:function () {}});
canvas.onpointerup({clientX:1, clientY:4});
assert.deepStrictEqual(pickedColors, [0]);
windowHandlers.keyup({code:'Space'});
firstSpaceClick();
pickedColors.length = 0;
function spaceClick(x, button = 0)
{
	pickingState.spacePressed = true;
	canvas.onpointerdown({button, clientX:x, clientY:4, preventDefault:function () {}});
	canvas.onpointerup({clientX:x, clientY:4});
	pickingState.spacePressed = false;
}
const picking = mountPalette(pickingPalette);
spaceClick(1);
spaceClick(7);
spaceClick(-1);
spaceClick(8);
assert.deepStrictEqual(pickedColors, [0, 1]);
spaceClick(1, 2);
canvas.onpointerdown({button:2, ctrlKey:false});
assert.deepStrictEqual(pickedColors, [0, 1]);
picking();
// Equal RGB values with different alpha must map to distinct, stable palette entries.
imageWidth = 4;
sourcePixels = [255, 0, 0, 255, 255, 0, 0, 128, 255, 0, 0, 64, 0, 255, 0, 0];
const alphaPalette = {...reopenedPalette, colors:['#00000000', '#ff000042', '#ff000084', '#ff0000ff'],
	mappingColors:['#00000000', '#ff000042', '#ff000084', '#ff0000ff'], transparentIndex:0};
const alphaPreview = mountPalette(alphaPalette);
assert.deepStrictEqual(converted, [255, 0, 0, 255, 255, 0, 0, 132, 255, 0, 0, 66, 0, 255, 0, 0]);
pickedColors.length = 0;
for(const x of [1, 3, 5, 7]) { spaceClick(x); }
assert.deepStrictEqual(pickedColors, [3, 2, 1, 0]);
alphaPalette.colors[2] = '#00ff0040';
alphaPreview.refreshPalette();
assert.deepStrictEqual(converted, [255, 0, 0, 255, 0, 255, 0, 64, 255, 0, 0, 66, 0, 255, 0, 0]);
pickedColors.length = 0;
spaceClick(3);
assert.deepStrictEqual(pickedColors, [2]);
alphaPreview();
const savedBlend = previewSprite.blend;
previewSprite.blend = 'additive';
const additivePreview = mountPalette(alphaPalette);
assert.deepStrictEqual(converted, [255, 0, 0, 255, 0, 255, 0, 64, 255, 0, 0, 66, 0, 255, 0, 0]);
additivePreview();
previewSprite.blend = 'opaque';
const opaquePreview = mountPalette(alphaPalette);
assert.deepStrictEqual(converted, [255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 0]);
opaquePreview();
previewSprite.blend = savedBlend;
// RGB565 is selectable, has a quantized opaque preview, and exposes no hidden stubs.
const inspectorHelpers = {...studioHelpers, state:{imageSizes:{'hero.png':{width:63, height:91}}},
	bundle:{resources:[pickingPalette], registries:{groups:['props'], types:['wood'], tags:['breakable']}}};
let inspector = spriteType.renderInspector(previewSprite, inspectorHelpers);
assert.ok(inspector.includes('Pivot preset'));
assert.ok(!inspector.includes('Anchor preset'));
assert.ok(!inspector.includes('Flip X'));
assert.ok(!inspector.includes('Flip Y'));
assert.ok(!inspector.includes('data-key="number"'));
assert.ok(!inspector.includes('data-key="frameRate"'));
assert.ok(!inspector.split('<summary>Manage groups, types and tags</summary>')[0].includes('data-add-classification'));
assert.ok(inspector.includes('Collider enabled'));
for(const label of ['X', 'Y', 'W', 'H']) { assert.ok(inspector.includes('<label>'+label+'<input')); }
const atPaletteLimit = {...inspectorHelpers, bundle:{...inspectorHelpers.bundle, resources:Array.from({length:64}, (_, index) => ({...pickingPalette, id:'p'+index, name:'p'+index}))}};
assert.ok(/value="__new_palette__"[^>]*disabled/.test(spriteType.renderInspector(previewSprite, atPaletteLimit)));
assert.throws(() => spriteType.validateCreate({name:'extra', source:'hero.png', paletteId:'', colorCount:33}, atPaletteLimit), /V-016/);
for(const registry of ['groups', 'types', 'tags']) { assert.ok(inspector.includes('data-delete-classification="'+registry+'"')); }
assert.throws(() => spriteType.change({...previewSprite}, 'number', {value:'32768'}), /V-011/);
assert.throws(() => spriteType.change({...previewSprite}, 'frameRate', {value:'1.5'}), /V-010/);
assert.throws(() => spriteType.change({...previewSprite}, 'pivotX', {value:'0.1'}, inspectorHelpers), /V-009/);
for(const key of ['fullsize', 'blend', 'group', 'objectType', 'tag', 'pivotX', 'pivotY'])
{
	assert.ok(inspector.includes('data-key="'+key+'"'), key);
}
assert.ok(inspector.includes('RGB565 — no palette'));
assert.ok(!inspector.includes('Keep in RAM'));
for(const mode of ['rgb6666', 'bump', 'dudv', 'refl', 'bg']) { assert.ok(!inspector.includes('value="'+mode+'"')); }
inspectorHelpers.state.advancedBlend = true;
assert.ok(spriteType.renderInspector(previewSprite, inspectorHelpers).includes('value="bg"'));
const rgbSprite = {...previewSprite, colorMode:'rgb565', paletteId:null, blend:'opaque', pivot:null};
const rgbPreviewHtml = spriteType.renderPreview(rgbSprite, inspectorHelpers);
const rgbInspectorHtml = spriteType.renderInspector(rgbSprite, inspectorHelpers);
assert.ok(rgbInspectorHtml.includes('Color Key'));
assert.ok(rgbInspectorHtml.includes('value="softkey"'));
assert.ok(!rgbInspectorHtml.includes('Softkey'));
assert.ok(!rgbPreviewHtml.includes('Softkey'));
assert.ok(rgbPreviewHtml.includes('>RGB565</button>'));
assert.ok(!rgbPreviewHtml.includes('data-palette-editor'));
imageWidth = 1;
sourcePixels = [128, 128, 128, 0];
const rgbState = {zoom:'4', previewMode:'indexed'};
const pivotEdits = [];
const rgbHelpers = {state:rgbState, bundle:{resources:[]},
	sources:[{path:'hero.png', uri:'test:hero.png', image:true}], main:{querySelectorAll:function () { return []; },
		querySelector:function (selector) { return selector === '#sprite-canvas' ? canvas : selector === '#sprite-preview' ? stage : selector === '#sprite-overlay' ? overlay : {}; }},
	saveState:function () {}, updateResource:function (resource) { pivotEdits.push(resource); },
	selectPaletteColor:function () { throw new Error('RGB565 must not pick palette entries.'); }};
const rgbPreview = spriteType.mountPreview(rgbSprite, rgbHelpers);
images.at(-1).onload();
assert.deepStrictEqual(converted, [132, 130, 132, 255]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(rgbState.imageSizes['hero.png'])), {width:1, height:1});
rgbState.spacePressed = true;
canvas.onpointerdown({button:0, clientX:4, clientY:4, preventDefault:function () {}});
canvas.onpointerup({clientX:4, clientY:4});
assert.strictEqual(pivotEdits.length, 0);
rgbState.spacePressed = false;
canvas.onkeydown({key:'ArrowRight', preventDefault:function () {}});
assert.deepStrictEqual(JSON.parse(JSON.stringify(pivotEdits.at(-1).pivot)), {x:1, y:0.5});
canvas.onkeydown({key:'ArrowUp', shiftKey:true, preventDefault:function () {}});
assert.deepStrictEqual(JSON.parse(JSON.stringify(pivotEdits.at(-1).pivot)), {x:0.5, y:-4.5});
assert.strictEqual(rgbSprite.pivot, null);
rgbPreview();
imageWidth = 2;
sourcePixels = [128, 128, 128, 255, 128, 128, 128, 255];
const ditheredPreview = spriteType.mountPreview({...rgbSprite, dither:true}, rgbHelpers);
images.at(-1).onload();
assert.deepStrictEqual(converted, [132, 130, 132, 255, 123, 125, 123, 255]);
ditheredPreview();
const customPivot = {...rgbSprite, pivot:{x:10, y:20.5}};
spriteType.change(customPivot, 'pivotPreset', {value:'bottomRight'}, inspectorHelpers);
assert.deepStrictEqual(JSON.parse(JSON.stringify(customPivot.pivot)), {x:63, y:91});
spriteType.change(customPivot, 'pivotPreset', {value:'center'}, inspectorHelpers);
assert.strictEqual(customPivot.pivot, null);
spriteType.change(customPivot, 'paletteId', {value:pickingPalette.id});
assert.strictEqual(customPivot.colorMode, 'palette');
assert.strictEqual(customPivot.dither, false);

// Softkey is validated and compared in the engine's RGB565 channel lattice.
const keyedSprite = {...rgbSprite};
spriteType.change(keyedSprite, 'compression', {value:'softkey'});
assert.deepStrictEqual(JSON.parse(JSON.stringify(keyedSprite.softkey)), {key:'#ff00ff', threshold:0});
assert.throws(() => spriteType.change(keyedSprite, 'softkeyHex', {value:'#ff00ff80'}), /V-020/);
assert.throws(() => spriteType.change(keyedSprite, 'softkeyThreshold', {value:'256'}), /V-020/);
imageWidth = 2;
sourcePixels = [255, 0, 255, 255, 255, 0, 0, 128];
let keyedPreview = spriteType.mountPreview(keyedSprite, rgbHelpers);
images.at(-1).onload();
assert.deepStrictEqual(converted, [255, 0, 255, 0, 255, 0, 0, 255]);
keyedPreview();
spriteType.change(keyedSprite, 'softkeyThreshold', {value:'1'});
sourcePixels = [247, 8, 247, 255, 247, 12, 247, 255];
keyedPreview = spriteType.mountPreview(keyedSprite, rgbHelpers);
images.at(-1).onload();
assert.deepStrictEqual(converted, [247, 8, 247, 0, 247, 12, 247, 255]);
keyedPreview();
spriteType.change(keyedSprite, 'paletteId', {value:pickingPalette.id});
assert.strictEqual(keyedSprite.softkey, null);

// Every collider corner is draggable; a drag updates live fields and commits once.
imageWidth = 20;
imageHeight = 10;
sourcePixels = Array.from({length:200}, () => [255, 0, 0, 255]).flat();
const colliderFields = Object.fromEntries(['colliderX', 'colliderY', 'colliderWidth', 'colliderHeight'].map(key => [key, {}]));
const colliderEdits = [];
const colliderState = {zoom:'4', previewMode:'source'};
const colliderHelpers = {...rgbHelpers, state:colliderState, updateResource:function (resource) { colliderEdits.push(resource); },
	main:{querySelectorAll:function () { return []; }, querySelector:function (selector)
	{
		return selector === '#sprite-canvas' ? canvas : selector === '#sprite-preview' ? stage : selector === '#sprite-overlay' ? overlay :
			colliderFields[selector.match(/data-key="([^"]+)"/)?.[1]] || {};
	}}};
const colliderSprite = {...rgbSprite, collider:{enabled:true, x:2, y:2, width:10, height:6}};
function cornerEvent(name, x, y)
{
	return {button:0, pointerId:7, clientX:x*8/20, clientY:y*8/10, target:{getAttribute:function () { return name; }}, preventDefault:function () {}, stopPropagation:function () {}};
}
for(const [name, start, end, expected] of [
	['topLeft', [2, 2], [4, 3], {enabled:true, x:4, y:3, width:8, height:5}],
	['topRight', [12, 2], [14, 1], {enabled:true, x:2, y:1, width:12, height:7}],
	['bottomRight', [12, 8], [10, 7], {enabled:true, x:2, y:2, width:8, height:5}],
	['bottomLeft', [2, 8], [1, 9], {enabled:true, x:1, y:2, width:11, height:7}],
	['topLeft', [2, 2], [14, 9], {enabled:true, x:12, y:8, width:2, height:1}],
	['topLeft', [2, 2], [-20, -10], {enabled:true, x:0, y:0, width:12, height:8}],
	['bottomRight', [12, 8], [50, 50], {enabled:true, x:2, y:2, width:18, height:8}]
])
{
	colliderEdits.length = 0;
	const mounted = spriteType.mountPreview(colliderSprite, colliderHelpers);
	images.at(-1).onload();
	assert.strictEqual((overlay.innerHTML.match(/data-collider-corner=/g) || []).length, 4);
	overlay.onpointerdown(cornerEvent(name, ...start));
	assert.strictEqual(capturedPointer, 7);
	overlay.onpointermove(cornerEvent(name, ...end));
	assert.strictEqual(colliderEdits.length, 0);
	assert.strictEqual(colliderFields.colliderWidth.value, expected.width);
	overlay.onpointerup(cornerEvent(name, ...end));
	assert.strictEqual(colliderEdits.length, 1);
	assert.deepStrictEqual(JSON.parse(JSON.stringify(colliderEdits[0].collider)), expected);
	assert.strictEqual(colliderEdits[0].pivot, colliderSprite.pivot);
	mounted();
}
colliderEdits.length = 0;
const cancelledCollider = spriteType.mountPreview(colliderSprite, colliderHelpers);
images.at(-1).onload();
overlay.onpointerdown(cornerEvent('topLeft', 2, 2));
overlay.onpointermove(cornerEvent('topLeft', 4, 3));
overlay.onpointercancel();
assert.strictEqual(colliderEdits.length, 0);
assert.strictEqual(colliderFields.colliderX.value, 2);
assert.strictEqual(colliderFields.colliderWidth.value, 10);
overlay.onkeydown({...cornerEvent('bottomRight', 12, 8), key:'ArrowRight'});
assert.strictEqual(colliderEdits.at(-1).collider.width, 10.5);
overlay.onkeydown({...cornerEvent('topLeft', 2, 2), key:'ArrowLeft', shiftKey:true});
assert.strictEqual(colliderEdits.at(-1).collider.x, 0);
assert.strictEqual(colliderEdits.at(-1).collider.width, 12);
cancelledCollider();
for(const [key, value] of [['colliderX', 11], ['colliderY', 5], ['colliderWidth', 19], ['colliderHeight', 9], ['colliderX', -1]])
{
	const before = JSON.stringify(colliderSprite.collider);
	assert.throws(() => spriteType.change(colliderSprite, key, {value:String(value)}, colliderHelpers), /within the sprite/);
	assert.strictEqual(JSON.stringify(colliderSprite.collider), before);
}
const toggledCollider = {...rgbSprite, collider:{enabled:false, x:0, y:0, width:0, height:0}};
spriteType.change(toggledCollider, 'colliderEnabled', {checked:true}, colliderHelpers);
assert.deepStrictEqual(JSON.parse(JSON.stringify(toggledCollider.collider)), {enabled:true, x:0, y:0, width:20, height:10});
spriteType.change(toggledCollider, 'colliderEnabled', {checked:false}, colliderHelpers);
assert.deepStrictEqual(JSON.parse(JSON.stringify(toggledCollider.collider)), {enabled:false, x:0, y:0, width:0, height:0});

const beforeInvalidName = sent.length;
change('name', 'icon');
assert.strictEqual(sent.length, beforeInvalidName);
assert.ok(root.innerHTML.includes('V-003'));
rootHandlers.change({target:{dataset:{paletteId:'palette-1', key:'colorCount'}, value:'257', type:'number'}});
assert.strictEqual(sent.length, beforeInvalidName);
assert.ok(root.innerHTML.includes('V-015'));
click({deleteClassification:'groups', name:'props'});
assert.strictEqual(sent.at(-1).action, 'deleteClassification');
assert.strictEqual(sent.at(-1).registry, 'groups');
assert.strictEqual(sent.at(-1).name, 'props');
update();
click({addClassification:'types'});
assert.strictEqual(sent.at(-1).action, 'addClassification');
assert.strictEqual(sent.at(-1).registry, 'types');
update();

windowHandlers.message({data:{type:'error', message:'V-020: Softkey requires a color.'}});
assert.ok(root.innerHTML.includes('V-020: Color Key requires a color.'));
windowHandlers.message({data:{type:'error', message:'V-005: Missing file: Softkey.png'}});
assert.ok(root.innerHTML.includes('Softkey.png'));
windowHandlers.message({data:{type:'invalid', message:'Corrupt JSON'}});
assert.ok(root.innerHTML.includes('Corrupt JSON'));
assert.ok(root.innerHTML.includes('Edit JSON to correct it'));
console.log('Resource Studio webview checks passed: embedded palette editing, live RGBA redraw, rebuilt palettes, palette prompts, deferred saving, and invalid-document recovery.');
