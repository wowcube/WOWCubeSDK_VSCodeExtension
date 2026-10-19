/* Font preview is independent of sprite/map texture caches and editing state. */
(function ()
{
	function view(resource, h)
	{
		h.state.fontViews ||= {};
		return h.state.fontViews[resource.id] ||= {mode:'text', text:'WOWCube\nThe quick brown fox\n0123456789', zoom:'fit', code:110, guides:true, tint:'#ffffff', background:'#555555', solid:false, align:'left'};
	}
	function render(resource, h)
	{
		const v = view(resource, h), f = h.fontData[resource.id], e = h.escape;
		return '<div class="font-detail"><div class="font-center"><div class="font-toolbar">'+['text', 'glyphs', 'atlas'].map(mode => '<button data-font-mode="'+mode+'" aria-pressed="'+(v.mode === mode)+'">'+({text:'Text preview',glyphs:'Glyph grid',atlas:'Atlas'}[mode])+'</button>').join('')+
			'<label class="font-zoom">Zoom <select data-font-zoom><option value="fit">Fit</option>'+window.ResourceStudioViewport.zoomLevels.map(value => '<option value="'+value+'" '+(String(value) === v.zoom ? 'selected' : '')+'>'+value+'×</option>').join('')+'</select></label></div>'+
			'<div id="font-preview"><canvas id="font-canvas" aria-label="Bitmap font preview"></canvas></div><div class="view-resize-handle preview-resize-handle" role="separator" tabindex="0" aria-label="Resize font preview vertically" aria-orientation="horizontal"></div>'+
			'<p class="minor" data-font-status></p><label>Sample text<textarea data-font-preview="text" maxlength="128" rows="4">'+e(v.text)+'</textarea></label><div class="font-options"><label>Alignment <select data-font-preview="align">'+['left', 'center', 'right'].map(value => '<option '+(v.align === value ? 'selected' : '')+'>'+value+'</option>').join('')+'</select></label><label><input type="checkbox" data-font-preview="guides" '+(v.guides ? 'checked' : '')+'> Guides</label><label><input type="checkbox" data-font-preview="solid" '+(v.solid ? 'checked' : '')+'> Solid background</label><label>Background <input type="color" data-font-preview="background" value="'+e(v.background)+'"></label><label>Preview tint <input type="color" data-font-preview="tint" value="'+e(v.tint)+'"></label></div><p class="minor">Tint changes this preview only. Spaces and missing characters use the width of “n”. Kerning is not applied by the engine.</p></div>'+
			'<aside class="resource-inspector font-inspector" aria-label="Font properties">'+h.field('Unique font name', h.input('name', resource.name))+
			h.field('Engine font slot', h.select('slot', [1, 2, 3].map(slot => ({value:String(slot), label:'font_'+slot, disabled:h.bundle.resources.some(item => item.type === 'font' && item.id !== resource.id && item.slot === slot)})), String(resource.slot)))+
			'<p class="minor">Three slots are available: 1, 2 and 3.</p><label class="check"><input type="checkbox" data-key="fullsize" '+(resource.fullsize ? 'checked' : '')+'> FULLSIZE</label><p class="minor">'+(resource.fullsize ? 'Source pixels draw at 1:1.' : 'Source pixels draw at 2× on the device.')+'</p>'+
			'<div class="rule"></div><div class="section-label">Source</div><p class="font-path">'+e(resource.source)+'</p><p class="minor">Referenced PNG: '+e(f?.page || 'Unavailable')+'</p><p class="font-path">Atlas: '+e(resource.atlas)+'</p><button data-font-action="fontAtlas">Choose PNG atlas…</button>'+
			(f?.referencedAtlas && f.referencedAtlas !== resource.atlas ? '<p class="notice">The selected atlas overrides the PNG referenced by the .fnt file.</p>' : '')+
			(f && !f.error ? '<p>'+e(f.family)+' · '+f.size+' px<br>'+f.glyphs.length+' glyphs · '+f.width+' × '+f.height+' atlas</p><p class="minor">Line height '+f.lineHeight+' · Baseline '+f.baseline+'</p>'+(f.ignored.length ? '<p class="notice">'+f.ignored.length+' characters outside 32–127 will not be exported.</p>' : '') : '')+
			'<div class="rule"></div>'+h.field('Alpha palette', h.select('paletteId', h.bundle.resources.filter(item => item.type === 'palette' && !h.bundle.resources.some(user => user.paletteId === item.id && user.type === 'sprite' && ['opaque','bg'].includes(user.blend))).map(item => ({value:item.id,label:item.name})), resource.paletteId))+
			'<button data-font-action="fontPalette">Generate or choose palette…</button><div class="rule"></div><div class="section-label">Selected glyph</div><canvas data-font-glyph width="180" height="140" aria-label="Selected glyph enlarged"></canvas><div data-font-metrics></div></aside></div>';
	}
	function mount(resource, h)
	{
		const v = view(resource, h), f = h.fontData[resource.id], main = h.main, stage = main.querySelector('#font-preview'), canvas = main.querySelector('#font-canvas'), ctx = canvas.getContext('2d');
		const status = main.querySelector('[data-font-status]'), zoom = main.querySelector('[data-font-zoom]'); zoom.value = v.zoom;
		let atlas, disposed = false, scale = 1, boxes = [];
		const glyphs = new Map((f?.glyphs || []).map(glyph => [glyph.code, glyph]));
		function metrics()
		{
			const glyph = glyphs.get(v.code);
			main.querySelector('[data-font-metrics]').textContent = glyph ? (glyph.code === 32 ? 'Space' : glyph.code === 127 ? 'DEL' : String.fromCharCode(glyph.code))+' · '+glyph.code+' · font_'+resource.slot+'_'+String(glyph.code).padStart(5,'0')+'\n'+glyph.width+' × '+glyph.height+' px\nOffset '+glyph.xOffset+', '+glyph.yOffset+' · Advance '+glyph.advance : 'Select a glyph in the grid or atlas.';
			paintGlyph();
		}
		function paintGlyph()
		{
			const g = glyphs.get(v.code), enlarged = main.querySelector('[data-font-glyph]'), context = enlarged.getContext('2d');
			context.clearRect(0,0,enlarged.width,enlarged.height);
			if(atlas && g?.width && g.height)
			{
				const fit = Math.min(150/g.width,110/g.height); context.imageSmoothingEnabled = false;
				context.drawImage(atlas,g.x,g.y,g.width,g.height,(180 - g.width*fit)/2,(140 - g.height*fit)/2,g.width*fit,g.height*fit);
			}
		}
		function draw()
		{
			if(disposed || !atlas) { return; }
			const lines = v.text.split('\n'), n = glyphs.get(110), factor = resource.fullsize ? 1 : 2;
			function lineWidth(line) { return Array.from(line).reduce((sum, c) => sum + (c === ' ' ? n.width : glyphs.get(c.codePointAt(0))?.advance ?? n.width), 0); }
			const width = v.mode === 'atlas' ? f.width : v.mode === 'glyphs' ? 480 : Math.max(160, ...lines.map(lineWidth).map(width => width*factor + 40));
			const height = v.mode === 'atlas' ? f.height : v.mode === 'glyphs' ? Math.ceil(f.glyphs.length/8)*72 : Math.max(100, lines.length*f.lineHeight*factor + 40);
			scale = window.ResourceStudioViewport.scale(v, width, height, stage);
			const w = Math.ceil(width*scale), heightPx = Math.ceil(height*scale), backing = Math.min(1, 4096/Math.max(w, heightPx));
			canvas.width = Math.max(1, Math.ceil(w*backing)); canvas.height = Math.max(1, Math.ceil(heightPx*backing)); canvas.style.width = w+'px'; canvas.style.height = heightPx+'px';
			ctx.setTransform(scale*backing, 0, 0, scale*backing, 0, 0); ctx.imageSmoothingEnabled = false;
			paintGlyph();
			stage.style.backgroundColor = v.background; stage.classList.toggle('font-checker', !v.solid); boxes = [];
			function image(g, x, y, zoom = 1) { if(g.width && g.height) { ctx.drawImage(atlas, g.x, g.y, g.width, g.height, x, y, g.width*zoom, g.height*zoom); } }
			function outline(x,y,w,h) { ctx.strokeStyle = '#00afff'; ctx.lineWidth = 2/scale; ctx.strokeRect(x + 1/scale,y + 1/scale,Math.max(0,w - 2/scale),Math.max(0,h - 2/scale)); }
			if(v.mode === 'atlas')
			{
				ctx.drawImage(atlas,0,0); for(const g of f.glyphs) { boxes.push({g,x:g.x,y:g.y,w:g.width,h:g.height}); if(v.guides || g.code === v.code) { outline(g.x,g.y,g.width,g.height); } }
			}
			else if(v.mode === 'glyphs')
			{
				f.glyphs.forEach((g,i) => { const x = i%8*60, y = Math.floor(i/8)*72, fit = Math.min(1, 48/Math.max(1,g.width), 48/Math.max(1,g.height)); image(g,x + (60 - g.width*fit)/2,y + 4,fit); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.font = '11px sans-serif'; ctx.strokeText(String(g.code),x + 8,y + 64); ctx.fillText(String(g.code),x + 8,y + 64); if(g.code === v.code) { outline(x,y,60,72); } boxes.push({g,x,y,w:60,h:72}); });
			}
			else
			{
				lines.forEach((line,i) => { let x = v.align === 'left' ? 20 : v.align === 'center' ? (width - lineWidth(line)*factor)/2 : width - 20 - lineWidth(line)*factor; const y = 20 + i*f.lineHeight*factor;
					if(v.guides) { ctx.strokeStyle = '#00cfff'; ctx.lineWidth = 1/scale; ctx.beginPath(); ctx.moveTo(0,y + f.baseline*factor);ctx.lineTo(width,y + f.baseline*factor);ctx.stroke(); }
					for(const c of line) { const g = c === ' ' ? undefined : glyphs.get(c.codePointAt(0)); if(g) { image(g,x + g.xOffset*factor,y + g.yOffset*factor,factor); x += g.advance*factor; } else { x += n.width*factor; } }
				});
			}
		}
		function load()
		{
			if(f?.error || !f) { status.textContent = f?.error || 'Font metadata unavailable.'; return; }
			const source = h.sources.find(item => item.path === resource.atlas);
			if(!source || source.missing) { status.textContent = 'PNG atlas is missing. Choose a replacement atlas.'; return; }
			const img = new Image(); img.onload = () =>
			{
				if(disposed) { return; }
				try
				{
					atlas = document.createElement('canvas'); atlas.width = img.naturalWidth; atlas.height = img.naturalHeight;
					const context = atlas.getContext('2d'); context.drawImage(img,0,0); const pixels = context.getImageData(0,0,atlas.width,atlas.height), palette = h.bundle.resources.find(item => item.id === resource.paletteId);
					if(!palette) { throw new Error('Choose a palette for this font.'); }
					window.ResourceStudioPixels.convert(pixels.data, atlas.width, {colorMode:'palette',blend:'alpha'},palette);
					const tint = window.ResourceStudioPixels.colorChannels(v.tint), shifts = [3,2,3];
					for(let i = 0; i < pixels.data.length; i += 4) { for(let channel = 0; channel < 3; channel++) { const max = (1 << (8 - shifts[channel])) - 1; const value = Math.floor((pixels.data[i + channel] >> shifts[channel])*(tint[channel] >> shifts[channel])/max); pixels.data[i + channel] = (value << shifts[channel]) | (value >> (8 - shifts[channel]*2)); } }
					context.putImageData(pixels,0,0); status.textContent = 'Shift + wheel to zoom. Click a glyph in the grid or atlas to inspect it.'; draw();
				}
				catch(error) { atlas = undefined; status.textContent = error.message; }
			}; img.onerror = () => { if(!disposed) { status.textContent = 'Unable to decode the PNG atlas.'; } }; img.src = source.uri;
		}
		function click(event)
		{
			const button = event.target.closest('[data-font-action], [data-font-mode]'); if(!button || button.disabled) { return; }
			if(button.dataset.fontAction) { h.sendChange({action:button.dataset.fontAction,id:resource.id}); }
			else { v.mode = button.dataset.fontMode; main.querySelectorAll('[data-font-mode]').forEach(item => item.setAttribute('aria-pressed',String(item.dataset.fontMode === v.mode))); h.saveState(); draw(); }
		}
		function input(event)
		{
			const key = event.target.dataset.fontPreview; if(!key) { return; } v[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; h.saveState(); if(key === 'tint') { load(); } else { draw(); }
		}
		main.addEventListener('click',click); main.addEventListener('input',input);
		canvas.onclick = event => { const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left)/scale, y = (event.clientY - rect.top)/scale, box = boxes.find(box => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h); if(box) { v.code = box.g.code; metrics(); draw(); h.saveState(); } };
		zoom.onchange = () => { v.zoom = zoom.value; h.saveState(); draw(); };
		const dispose = window.ResourceStudioViewport.mount({stage,canvas,state:v,draw,saveState:h.saveState,select:zoom,getScale:() => scale,ready:() => !!atlas,interacting:() => false});
		metrics(); load(); return () => { disposed = true; dispose(); main.removeEventListener('click',click); main.removeEventListener('input',input); canvas.onclick = zoom.onchange = null; };
	}
	window.ResourceStudioTypes.register({type:'font',label:'Font',section:'Fonts',icon:'Aa',canCreate:true,
		getSummary:resource => 'Font '+resource.slot, renderWorkspace:render,mountPreview:mount,
		change:function (resource,key,element) { if(key === 'slot') { resource.slot = Number(element.value); } else if(key === 'fullsize') { resource.fullsize = element.checked; } else if(key === 'paletteId') { resource.paletteId = element.value; } else { throw new Error('Unknown font property.'); } }
	});
}());
