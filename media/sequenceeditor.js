/* Sequence UI groups sprite resources; playback never modifies the bundle. */
(function ()
{
	
	function frames(resource, h) { return h.bundle.resources.filter(item => item.type === 'sprite' && item.sequence?.id === resource?.sequence?.id && item.sequence).sort((a, b) => a.sequence.index - b.sequence.index).map(item => structuredClone(item)); }
	function render(resource, h)
	{
		const imports = '<button data-sequence-action="files">+ Add more files</button><button data-sequence-action="folder">+ Add files from folder</button>';
		return '<div class="heading"><strong>'+h.escape(resource?.sequence.name || 'Animations')+'</strong><span class="spacer"></span><button class="primary" data-sequence-action="new">+ Add new animation</button>'+imports+(resource ? '<button data-sequence-action="remove-animation">Remove</button>' : '')+'</div>'+
			(!resource ? '<div class="empty"><h2>No animations yet</h2><p>Import PNG files or a folder. Every frame becomes a distinct sprite.</p></div>' :
			'<div class="sequence-detail"><div class="sequence-center"><div class="sequence-toolbar"><label><input type="checkbox" data-sequence-onion> Previous frame</label><label><input type="checkbox" data-sequence-solid> Solid background</label><input type="color" data-sequence-background value="#555555" aria-label="Preview background color"><label class="sequence-zoom">Zoom <select data-sequence-zoom><option value="fit">Fit</option>'+window.ResourceStudioViewport.zoomLevels.map(value => '<option value="'+value+'">'+value+'×</option>').join('')+'</select></label></div>'+
			'<div class="sequence-preview-wrap"><div id="sequence-preview" class="checker"><canvas id="sequence-canvas"></canvas></div><div class="view-resize-handle preview-resize-handle" role="separator" tabindex="0" aria-label="Resize animation preview vertically" aria-orientation="horizontal"></div><div class="sequence-origin-controls" role="group" aria-label="Move sequence origin">'+
			[['up', '↑'], ['left', '←'], ['right', '→'], ['down', '↓']].map(([direction, arrow]) => '<button class="sequence-origin-'+direction+'" data-sequence-action="origin-'+direction+'" aria-label="Move sequence origin '+direction+'" title="Move origin '+direction+' by 1 source pixel">'+arrow+'</button>').join('')+'<span aria-hidden="true">+</span></div></div>'+
			'<div class="sequence-playback"><button data-sequence-action="first" aria-label="First frame">|◀</button><button data-sequence-action="previous" aria-label="Previous frame">◀</button><button data-sequence-action="play">Play</button><button data-sequence-action="next" aria-label="Next frame">▶</button><input data-sequence-scrub type="range" min="0" value="0" aria-label="Current animation frame"><label><input type="checkbox" data-sequence-loop checked> Loop preview</label><span data-sequence-time></span></div>'+
			'<div class="sequence-actions"><button data-sequence-action="earlier">Move frame earlier</button><button data-sequence-action="later">Move frame later</button><button data-sequence-action="duplicate">Duplicate frame</button><button data-sequence-action="remove">Remove selected frame</button></div><div class="sequence-strip" aria-label="Animation frames"></div><p class="sequence-notice">Drag a frame around the fixed (0, 0) origin. Positions use source pixels; Y points down. Saved local pivot = (−X, −Y). Loop affects this preview only.</p></div><aside class="sequence-inspector resource-inspector" aria-label="Selected animation frame"></aside></div>');
	}
	function mount(resource, initialHelpers)
	{
		let h = initialHelpers, items = resource ? frames(resource, h) : [], current = 0, selected = new Set(items.length ? [items[0].id] : []), anchor = 0;
		const main = h.main, stage = main.querySelector('#sequence-preview'), canvas = main.querySelector('#sequence-canvas');
		const id = resource?.sequence.id;
		h.state.sequenceViews ||= {};
		const view = h.state.sequenceViews[id] || {zoom:'fit', previewHeight:undefined, onion:false, solid:false, background:'#555555'}; if(id) { h.state.sequenceViews[id] = view; }
		view.originOffset ||= {x:0, y:0};
		if(items.length && view.currentId) { current = Math.max(0, items.findIndex(frame => frame.id === view.currentId)); selected = new Set((view.selected || [items[current].id]).filter(id => items.some(frame => frame.id === id))); }
		let lastDisplayed, pendingDraw;
		let textures = new Map(), generation = 0, disposed = false, playing = false, started = 0, animation, drag, draggedId, scale = 1, extent = 360;
		const query = selector => main.querySelector(selector);
		const ctx = canvas?.getContext('2d');
		function commit(extra = {})
		{
			h.sendChange({action:'sequenceUpdate', sequenceId:id, name:items[0].sequence.name,
				frames:items.map(frame => ({id:frame.id, name:frame.name, pivot:frame.pivot, frameRate:frame.frameRate})), ...extra});
		}
		function stop() { playing = false; cancelAnimationFrame(animation); const button = query('[data-sequence-action="play"]'); if(button) { button.textContent = 'Play'; } }
		function position(frame, texture) { return {x:-(frame.pivot?.x ?? texture.width/2), y:-(frame.pivot?.y ?? texture.height/2)}; }
		function drawFrame(index, opacity)
		{
			const frame = items[index], texture = textures.get(frame?.id); if(!texture) { return; }
			const p = position(frame, texture); ctx.globalAlpha = opacity;
			ctx.drawImage(texture.canvas, (extent/2 + view.originOffset.x + p.x)*scale, (extent/2 + view.originOffset.y + p.y)*scale, texture.width*scale, texture.height*scale);
			if(opacity === 1 && !playing) { ctx.strokeStyle = '#009fff'; ctx.lineWidth = 2; ctx.strokeRect((extent/2 + view.originOffset.x + p.x)*scale + 1, (extent/2 + view.originOffset.y + p.y)*scale + 1, Math.max(0, texture.width*scale - 2), Math.max(0, texture.height*scale - 2)); }
			ctx.globalAlpha = 1;
		}
		function draw()
		{
			if(!ctx || disposed) { return; }
			scale = window.ResourceStudioViewport.scale(view, extent, extent, stage);
			// Cap backing bitmap size; CSS size retains zoom and scrolling at 128×.
			const size = Math.ceil(extent*scale), backing = Math.min(size, 4096);
			if(canvas.width !== backing) { canvas.width = backing; canvas.height = backing; }
			canvas.style.width = size+'px'; canvas.style.height = size+'px';
			ctx.setTransform(backing/size, 0, 0, backing/size, 0, 0); ctx.clearRect(0, 0, size, size); ctx.imageSmoothingEnabled = false;
			const originX = (extent/2 + view.originOffset.x)*scale, originY = (extent/2 + view.originOffset.y)*scale;
			ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, size); ctx.moveTo(0, originY); ctx.lineTo(size, originY); ctx.stroke();
			if(view.onion && !playing && current > 0) { drawFrame(current - 1, .25); }
			drawFrame(current, 1);
			ctx.strokeStyle = '#ffbd38'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(originX - 7, originY); ctx.lineTo(originX + 7, originY); ctx.moveTo(originX, originY - 7); ctx.lineTo(originX, originY + 7); ctx.stroke();
			ctx.fillStyle = '#ffbd38'; ctx.font = '12px sans-serif'; ctx.fillText('(0, 0)', originX + 10, originY - 10);
		}
		function requestDraw()
		{
			if(pendingDraw !== undefined || disposed) { return; }
			pendingDraw = requestAnimationFrame(() => { pendingDraw = undefined; draw(); });
		}
		function load()
		{
			const token = ++generation; textures = new Map();
			for(const frame of items)
			{
				const source = h.sources.find(source => source.path === frame.source), palette = h.bundle.resources.find(item => item.id === frame.paletteId);
				const entry = window.ResourceStudioMapTextures.texture(frame, source, palette);
				function ready(texture)
				{
					if(disposed || generation !== token) { return; } textures.set(frame.id, texture);
					const p = position(frame, texture); p.x += view.originOffset.x; p.y += view.originOffset.y; extent = Math.max(extent, 2*(Math.max(Math.abs(view.originOffset.x), Math.abs(view.originOffset.y), Math.abs(p.x), Math.abs(p.y), Math.abs(p.x + texture.width), Math.abs(p.y + texture.height)) + 40));
					if(frame.id === items[current]?.id && !playing && !main.querySelector('[data-sequence-key]:focus')) { inspector(); }
					requestDraw();
				}
				if(entry.value) { ready(entry.value); } else { entry.promise.then(ready).catch(error => { if(!disposed && token === generation) { query('[data-sequence-time]').textContent = error.message; } }); }
			}
		}
		function inspector()
		{
			const frame = items[current], texture = textures.get(frame.id), p = position(frame, texture || {width:0,height:0});
			const input = (key, value, type = 'text', extra = '') => '<input data-sequence-key="'+key+'" value="'+h.escape(value)+'" type="'+type+'" required '+extra+'>';
			query('.sequence-inspector').innerHTML = '<div class="section-label">Selected frame</div>'+h.field('Sequence name', input('sequence', frame.sequence.name))+
				h.field('Unique sprite name', input('name', frame.name))+'<p>'+h.escape(frame.source)+'</p><p class="minor">'+(texture ? texture.width+' × '+texture.height+' source pixels' : 'Loading image…')+'</p>'+
				'<div class="sequence-offsets">'+h.field('X offset', input('x', p.x, 'number', 'step="0.5"'))+h.field('Y offset', input('y', p.y, 'number', 'step="0.5"'))+'</div><p class="minor" data-sequence-pivot>Local pivot: '+(-p.x)+', '+(-p.y)+'</p>'+
				h.field('Hold duration (ms)', input('duration', (frame.frameRate + 1)*50, 'number', 'min="50" max="6400" step="50"'))+'<button data-sequence-action="duration">Apply duration to selected ('+selected.size+')</button>'+
				h.field('Shared colors', '<select data-sequence-key="palette"><option value="" '+(!frame.paletteId ? 'selected' : '')+'>Plain RGB565</option><option value="__new__">Generate new shared palette…</option>'+h.bundle.resources.filter(item => item.type === 'palette').map(item => '<option value="'+h.escape(item.id)+'" '+(item.id === frame.paletteId ? 'selected' : '')+'>'+h.escape(item.name)+'</option>').join('')+'</select>')+
				'<p class="sequence-notice">Color selection applies to all frames in this sequence. Static sprite properties remain available in the Sprites tab.</p>';
		}
		function strip()
		{
			query('.sequence-strip').innerHTML = items.map((frame, index) => '<button class="sequence-frame" draggable="true" data-sequence-frame="'+index+'" aria-pressed="'+selected.has(frame.id)+'"><img alt="" src="'+h.escape(h.sources.find(source => source.path === frame.source)?.uri || '')+'">'+h.escape(frame.name)+'<small>'+(index + 1)+' · '+((frame.frameRate + 1)*50)+' ms</small></button>').join('');
		}
		function display(updateInspector = true)
		{
			if(!items.length) { return; }
			query('[data-sequence-action="remove"]').textContent = selected.size > 1 ? 'Remove selected frames' : 'Remove selected frame';
			query('[data-sequence-scrub]').max = items.length - 1; query('[data-sequence-scrub]').value = current;
			query('[data-sequence-time]').textContent = (current + 1)+' / '+items.length+' · '+items.reduce((sum, frame) => sum + (frame.frameRate + 1)*50, 0)+' ms';
			if(updateInspector) { inspector(); }
			const buttons = query('.sequence-strip').children;
			if(updateInspector) { for(const button of buttons) { button.setAttribute('aria-pressed', String(selected.has(items[+button.dataset.sequenceFrame].id))); } }
			if(buttons[lastDisplayed]) { buttons[lastDisplayed].dataset.current = 'false'; }
			if(buttons[current]) { buttons[current].dataset.current = 'true'; } lastDisplayed = current;
			if(updateInspector) { view.currentId = items[current].id; view.selected = [...selected]; h.saveState(); } draw();
		}
		function select(index, event = {})
		{
			stop(); current = Math.max(0, Math.min(items.length - 1, index));
			if(event.shiftKey) { selected = new Set(items.slice(Math.min(anchor, current), Math.max(anchor, current) + 1).map(frame => frame.id)); }
			else if(event.ctrlKey || event.metaKey) { if(selected.has(items[current].id) && selected.size > 1) { selected.delete(items[current].id); } else { selected.add(items[current].id); } anchor = current; }
			else { selected = new Set([items[current].id]); anchor = current; }
			display();
		}
		function tick(now)
		{
			if(!playing) { return; }
			let elapsed = now - started;
			const total = items.reduce((sum, frame) => sum + (frame.frameRate + 1)*50, 0);
			if(elapsed >= total && !query('[data-sequence-loop]').checked) { current = items.length - 1; stop(); display(); return; }
			elapsed %= total; let index = 0;
			while(index < items.length - 1 && elapsed >= (items[index].frameRate + 1)*50) { elapsed -= (items[index].frameRate + 1)*50; index++; }
			if(current !== index) { current = index; display(false); }
			animation = requestAnimationFrame(tick);
		}
		function click(event)
		{
			const button = event.target.closest('button'); if(!button || button.disabled || h.state.busy) { return; }
			if(button.dataset.sequenceFrame !== undefined) { select(+button.dataset.sequenceFrame, event); return; }
			const action = button.dataset.sequenceAction; if(!action) { return; }
			if(['files', 'folder', 'new'].includes(action)) { stop(); h.sendChange({action:'sequenceImport', sequenceId:action === 'new' ? undefined : id, folder:action === 'folder'}); return; }
			if(!items.length) { return; }
			if(action === 'play')
			{
				if(playing) { stop(); display(); return; }
				if(textures.size !== items.length) { query('[data-sequence-time]').textContent = 'Wait for all frame images to load.'; return; }
				playing = true; started = performance.now() - items.slice(0, current).reduce((sum, frame) => sum + (frame.frameRate + 1)*50, 0); button.textContent = 'Pause'; animation = requestAnimationFrame(tick); return;
			}
			stop();
			if(action === 'remove-animation') { h.sendChange({action:'sequenceRemove', sequenceId:id, ids:items.map(frame => frame.id)}); return; }
			if(action.startsWith('origin-'))
			{
				if(textures.size !== items.length) { query('[data-sequence-time]').textContent = 'Wait for all frame images to load.'; return; }
				const [dx, dy] = {'origin-left':[-1, 0], 'origin-right':[1, 0], 'origin-up':[0, -1], 'origin-down':[0, 1]}[action];
				for(const frame of items)
				{
					const p = position(frame, textures.get(frame.id)); frame.pivot = {x:-p.x + dx, y:-p.y + dy};
				}
				// Compensate the preview camera so sprites stay still while the origin moves.
				view.originOffset.x += dx; view.originOffset.y += dy;
				display(); commit(); return;
			}
			if(action === 'first') { select(0); }
			if(action === 'previous') { select(current - 1); }
			if(action === 'next') { select(current + 1); }
			if(action === 'earlier' || action === 'later')
			{
				const frame = items[current], index = Math.max(0, Math.min(items.length - 1, current + (action === 'earlier' ? -1 : 1)));
				items.splice(current, 1); items.splice(index, 0, frame); current = index; view.currentId = frame.id; commit();
			}
			if(action === 'remove' && items.length - selected.size === 1) { query('[data-sequence-time]').textContent = 'Keep at least two frames, or select all frames to remove the entire animation.'; return; }
			if(action === 'duplicate' || action === 'remove') { h.sendChange({action:action === 'duplicate' ? 'sequenceDuplicate' : 'sequenceRemove', sequenceId:id, ids:[...selected]}); }
			if(action === 'duration')
			{
				const element = query('[data-sequence-key="duration"]'); if(!validDuration(element)) { return; }
				items.filter(frame => selected.has(frame.id)).forEach(frame => frame.frameRate = +element.value/50 - 1); commit();
			}
		}
		function validDuration(element) { element.setCustomValidity(+element.value >= 50 && +element.value <= 6400 && +element.value % 50 === 0 ? '' : 'Use 50–6400 ms in steps of 50.'); return element.reportValidity(); }
		function change(event)
		{
			const element = event.target, key = element.dataset.sequenceKey; if(!key || h.state.busy) { return; } stop();
			const frame = items[current];
			if(key === 'name' || key === 'sequence')
			{
				const validation = window.ResourceStudioValidation;
				const used = validation.usedNames(h.bundle.resources, key === 'name' ? frame.id : undefined, key === 'sequence' ? id : undefined);
				const error = key === 'sequence' ? validation.animationName(element.value, used) : validation.name(element.value, used, 'sprite'); element.setCustomValidity(error || ''); if(!element.reportValidity()) { return; }
				if(key === 'name') { frame.name = element.value; } else { items.forEach(item => item.sequence.name = element.value); }
			}
			if(key === 'x' || key === 'y')
			{
				const texture = textures.get(frame.id); if(!texture || !element.reportValidity() || element.value === '' || !Number.isFinite(+element.value)) { return; }
				const p = position(frame, texture); p[key] = +element.value; frame.pivot = {x:-p.x, y:-p.y};
			}
			if(key === 'duration') { if(!validDuration(element)) { return; } items.filter(item => selected.has(item.id)).forEach(item => item.frameRate = +element.value/50 - 1); }
			if(key === 'palette' && element.value === '__new__') { h.sendChange({action:'sequenceGeneratePalette', sequenceId:id}); return; }
			commit(key === 'palette' ? {paletteId:element.value || null} : {});
		}
		function clearValidity(event) { if(event.target.dataset.sequenceKey) { event.target.setCustomValidity(''); } }
		main.addEventListener('input', clearValidity); main.addEventListener('click', click); main.addEventListener('change', change);
		let disposeViewport = () => {};
		if(canvas)
		{
			query('[data-sequence-zoom]').value = view.zoom; query('[data-sequence-onion]').checked = view.onion; query('[data-sequence-solid]').checked = view.solid; query('[data-sequence-background]').value = view.background;
			function background() { stage.classList.toggle('checker', !view.solid); stage.style.setProperty('--sequence-background', view.background); draw(); }
			background();
			query('[data-sequence-zoom]').onchange = event => { view.zoom = event.target.value; draw(); };
			query('[data-sequence-onion]').onchange = event => { view.onion = event.target.checked; draw(); };
			query('[data-sequence-solid]').onchange = event => { view.solid = event.target.checked; background(); };
			query('[data-sequence-background]').oninput = event => { view.background = event.target.value; background(); };
			query('[data-sequence-scrub]').oninput = event => select(+event.target.value);
			disposeViewport = window.ResourceStudioViewport.mount({stage, canvas, state:view, draw, saveState:h.saveState, select:query('[data-sequence-zoom]'), getScale:() => scale, ready:() => textures.size > 0, interacting:() => !!drag});
			canvas.onpointerdown = event =>
			{
				if(event.button !== 0 || h.state.busy) { return; } stop();
				const texture = textures.get(items[current].id); if(!texture) { return; }
				const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left)/scale - extent/2 - view.originOffset.x, y = (event.clientY - rect.top)/scale - extent/2 - view.originOffset.y, p = position(items[current], texture);
				if(x < p.x || x > p.x + texture.width || y < p.y || y > p.y + texture.height) { return; }
				drag = {pointer:event.pointerId, x:event.clientX, y:event.clientY, p}; canvas.setPointerCapture(event.pointerId); event.preventDefault();
			};
			canvas.onpointermove = event =>
			{
				if(!drag || drag.pointer !== event.pointerId) { return; }
				items[current].pivot = {x:-Math.round((drag.p.x + (event.clientX - drag.x)/scale)*2)/2, y:-Math.round((drag.p.y + (event.clientY - drag.y)/scale)*2)/2}; draw(); inspector();
			};
			canvas.onpointerup = event => { if(!drag || drag.pointer !== event.pointerId) { return; } canvas.onpointermove(event); drag = undefined; commit(); };
			canvas.onpointercancel = canvas.onlostpointercapture = () => { if(drag) { items[current].pivot = {x:-drag.p.x,y:-drag.p.y}; drag = undefined; draw(); } };
			const list = query('.sequence-strip');
			list.ondragstart = event => { if(h.state.busy) { event.preventDefault(); return; } const button = event.target.closest('[data-sequence-frame]'); draggedId = button && items[+button.dataset.sequenceFrame].id; if(draggedId) { event.dataTransfer.setData('text/plain', draggedId); } };
			list.ondragover = event => { if(draggedId) { event.preventDefault(); } };
			list.ondrop = event => { event.preventDefault(); if(h.state.busy) { return; } const button = event.target.closest('[data-sequence-frame]'), from = items.findIndex(frame => frame.id === draggedId); if(!button || from < 0) { return; } stop(); const to = +button.dataset.sequenceFrame; items.splice(to, 0, items.splice(from, 1)[0]); current = to; view.currentId = items[current].id; draggedId = undefined; commit(); };
			list.ondragend = () => { draggedId = undefined; };
			load(); strip(); display();
		}
		const dispose = () => { if(items.length) { view.currentId = items[current].id; view.selected = [...selected]; h.saveState(); } disposed = true; stop(); cancelAnimationFrame(pendingDraw); generation++; disposeViewport(); main.removeEventListener('input', clearValidity); main.removeEventListener('click', click); main.removeEventListener('change', change); };
		dispose.validate = () => { const invalid = main.querySelector('[data-sequence-key]:invalid'); if(invalid) { invalid.reportValidity(); return false; } return true; };
		dispose.refreshResource = (next, nextHelpers, preserveInput) =>
		{
			stop(); h = nextHelpers; items = frames(next, h); current = Math.min(current, items.length - 1); load(); strip(); display(!preserveInput);
		};
		return dispose;
	}
	window.ResourceStudioSequences = {render, mount};
}());
