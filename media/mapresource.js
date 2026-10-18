/* Map resource markup and registry descriptor. */
(function ()
{
	const geometry = window.ResourceStudioMapGeometry;
	function view(resource, helpers)
	{
		helpers.state.mapViews ||= {};
		const state = helpers.state.mapViews[resource.id] ||= {zoom:'fit', selectedPlacement:resource.placements[0]?.id || '', settingsTab:'geometry', scrolls:{}};
		state.lockedPlacements ||= [];
		return state;
	}
	function sprites(helpers) { return helpers.bundle.resources.filter(item => item.type === 'sprite'); }
	function thumbnail(sprite, helpers)
	{
		const source = helpers.sources.find(item => item.path === sprite.source);
		return source && !source.missing ? '<img class="map-thumbnail" src="'+helpers.escape(source.uri)+'" alt="">' : '<span class="map-thumbnail" aria-hidden="true">▧</span>';
	}
	function lockIcon(locked)
	{
		return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="'+(locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.7-1.3')+'"/></svg>';
	}
	function outliner(resource, helpers)
	{
		const state = view(resource, helpers), selected = state.selectedPlacement;
		return resource.placements.length ? '<div class="map-order-end minor">Topmost</div><ol class="map-placements">'+resource.placements.map((item, index) =>
		{
			const sprite = helpers.bundle.resources.find(sprite => sprite.id === item.spriteId);
			const locked = state.lockedPlacements.includes(item.id);
			return '<li draggable="'+!locked+'" data-map-instance="'+helpers.escape(item.id)+'" title="'+helpers.escape(item.id)+'" class="map-placement '+(locked ? 'locked ' : '')+(selected === item.id ? 'selected' : '')+'">'+
				'<span class="map-grip" aria-hidden="true">⠿</span><button data-map-select="'+helpers.escape(item.id)+'" aria-pressed="'+(selected === item.id)+'" '+(locked ? 'disabled' : '')+'>'+
				helpers.escape(sprite?.name || 'Missing sprite')+'<small class="map-placement-face">'+geometry.computeNetLayout(resource.net).faces[item.side].name+'</small></button><span class="minor">'+(index + 1)+'</span><button class="map-lock" data-map-lock="'+helpers.escape(item.id)+'" aria-pressed="'+locked+'" aria-label="'+(locked ? 'Unlock ' : 'Lock ')+helpers.escape(sprite?.name || 'sprite')+'" title="'+(locked ? 'Unlock sprite' : 'Lock sprite')+'">'+lockIcon(locked)+'</button></li>';
		}).join('')+'</ol><div class="map-order-end minor">Bottommost</div>' : '<p class="minor">Add a sprite from the library to start placing resources.</p>';
	}
	function parameters(resource, helpers)
	{
		const item = resource.placements.find(item => item.id === view(resource, helpers).selectedPlacement);
		if(!item || view(resource, helpers).lockedPlacements.includes(item.id)) { return '<p class="minor">Select an unlocked placed sprite.</p>'; }
		const sprite = sprites(helpers).find(sprite => sprite.id === item.spriteId);
		const escape = helpers.escape;
		const relative = geometry.faceToScreen(geometry.computeNetLayout(resource.net), item.side, item.x, item.y);
		const screenNames = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
		return '<div class="map-bounds-warning" id="map-selected-bounds-warning" role="status" hidden></div>'+
			'<label class="check"><input type="checkbox" data-map-key="twistable" '+(item.twistable ? 'checked' : '')+'> Twistable</label>'+
			'<label class="map-field">Sprite resource<select data-map-key="spriteId">'+sprites(helpers).map(sprite =>
			'<option value="'+escape(sprite.id)+'" '+(sprite.id === item.spriteId ? 'selected' : '')+'>'+escape(sprite.name)+'</option>').join('')+'</select></label>'+
			'<label class="map-field">Face<select data-map-key="side">'+geometry.computeNetLayout(resource.net).faces.map(face => '<option value="'+face.side+'" '+(face.side === item.side ? 'selected' : '')+'>'+face.side+' · '+face.name+'</option>').join('')+'</select></label>'+
			'<div class="pair">'+['x', 'y'].map(key => '<label class="map-field">Relative '+key.toUpperCase()+'<input data-map-key="relative'+key.toUpperCase()+'" type="number" step="any" value="'+Number(relative[key].toFixed(6))+'"></label>').join('')+'</div>'+
			'<p class="minor map-relative-description">Relative: '+screenNames[relative.screen]+' screen, in screen pixels from its top-left. X increases right; Y increases down.</p>'+
			'<p class="minor map-sprite-scale">'+(sprite?.fullsize ? 'FULLSIZE: 50% at screen size 120.' : 'Normal: 100% at screen size 120.')+'</p>'+
			'<button data-select="'+escape(item.spriteId)+'">Open sprite</button>';
	}
	function field(label, key, value, extra = '')
	{
		return '<label class="map-field">'+label+'<input type="number" data-map-key="net.'+key+'" value="'+value+'" '+extra+'></label>';
	}
	window.ResourceStudioMapUI = {view, outliner, parameters, lockIcon};
	window.ResourceStudioTypes.register({
		type:'map', label:'Map', section:'Maps', icon:'▦',
		getSummary:resource => resource.placements.length+' sprite placements',
		validateCreate:() => {},
		renderLibrary:function (resource, helpers)
		{
			return '<section class="map-sprite-library" aria-label="Available sprites"><div class="section-label">Available sprites</div>'+sprites(helpers).map(sprite =>
				'<div class="map-source-sprite">'+thumbnail(sprite, helpers)+'<span>'+helpers.escape(sprite.name)+'<small>'+(sprite.fullsize ? 'FULLSIZE' : 'Normal')+'</small></span>'+
				'<button data-map-add="'+helpers.escape(sprite.id)+'" aria-label="Add '+helpers.escape(sprite.name)+' to map">+</button></div>').join('')+
				(!sprites(helpers).length ? '<p class="minor">Register a sprite in Sprites first.</p>' : '')+'</section>';
		},
		renderWorkspace:function (resource, helpers)
		{
			const state = view(resource, helpers), net = resource.net, escape = helpers.escape;
			return '<div class="detail map-detail"><div class="map-center"><section class="map-view" aria-label="Map view"><div class="preview-head"><span>Cube net</span><span id="map-dimensions"></span></div>'+
				'<div class="actions preview-tools"><label>Zoom <select id="map-zoom" aria-label="Map zoom">'+['fit', ...window.ResourceStudioViewport.zoomLevels.map(String)].map(value => '<option value="'+value+'" '+(state.zoom === value ? 'selected' : '')+'>'+(value === 'fit' ? 'Fit' : value+'×')+'</option>').join('')+'</select></label></div>'+
				'<div class="preview" id="map-preview"><canvas id="map-canvas" tabindex="0" aria-label="Map placements. Drag to move. Arrow keys nudge. Delete removes the selected placement."></canvas></div>'+
				'<div class="view-resize-handle preview-resize-handle" role="separator" tabindex="0" aria-label="Resize map view height" aria-orientation="horizontal" aria-controls="map-preview"></div>'+
				'<div class="preview-caption">Drag sprites to position. Shift + scroll to zoom. Drag the handle below the map up or down to resize its height.</div><div class="notice" id="map-notice" role="status" hidden></div></section>'+
				'<section class="map-settings" aria-label="Map settings"><div class="map-settings-tabs" role="tablist" aria-label="Map settings">'+[['geometry', 'Net geometry'], ['background', 'Background'], ['markers', 'Side markers']].map(([key, label]) => '<button role="tab" id="map-tab-'+key+'" data-map-tab="'+key+'" aria-controls="map-settings-'+key+'" aria-selected="'+(state.settingsTab === key)+'">'+label+'</button>').join('')+'</div>'+
				'<div class="map-settings-pane" id="map-settings-geometry" role="tabpanel" aria-labelledby="map-tab-geometry" '+(state.settingsTab !== 'geometry' ? 'hidden' : '')+'>'+helpers.field('Map name', helpers.input('name', resource.name))+'<div class="map-net-fields">'+
				field('Screen size', 'screenSize', net.screenSize, 'min="1" step="1"')+field('Inner gap', 'innerGap', net.innerGap, 'min="0" step="2"')+field('Face-edge gap', 'faceEdgeGap', net.faceEdgeGap, 'min="0" step="1"')+'</div></div>'+
				'<div class="map-settings-pane" id="map-settings-background" role="tabpanel" aria-labelledby="map-tab-background" '+(state.settingsTab !== 'background' ? 'hidden' : '')+'><div class="pair">'+
				'<label class="map-field">Background color<input type="color" data-map-key="net.background" value="'+escape((net.background || '#8b8b8b').slice(0, 7))+'" '+(net.background === null ? 'disabled' : '')+'></label>'+
				'<label class="map-field">Grid color<input type="color" data-map-key="net.lineColor" value="'+escape(net.lineColor.slice(0, 7))+'"></label></div>'+
				'<label class="check"><input type="checkbox" data-map-key="transparentBackground" '+(net.background === null ? 'checked' : '')+'> Transparent background</label>'+
				'<div class="minor map-background-path">'+escape(net.backgroundImage || 'Generated net')+'</div><div class="actions"><button data-map-background="choose">Choose background image…</button><button data-map-background="clear" '+(!net.backgroundImage ? 'disabled' : '')+'>Use generated net</button></div></div>'+
				'<div class="map-settings-pane" id="map-settings-markers" role="tabpanel" aria-labelledby="map-tab-markers" '+(state.settingsTab !== 'markers' ? 'hidden' : '')+'><label class="check"><input type="checkbox" data-map-key="net.markers" '+(net.markers ? 'checked' : '')+'> Show side markers</label>'+
				'<label class="map-field">Marker color<input type="color" data-map-key="net.markerColor" value="'+escape(net.markerColor.slice(0, 7))+'"></label><div class="map-marker-list">'+resource.sideMarkers.map(marker =>
				{
					const face = geometry.computeNetLayout(net).faces[marker.side];
					return '<span>'+escape(marker.name)+' · '+face.name+'<small>'+face.centre.x+', '+face.centre.y+'</small></span>';
				}).join('')+'</div><p class="minor">All six markers remain stored when hidden.</p></div></section></div>'+
				'<aside class="map-inspector"><section id="map-outliner" class="map-outliner" aria-label="Placed sprites outliner"><div class="section-label">Placed sprites</div><div id="map-outliner-list">'+outliner(resource, helpers)+'</div>'+
				'<div class="actions map-order-actions"><button data-map-order="top" aria-label="Bring to top">⇈</button><button data-map-order="up" aria-label="Move up">↑</button><button data-map-order="down" aria-label="Move down">↓</button><button data-map-order="bottom" aria-label="Send to bottom">⇊</button><button data-map-remove>Remove</button></div></section>'+
				'<div class="map-inspector-divider view-resize-handle" role="separator" tabindex="0" aria-label="Resize placed sprites outliner" aria-orientation="horizontal" aria-controls="map-outliner"></div><section class="map-parameters inspector" aria-label="Selected sprite parameters"><div class="section-label">Selected sprite parameters</div><div id="map-placement-parameters">'+parameters(resource, helpers)+'</div></section></aside></div>';
		},
		mountPreview:(resource, helpers) => window.ResourceStudioMapEditor.mount(resource, helpers)
	});
}());
