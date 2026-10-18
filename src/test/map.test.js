const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const geometry = require('../../media/mapgeometry');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');

function canvas()
{
	const c = {width:0, height:0};
	let data = new Uint8Array(), width = 0, height = 0;
	Object.defineProperty(c, 'width', {get:() => width, set:value => { width = value; data = new Uint8Array(width*height); }});
	Object.defineProperty(c, 'height', {get:() => height, set:value => { height = value; data = new Uint8Array(width*height); }});
	const ctx = {canvas:c, fillStyle:'', fillRect:function (x, y, w, h)
	{
		const color = this.fillStyle === '#252525' ? 1 : this.fillStyle === '#ffffff' ? 3 : 2;
		for(let row = y; row < y + h; row++) { data.fill(color, row*width + x, row*width + x + w); }
	}, clearRect:function (x, y, w, h) { for(let row = y; row < y + h; row++) { data.fill(0, row*width + x, row*width + x + w); } }};
	return {ctx, pixel:(x, y) => data[y*width + x], data:() => data};
}
function runs(values)
{
	const result = [];
	for(let x = 0; x < values.length; x++)
	{
		const previous = result.at(-1);
		if(previous && previous.color === values[x]) { previous.length++; }
		else { result.push({color:values[x], start:x, length:1}); }
	}
	return result.map(item => (item.color === 1 ? 'line' : 'cell')+' '+item.start+'+'+item.length).join(', ');
}
const target = canvas();
const l = geometry.renderNet(target.ctx);
assert.deepStrictEqual([l.F, l.k, l.gridWidth, l.gridHeight, l.canvasWidth, l.canvasHeight], [258, 0.5, 1088, 812, 1088, 812]);
assert.deepStrictEqual(l.faces.map(f => [f.side, f.centre.x, f.centre.y]), [[0, 406, 130], [1, 406, 406], [2, 682, 406], [3, 958, 406], [4, 130, 406], [5, 406, 682]]);
for(const x of [405, 406]) { for(const y of [405, 406]) { assert.strictEqual(target.pixel(x, y), 3); } }
assert.strictEqual(target.data().filter(value => value === 3).length, 24);
assert.strictEqual(runs(Array.from({length:l.gridWidth}, (_, x) => target.pixel(x, 330))), 'line 0+1, cell 1+120, line 121+18, cell 139+120, line 259+18, cell 277+120, line 397+18, cell 415+120, line 535+18, cell 553+120, line 673+18, cell 691+120, line 811+18, cell 829+120, line 949+18, cell 967+120, line 1087+1');
assert.strictEqual(runs(Array.from({length:l.gridHeight}, (_, y) => target.pixel(330, y))), 'line 0+1, cell 1+120, line 121+18, cell 139+120, line 259+18, cell 277+120, line 397+18, cell 415+120, line 535+18, cell 553+120, line 673+18, cell 691+120, line 811+1');
assert.strictEqual(runs(Array.from({length:l.gridWidth}, (_, x) => target.pixel(x, 100))), 'line 0+1, cell 1+258, line 259+18, cell 277+120, line 397+18, cell 415+120, line 535+18, cell 553+534, line 1087+1');
geometry.renderNet(target.ctx, {markers:false});
assert.deepStrictEqual([...new Set(target.data())].sort(), [1, 2]);
geometry.renderNet(target.ctx, {markers:false, background:null});
assert.deepStrictEqual([...new Set(target.data())].sort(), [0, 1]);
assert.deepStrictEqual(geometry.faceToCanvas(l, 1, 138, 138), {x:475, y:337});
assert.deepStrictEqual(geometry.canvasToFace(l, 475, 337), {side:1, X:138, Y:138});
assert.strictEqual(geometry.canvasToFace(l, 406, 268).side, 0);
assert.strictEqual(geometry.canvasToFace(l, 268, 406).side, 1);
const padded = geometry.computeNetLayout({padding:{right:112,bottom:88}});
assert.deepStrictEqual([padded.canvasWidth, padded.canvasHeight], [1200,900]);
const full = geometry.computeNetLayout({screenSize:240, innerGap:36, faceEdgeGap:36});
assert.deepStrictEqual([full.F, full.gridWidth, full.gridHeight, full.faces[1].centre], [516, 2174, 1622, {x:811, y:811}]);
const independent = geometry.renderNet(target.ctx, {screenSize:100, innerGap:10, faceEdgeGap:6, frame:2});
assert.deepStrictEqual([independent.F, independent.gridWidth, independent.gridHeight], [210, 862, 646]);
assert.deepStrictEqual(independent.faces.map(f => f.centre), [{x:323,y:107},{x:323,y:323},{x:539,y:323},{x:755,y:323},{x:107,y:323},{x:323,y:539}]);
assert.strictEqual(runs(Array.from({length:independent.gridWidth}, (_, x) => target.pixel(x, 293))), 'line 0+2, cell 2+100, line 102+10, cell 112+100, line 212+6, cell 218+100, line 318+10, cell 328+100, line 428+6, cell 434+100, line 534+10, cell 544+100, line 644+6, cell 650+100, line 750+10, cell 760+100, line 860+2');
const p = geometry.canvasToFace(independent, 378, 268);
assert.strictEqual(p.side, 1); assert.ok(Math.abs(p.X - 132) < 1e-9 && Math.abs(p.Y - 132) < 1e-9);
for(const params of [{innerGap:9}, {screenSize:0}, {frame:-1}, {faceEdgeGap:2.5}, {padding:{right:0,bottom:-1}}]) { assert.throws(() => geometry.computeNetLayout(params)); }
assert.doesNotThrow(() => geometry.computeNetLayout({screenSize:1,innerGap:0,faceEdgeGap:0,frame:0,padding:{right:0,bottom:0}}));
for(const layout of [l, independent, full])
{
	for(let side = 0; side < 6; side++)
	{
		const point = geometry.faceToCanvas(layout, side, -30.5, 42);
		const face = layout.faces[side];
		assert.ok(Math.abs((point.x - face.centre.x)/layout.k + 30.5) < 1e-9);
	}
}

