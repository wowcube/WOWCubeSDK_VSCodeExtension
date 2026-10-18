/* Shared zoom and vertical-resize interaction for resource previews. */
(function ()
{
	const zoomLevels = [0.5, 1, 2, 4, 8, 16, 32, 64, 128];
	function scale(state, width, height, stage)
	{
		return state.zoom === 'fit' ? Math.min(128, Math.max(0.05, Math.min((stage.clientWidth - 40)/width, (stage.clientHeight - 40)/height))) : Math.max(zoomLevels[0], Math.min(128, Number(state.zoom) || 1));
	}
	function mountResizeHandle(stage, state, saveState)
	{
		const handle = stage.nextElementSibling;
		if(!handle?.classList.contains('preview-resize-handle')) { return () => {}; }
		let drag;
		function resize(height)
		{
			state.previewHeight = Math.max(140, height);
			stage.style.height = state.previewHeight+'px';
			handle.setAttribute('aria-valuenow', String(Math.round(state.previewHeight)));
		}
		handle.setAttribute('aria-valuemin', '140');
		handle.setAttribute('aria-valuenow', String(Math.round(stage.getBoundingClientRect().height)));
		handle.onpointerdown = event =>
		{
			if(event.button !== 0) { return; }
			event.preventDefault();
			drag = {id:event.pointerId, y:event.clientY, height:stage.getBoundingClientRect().height};
			handle.focus({preventScroll:true}); handle.setPointerCapture(event.pointerId);
		};
		handle.onpointermove = event =>
		{
			if(drag && drag.id === event.pointerId) { resize(drag.height + event.clientY - drag.y); }
		};
		handle.onpointerup = event =>
		{
			if(!drag || drag.id !== event.pointerId) { return; }
			handle.onpointermove(event); drag = undefined; saveState();
		};
		handle.onlostpointercapture = handle.onpointercancel = () => { drag = undefined; saveState(); };
		handle.onkeydown = event =>
		{
			if(!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) { return; }
			event.preventDefault();
			resize(event.key === 'Home' ? 140 : stage.getBoundingClientRect().height + (event.key === 'ArrowUp' ? -1 : 1)*(event.shiftKey ? 50 : 20));
			saveState();
		};
		return () => { handle.onpointerdown = handle.onpointermove = handle.onpointerup = handle.onpointercancel = handle.onlostpointercapture = handle.onkeydown = null; };
	}
	function mount(options)
	{
		const {stage, canvas, state, draw, saveState, select, getScale} = options;
		let wheelDelta = 0;
		function zoomWheel(event)
		{
			if(!event.shiftKey) { wheelDelta = 0; return; }
			const deltaX = event.deltaX || 0, deltaY = event.deltaY || 0;
			const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
			if(!options.ready() || options.interacting() || delta === 0) { return; }
			event.preventDefault();
			wheelDelta += delta*(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
			if(Math.abs(wheelDelta) < 40) { return; }
			const next = wheelDelta < 0 ? zoomLevels.find(value => value > getScale() + 0.0001) : zoomLevels.slice().reverse().find(value => value < getScale() - 0.0001);
			wheelDelta = 0;
			if(next === undefined) { return; }
			const before = canvas.getBoundingClientRect();
			const x = Math.max(0, Math.min(1, (event.clientX - before.left)/before.width));
			const y = Math.max(0, Math.min(1, (event.clientY - before.top)/before.height));
			state.zoom = String(next); select.value = String(next); saveState(); draw();
			const after = canvas.getBoundingClientRect();
			stage.scrollLeft += after.left + x*after.width - event.clientX;
			stage.scrollTop += after.top + y*after.height - event.clientY;
		}
		stage.addEventListener('wheel', zoomWheel, {passive:false});
		if(Number.isFinite(state.previewHeight)) { stage.style.height = Math.max(140, state.previewHeight)+'px'; }
		const disposeResize = mountResizeHandle(stage, state, saveState);
		const observer = new ResizeObserver(function ()
		{
			const height = stage.getBoundingClientRect().height;
			if(height >= 140 && height !== state.previewHeight) { state.previewHeight = height; saveState(); }
			draw();
		});
		observer.observe(stage);
		return function () { stage.removeEventListener('wheel', zoomWheel); observer.disconnect(); disposeResize(); };
	}
	const viewport = {zoomLevels, scale, mount};
	if(typeof module !== 'undefined' && module.exports) { module.exports = viewport; }
	else { window.ResourceStudioViewport = viewport; }
}());
