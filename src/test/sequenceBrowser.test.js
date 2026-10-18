// Optional Chromium integration, using the same boundary as the real webview.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {chromium} = require('playwright');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');
const {SpriteSequences} = require('../../out/SpriteSequence');
const bundle = ResourceBundles.create();
const items = SpriteSequences.createFrames(bundle,'jump',[{source:'a.png',width:40,height:50},{source:'b.png',width:80,height:90}],1);
items.forEach(frame => { frame.colorMode='rgb565';frame.blend='opaque';frame.compression='plain'; }); bundle.resources.push(...items);
const media = path.join(__dirname,'../../media');
const scripts=['resourcevalidation.js','spritepixels.js','previewviewport.js','mapgeometry.js','sourcefiles.js','spritelist.js','palettecompatibility.js','resourcetypes.js','maptextures.js','maprenderer.js','mapeditor.js','mapresource.js','sequenceeditor.js','resourcestudio.js'];
const setup=`
window.bundle=${JSON.stringify(bundle)};window.version=1;window.messages=[];window.metrics={images:0,conversions:0};
const ImageType=window.Image;window.Image=class extends ImageType{constructor(){super();window.metrics.images++;}};
window.sources=window.bundle.resources.map((frame,index)=>{const c=document.createElement('canvas');c.width=index?80:40;c.height=index?90:50;const ctx=c.getContext('2d');ctx.fillStyle=index?'#00ff00':'#ff0000';ctx.fillRect(0,0,c.width,c.height);return{path:frame.source,uri:c.toDataURL(),image:true,missing:false};});
window.saved={tab:'Animations',selected:window.bundle.resources[0].id};
window.sendUpdate=()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'update',bundle:structuredClone(window.bundle),sources:window.sources,resourceTypes:[{type:'sprite',label:'Sprite',canCreate:true},{type:'palette',label:'Palette',canCreate:false},{type:'map',label:'Map',canCreate:true}],version:window.version,dirty:true,project:'Sequence test'}}));
window.acquireVsCodeApi=()=>({getState:()=>window.saved,setState:value=>window.saved=value,postMessage:message=>{window.messages.push(message);if(message.type==='ready')setTimeout(window.sendUpdate,0);if(message.type==='change'){setTimeout(()=>{if(message.action==='sequenceUpdate'){message.frames.forEach((edit,index)=>{const frame=window.bundle.resources.find(f=>f.id===edit.id);Object.assign(frame,edit);frame.sequence={...frame.sequence,name:message.name,index};});}window.version++;window.sendUpdate();},20);}}});
`;
async function run()
{
	const browser=await chromium.launch({headless:true,...(process.env.WOWCUBE_BROWSER?{executablePath:process.env.WOWCUBE_BROWSER}:{})});
	try
	{
		const page=await browser.newPage({viewport:{width:1400,height:1050}}), errors=[];page.on('pageerror',error=>errors.push(error.message));
		await page.setContent('<style>'+['resourcestudio.css','mapeditor.css','sequenceeditor.css'].map(file=>fs.readFileSync(path.join(media,file),'utf8')).join('\n')+'</style><div id="resource-studio"></div><script>'+setup+'</script>'+scripts.map(file=>'<script>'+fs.readFileSync(path.join(media,file),'utf8')+'</script>').join(''));
		await page.waitForSelector('[data-sequence-key="x"]');await page.waitForFunction(()=>document.querySelector('.sequence-inspector').textContent.includes('40 × 50'));
		await page.evaluate(()=>{window.canvasBefore=document.querySelector('#sequence-canvas');window.metricsBefore={...window.metrics};});
		assert.strictEqual(await page.locator('[data-sequence-key="x"]').inputValue(),'-20');
		async function edit(selector,value)
		{
			const v=await page.evaluate(()=>window.version);await page.locator(selector).fill(value);await page.locator(selector).press('Tab');await page.waitForFunction(v=>window.version>v,v);await page.waitForTimeout(40);
			assert.deepStrictEqual(await page.evaluate(()=>window.bundle),JSON.parse(JSON.stringify(await page.evaluate(()=>window.bundle))));
		}
		await edit('[data-sequence-key="x"]','-60.5');
		assert.strictEqual(await page.evaluate(()=>window.bundle.resources[0].pivot.x),60.5);
		assert.strictEqual(await page.evaluate(()=>document.querySelector('#sequence-canvas')===window.canvasBefore),true,'Position edits preserve the canvas.');
		// Shared viewport behaviour: vertical handle and Shift+wheel zoom.
		const handle=await page.locator('.preview-resize-handle').boundingBox(); assert(handle.height>=6);
		const height=await page.locator('#sequence-preview').evaluate(node=>node.getBoundingClientRect().height);
		await page.mouse.move(handle.x+30,handle.y+3);await page.mouse.down();await page.mouse.move(handle.x+30,handle.y+53);await page.mouse.up();
		assert((await page.locator('#sequence-preview').evaluate(node=>node.getBoundingClientRect().height))>=height+45);
		await page.locator('[data-sequence-zoom]').selectOption('1');
		await page.locator('#sequence-preview').dispatchEvent('wheel',{deltaY:-80,shiftKey:true,clientX:500,clientY:400});
		assert.strictEqual(await page.locator('[data-sequence-zoom]').inputValue(),'2');
		await page.locator('[data-sequence-zoom]').selectOption('1');
		const rect=await page.locator('#sequence-canvas').boundingBox();
		// Frame top-left (-60.5,-25), relative to the origin at canvas center.
		await page.mouse.move(rect.x+rect.width/2-50,rect.y+rect.height/2-10);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2-35,rect.y+rect.height/2+10);await page.mouse.up();
		await page.waitForFunction(()=>window.bundle.resources[0].pivot.x===45.5);
		assert.strictEqual(await page.evaluate(()=>window.bundle.resources[0].pivot.y),5);

		// Origin arrows shift every frame pivot, with the visual camera keeping sprites still.
		const pivotsBefore=await page.evaluate(()=>window.bundle.resources.map(frame=>({...frame.pivot})));
		const spritePixel=()=>page.evaluate(()=>Array.from(document.querySelector('#sequence-canvas').getContext('2d').getImageData(145,190,1,1).data));
		const pixelBefore=await spritePixel();
		for(const [direction,dx,dy] of [['right',1,0],['left',-1,0],['up',0,-1],['down',0,1]])
		{
			const before=await page.evaluate(()=>window.bundle.resources.map(frame=>({...frame.pivot}))),v=await page.evaluate(()=>window.version);
			await page.locator('[data-sequence-action="origin-'+direction+'"]').click();
			await page.waitForFunction(v=>window.version>v,v);await page.waitForTimeout(40);
			assert.deepStrictEqual(await page.evaluate(()=>window.bundle.resources.map(frame=>frame.pivot)),before.map(p=>({x:p.x+dx,y:p.y+dy})));
			assert.deepStrictEqual(await spritePixel(),pixelBefore,'Origin shifts keep the displayed sprite stationary.');
			assert.strictEqual(await page.evaluate(()=>window.canvasBefore===document.querySelector('#sequence-canvas')),true);
		}
		assert.deepStrictEqual(await page.evaluate(()=>window.bundle.resources.map(frame=>frame.pivot)),pivotsBefore);
		const overlay=await page.locator('.sequence-origin-controls').boundingBox(),preview=await page.locator('#sequence-preview').boundingBox();
		assert(overlay.x+overlay.width<=preview.x+preview.width && overlay.y+overlay.height<=preview.y+preview.height);
		assert(overlay.x>preview.x+preview.width/2 && overlay.y>preview.y+preview.height/2);

		const beforeRemoval=await page.evaluate(()=>window.messages.length);
		await page.locator('[data-sequence-action="remove"]').click();
		assert.match(await page.locator('[data-sequence-time]').innerText(),/at least two frames/);
		assert.strictEqual(await page.evaluate(()=>window.messages.length),beforeRemoval,'A two-frame animation must not be reduced to one frame.');
		await page.locator('[data-sequence-frame="1"]').click({modifiers:['Shift']});
		assert.strictEqual(await page.locator('.sequence-frame[aria-pressed=true]').count(),2);
		await edit('[data-sequence-key="duration"]','150');
		assert.deepStrictEqual(await page.evaluate(()=>window.bundle.resources.map(f=>f.frameRate)),[2,2]);
		await page.locator('[data-sequence-action="earlier"]').click();await page.waitForTimeout(100);
		assert.strictEqual(await page.locator('[data-sequence-key="name"]').inputValue(),items[1].name,'Reorder retains selected frame.');
		await page.locator('[data-sequence-action="play"]').click();await page.waitForTimeout(400);
		assert.strictEqual(await page.locator('[data-sequence-action="play"]').innerText(),'Pause');
		await page.locator('[data-sequence-action="play"]').click();
		assert.strictEqual(await page.evaluate(()=>window.metrics.images),2,'Editing and playback reuse decoded images.');
		assert.strictEqual(await page.evaluate(()=>window.canvasBefore===document.querySelector('#sequence-canvas')),false,'Reordering remounts only structural UI.');
		// Ctrl/Cmd+S commits a focused offset before saving.
		await page.locator('[data-sequence-key="y"]').fill('-100.5');
		await page.locator('[data-sequence-key="y"]').press('Control+s');
		await page.waitForFunction(()=>window.bundle.resources.find(frame=>frame.sequence.index===0).pivot.y===100.5);
		await page.waitForFunction(()=>window.messages.some(message=>message.type==='save'));
		// Duplicate names cannot be flushed into a build or saved silently.
		await page.locator('[data-sequence-key="name"]').fill(items[0].name);await page.locator('[data-sequence-key="name"]').press('Tab');
		await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'flushEdits',requestId:'test'}})));
		assert.match(await page.evaluate(()=>window.messages.findLast(message=>message.type==='flushedEdits').error),/invalid animation/);

		await page.locator('[data-sequence-key="name"]').fill('jump_end');await page.locator('[data-sequence-key="name"]').press('Tab');
		assert.match(await page.locator('[data-sequence-key="name"]').evaluate(node=>node.validationMessage),/already used/);
		assert.deepStrictEqual(errors,[]);
		assert.deepStrictEqual(ResourceBundles.validate(await page.evaluate(()=>window.bundle)),[]);
		await page.screenshot({path:'/private/tmp/resource-studio-animations.png'});
		// Both sprite libraries group sequence frames, preserve expansion separately,
		// and retain the ordinary select/add controls inside the group.
		await page.evaluate(map => {
			window.bundle.resources.push(map);
			const sprite=structuredClone(window.bundle.resources[0]);delete sprite.sequence;sprite.id='static';sprite.name='static_sprite';
			window.bundle.resources.push(sprite);window.version++;window.sendUpdate();
		}, ResourceTypes.get('map').create('map','test_map'));
		await page.locator('[data-tab="Sprites"]').click();
		let group=page.locator('.library .sprite-group');
		assert.strictEqual(await group.count(),1);
		assert.match(await group.locator('summary').innerText(),/jump[\s\S]*2 sprites/);
		assert.strictEqual(await group.evaluate(node=>node.open),false);
		assert.strictEqual(await page.locator('.library > [data-select="static"]').isVisible(),true);
		await group.locator('summary').click();await page.waitForTimeout(40);
		assert.deepStrictEqual(await group.locator('[data-select]').evaluateAll(nodes=>nodes.map(node=>node.dataset.select)),[items[1].id,items[0].id]);
		await group.locator('[data-select="'+items[0].id+'"]').click();
		assert.strictEqual(await page.locator('.library .sprite-group').evaluate(node=>node.open),true);
		assert.strictEqual(await page.locator('.tabs [data-tab="Sprites"]').getAttribute('aria-pressed'),'true');
		await page.locator('[data-tab="Maps"]').click();
		group=page.locator('.map-sprite-library .sprite-group');
		assert.strictEqual(await group.count(),1);assert.strictEqual(await group.evaluate(node=>node.open),false);
		await group.locator('summary').click();await page.waitForTimeout(40);
		await group.locator('[data-map-add="'+items[0].id+'"]').click();
		await page.waitForFunction(()=>window.messages.some(message=>message.action==='update' && message.resource?.type==='map'));
		assert.strictEqual(await page.evaluate(()=>window.messages.findLast(message=>message.action==='update').resource.placements[0].spriteId),items[0].id);
		await page.locator('[data-tab="Sprites"]').click();
		assert.strictEqual(await page.locator('.library .sprite-group').evaluate(node=>node.open),true);
		assert.deepStrictEqual(errors,[]);

		console.log('Sequence browser checks passed: fixed-origin dragging, sequence-wide origin arrows, source-pixel pivots, bulk timing, reorder selection, cached playback, persistent canvas, invalid-field build blocking and collapsible animation groups in both sprite libraries.');
	}
	finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
