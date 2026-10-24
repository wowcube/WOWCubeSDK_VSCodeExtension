// Optional Chromium integration; exercises the same scripts and message boundary as VS Code.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {chromium} = require('playwright');
const {ResourceBundles,ResourceTypes} = require('../../out/ResourceBundle');
const {parseBitmapFont} = require('../../out/BitmapFont');
const {fontFixture} = require('./fontFixture');
const bundle = ResourceBundles.create();
const palette = ResourceTypes.get('palette').create('p','font_palette'); palette.colors = ['#00000000','#00ff00ff']; palette.mappingColors = ['#00000000','#ffffffff'];
const font = ResourceTypes.get('font').create('f','font_1','fonts/demo.fnt',{atlas:'fonts/atlas.png',slot:1,paletteId:'p'});
bundle.resources.push(palette,font);
const metadata = parseBitmapFont(fontFixture()); metadata.referencedAtlas='fonts/atlas.png';
const media = path.join(__dirname,'../../media'), scripts = ['resourcevalidation.js','spritepixels.js','previewviewport.js','mapgeometry.js','sourcefiles.js','spritelist.js','palettecompatibility.js','soundvalidation.js','resourcetypes.js','maptextures.js','maprenderer.js','mapeditor.js','mapresource.js','sequenceeditor.js','fonteditor.js','soundeditor.js','resourcestudio.js'];
const initial = `window.bundle=${JSON.stringify(bundle)};window.metadata=${JSON.stringify(metadata)};window.version=1;window.messages=[];window.saved={tab:'Fonts',selected:'f'};
const image=document.createElement('canvas');image.width=256;image.height=256;const ctx=image.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);
window.sources=[{path:'fonts/demo.fnt',uri:'',image:false,missing:false},{path:'fonts/atlas.png',uri:image.toDataURL(),image:true,missing:false}];
window.sendUpdate=()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'update',bundle:structuredClone(window.bundle),fontData:{f:window.metadata},sources:window.sources,resourceTypes:${JSON.stringify(ResourceTypes.getAll().map(t => ({type:t.type,label:t.label,canCreate:t.canCreate!==false})))},version:window.version,dirty:true,project:'Font test'}}));
window.acquireVsCodeApi=()=>({getState:()=>window.saved,setState:value=>window.saved=value,postMessage:message=>{window.messages.push(message);if(message.type==='ready')setTimeout(window.sendUpdate,0);if(message.type==='change'){if(message.action==='update'){window.bundle.resources[window.bundle.resources.findIndex(r=>r.id===message.resource.id)]=message.resource;}window.version++;setTimeout(window.sendUpdate,10);}}});`;
async function run()
{
	const browser=await chromium.launch({headless:true,...(process.env.WOWCUBE_BROWSER?{executablePath:process.env.WOWCUBE_BROWSER}:{})});
	try
	{
		const page=await browser.newPage({viewport:{width:1400,height:1050}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
		await page.setContent('<style>'+['resourcestudio.css','mapeditor.css','sequenceeditor.css','fonteditor.css'].map(file=>fs.readFileSync(path.join(media,file),'utf8')).join('\n')+'</style><div id="resource-studio"></div><script>'+initial+'</script>'+scripts.map(file=>'<script>'+fs.readFileSync(path.join(media,file),'utf8')+'</script>').join(''));
		await page.waitForSelector('#font-canvas'); await page.waitForFunction(()=>document.querySelector('[data-font-status]').textContent.includes('Shift'));
		assert.deepStrictEqual(await page.locator('.tabs button').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab)),['Sprites','Maps','Animations','Fonts','Sounds','Palettes','Source files']);
		assert.strictEqual(await page.locator('[data-key="slot"] option').count(),3); assert.strictEqual(await page.locator('[data-key="slot"]').inputValue(),'1');
		await page.locator('[data-font-mode="atlas"]').click(); await page.locator('[data-font-zoom]').selectOption('1');
		const pixel=()=>page.locator('#font-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(200,200,1,1).data));
		assert.deepStrictEqual(await pixel(),[0,255,0,255],'Atlas must use indexed palette conversion, including edited colors.');
		await page.evaluate(()=>{window.bundle.resources.find(r=>r.id==='p').colors[1]='#00ff0084';window.sendUpdate();});
		await page.waitForFunction(()=>{const c=document.querySelector('#font-canvas');return c.getContext('2d').getImageData(200,200,1,1).data[3]===132;});
		await page.evaluate(()=>{window.bundle.resources.find(r=>r.id==='p').colors[1]='#00ff00ff';window.sendUpdate();});
		await page.waitForFunction(()=>{const c=document.querySelector('#font-canvas');return c.getContext('2d').getImageData(200,200,1,1).data[3]===255;});
		await page.locator('[data-font-preview="tint"]').fill('#ff0000');await page.waitForFunction(()=>{const c=document.querySelector('#font-canvas');return c.getContext('2d').getImageData(200,200,1,1).data[1]===0;});
		assert.deepStrictEqual(await pixel(),[0,0,0,255]);
		await page.locator('[data-font-preview="tint"]').fill('#ffffff');await page.waitForFunction(()=>{const c=document.querySelector('#font-canvas');return c.getContext('2d').getImageData(200,200,1,1).data[1]===255;});
		await page.locator('#font-canvas').click({position:{x:25,y:5}});assert((await page.locator('[data-font-metrics]').textContent()).includes('font_1_00065'));
		await page.locator('[data-font-mode="glyphs"]').click();await page.locator('#font-canvas').click({position:{x:190,y:20}});assert((await page.locator('[data-font-metrics]').textContent()).includes('127'));
		await page.locator('[data-font-mode="text"]').click(); await page.locator('[data-font-preview="text"]').fill('An\nMissing Ω');assert.strictEqual(await page.locator('[data-font-preview="text"]').inputValue(),'An\nMissing Ω');
		await page.locator('[data-font-preview="align"]').selectOption('center');await page.locator('[data-font-preview="solid"]').check();assert.strictEqual(await page.locator('#font-preview').evaluate(n=>n.classList.contains('font-checker')),false);
		await page.locator('#font-preview').dispatchEvent('wheel',{deltaY:-80,shiftKey:true,clientX:500,clientY:400});assert.strictEqual(await page.locator('[data-font-zoom]').inputValue(),'2');
		const zoomBefore=await page.locator('[data-font-zoom]').inputValue();await page.locator('#font-preview').dispatchEvent('wheel',{deltaY:-80,shiftKey:false});assert.strictEqual(await page.locator('[data-font-zoom]').inputValue(),zoomBefore);
		const handle=await page.locator('.preview-resize-handle').boundingBox(), before=await page.locator('#font-preview').evaluate(n=>n.getBoundingClientRect().height);
		await page.mouse.move(handle.x+20,handle.y+3);await page.mouse.down();await page.mouse.move(handle.x+20,handle.y+73);await page.mouse.up();assert((await page.locator('#font-preview').evaluate(n=>n.getBoundingClientRect().height))>=before+65);
		await page.locator('[data-key="name"]').fill('renamed_font');await page.locator('[data-key="name"]').press('Tab');await page.waitForFunction(()=>window.bundle.resources.find(r=>r.id==='f').name==='renamed_font');
		await page.waitForFunction(()=>document.querySelector('[data-font-preview="text"]').value==='An\nMissing Ω');
		await page.locator('[data-key="slot"]').selectOption('2');await page.waitForFunction(()=>window.bundle.resources.find(r=>r.id==='f').slot===2);
		await page.locator('[data-font-action="fontAtlas"]').click();await page.waitForFunction(()=>window.messages.some(m=>m.action==='fontAtlas'));
		await page.locator('[data-action="newResource"]').click();await page.waitForFunction(()=>window.messages.some(m=>m.action==='fontImport'));
		await page.screenshot({path:'/private/tmp/resource-studio-fonts.png'});
		assert.strictEqual(await page.locator('[data-font-preview="text"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(49, 49, 49)');
		if(process.env.WOWCUBE_FONT_SAMPLES)
		{
			const sample = process.env.WOWCUBE_FONT_SAMPLES;
			for(const name of ['font_1','font_2','font_3'])
			{
				const parsed = parseBitmapFont(fs.readFileSync(path.join(sample,name+'.fnt')));
				// Explicit overrides correct the two swapped sample page references.
				const atlas = name+'_0.png', uri = 'data:image/png;base64,'+fs.readFileSync(path.join(sample,atlas)).toString('base64');
				await page.evaluate(({parsed,name,atlas,uri})=>{window.metadata={...parsed,referencedAtlas:'fonts/'+parsed.page};Object.assign(window.bundle.resources.find(r=>r.id==='f'),{source:'fonts/'+name+'.fnt',atlas:'fonts/'+atlas});window.sources=[{path:'fonts/'+atlas,uri,image:true,missing:false}];window.sendUpdate();},{parsed,name,atlas,uri});
				await page.waitForFunction(()=>document.querySelector('[data-font-status]').textContent.includes('Shift'));
				await page.locator('[data-font-preview="text"]').fill('WOWCube\nThe quick brown fox\n0123456789');await page.locator('[data-font-zoom]').selectOption('fit');
				assert((await page.locator('.font-inspector').textContent()).includes('95 glyphs'));
				if(name==='font_1') { await page.screenshot({path:'/private/tmp/resource-studio-font-sample.png'}); }
			}
		}
		// Missing files keep the inspector and recovery actions available.
		await page.evaluate(()=>{window.metadata={error:'PNG atlas is missing'};window.sendUpdate();});await page.waitForFunction(()=>document.querySelector('[data-font-status]').textContent.includes('missing'));assert(await page.locator('[data-font-action="fontAtlas"]').isVisible());
		await page.screenshot({path:'/private/tmp/resource-studio-fonts-missing.png'});
		assert.deepStrictEqual(errors,[]);console.log('Font browser checks passed: preview modes, glyph picking, indexed colors/tint, zoom/resize, edits, native actions, preserved view state and missing-file recovery.');
	}
	finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
