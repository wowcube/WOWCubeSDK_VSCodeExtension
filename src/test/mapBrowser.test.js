// Optional real-browser integration: supply Playwright and WOWCUBE_BROWSER (a Chromium executable).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {chromium} = require('playwright');
const {ResourceBundles, ResourceTypes} = require('../../out/ResourceBundle');
const media = path.join(__dirname, '../../media');
const bundle = ResourceBundles.create();
const palette = ResourceTypes.get('palette').create('palette', 'shared_palette');
palette.colors = ['#00000000', '#ff000084', '#0000ffff']; palette.mappingColors = palette.colors.slice();
const sprite = ResourceTypes.get('sprite').create('hero', 'hero', 'hero.png', {paletteId:palette.id}); sprite.fullsize = true; sprite.pivot = {x:20, y:30};
const second = {...sprite, id:'other', name:'other', source:'other.png', fullsize:false};
const map = ResourceTypes.get('map').create('map', 'level_01');
map.placements = [{id:'top',spriteId:sprite.id,side:1,x:138,y:138}, {id:'bottom',spriteId:second.id,side:1,x:138,y:138}];
bundle.resources.push(palette, sprite, second, map);
const scripts = ['sourcefiles.js','spritelist.js','palettecompatibility.js','soundvalidation.js', 'resourcevalidation.js','spritepixels.js','previewviewport.js','mapgeometry.js','resourcetypes.js','maptextures.js','maprenderer.js','mapeditor.js','mapresource.js','sequenceeditor.js','fonteditor.js','soundeditor.js','resourcestudio.js'];
const initial = `
window.testMetrics={images:0,conversions:0,frames:0,draws:0};
const NativeImage=window.Image;
window.Image=class extends NativeImage{constructor(){super();window.testMetrics.images++;}};
window.testBundle=${JSON.stringify(bundle)}; window.testVersion=1; window.testMessages=[];
window.testTemplate=${JSON.stringify(ResourceTypes.get('map').create('template','template'))};
window.testState={tab:'Maps',selected:'map'};
const image=document.createElement('canvas'); image.width=100; image.height=80;
const ctx=image.getContext('2d'); ctx.fillStyle='#ff0000';ctx.fillRect(0,0,100,80);const uri=image.toDataURL();
ctx.fillStyle='#0000ff';ctx.fillRect(0,0,100,80);const blue=image.toDataURL();
window.testSources=[{path:'hero.png',uri,image:true,missing:false},{path:'other.png',uri:blue,image:true,missing:false}];
window.testUpdate=()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'update',bundle:structuredClone(window.testBundle),sources:structuredClone(window.testSources),resourceTypes:[{type:'palette',label:'Palette',canCreate:false},{type:'sprite',label:'Sprite',canCreate:true},{type:'map',label:'Map',canCreate:true},{type:'font',label:'Font',canCreate:true},{type:'sound',label:'Sound',canCreate:true}],version:window.testVersion,dirty:true,project:'Map test'}}));
window.acquireVsCodeApi=()=>({getState:()=>window.testState,setState:value=>window.testState=value,postMessage:message=>{
window.testMessages.push(message);
if(message.type==='ready')setTimeout(window.testUpdate,0);
if(message.type==='change')setTimeout(()=>{
 if(message.action==='update') { const index=window.testBundle.resources.findIndex(item=>item.id===message.resource.id);window.testBundle.resources[index]=message.resource; }
 if(message.action==='reservePaletteIndex')window.ResourceStudioPaletteCompatibility.reserve(window.testBundle.resources.find(item=>item.id===message.id));
 if(message.action==='create')window.testBundle.resources.push({...structuredClone(window.testTemplate),id:'created',name:message.name});
 window.testVersion++;window.testUpdate();
},10);
}});
`;
async function run()
{
	const browser = await chromium.launch({headless:true, ...(process.env.WOWCUBE_BROWSER ? {executablePath:process.env.WOWCUBE_BROWSER} : {})});
	try
	{
		const page = await browser.newPage({viewport:{width:1280,height:950},colorScheme:'dark'});
		const errors = []; page.on('pageerror', error => errors.push(error.message));
		await page.setContent('<style>'+fs.readFileSync(path.join(media,'resourcestudio.css'),'utf8')+'\n'+fs.readFileSync(path.join(media,'mapeditor.css'),'utf8')+'</style><div id="resource-studio"></div><script>'+initial+'</script>'+scripts.map(file => '<script>'+fs.readFileSync(path.join(media,file),'utf8')+'</script>').join(''));
		await page.waitForSelector('#map-canvas');
		assert.deepStrictEqual(await page.locator('.tabs [data-tab]').evaluateAll(nodes=>nodes.map(node=>node.dataset.tab)),['Sprites','Maps','Animations','Fonts','Sounds','Palettes','Source files']);
		await page.waitForTimeout(100);
		await page.evaluate(()=>
		{
			const convert=window.ResourceStudioPixels.convert;
			window.ResourceStudioPixels.convert=(...args)=>{window.testMetrics.conversions++;return convert(...args);};
			const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage;
			CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='map-canvas')window.testMetrics.frames++;return clear.apply(this,args);};
			CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.id==='map-canvas')window.testMetrics.draws++;return draw.apply(this,args);};
		});

		const current = () => page.evaluate(() => window.testBundle.resources.find(item=>item.id==='map'));
		async function change(action)
		{
			const version = await page.evaluate(() => window.testVersion); await action();
			await page.waitForFunction(v => window.testVersion>v, version);
			await page.waitForTimeout(30);
		}
		assert.strictEqual(await page.locator('[data-map-key="net.frame"], [data-map-key="net.padding.right"], [data-map-key="net.padding.bottom"]').count(),0);
		const initialHeight=await page.evaluate(()=>({preview:document.querySelector('#map-preview').getBoundingClientRect().height,available:document.querySelector('.map-center').clientHeight}));
		assert.ok(Math.abs(initialHeight.preview-initialHeight.available*0.75)<=1);
		assert.strictEqual(await page.locator('.map-placement').count(),2);
		assert.strictEqual(await page.locator('.map-source-sprite').count(),2);
		const beforeLock=await page.evaluate(()=>({version:window.testVersion,placements:structuredClone(window.testBundle.resources.find(item=>item.id==='map').placements),metrics:{...window.testMetrics}}));
		assert.strictEqual(await page.locator('[data-map-lock="top"]').getAttribute('aria-pressed'),'false');
		await page.locator('[data-map-lock="top"]').click();
		assert.strictEqual(await page.locator('[data-map-lock="top"]').getAttribute('aria-pressed'),'true');
		assert.strictEqual(await page.locator('[data-map-select="top"]').isDisabled(),true);
		assert.strictEqual(await page.locator('[data-map-instance="top"]').getAttribute('draggable'),'false');
		assert.strictEqual(await page.locator('[data-map-key="relativeX"]').count(),0,'Locking a selected placement must clear the inspector.');
		assert.strictEqual(await page.locator('[data-map-remove]').isDisabled(),true);
		const lockedPoint=await page.locator('#map-canvas').evaluate(canvas=>{const r=canvas.getBoundingClientRect();return{x:r.left+480*r.width/canvas.width,y:r.top+340*r.height/canvas.height};});
		await page.mouse.click(lockedPoint.x,lockedPoint.y);
		assert.strictEqual(await page.locator('[data-map-select="bottom"]').getAttribute('aria-pressed'),'true','Canvas picking must pass through locked sprites.');
		await page.locator('[data-map-lock="bottom"]').focus();await page.keyboard.press('Space');
		await page.mouse.click(lockedPoint.x,lockedPoint.y);
		assert.strictEqual(await page.locator('[data-map-key="relativeX"]').count(),0,'Locked sprites must not be picked from the canvas.');
		await page.locator('#map-canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');
		await page.locator('[data-map-instance="top"]').dispatchEvent('dragstart');
		await page.locator('[data-map-instance="bottom"]').dispatchEvent('drop');
		assert.strictEqual(await page.evaluate(()=>window.testVersion),beforeLock.version,'Locking and attempting to edit locked sprites must not modify the JSON.');
		assert.deepStrictEqual((await current()).placements,beforeLock.placements);
		await page.locator('[data-tab="Palettes"]').click();await page.locator('[data-tab="Maps"]').click();
		assert.strictEqual(await page.locator('[data-map-lock="top"]').getAttribute('aria-pressed'),'true','Locks must survive editor remounts.');
		assert.strictEqual(await page.locator('[data-map-select="top"]').isDisabled(),true);
		await page.locator('[data-map-lock="top"]').click();await page.locator('[data-map-lock="bottom"]').click();
		await page.locator('[data-map-select="top"]').click();
		assert.strictEqual(await page.locator('[data-map-select="top"]').isEnabled(),true);
		assert.strictEqual(await page.locator('[data-map-instance="top"]').getAttribute('draggable'),'true');
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.images),beforeLock.metrics.images);
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.conversions),beforeLock.metrics.conversions);
		assert.strictEqual(await page.locator('[data-map-key="x"], [data-map-key="y"]').count(),0);
		assert.strictEqual(await page.getByLabel('Relative X',{exact:true}).inputValue(),'60');
		assert.strictEqual(await page.getByLabel('Relative Y',{exact:true}).inputValue(),'60');
		await change(async()=>{await page.getByLabel('Relative X',{exact:true}).fill('70');await page.getByLabel('Relative X',{exact:true}).press('Tab');});
		assert.strictEqual((await current()).placements[0].x,158);
		await change(async()=>{await page.getByLabel('Relative Y',{exact:true}).fill('75');await page.getByLabel('Relative Y',{exact:true}).press('Tab');});
		assert.strictEqual((await current()).placements[0].y,108);
		assert.ok(!Object.hasOwn((await current()).placements[0],'relativeX'),'Relative coordinates must not change the JSON contract.');
		await change(async()=>{await page.getByLabel('Relative X',{exact:true}).fill('60');await page.getByLabel('Relative X',{exact:true}).press('Tab');});
		await change(async()=>{await page.getByLabel('Relative Y',{exact:true}).fill('60');await page.getByLabel('Relative Y',{exact:true}).press('Tab');});
		assert.strictEqual(await page.getByLabel('Relative X',{exact:true}).inputValue(),'60');
		assert.strictEqual(await page.getByLabel('Relative Y',{exact:true}).inputValue(),'60');
		assert.strictEqual(await page.getByLabel('Twistable',{exact:true}).isChecked(),false);
		await change(()=>page.getByLabel('Twistable',{exact:true}).check());
		assert.strictEqual((await current()).placements[0].twistable,true);
		assert.strictEqual((await current()).placements[1].twistable,false,'Twistable belongs to each placement.');
		await change(async()=>{await page.getByLabel('Relative X',{exact:true}).fill('130');await page.getByLabel('Relative X',{exact:true}).press('Tab');});
		assert.ok(await page.locator('#map-selected-bounds-warning').isVisible());
		assert.match(await page.locator('#map-selected-bounds-warning').innerText(),/not fully inside a single screen.*Saving and building are still allowed/);
		await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'flushEdits',requestId:'bounds-warning-build'}})));
		await page.waitForFunction(()=>window.testMessages.some(message=>message.type==='flushedEdits'&&message.requestId==='bounds-warning-build'));
		assert.strictEqual(await page.evaluate(()=>window.testMessages.find(message=>message.requestId==='bounds-warning-build'&&message.type==='flushedEdits').error),undefined,'Bounds warnings must not block building.');
		await change(async()=>{await page.getByLabel('Relative X',{exact:true}).fill('60');await page.getByLabel('Relative X',{exact:true}).press('Tab');});
		assert.strictEqual(await page.locator('#map-selected-bounds-warning').isVisible(),false);
		// A build must commit the focused map name without requiring Tab or a click elsewhere.
		await page.locator('[data-key="name"]').fill('renamed_map');
		assert.strictEqual((await current()).name,'level_01');
		await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'flushEdits',requestId:'rename-build'}})));
		await page.waitForFunction(()=>window.testMessages.some(message=>message.type==='flushedEdits'&&message.requestId==='rename-build'));
		assert.strictEqual((await current()).name,'renamed_map');
		assert.strictEqual(await page.evaluate(()=>window.testMessages.find(message=>message.type==='flushedEdits'&&message.requestId==='rename-build').error),undefined);
		await page.locator('[data-key="name"]').fill('invalid map name');
		await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'flushEdits',requestId:'invalid-rename'}})));
		await page.waitForFunction(()=>window.testMessages.some(message=>message.type==='flushedEdits'&&message.requestId==='invalid-rename'));
		assert.ok(await page.evaluate(()=>window.testMessages.find(message=>message.type==='flushedEdits'&&message.requestId==='invalid-rename').error));
		assert.strictEqual((await current()).name,'renamed_map');
		await change(async()=>{await page.locator('[data-key="name"]').fill('renamed_map_again');await page.locator('[data-key="name"]').press('Tab');});

		const blended=await page.locator('#map-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(484,347,1,1).data));
		assert.ok(blended[0]>100 && blended[2]>100,'Top red sprite must blend over the lower blue sprite.');
		await page.locator('[data-map-select="bottom"]').click();
		await change(()=>page.locator('[data-map-order="top"]').click());
		const blueOnTop=await page.locator('#map-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(484,347,1,1).data));
		assert.deepStrictEqual(blueOnTop,[0,0,255,255]);
		await page.evaluate(()=>
		{
			const image=document.createElement('canvas');image.width=1088;image.height=812;
			const ctx=image.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(1,1,1,1);
			window.testSources.push({path:'background.png',uri:image.toDataURL(),image:true,missing:false});
			window.testBundle.resources.find(item=>item.id==='map').net.backgroundImage='background.png';
			window.testVersion++;window.testUpdate();
		});
		await page.waitForFunction(()=>document.querySelector('#map-canvas').getContext('2d').getImageData(1,1,1,1).data[0]===255);
		assert.deepStrictEqual(await page.locator('#map-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(0,0,1,1).data)),[139,139,139,255],'Transparent image pixels must show background color, not the generated net.');
		assert.deepStrictEqual(await page.locator('#map-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(405,405,1,1).data)),[255,255,255,255],'Side markers must remain visible over custom backgrounds.');
		await page.evaluate(()=>{window.testBundle.resources.find(item=>item.id==='map').net.background=null;window.testVersion++;window.testUpdate();});
		await page.waitForFunction(()=>document.querySelector('#map-canvas').getContext('2d').getImageData(0,0,1,1).data[3]===0);
		await page.evaluate(()=>{const net=window.testBundle.resources.find(item=>item.id==='map').net;net.backgroundImage=null;net.background='#8b8b8b';window.testVersion++;window.testUpdate();});
		await page.waitForFunction(()=>document.querySelector('#map-canvas').getContext('2d').getImageData(0,0,1,1).data[0]===37);

		await change(()=>page.locator('[data-map-order="bottom"]').click());
		await change(()=>page.locator('[data-map-add="hero"]').click());
		assert.strictEqual((await current()).placements.filter(item=>item.spriteId==='hero').length,2);
		const added=(await current()).placements[0].id;
		assert.strictEqual((await current()).placements[0].twistable,false,'New placements default to non-twistable.');
		await change(()=>page.locator('[data-map-order="down"]').click());
		assert.strictEqual((await current()).placements[1].id,added);
		await change(()=>page.locator('[data-map-order="top"]').click());
		assert.strictEqual((await current()).placements[0].id,added);
		await change(()=>page.locator('[data-map-instance="'+added+'"]').dragTo(page.locator('[data-map-instance="bottom"]')));
		assert.strictEqual((await current()).placements.at(-1).id,added);
		await change(()=>page.locator('[data-map-order="top"]').click());
		const coordinate = await page.locator('#map-canvas').evaluate(canvas=>{
			const r=canvas.getBoundingClientRect();return {x:r.left+475*r.width/canvas.width,y:r.top+337*r.height/canvas.height};
		});
		const original=(await current()).placements[0].x;
		const dragMetrics=await page.evaluate(()=>
		{
			window.dragCanvas=document.querySelector('#map-canvas');
			window.dragList=document.querySelector('#map-outliner-list').firstElementChild;
			return {...window.testMetrics};
		});
		await page.mouse.move(coordinate.x,coordinate.y);await page.mouse.down();await page.mouse.move(coordinate.x+12,coordinate.y+8,{steps:5});
		await change(()=>page.mouse.up());
		assert.notStrictEqual((await current()).placements[0].x,original);
		assert.deepStrictEqual(await page.evaluate(()=>({canvas:window.dragCanvas===document.querySelector('#map-canvas'),list:window.dragList===document.querySelector('#map-outliner-list').firstElementChild,images:window.testMetrics.images,conversions:window.testMetrics.conversions})),
			{canvas:true,list:true,images:dragMetrics.images,conversions:dragMetrics.conversions},'Releasing a drag must preserve canvas/outliner nodes and must not reload or reconvert images.');
		await change(async()=>{await page.locator('[data-map-key="relativeX"]').fill('-900');await page.locator('[data-map-key="relativeX"]').press('Tab');});
		assert.ok((await current()).placements[0].x < -800);
		await change(async()=>{await page.locator('[data-map-key="net.screenSize"]').fill('100');await page.locator('[data-map-key="net.screenSize"]').press('Tab');});
		assert.ok((await current()).placements[0].x < -800);
		await page.locator('[data-map-key="net.innerGap"]').fill('9');await page.locator('[data-map-key="net.innerGap"]').press('Tab');
		assert.match(await page.locator('#map-notice').innerText(),/even/);
		assert.strictEqual((await current()).net.innerGap,18);
		await page.locator('[data-map-tab="markers"]').click();
		assert.strictEqual(await page.locator('.map-marker-list>span').count(),6);
		await change(()=>page.locator('[data-map-key="net.markers"]').uncheck());
		assert.strictEqual((await current()).sideMarkers.length,6);
		assert.strictEqual((await current()).net.markers,false);
		await page.locator('#map-zoom').selectOption('4');
		await page.locator('#map-preview').evaluate(stage=>{stage.scrollTop=0;stage.closest('.map-center').scrollTop=0;});
		const stage=await page.locator('#map-preview').boundingBox();
		await page.mouse.move(stage.x+70,stage.y+70);await page.mouse.wheel(0,150);await page.waitForTimeout(70);
		assert.ok(await page.locator('#map-preview').evaluate(stage=>stage.scrollTop)>0);
		assert.strictEqual(await page.locator('#map-zoom').inputValue(),'4');
		await page.keyboard.down('Shift');await page.mouse.wheel(0,-100);await page.keyboard.up('Shift');
		assert.strictEqual(await page.locator('#map-zoom').inputValue(),'8');
		await page.keyboard.down('Shift');await page.locator('#map-preview').dispatchEvent('wheel',{deltaX:100,deltaY:0,shiftKey:true,clientX:stage.x+70,clientY:stage.y+70});await page.keyboard.up('Shift');
		assert.strictEqual(await page.locator('#map-zoom').inputValue(),'4');
		await page.locator('#map-zoom').selectOption('128');
		assert.strictEqual(await page.locator('#map-zoom').inputValue(),'128');
		assert.strictEqual(await page.locator('#map-zoom option[value="0.25"]').count(),0);
		await page.locator('#map-zoom').selectOption('fit');
		const before=await page.locator('#map-preview').boundingBox();
		const mapHandle=await page.locator('[aria-controls="map-preview"]').boundingBox();
			await page.mouse.move(mapHandle.x+mapHandle.width/2,mapHandle.y+3);await page.mouse.down();await page.mouse.move(mapHandle.x+mapHandle.width/2,mapHandle.y+93,{steps:6});await page.mouse.up();
		const after=await page.locator('#map-preview').boundingBox();
		assert.ok(after.height>before.height+40,'Map must resize vertically.');
		await change(()=>page.locator('[data-map-remove]').click());
		assert.strictEqual((await page.locator('#map-preview').boundingBox()).height,after.height,'Height must survive rerender.');
		assert.deepStrictEqual(await page.locator('.map-inspector').evaluate(node=>Array.from(node.querySelectorAll(':scope>section')).map(child=>getComputedStyle(child).overflowY)),['auto','auto']);
		const outlinerBefore=await page.locator('.map-outliner').boundingBox();
		const divider=await page.locator('.map-inspector-divider').boundingBox();
		await page.mouse.move(divider.x+divider.width/2,divider.y+divider.height/2);
		await page.mouse.down();await page.mouse.move(divider.x+divider.width/2,divider.y+83,{steps:6});await page.mouse.up();
		const outlinerAfter=await page.locator('.map-outliner').boundingBox();
		assert.ok(outlinerAfter.height>outlinerBefore.height+60,'Outliner divider must resize the panes.');
		await change(async()=>{await page.locator('[data-map-key="relativeX"]').fill('125');await page.locator('[data-map-key="relativeX"]').press('Tab');});
		assert.ok(Math.abs((await page.locator('.map-outliner').boundingBox()).height-outlinerAfter.height)<1,'Outliner height must survive edits.');
		await page.locator('.map-inspector-divider').focus();await page.keyboard.press('ArrowUp');
		assert.ok((await page.locator('.map-outliner').boundingBox()).height<outlinerAfter.height-10,'Divider supports keyboard resizing.');
		const settings=await page.locator('.map-settings').boundingBox();const view=await page.locator('.map-view').boundingBox();assert.ok(settings.y>=view.y+view.height-1);
		await page.locator('[data-action="newResource"]').click();
		assert.strictEqual(await page.locator('[data-dialog="type"]').inputValue(),'map');
		await page.locator('[data-dialog="name"]').fill('second_map');await change(()=>page.locator('#resource-form button[type=submit]').click());
		assert.strictEqual(await page.locator('.heading strong').innerText(),'second_map');
		assert.strictEqual(await page.locator('.map-placement').count(),0);
		await page.locator('[data-tab="Sprites"]').click();
		assert.strictEqual(await page.locator('.library>.section-label').innerText(),'SPRITES');
		assert.ok(await page.locator('#sprite-canvas').count());
		await page.locator('[data-select="hero"]').first().click();
		await page.waitForFunction(()=>!document.querySelector('#sprite-canvas').hidden);
		await page.locator('[aria-controls="sprite-preview"]').scrollIntoViewIfNeeded();
		const spriteBefore=await page.locator('#sprite-preview').boundingBox();
		const spriteHandle=await page.locator('[aria-controls="sprite-preview"]').boundingBox();
		await page.mouse.move(spriteHandle.x+spriteHandle.width/2,spriteHandle.y+3);await page.mouse.down();
		await page.mouse.move(spriteHandle.x+spriteHandle.width/2,spriteHandle.y-57,{steps:6});await page.mouse.up();
		const spriteHeight=(await page.locator('#sprite-preview').boundingBox()).height;
		assert.ok(spriteHeight<spriteBefore.height-40,'Sprite handle must resize preview height.');
		await page.locator('#preview-zoom').selectOption('128');
		assert.strictEqual(await page.locator('#preview-zoom').inputValue(),'128');
		await page.locator('[data-color-index="1"]').click();
		await change(async()=>{await page.locator('[data-key="colorHex"]').fill('#7f7f7f7f');await page.locator('[data-key="colorHex"]').press('Tab');});
		assert.strictEqual(await page.evaluate(()=>window.testBundle.resources.find(item=>item.id==='palette').colors[1]),'#7b7d7b7b');
		// Legacy palettes are repaired through the UI without losing edited entries.
		const previousPalette=await page.evaluate(()=>structuredClone(window.testBundle.resources.find(item=>item.id==='palette')));
		await page.evaluate(()=>{const palette=window.testBundle.resources.find(item=>item.id==='palette');palette.colors.shift();palette.mappingColors.shift();palette.transparentIndex=null;window.testVersion++;window.testUpdate();});
		await page.waitForSelector('[data-reserve-palette="palette"]');
		await change(()=>page.locator('[data-reserve-palette="palette"]').click());
		assert.deepStrictEqual(await page.evaluate(()=>window.testBundle.resources.find(item=>item.id==='palette')),previousPalette);
		await page.locator('[data-color-index="0"]').click();assert.strictEqual(await page.locator('[data-key="colorHex"]').isDisabled(),true);
		assert.strictEqual(await page.locator('[data-key="channelA"]').isDisabled(),true);
		assert.strictEqual(await page.locator('[data-key="transparentIndex"]').count(),0);

		await change(async()=>{await page.locator('[data-key="pivotX"]').fill('10.5');await page.locator('[data-key="pivotX"]').press('Tab');});
		assert.strictEqual(await page.evaluate(()=>window.testBundle.resources.find(item=>item.id==='hero').pivot.x),10.5);
		assert.strictEqual((await page.locator('#sprite-preview').boundingBox()).height,spriteHeight,'Sprite height must survive edits.');
		await page.locator('[data-tab="Palettes"]').click();assert.ok(await page.locator('[data-key="colorHex"]').count());
		await page.locator('[data-tab="Maps"]').click();
		await page.locator('[data-select="map"]').first().click();
		assert.strictEqual(await page.locator('#map-zoom').inputValue(),'fit');
		await page.evaluate(()=>
		{
			const map=window.testBundle.resources.find(item=>item.id==='map');
			for(let n=0;n<12;n++)map.placements.push({...map.placements[0],id:'extra_'+n});
			window.testVersion++;window.testUpdate();
		});
		await page.waitForFunction(()=>document.querySelectorAll('.map-placement').length===14);
		await page.locator('.map-outliner').evaluate(node=>{node.scrollTop=100;});
		const paneScroll=await page.locator('.map-outliner').evaluate(node=>node.scrollTop);
		assert.ok(paneScroll>0);
		const centerScroll=await page.locator('.map-center').evaluate(node=>node.scrollTop);
		await change(async()=>{await page.locator('[data-map-key="relativeX"]').fill('139');await page.locator('[data-map-key="relativeX"]').press('Tab');});
		assert.strictEqual(await page.locator('.map-outliner').evaluate(node=>node.scrollTop),paneScroll);
		assert.strictEqual(await page.locator('.map-center').evaluate(node=>node.scrollTop),centerScroll);
		if(process.env.WOWCUBE_MAP_SCREENSHOT){await page.screenshot({path:process.env.WOWCUBE_MAP_SCREENSHOT,fullPage:true});}
		await page.evaluate(()=>
		{
			for(let n=0;n<1500;n++)window.testSources.push({path:'bulk/file_'+n+'.png',uri:window.testSources[0].uri,image:true,missing:false});
			window.testSources.push({path:'bulk/nested/extra.png',uri:window.testSources[0].uri,image:true,missing:false});window.testUpdate();
		});
		await page.locator('[data-tab="Source files"]').click();
		assert.strictEqual(await page.locator('.source-group').count(),3);
		assert.strictEqual(await page.locator('.source-group[open]').count(),0,'Source folders must initially be collapsed.');
		assert.strictEqual(await page.locator('.source-row').count(),0,'Collapsed folders must not create thousands of hidden rows.');
		await page.locator('[data-source-folder="."]>summary').click();
		await page.waitForSelector('[data-source-path="hero.png"]');
		const registeredSource=page.locator('[data-source-path="hero.png"]');
		assert.ok(await registeredSource.evaluate(node=>node.classList.contains('registered')));
		assert.strictEqual(await registeredSource.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
		assert.strictEqual(await registeredSource.locator('.source-title .link').evaluate(node=>getComputedStyle(node).color),'rgb(46, 125, 50)');
		assert.strictEqual(await registeredSource.locator('[data-open-source]').count(),0);
		assert.strictEqual(await page.locator('[data-source-path="background.png"] [data-open-source]').count(),1);
		assert.strictEqual(await registeredSource.locator('.source-sprite-names').innerText(),'hero');
		assert.ok(await registeredSource.locator('.source-sprite-names').evaluate(node=>Number(getComputedStyle(node).fontWeight)>=600));
		assert.strictEqual(await registeredSource.locator('[data-register-source]').count(),0);
		assert.strictEqual(await page.locator('[data-source-path="background.png"] [data-register-source]').count(),1);
		assert.ok(!/Registered as|Unregistered/.test(await page.locator('.source-list').innerText()));
		await page.evaluate(()=>
		{
			const sprite=window.testBundle.resources.find(item=>item.id==='hero');
			window.testBundle.resources.push({...structuredClone(sprite),id:'hero_copy',name:'hero_copy'});
			window.testVersion++;window.testUpdate();
		});
		await page.waitForFunction(()=>document.querySelector('[data-source-path="hero.png"] .source-sprite-names').textContent==='hero, hero_copy');
		await page.locator('[data-source-folder="bulk"]>summary').click();
		await page.waitForFunction(()=>document.querySelectorAll('[data-source-folder="bulk"] .source-row').length===1500);
		await page.locator('[data-source-folder="bulk"]>summary').click();
		await page.waitForFunction(()=>document.querySelectorAll('[data-source-folder="bulk"] .source-row').length===0);
		await page.locator('#source-filter').fill('bulk/file_1499.png');
		assert.strictEqual(await page.locator('.source-group:not([hidden])').count(),1);
		assert.strictEqual(await page.locator('.source-row').count(),1);
		assert.ok(await page.locator('[data-source-path="bulk/file_1499.png"]').isVisible());
		await page.locator('#source-filter').fill('');
		assert.strictEqual(await page.locator('[data-source-folder="bulk"]').getAttribute('open'),null);
		assert.ok(await page.locator('[data-source-path="hero.png"]').isVisible(),'Clearing the filter must restore expanded folders.');
		// Stress a real mounted map with 2,000 distinct sprite resources and textures.
		await page.evaluate(()=>
		{
			const pixel=document.createElement('canvas');pixel.width=pixel.height=1;pixel.getContext('2d').fillRect(0,0,1,1);
			const uri=pixel.toDataURL(),sprite=window.testBundle.resources.find(item=>item.id==='hero');
			const map={...structuredClone(window.testTemplate),id:'stress_map',name:'stress_map',placements:[]};
			for(let n=0;n<2000;n++)
			{
				const id='stress_'+n,source='stress/'+n+'.png';
				window.testBundle.resources.push({...structuredClone(sprite),id,name:id,source,pivot:{x:0,y:0}});
				window.testSources.push({path:source,uri:uri+'#'+n,image:true,missing:false});
				map.placements.push({id:'place_'+n,spriteId:id,side:1,x:138,y:138,twistable:false});
			}
			window.testBundle.resources.push(map);window.testVersion++;window.testUpdate();
		});
		await page.locator('[data-tab="Maps"]').click();
		const beforeStress=await page.evaluate(()=>({...window.testMetrics}));
		await page.locator('[data-select="stress_map"]').first().click();
		await page.waitForFunction(count=>window.testMetrics.conversions>=count+2000,beforeStress.conversions,{timeout:120000});
		await page.waitForTimeout(100);
		assert.strictEqual(await page.locator('.map-placement').count(),2000);
		await page.locator('#map-zoom').selectOption('1');
		await page.locator('#map-preview').evaluate(node=>{node.scrollTop=0;node.scrollLeft=0;node.closest('.map-center').scrollTop=0;});
		const stressPosition=await page.locator('#map-canvas').evaluate(canvas=>{const r=canvas.getBoundingClientRect();return{x:r.left+475.25*r.width/canvas.width,y:r.top+337.25*r.height/canvas.height};});
		const beforeStressDrag=await page.evaluate(()=>{window.stressCanvas=document.querySelector('#map-canvas');return{...window.testMetrics};});
		await page.mouse.move(stressPosition.x,stressPosition.y);await page.mouse.down();await page.mouse.move(stressPosition.x+15,stressPosition.y+5,{steps:12});
		await change(()=>page.mouse.up());
		assert.ok(await page.evaluate(()=>window.stressCanvas===document.querySelector('#map-canvas')));
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.images),beforeStressDrag.images);
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.conversions),beforeStressDrag.conversions);
		assert.notStrictEqual(await page.evaluate(()=>window.testBundle.resources.find(item=>item.id==='stress_map').placements[0].x),138);
		// An unchanged host/save refresh must also leave the scene and image cache intact.
		await page.evaluate(()=>window.testUpdate());
		assert.ok(await page.evaluate(()=>window.stressCanvas===document.querySelector('#map-canvas')));
		const beforeRevision=await page.evaluate(()=>({...window.testMetrics}));
		await page.evaluate(()=>{window.testSources.find(item=>item.path==='stress/0.png').uri+='_revision';window.testUpdate();});
		await page.waitForFunction(count=>window.testMetrics.conversions===count+1,beforeRevision.conversions);
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.images),beforeRevision.images+1,'A changed source must reload only its texture.');
		const beforePalette=await page.evaluate(()=>({...window.testMetrics}));
		await page.evaluate(()=>
		{
			const palette=structuredClone(window.testBundle.resources.find(item=>item.id==='palette'));
			palette.id='stress_palette';palette.name='stress_palette';palette.colors[1]='#00ff00ff';
			window.testBundle.resources.push(palette);
			window.testBundle.resources.find(item=>item.id==='stress_0').paletteId=palette.id;
			window.testVersion++;window.testUpdate();
		});
		await page.waitForFunction(count=>window.testMetrics.conversions===count+1,beforePalette.conversions);
		assert.strictEqual(await page.evaluate(()=>window.testMetrics.images),beforePalette.images+1,'A changed palette must rebuild only the affected texture.');
		// At high zoom, scrolling to an empty region must avoid drawing offscreen sprites.
		await page.locator('#map-zoom').selectOption('4');
		await page.locator('#map-preview').evaluate(node=>{node.scrollLeft=0;node.scrollTop=0;});
		await page.waitForTimeout(50);
		const beforeCull=await page.evaluate(()=>({...window.testMetrics}));
		await page.locator('#map-preview').evaluate(node=>{node.scrollLeft=10;});
		await page.waitForFunction(count=>window.testMetrics.frames>count,beforeCull.frames);
		assert.ok(await page.evaluate(count=>window.testMetrics.draws-count<20,beforeCull.draws),'Offscreen placements should not be drawn.');
		assert.deepStrictEqual(errors,[]);
		assert.deepStrictEqual(ResourceBundles.validate(await page.evaluate(()=>window.testBundle)),[]);
		console.log('Browser checks passed: 2,000 distinct sprites, no canvas replacement or texture reload on drag, source/palette cache invalidation, viewport culling, and existing map/sprite/palette/source-file interactions.');
	}
	finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
