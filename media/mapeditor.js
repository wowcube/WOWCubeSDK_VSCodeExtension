/* Map editor interaction and per-map view state; no sprite/palette editor handlers here. */
(function ()
{
	function mountOutliner(main, state, saveState)
	{
		const inspector = main.querySelector('.map-inspector'), divider = main.querySelector('.map-inspector-divider');
		let pointerId;
		function resize(ratio)
		{
			const available = Math.max(0, inspector.clientHeight - divider.offsetHeight);
			const minimum = Math.min(140, available/2), maximum = available - Math.min(160, available/2);
			const height = Math.max(minimum, Math.min(maximum, available*ratio));
			inspector.style.setProperty('--map-outliner-height', height+'px');
			divider.setAttribute('aria-valuemin', String(Math.round(100*minimum/(available || 1))));
			divider.setAttribute('aria-valuemax', String(Math.round(100*maximum/(available || 1))));
			divider.setAttribute('aria-valuenow', String(Math.round(100*height/(available || 1))));
			return available ? height/available : 0.5;
		}
		function move(event)
		{
			if(event.pointerId !== pointerId) { return; }
			const available = Math.max(1, inspector.clientHeight - divider.offsetHeight);
			state.outlinerRatio = resize((event.clientY - inspector.getBoundingClientRect().top)/available);
		}
		divider.onpointerdown = event =>
		{
			if(event.button !== 0) { return; }
			event.preventDefault(); pointerId = event.pointerId;
			divider.focus({preventScroll:true}); divider.setPointerCapture(pointerId);
		};
		divider.onpointermove = move;
		divider.onpointerup = event =>
		{
			if(event.pointerId !== pointerId) { return; }
			move(event); pointerId = undefined; saveState();
		};
		divider.onlostpointercapture = divider.onpointercancel = () => { pointerId = undefined; saveState(); };
		divider.onkeydown = event =>
		{
			if(!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { return; }
			event.preventDefault();
			const ratio = Number.isFinite(state.outlinerRatio) ? state.outlinerRatio : 0.5;
			state.outlinerRatio = resize(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ratio + (event.key === 'ArrowUp' ? -0.05 : 0.05));
			saveState();
		};
		const observer = new ResizeObserver(() => resize(Number.isFinite(state.outlinerRatio) ? state.outlinerRatio : 0.5));
		observer.observe(inspector); resize(Number.isFinite(state.outlinerRatio) ? state.outlinerRatio : 0.5);
		return () =>
		{
			observer.disconnect();
			divider.onpointerdown = divider.onpointermove = divider.onpointerup = divider.onpointercancel = divider.onlostpointercapture = divider.onkeydown = null;
		};
	}
	function mount(resource, helpers)
	{
		const ui = window.ResourceStudioMapUI, geometry = window.ResourceStudioMapGeometry;
		const root = helpers.root, main = helpers.main, state = ui.view(resource, helpers);
		let map = JSON.parse(JSON.stringify(resource)), disposed = false, dragging, draggedId, navigated = false;
		const stage = main.querySelector('#map-preview'), canvas = main.querySelector('#map-canvas');
		const center = main.querySelector('.map-center'), outliner = main.querySelector('.map-outliner'), parameters = main.querySelector('.map-parameters');
		const scrolls = state.scrolls || {};
		const disposeOutliner = mountOutliner(main, state, helpers.saveState);
		if(!Number.isFinite(state.previewHeight)) { state.previewHeight = Math.max(140, Math.round(center.clientHeight*0.75)); }
		if(!map.placements.some(item => item.id === state.selectedPlacement && !isLocked(item.id))) { state.selectedPlacement = ''; }
		function restorePreview()
		{
			stage.scrollTop = scrolls.top || 0; stage.scrollLeft = scrolls.left || 0;
		}
		function restore()
		{
			center.scrollTop = scrolls.center || 0; outliner.scrollTop = scrolls.outliner || 0; parameters.scrollTop = scrolls.parameters || 0;
			restorePreview();
		}
		function notice(message)
		{
			const element = main.querySelector('#map-notice'); element.textContent = message; element.hidden = !message;
		}
		function boundsWarnings(warnings)
		{
			const selectedWarning = main.querySelector('#map-selected-bounds-warning');
			const message = item => item.name+' ('+item.face+') is not fully inside a single screen.';
			if(selectedWarning)
			{
				const item = warnings.find(item => item.id === state.selectedPlacement);
				const text = item ? 'Warning: '+message(item)+' Saving and building are still allowed.' : '';
				if(selectedWarning.textContent !== text) { selectedWarning.textContent = text; }
				selectedWarning.hidden = !item;
			}
		}
		const renderer = window.ResourceStudioMapRenderer.mount({canvas, stage, resource:map, bundle:helpers.bundle, sources:helpers.sources, state, notice, boundsWarnings,
			ready:() => { if(!disposed && !navigated) { restorePreview(); } }});
		const viewport = window.ResourceStudioViewport.mount({stage, canvas, state, saveState:helpers.saveState, select:main.querySelector('#map-zoom'),
			getScale:renderer.getScale, draw:renderer.draw, ready:() => !disposed, interacting:() => Boolean(dragging)});
		function isLocked(id) { return state.lockedPlacements.includes(id); }
		function selected() { return map.placements.find(item => item.id === state.selectedPlacement && !isLocked(item.id)); }
		function updateLockRow(id)
		{
			const row = rowsById.get(id);
			if(!row) { return; }
			const locked = isLocked(id), button = row.querySelector('[data-map-lock]');
			row.classList.toggle('locked', locked); row.draggable = !locked;
			row.querySelector('[data-map-select]').disabled = locked;
			if(button.getAttribute('aria-pressed') !== String(locked))
			{
				const item = map.placements.find(item => item.id === id), sprite = helpers.bundle.resources.find(sprite => sprite.id === item.spriteId);
				button.setAttribute('aria-pressed', String(locked));
				button.setAttribute('aria-label', (locked ? 'Unlock ' : 'Lock ')+(sprite?.name || 'sprite'));
				button.title = locked ? 'Unlock sprite' : 'Lock sprite'; button.innerHTML = ui.lockIcon(locked);
			}
		}
		let listKey, parameterId, parameterSprite, previousSelection;
		let rowsById = new Map();
		function refresh(structure = true, preserveInput = false, keepExtent = true)
		{
			const top = outliner.scrollTop, propertiesTop = parameters.scrollTop;
			if(structure)
			{
				const key = JSON.stringify(map.placements.map(item => [item.id, item.spriteId]));
				if(key !== listKey)
				{
					main.querySelector('#map-outliner-list').innerHTML = ui.outliner(map, helpers); listKey = key;
					rowsById = new Map(Array.from(outliner.querySelectorAll('[data-map-instance]')).map(row => [row.dataset.mapInstance, row]));
				}
				for(const item of map.placements)
				{
					updateLockRow(item.id);
					const label = rowsById.get(item.id)?.querySelector('.map-placement-face'), name = renderer.getLayout().faces[item.side].name;
					if(label && label.textContent !== name) { label.textContent = name; }
				}
			}
			rowsById.get(previousSelection)?.classList.remove('selected');
			rowsById.get(previousSelection)?.querySelector('[data-map-select]').setAttribute('aria-pressed', 'false');
			const row = rowsById.get(state.selectedPlacement), item = selected();
			if(row)
			{
				row.classList.add('selected'); row.querySelector('[data-map-select]').setAttribute('aria-pressed', 'true');
				row.querySelector('.map-placement-face').textContent = renderer.getLayout().faces[item.side].name;
			}
			previousSelection = state.selectedPlacement;
			if(parameterId !== state.selectedPlacement || parameterSprite !== item?.spriteId)
			{
				main.querySelector('#map-placement-parameters').innerHTML = ui.parameters(map, helpers);
				parameterId = state.selectedPlacement; parameterSprite = item?.spriteId;
			}
			if(item)
			{
				const relative = geometry.faceToScreen(renderer.getLayout(), item.side, item.x, item.y);
				const values = {spriteId:item.spriteId, side:item.side, twistable:!!item.twistable, relativeX:Number(relative.x.toFixed(6)), relativeY:Number(relative.y.toFixed(6))};
				parameters.querySelectorAll('[data-map-key]').forEach(field =>
				{
					if(preserveInput && field === document.activeElement) { return; }
					if(field.type === 'checkbox') { field.checked = values[field.dataset.mapKey]; }
					else { field.value = values[field.dataset.mapKey]; }
				});
				parameters.querySelector('.map-relative-description').textContent = 'Relative: '+['top-left','top-right','bottom-left','bottom-right'][relative.screen]+' screen, in screen pixels from its top-left. X increases right; Y increases down.';
			}
			const index = map.placements.findIndex(item => item.id === state.selectedPlacement);
			main.querySelectorAll('[data-map-order]').forEach(button =>
			{
				button.disabled = index < 0 || (['up', 'top'].includes(button.dataset.mapOrder) ? index === 0 : index === map.placements.length - 1);
			});
			main.querySelector('[data-map-remove]').disabled = index < 0;
			outliner.scrollTop = top; parameters.scrollTop = propertiesTop;
			renderer.update(map, keepExtent, structure);
		}
		function commit(change, focusKey)
		{
			if(disposed || helpers.state.busy) { return; }
			try
			{
				const next = JSON.parse(JSON.stringify(map)); change(next);
				next.placements.forEach(item => { item.twistable ??= false; });
				geometry.computeNetLayout(next.net);
				if(focusKey) { state.focusKey = focusKey; }
				helpers.updateResource(next);
			}
			catch(error) { notice(error.message); }
		}
		function remove()
		{
			const id = state.selectedPlacement;
			if(!id || isLocked(id)) { return; }
			commit(next =>
			{
				const index = next.placements.findIndex(item => item.id === id);
				if(index >= 0) { next.placements.splice(index, 1); state.selectedPlacement = next.placements.slice(index).find(item => !isLocked(item.id))?.id || next.placements.find(item => !isLocked(item.id))?.id || ''; }
			});
		}
		function click(event)
		{
			const button = event.target.closest('button');
			if(!button || button.disabled || disposed || helpers.state.busy) { return; }
			if(button.dataset.mapLock !== undefined)
			{
				const id = button.dataset.mapLock;
				if(!map.placements.some(item => item.id === id)) { return; }
				if(dragging?.id === id) { Object.assign(map.placements.find(item => item.id === id), dragging.initial); dragging = undefined; }
				state.lockedPlacements = isLocked(id) ? state.lockedPlacements.filter(item => item !== id) : [...state.lockedPlacements, id];
				if(isLocked(id) && state.selectedPlacement === id) { state.selectedPlacement = ''; }
				if(draggedId === id) { draggedId = undefined; }
				updateLockRow(id); refresh(false); helpers.saveState();
			}
			else if(button.dataset.mapSelect !== undefined)
			{
				if(isLocked(button.dataset.mapSelect)) { return; }
				state.selectedPlacement = button.dataset.mapSelect; refresh(false); helpers.saveState();
			}
			else if(button.dataset.mapAdd)
			{
				commit(next =>
				{
					const sprite = helpers.bundle.resources.find(item => item.type === 'sprite' && item.id === button.dataset.mapAdd);
					if(!sprite) { throw new Error('Sprite no longer exists.'); }
					const layout = geometry.computeNetLayout(next.net), display = layout.faces[1].displays[1];
					const position = geometry.canvasToFace(layout, display.x + display.w/2, display.y + display.h/2);
					let id;
					do { id = window.crypto?.randomUUID?.() || 'place_'+Date.now().toString(16)+'_'+Math.random().toString(16).slice(2); } while(next.placements.some(item => item.id === id));
					next.placements.unshift({id, spriteId:sprite.id, side:position.side, x:position.X, y:position.Y, twistable:false}); state.selectedPlacement = id;
				});
			}
			else if(button.hasAttribute('data-map-remove')) { remove(); }
			else if(button.dataset.mapOrder)
			{
				if(!selected()) { return; }
				commit(next =>
				{
					const index = next.placements.findIndex(item => item.id === state.selectedPlacement);
					if(index < 0) { return; }
					const order = button.dataset.mapOrder;
					const target = order === 'top' ? 0 : order === 'bottom' ? next.placements.length - 1 : index + (order === 'up' ? -1 : 1);
					next.placements.splice(Math.max(0, Math.min(next.placements.length - 1, target)), 0, next.placements.splice(index, 1)[0]);
				});
			}
			else if(button.dataset.mapTab)
			{
				state.settingsTab = button.dataset.mapTab;
				main.querySelectorAll('[data-map-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
				for(const key of ['geometry', 'background', 'markers']) { main.querySelector('#map-settings-'+key).hidden = key !== state.settingsTab; }
				helpers.saveState();
			}
			else if(button.dataset.mapBackground === 'choose') { helpers.chooseMapBackground(map.id); }
			else if(button.dataset.mapBackground === 'clear') { commit(next => { next.net.backgroundImage = null; }); }
		}
		function change(event)
		{
			const element = event.target, key = element.dataset.mapKey;
			if(disposed || helpers.state.busy) { return; }
			if(element.id === 'map-zoom') { state.zoom = element.value; navigated = true; renderer.draw(); helpers.saveState(); return; }
			if(!key) { return; }
			commit(next =>
			{
				if(key === 'transparentBackground') { next.net.background = element.checked ? null : '#8b8b8b'; return; }
				const value = element.type === 'checkbox' ? element.checked : element.type === 'number' || key === 'side' ? Number(element.value) : element.value;
				if((element.type === 'number' || key === 'side') && (!element.value || !Number.isFinite(value))) { throw new Error('Enter a finite coordinate or size.'); }
				if(key.startsWith('net.'))
				{
					const path = key.split('.').slice(1);
					if(path[0] === 'padding') { next.net.padding[path[1]] = value; } else { next.net[path[0]] = value; }
				}
				else
				{
					const item = next.placements.find(item => item.id === state.selectedPlacement);
					if(!item || isLocked(item.id)) { throw new Error('Select an unlocked placed sprite.'); }
					if(key === 'relativeX' || key === 'relativeY')
					{
						const layout = geometry.computeNetLayout(next.net), relative = geometry.faceToScreen(layout, item.side, item.x, item.y);
						relative[key === 'relativeX' ? 'x' : 'y'] = value;
						const position = geometry.screenToFace(layout, item.side, relative.screen, relative.x, relative.y);
						item.x = position.X; item.y = position.Y;
					}
					else { item[key] = value; }
				}
			}, key);
		}
		canvas.onpointerdown = function (event)
		{
			if(disposed || helpers.state.busy || event.button !== 0) { return; }
			navigated = true;
			const p = renderer.point(event), item = renderer.hitTest(p);
			state.selectedPlacement = item?.id || ''; refresh(false); helpers.saveState();
			if(!item) { return; }
			const pivot = geometry.faceToCanvas(renderer.getLayout(), item.side, item.x, item.y);
			dragging = {pointerId:event.pointerId, id:item.id, initial:{...item}, dx:p.x - pivot.x, dy:p.y - pivot.y};
			event.preventDefault(); canvas.focus({preventScroll:true}); canvas.setPointerCapture(event.pointerId);
		};
		canvas.onpointermove = function (event)
		{
			if(!dragging || event.pointerId !== dragging.pointerId || isLocked(dragging.id)) { return; }
			const p = renderer.point(event), position = geometry.canvasToFace(renderer.getLayout(), p.x - dragging.dx, p.y - dragging.dy);
			const item = selected(); item.side = position.side; item.x = Math.round(position.X*2)/2; item.y = Math.round(position.Y*2)/2;
			refresh(false);
		};
		canvas.onpointerup = function (event)
		{
			if(!dragging || event.pointerId !== dragging.pointerId || isLocked(dragging.id)) { return; }
			canvas.onpointermove(event);
			const initial = dragging.initial; dragging = undefined;
			const item = selected();
			if(item && ['side', 'x', 'y'].some(key => item[key] !== initial[key])) { commit(() => {}); }
		};
		canvas.onpointercancel = function ()
		{
			if(dragging) { Object.assign(selected(), dragging.initial); dragging = undefined; refresh(false); }
		};
		canvas.onlostpointercapture = function () { if(dragging) { canvas.onpointercancel(); } };
		canvas.onkeydown = function (event)
		{
			if(helpers.state.busy || !selected()) { return; }
			if(event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); return; }
			if(!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { return; }
			event.preventDefault();
			commit(next =>
			{
				const item = next.placements.find(item => item.id === state.selectedPlacement), delta = event.shiftKey ? 5 : 0.5;
				if(event.key === 'ArrowLeft') { item.x -= delta; } if(event.key === 'ArrowRight') { item.x += delta; }
				if(event.key === 'ArrowUp') { item.y += delta; } if(event.key === 'ArrowDown') { item.y -= delta; }
			});
		};
		function dragStart(event)
		{
			const row = event.target.closest('[data-map-instance]');
			if(event.target.closest('[data-map-lock]') || row && isLocked(row.dataset.mapInstance)) { event.preventDefault(); return; }
			if(row && !helpers.state.busy) { draggedId = row.dataset.mapInstance; event.dataTransfer.setData('text/plain', draggedId); event.dataTransfer.effectAllowed = 'move'; }
		}
		function dragOver(event) { if(event.target.closest('[data-map-instance]')) { event.preventDefault(); } }
		function drop(event)
		{
			const row = event.target.closest('[data-map-instance]');
			if(!row || !draggedId || isLocked(draggedId)) { return; }
			event.preventDefault();
			commit(next =>
			{
				const from = next.placements.findIndex(item => item.id === draggedId), to = next.placements.findIndex(item => item.id === row.dataset.mapInstance);
				if(from >= 0 && to >= 0) { next.placements.splice(to, 0, next.placements.splice(from, 1)[0]); }
			});
			draggedId = undefined;
		}
		function navigate() { navigated = true; }
		root.addEventListener('click', click); root.addEventListener('change', change);
		main.addEventListener('dragstart', dragStart); main.addEventListener('dragover', dragOver); main.addEventListener('drop', drop);
		stage.addEventListener('wheel', navigate); stage.addEventListener('pointerdown', navigate);
		const layout = renderer.getLayout(); main.querySelector('#map-dimensions').textContent = layout.canvasWidth+' × '+layout.canvasHeight;
		refresh(); restore();
		if(state.focusKey)
		{
			const field = Array.from(main.querySelectorAll('[data-map-key]')).find(element => element.dataset.mapKey === state.focusKey);
			field?.focus({preventScroll:true}); delete state.focusKey;
		}
		const dispose = function ()
		{
			disposed = true;
			state.scrolls = {center:center.scrollTop, outliner:outliner.scrollTop, parameters:parameters.scrollTop, top:stage.scrollTop, left:stage.scrollLeft};
			disposeOutliner(); viewport(); renderer.dispose();
			root.removeEventListener('click', click); root.removeEventListener('change', change);
			main.removeEventListener('dragstart', dragStart); main.removeEventListener('dragover', dragOver); main.removeEventListener('drop', drop);
			stage.removeEventListener('wheel', navigate); stage.removeEventListener('pointerdown', navigate);
			canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = canvas.onkeydown = null;
		};
		dispose.refreshResource = function (resource, updatedHelpers, preserveInput)
		{
			map = JSON.parse(JSON.stringify(resource)); helpers = updatedHelpers;
			if(!map.placements.some(item => item.id === state.selectedPlacement && !isLocked(item.id))) { state.selectedPlacement = ''; }
			refresh(true, preserveInput, false);
			if(state.focusKey)
			{
				parameters.querySelector('[data-map-key="'+state.focusKey+'"]')?.focus({preventScroll:true}); delete state.focusKey;
			}
			const entry = Array.from(root.querySelectorAll('[data-select]')).find(element => element.dataset.select === map.id);
			if(entry?.querySelector('small')) { entry.querySelector('small').textContent = map.placements.length+' sprite placements'; }
		};
		return dispose;
	}
	window.ResourceStudioMapEditor = {mount};
}());
