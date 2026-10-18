/* Cube net geometry is shared by the model and the webview; all coordinates are logical pixels. */
(function ()
{
	const names = ['TOP', 'FRONT', 'RIGHT', 'BACK', 'LEFT', 'BOTTOM'];
	const cells = [[1, 0], [1, 1], [2, 1], [3, 1], [0, 1], [1, 2]];
	function computeNetLayout(p = {})
	{
		const params = {screenSize:120, innerGap:18, faceEdgeGap:18, frame:1, padding:{right:0, bottom:0}, lineColor:'#252525', background:'#8b8b8b', markers:true, markerColor:'#ffffff', ...p};
		for(const key of ['screenSize', 'innerGap', 'faceEdgeGap', 'frame'])
		{
			if(!Number.isInteger(params[key]) || params[key] < (key === 'screenSize' ? 1 : 0)) { throw new Error(key+' must be a whole number '+(key === 'screenSize' ? 'greater than zero.' : 'of zero or more.')); }
		}
		if(params.innerGap%2) { throw new Error('Inner gap must be even.'); }
		if(!params.padding || ['right', 'bottom'].some(key => !Number.isInteger(params.padding[key]) || params.padding[key] < 0)) { throw new Error('Net padding must contain nonnegative whole-pixel right and bottom values.'); }
		const S = params.screenSize, G = params.innerGap, E = params.faceEdgeGap, B = params.frame, F = 2*S + G;
		const gridWidth = 2*B + 4*F + 3*E, gridHeight = 2*B + 3*F + 2*E;
		const faces = cells.map(([c, r], side) =>
		{
			const x = B + c*(F + E), y = B + r*(F + E);
			return {side, name:names[side], rect:{x, y, w:F, h:F}, centre:{x:x + S + G/2, y:y + S + G/2},
				displays:[[0, 0], [S + G, 0], [0, S + G], [S + G, S + G]].map(([dx, dy]) => ({x:x + dx, y:y + dy, w:S, h:S}))};
		});
		return {params, S, G, E, B, F, k:S/240, gridWidth, gridHeight, canvasWidth:gridWidth + params.padding.right, canvasHeight:gridHeight + params.padding.bottom, faces};
	}
	function renderNet(ctx, p)
	{
		const l = computeNetLayout(p);
		ctx.canvas.width = l.canvasWidth; ctx.canvas.height = l.canvasHeight;
		if(l.params.background !== null) { ctx.fillStyle = l.params.background; ctx.fillRect(0, 0, l.canvasWidth, l.canvasHeight); }
		ctx.fillStyle = l.params.lineColor; ctx.fillRect(0, 0, l.gridWidth, l.gridHeight);
		function remove(x, y, w, h)
		{
			if(l.params.background === null) { ctx.clearRect(x, y, w, h); }
			else { ctx.fillStyle = l.params.background; ctx.fillRect(x, y, w, h); }
		}
		for(const face of l.faces) { for(const r of face.displays) { remove(r.x, r.y, r.w, r.h); } }
		for(const [c1, c2, r] of [[0, 0, 0], [2, 3, 0], [0, 0, 2], [2, 3, 2]])
		{
			remove(l.B + c1*(l.F + l.E), l.B + r*(l.F + l.E), (c2 - c1)*(l.F + l.E) + l.F, l.F);
		}
		if(l.params.markers)
		{
			ctx.fillStyle = l.params.markerColor;
			for(const f of l.faces) { ctx.fillRect(f.centre.x - 1, f.centre.y - 1, 2, 2); }
		}
		return l;
	}
	function faceToCanvas(layout, side, X, Y)
	{
		if(!Number.isInteger(side) || !layout.faces[side] || !Number.isFinite(X) || !Number.isFinite(Y)) { throw new Error('Choose a valid side and finite face coordinates.'); }
		const c = layout.faces[side].centre;
		return {x:c.x + X*layout.k, y:c.y - Y*layout.k};
	}
	function faceToScreen(layout, side, X, Y)
	{
		const point = faceToCanvas(layout, side, X, Y), displays = layout.faces[side].displays;
		let screen = 0, distance = Infinity;
		for(let index = 0; index < displays.length; index++)
		{
			const rect = displays[index], d = (point.x - rect.x - rect.w/2)**2 + (point.y - rect.y - rect.h/2)**2;
			if(d < distance) { screen = index; distance = d; }
		}
		return {screen, x:point.x - displays[screen].x, y:point.y - displays[screen].y};
	}
	function screenToFace(layout, side, screen, x, y)
	{
		faceToCanvas(layout, side, 0, 0);
		const rect = layout.faces[side].displays[screen];
		if(!Number.isInteger(screen) || !rect || !Number.isFinite(x) || !Number.isFinite(y)) { throw new Error('Choose a valid screen and finite screen coordinates.'); }
		const centre = layout.faces[side].centre;
		return {X:(rect.x + x - centre.x)/layout.k, Y:-(rect.y + y - centre.y)/layout.k};
	}
	function canvasToFace(layout, x, y)
	{
		if(!Number.isFinite(x) || !Number.isFinite(y)) { throw new Error('Canvas coordinates must be finite.'); }
		let side = 0, distance = Infinity;
		for(const f of layout.faces)
		{
			const d = (x - f.centre.x)**2 + (y - f.centre.y)**2;
			if(d < distance) { side = f.side; distance = d; }
		}
		const c = layout.faces[side].centre;
		return {side, X:(x - c.x)/layout.k, Y:-(y - c.y)/layout.k};
	}
	const geometry = {computeNetLayout, renderNet, faceToCanvas, canvasToFace, faceToScreen, screenToFace};
	if(typeof module !== 'undefined' && module.exports) { module.exports = geometry; }
	else { window.ResourceStudioMapGeometry = geometry; }
}());
