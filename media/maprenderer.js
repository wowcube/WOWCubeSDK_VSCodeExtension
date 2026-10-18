/* Map composition and sprite texture loading; editor events live in mapeditor.js. */
(function ()
{
	const geometry = window.ResourceStudioMapGeometry;
	function placementBounds(layout, placement, sprite, width, height)
	{
		const pivot = sprite.pivot || {x:width/2, y:height/2};
		const point = geometry.faceToCanvas(layout, placement.side, placement.x, placement.y);
		const scale = layout.k*(sprite.fullsize ? 1 : 2);
		return {x:point.x - pivot.x*scale, y:point.y - pivot.y*scale, width:width*scale, height:height*scale, pivot:point};
	}
	function placementFitsScreen(layout, placement, sprite, width, height)
	{
		const b = placementBounds(layout, placement, sprite, width, height), epsilon = 0.000001;
		return layout.faces[placement.side].displays.some(rect => b.x >= rect.x - epsilon && b.y >= rect.y - epsilon &&
			b.x + b.width <= rect.x + rect.w + epsilon && b.y + b.height <= rect.y + rect.h + epsilon);
	}
	function mount(options)
	{
		const {canvas, stage, bundle, sources, state} = options;
		let map = options.resource, layout = geometry.computeNetLayout(map.net), scale = 1, disposed = false;
		let extent = {x:0, y:0, width:layout.canvasWidth, height:layout.canvasHeight};
		const textures = new Map(), loading = new Set(), failures = new Map();
		const resourcesById = new Map(bundle.resources.map(item => [item.id, item]));
		const sourcesByPath = new Map(sources.map(item => [item.path, item]));
		let frame, pendingKeepExtent = true;
		const net = document.createElement('canvas');
		let background, previewError = '';
		if(!map.net.backgroundImage && layout.canvasWidth <= 16384 && layout.canvasHeight <= 16384 && layout.canvasWidth*layout.canvasHeight <= 64000000)
		{
			geometry.renderNet(net.getContext('2d'), {...map.net, markers:false});
		}
		function bounds(item)
		{
			const texture = textures.get(item.spriteId);
			return texture && placementBounds(layout, item, texture.sprite, texture.width, texture.height);
		}
		function scheduleDraw(keepExtent = false)
		{
			pendingKeepExtent = pendingKeepExtent && keepExtent;
			if(frame === undefined) { frame = requestAnimationFrame(() => { const keep = pendingKeepExtent; frame = undefined; pendingKeepExtent = true; draw(keep); }); }
		}
		function draw(keepExtent = false)
		{
			if(disposed) { return; }
			if(frame !== undefined) { cancelAnimationFrame(frame); frame = undefined; pendingKeepExtent = true; }
			const selected = map.placements.find(item => item.id === state.selectedPlacement && !(state.lockedPlacements || []).includes(item.id));
			const selectedTexture = selected && textures.get(selected.spriteId);
			const warnings = selectedTexture && !placementFitsScreen(layout, selected, selectedTexture.sprite, selectedTexture.width, selectedTexture.height) ?
				[{id:selected.id, name:selectedTexture.sprite.name, face:layout.faces[selected.side].name}] : [];
			options.boundsWarnings?.(warnings);
			if(!keepExtent)
			{
				let x = 0, y = 0, right = layout.canvasWidth, bottom = layout.canvasHeight;
				for(const item of map.placements)
				{
					const b = bounds(item);
					if(b) { x = Math.min(x, b.x - 10); y = Math.min(y, b.y - 10); right = Math.max(right, b.x + b.width + 10); bottom = Math.max(bottom, b.y + b.height + 10); }
				}
				extent = {x:Math.floor(x), y:Math.floor(y), width:Math.ceil(right - Math.floor(x)), height:Math.ceil(bottom - Math.floor(y))};
			}
			if(extent.width > 16384 || extent.height > 16384 || extent.width*extent.height > 64000000)
			{
				previewError = 'The map is too large for a canvas preview. Reduce net dimensions or move distant placements closer.';
				options.notice(previewError);
				return;
			}
			scale = window.ResourceStudioViewport.scale(state, extent.width, extent.height, stage);
			if(canvas.width !== extent.width) { canvas.width = extent.width; }
			if(canvas.height !== extent.height) { canvas.height = extent.height; }
			canvas.style.width = Math.ceil(extent.width*scale)+'px'; canvas.style.height = Math.ceil(extent.height*scale)+'px';
			const ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.imageSmoothingEnabled = false;
			const stageRect = stage.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
			const visible = {x:extent.x + (stageRect.left - canvasRect.left)/scale, y:extent.y + (stageRect.top - canvasRect.top)/scale,
				width:stageRect.width/scale + 2/scale, height:stageRect.height/scale + 2/scale};
			ctx.save(); ctx.translate(-extent.x, -extent.y);
			if(!map.net.backgroundImage) { ctx.drawImage(net, 0, 0); }
			else
			{
				if(map.net.background !== null)
				{
					ctx.fillStyle = map.net.background; ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);
				}
				if(background) { ctx.drawImage(background, 0, 0, layout.canvasWidth, layout.canvasHeight); }
			}
			for(const item of map.placements.slice().reverse())
			{
				const b = bounds(item), texture = textures.get(item.spriteId);
				if(!b || !texture || b.x + b.width < visible.x || b.y + b.height < visible.y || b.x > visible.x + visible.width || b.y > visible.y + visible.height) { continue; }
				ctx.globalCompositeOperation = texture.sprite.blend === 'additive' ? 'lighter' : 'source-over';
				ctx.drawImage(texture.canvas, b.x, b.y, b.width, b.height);
			}
			ctx.globalCompositeOperation = 'source-over';
			if(map.net.markers)
			{
				ctx.fillStyle = map.net.markerColor;
				for(const marker of map.sideMarkers)
				{
					const p = geometry.faceToCanvas(layout, marker.side, marker.x, marker.y);
					ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
				}
			}
			const b = selected && bounds(selected);
			if(b)
			{
				ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--s-focus').trim() || '#3794ff';
				const borderWidth = Math.min(1.5/scale, b.width, b.height);
				ctx.lineWidth = borderWidth;
				ctx.strokeRect(b.x + borderWidth/2, b.y + borderWidth/2, b.width - borderWidth, b.height - borderWidth);
				ctx.lineWidth = 1.5/scale;
				ctx.beginPath(); ctx.moveTo(b.pivot.x - 5/scale, b.pivot.y); ctx.lineTo(b.pivot.x + 5/scale, b.pivot.y);
				ctx.moveTo(b.pivot.x, b.pivot.y - 5/scale); ctx.lineTo(b.pivot.x, b.pivot.y + 5/scale); ctx.stroke();
			}
			ctx.restore();
		}
		function report() { options.notice([previewError, ...failures.values()].filter(Boolean).join('\n')); }
		function syncTextures()
		{
			const ids = new Set(map.placements.map(item => item.spriteId)), pending = [];
			for(const id of textures.keys()) { if(!ids.has(id)) { textures.delete(id); } }
			for(const id of ids)
			{
				if(textures.has(id) || loading.has(id) || failures.has(id)) { continue; }
				const sprite = resourcesById.get(id), source = sprite && sourcesByPath.get(sprite.source);
				if(!sprite) { failures.set(id, 'Referenced sprite is missing.'); continue; }
				const cached = window.ResourceStudioMapTextures.texture(sprite, source, resourcesById.get(sprite.paletteId));
				if(cached.value) { textures.set(id, {...cached.value, sprite}); continue; }
				loading.add(id);
				pending.push(cached.promise.then(texture =>
				{
					if(!disposed) { textures.set(id, {...texture, sprite}); scheduleDraw(); }
				}, error => { if(!disposed) { failures.set(id, sprite.name+': '+error.message); report(); } }).finally(() => loading.delete(id)));
			}
			return pending;
		}
		const pending = syncTextures();
		if(map.net.backgroundImage)
		{
			const cached = window.ResourceStudioMapTextures.background(sourcesByPath.get(map.net.backgroundImage));
			if(cached.value) { background = cached.value.image; }
			else { pending.push(cached.promise.then(value => { if(!disposed) { background = value.image; scheduleDraw(); } },
				error => { if(!disposed) { failures.set('background', error.message); report(); } })); }
		}
		draw();
		Promise.allSettled(pending).then(() =>
		{
			if(disposed) { return; }
			draw(); report(); options.ready();
		});
		function scroll() { scheduleDraw(true); }
		stage.addEventListener('scroll', scroll, {passive:true});
		return {
			draw, getScale:() => scale, getLayout:() => layout,
			update:(resource, keepExtent = true, sync = true) => { map = resource; if(sync) { syncTextures(); } scheduleDraw(keepExtent); },
			point:event =>
			{
				const r = canvas.getBoundingClientRect();
				return {x:(event.clientX - r.left)*canvas.width/r.width + extent.x, y:(event.clientY - r.top)*canvas.height/r.height + extent.y};
			},
			hitTest:point =>
			{
				const locked = new Set(state.lockedPlacements);
				return map.placements.find(item =>
				{
					if(locked.has(item.id)) { return false; }
					const b = bounds(item);
					return b && point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
				});
			},
			dispose:() => { disposed = true; if(frame !== undefined) { cancelAnimationFrame(frame); } stage.removeEventListener('scroll', scroll); textures.clear(); }
		};
	}
	window.ResourceStudioMapRenderer = {mount, placementBounds, placementFitsScreen};
}());