// Relative coordinates use the nearest display's top-left and screen pixels.
for(const layout of [l, independent, full])
{
	for(let side = 0; side < 6; side++)
	{
		for(let screen = 0; screen < 4; screen++)
		{
			const absolute = geometry.screenToFace(layout, side, screen, layout.S/2, layout.S/2);
			const relative = geometry.faceToScreen(layout, side, absolute.X, absolute.Y);
			assert.strictEqual(relative.screen, screen);
			assert.ok(Math.abs(relative.x-layout.S/2)<1e-9 && Math.abs(relative.y-layout.S/2)<1e-9);
		}
	}
}
assert.deepStrictEqual(geometry.faceToScreen(l,1,138,138), {screen:1,x:60,y:60});
assert.deepStrictEqual(geometry.screenToFace(l,1,1,70,75), {X:158,Y:108});
assert.deepStrictEqual(geometry.faceToScreen(l,1,0,0), {screen:0,x:129,y:129});
assert.ok(geometry.faceToScreen(l,1,-1000,1000).x<0, 'Free placement must remain representable outside a display.');
assert.throws(()=>geometry.screenToFace(l,1,4,60,60));
assert.throws(()=>geometry.screenToFace(l,1,1,Infinity,60));

const bundle = ResourceBundles.create();
const sprite = ResourceTypes.get('sprite').create('sprite', 'hero', 'hero.png', {colorMode:'rgb565'});
const map = ResourceTypes.get('map').create('map', 'level');
map.placements = [{id:'top', spriteId:sprite.id, side:1, x:138, y:138}, {id:'bottom', spriteId:sprite.id, side:4, x:-900, y:1234.5}];
map.custom = {preserve:true}; map.placements[0].custom = 'keep';
bundle.resources.push(sprite, map);
assert.deepStrictEqual(ResourceBundles.validate(bundle), []);
assert.deepStrictEqual(ResourceBundles.parse(JSON.stringify(bundle)), bundle);
assert.deepStrictEqual(ResourceBundles.getDependents(bundle, sprite.id), [map]);
assert.deepStrictEqual(ResourceTypes.get('map').getReferences(map), [sprite.id]);
for(const mutate of [m => m.placements[0].twistable='true', m => m.placements[0].twistable=null, m => m.placements[0].spriteId='missing', m => m.placements[1].id='top', m => m.placements[0].side=6, m => m.placements[0].x=Infinity, m => m.sideMarkers.pop(), m => m.sideMarkers[0].x=1, m => m.net.innerGap=9, m => m.net.backgroundImage='../outside.png'])
{
	const copy = JSON.parse(JSON.stringify(bundle)); mutate(copy.resources[1]);
	assert.ok(ResourceBundles.validate(copy).length);
}
const clone = ResourceTypes.get('map').create('another', 'another');
clone.net.padding.right = 112;
assert.strictEqual(map.net.padding.right, 0, 'Defaults must not share mutable objects.');
const context = vm.createContext({window:{ResourceStudioMapGeometry:geometry}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../media/maprenderer.js'), 'utf8'), context);
const bounds = context.window.ResourceStudioMapRenderer.placementBounds;
assert.deepStrictEqual(JSON.parse(JSON.stringify(bounds(l, map.placements[0], {...sprite, fullsize:true, pivot:{x:10,y:20}}, 100, 80))), {x:470,y:327,width:50,height:40,pivot:{x:475,y:337}});
assert.deepStrictEqual(JSON.parse(JSON.stringify(bounds(l, map.placements[0], {...sprite, fullsize:false, pivot:null}, 100, 80))), {x:425,y:297,width:100,height:80,pivot:{x:475,y:337}});
assert.strictEqual(bounds(full, map.placements[0], {...sprite, fullsize:true}, 100, 80).width, 100);
const fits = context.window.ResourceStudioMapRenderer.placementFitsScreen;
const centered = {...sprite,pivot:null,fullsize:false};
const placement = {side:1,x:138,y:138};
assert.strictEqual(fits(l,placement,centered,120,120),true,'Edges exactly aligned with a screen must not warn.');
assert.strictEqual(fits(l,placement,centered,20,20),true,'Smaller contained sprites must not warn.');
assert.strictEqual(fits(l,{...placement,x:139},centered,120,120),false,'Partial overflow must warn.');
assert.strictEqual(fits(l,{...placement,x:0},centered,120,120),false,'Crossing a screen gap must warn.');
assert.strictEqual(fits(l,{...placement,x:-1000},centered,120,120),false,'Off-net sprites must warn.');
assert.strictEqual(fits(l,placement,{...centered,fullsize:true},240,240),true,'FULLSIZE scaling must be included.');
assert.strictEqual(fits(l,placement,centered,121,120),false,'Sprites larger than a screen must warn.');
assert.strictEqual(fits(l,{side:1,x:18,y:258},{...centered,pivot:{x:0,y:0}},120,120),true,'Authored pivots must be included.');
map.placements[0].twistable = true;
assert.strictEqual(ResourceBundles.parse(JSON.stringify(bundle)).resources[1].placements[0].twistable,true);
assert.deepStrictEqual(ResourceBundles.validate(bundle),[], 'Out-of-screen placements are valid model data.');
const contract = fs.readFileSync(path.join(__dirname, '../../resource-json-model.txt'), 'utf8');
const examples = [...contract.matchAll(/^\{[\s\S]*?^\}/gm)].map(match => JSON.parse(match[0]));
for(const example of examples.filter(item => item.schemaVersion)) { assert.deepStrictEqual(ResourceBundles.validate(example), []); }
const documented = examples.find(item => item.resources?.some(resource => resource.id === 'sprite_hero'));
documented.resources.push(examples.find(item => item.type === 'map'));
assert.deepStrictEqual(ResourceBundles.validate(documented), []);
console.log('Map checks passed: exact net pixels, custom geometry, transparent gaps, face conversion/ties, model references, repeated placements, markers, pivot anchoring, and FULLSIZE scaling.');
