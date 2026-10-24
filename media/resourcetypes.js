/* Resource-type UI registry. Each type owns its inspector and preview lifecycle. */
(function ()
{
	const types = new Map();
	const zoomLevels = window.ResourceStudioViewport.zoomLevels;
	const hiddenColorModes = ['rgb6666'];
	const hiddenBlendModes = ['bump', 'dudv', 'refl'];
	const validation = window.ResourceStudioValidation;
	function spritePivot(resource, width, height)
	{
		return resource.pivot === null ? {x:width/2, y:height/2} : {...resource.pivot};
	}
	const {paletteChannels} = window.ResourceStudioPixels;
	function paletteColor(resource, index)
	{
		return '#'+paletteChannels(resource, index).map(value => value.toString(16).padStart(2, '0')).join('');
	}
	window.ResourceStudioTypes = {
		register:function (resourceType)
		{
			if(types.has(resourceType.type))
			{
				throw new Error('Resource UI type already registered: '+resourceType.type);
			}
			types.set(resourceType.type, resourceType);
		},
		get:function (type)
		{
			return types.get(type);
		}
	};

	window.ResourceStudioTypes.register({
		type:'palette',
		canCreate:false,
		label:'Palette',
		section:'Palettes',
		icon:'▦',
		getSummary:function (resource)
		{
			return resource.colors.length+' colors';
		},
		renderGrid:function (resource, helpers)
		{
			return '<div class="swatches palette-grid">'+resource.colors.map((color, index) =>
				'<button class="swatch '+(index === helpers.state.colorIndex ? 'selected' : '')+'" data-color-index="'+index+'" '+
				'aria-label="Edit color '+index+' '+paletteColor(resource, index)+'" aria-pressed="'+(index === helpers.state.colorIndex)+'">'+
				'<span class="swatch-color" data-color="'+paletteColor(resource, index)+'"></span><span class="swatch-index">'+index+
				(index === 0 ? ' ◌' : '')+'</span></button>').join('')+'</div>';
		},
		renderInspector:function (resource, helpers)
		{
			const index = Math.min(helpers.state.colorIndex, resource.colors.length - 1);
			const channels = paletteChannels(resource, index);
			return helpers.field('Palette size · 2–256', helpers.input('colorCount', resource.colorCount, 'number', 'min="2" max="256" step="1"'))+
				helpers.field('Color '+index+' · hex RGB / RGBA', helpers.input('colorHex', paletteColor(resource, index), 'text', 'maxlength="9" spellcheck="false" '+(index === 0 ? 'disabled' : '')))+
				'<div class="rgba-sliders">'+['R', 'G', 'B', 'A'].map((channel, i) =>
					'<label class="rgba-channel"><span>'+channel+'</span>'+helpers.input('channel'+channel, channels[i], 'range', 'min="0" max="255" step="1" aria-label="'+['Red', 'Green', 'Blue', 'Alpha'][i]+'" '+(index === 0 ? 'disabled' : ''))+
					'<output data-channel-output="'+channel+'">'+channels[i]+'</output></label>').join('')+'</div>'+
				'<p class="minor">Color 0 is reserved for transparency and cannot be edited. The palette size includes this entry.</p>'+
				(window.ResourceStudioPaletteCompatibility.issue(resource) ? '<p class="notice">'+helpers.escape(window.ResourceStudioPaletteCompatibility.issue(resource))+'</p><button data-reserve-palette="'+helpers.escape(resource.id)+'">Reserve transparent color 0</button>' : '')+
				'<div class="notice">Changing the size regenerates colors from every assigned sprite. Individual colors can be edited without changing the size.</div>'+
				'<button data-rebuild-palette="'+helpers.escape(resource.id)+'">Rebuild palette</button>';
		},
		renderPreview:function (resource, helpers)
		{
			const users = helpers.bundle.resources.filter(item => item.paletteId === resource.id);
			return '<div class="preview-head"><span>Indexed colors</span><span>'+resource.colors.length+' entries · '+(resource.colorCount)+' color limit</span></div>'+
				this.renderGrid(resource, helpers)+
				'<div class="usage"><div class="minor">Assigned to '+users.length+' sprites</div><div class="actions">'+
				users.map(item => '<button data-select="'+helpers.escape(item.id)+'">'+helpers.escape(item.name)+'</button>').join('')+
				'</div></div>';
		},
		change:function (resource, key, element, helpers)
		{
			const index = Math.min(helpers.state.colorIndex, resource.colors.length - 1);
			if(key === 'transparentIndex' || index === 0 && (key === 'color' || key === 'colorHex' || key.startsWith('channel'))) { throw new Error('Color 0 is reserved for transparency and cannot be edited.'); }
			if(key === 'colorCount')
			{
				throw new Error('Palette size changes require generation from the source images.');
			}
			else if(key === 'color' || key === 'colorHex')
			{
				if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(element.value))
				{
					throw new Error('Use a six-digit hex color or eight-digit RGBA color, for example #347e98ff.');
				}
				resource.colors[index] = validation.quantizePaletteColor(element.value);
			}
			else if(key.startsWith('channel'))
			{
				const channel = ['R', 'G', 'B', 'A'].indexOf(key.slice(7));
				const value = Number(element.value);
				if(channel === -1 || !Number.isInteger(value) || value < 0 || value > 255)
				{
					throw new Error('RGBA channels must be integers from 0 to 255.');
				}
				const channels = paletteChannels(resource, index);
				channels[channel] = value;
				resource.colors[index] = validation.quantizePaletteColor('#'+channels.map(value => value.toString(16).padStart(2, '0')).join(''));
			}
			else if(key === 'transparentIndex')
			{
				resource.transparentIndex = element.value === '' ? null : Number(element.value);
			}
		},
		mountPreview:function (resource, helpers)
		{
			helpers.main.querySelectorAll('[data-color]').forEach(element => { element.style.backgroundColor = element.dataset.color; });
		},
		refreshControls:function (resource, helpers, active)
		{
			const index = Math.min(helpers.state.colorIndex, resource.colors.length - 1);
			const channels = paletteChannels(resource, index);
			const scope = helpers.main.querySelector('[data-palette-editor]') || helpers.main;
			const hex = scope.querySelector('[data-key="colorHex"]');
			if(hex && hex !== active)
			{
				hex.value = paletteColor(resource, index);
			}
			['R', 'G', 'B', 'A'].forEach((channel, i) =>
			{
				const slider = scope.querySelector('[data-key="channel'+channel+'"]');
				const output = scope.querySelector('[data-channel-output="'+channel+'"]');
				if(slider && slider !== active) { slider.value = channels[i]; }
				if(output) { output.textContent = channels[i]; }
			});
			const swatch = scope.querySelector('[data-color-index="'+index+'"] .swatch-color');
			if(swatch) { swatch.style.backgroundColor = paletteColor(resource, index); }
		}
	});

	window.ResourceStudioTypes.register({
		type:'sprite',
		label:'Sprite',
		ownsName:true,
		section:'Sprites',
		icon:'▧',
		renderCreateSource:function (dialog, helpers)
		{
			const sources = helpers.sources.filter(source => /\.png$/i.test(source.path) && !source.missing);
			return helpers.field('Source file', '<select data-dialog="source"><option value="">Choose an image…</option>'+sources.map(source =>
				'<option value="'+helpers.escape(source.path)+'" '+(dialog.source === source.path ? 'selected' : '')+'>'+helpers.escape(source.path)+'</option>').join('')+'</select>');
		},
		renderCreate:function (dialog, helpers)
		{
			const sources = helpers.sources.filter(source => /\.png$/i.test(source.path) && !source.missing);
			const palettes = helpers.bundle.resources.filter(resource => resource.type === 'palette');
			return helpers.field('Unique name', '<input data-dialog="name" pattern="[a-z0-9_]{1,23}" maxlength="23" value="'+helpers.escape(dialog.name)+'" required>')+
				helpers.field('Color / palette', '<select data-dialog="paletteId"><option value="" '+(palettes.length >= validation.maxPalettes ? 'disabled' : '')+'>Generate a new palette</option>'+palettes.map(palette =>
					'<option value="'+helpers.escape(palette.id)+'" '+(dialog.paletteId === palette.id ? 'selected' : '')+'>'+helpers.escape(palette.name)+'</option>').join('')+'<option value="__rgb565__" '+(dialog.paletteId === '__rgb565__' ? 'selected' : '')+'>RGB565 — no palette</option></select>')+
				(!dialog.paletteId ? helpers.field('New palette name', '<input data-dialog="paletteName" pattern="[a-z0-9_]{1,23}" maxlength="23" value="'+helpers.escape(dialog.paletteName ?? validation.paletteName(dialog.name))+'" required>')+
					helpers.field('Number of colors · 2–256', '<input data-dialog="colorCount" type="number" min="2" max="256" step="1" value="'+helpers.escape(dialog.colorCount)+'" required>') :
					dialog.paletteId === '__rgb565__' ? '<p class="notice">Plain RGB565 stores colors without a palette. Transparency is not supported.</p>' :
					'<p class="notice">This palette will be regenerated from the new sprite and all sprites already using it. Edited colors will be replaced.</p>')+
				(!sources.length ? '<p class="notice">Add source folders to register an image.</p><button type="button" data-action="addFolder">+ Add source folders</button>' : '');
		},
		validateCreate:function (dialog, helpers)
		{
			const nameError = validation.name(dialog.name, validation.usedNames(helpers.bundle.resources), 'sprite');
			if(nameError) { throw new Error(nameError); }
			if(!dialog.source)
			{
				throw new Error('Choose a source image for the sprite.');
			}
			if(!dialog.paletteId)
			{
				if(helpers.bundle.resources.filter(resource => resource.type === 'palette').length >= validation.maxPalettes) { throw new Error('V-016: At most '+validation.maxPalettes+' palettes are allowed.'); }
				const name = dialog.paletteName ?? validation.paletteName(dialog.name);
				const error = validation.name(name, [...validation.usedNames(helpers.bundle.resources), dialog.name]);
				if(error)
				{
					throw new Error(error);
				}
				const size = Number(dialog.colorCount);
				if(validation.paletteSize(size))
				{
					throw new Error(validation.paletteSize(size));
				}
			}
		},
		getSummary:function ()
		{
			return 'Sprite';
		},
		renderInspector:function (resource, helpers)
		{
			const sources = helpers.sources.filter(source => /\.png$/i.test(source.path)).map(source => ({value:source.path, label:source.path+(source.missing ? ' · missing' : '')}));
			if(!sources.some(source => source.value === resource.source))
			{
				sources.push({value:resource.source, label:resource.source});
			}
			const palettes = helpers.bundle.resources.filter(item => item.type === 'palette');
			const rgb = resource.colorMode === 'rgb565';
			const unsupported = hiddenColorModes.includes(resource.colorMode);
			const size = helpers.state.imageSizes?.[resource.source];
			const pivot = size ? spritePivot(resource, size.width, size.height) : {x:0, y:0};
			const registries = helpers.bundle.registries;
			const classify = (label, key, registry) => helpers.field(label, helpers.select(key,
				[{value:'', label:'None'}, ...registries[registry].map(name => ({value:name, label:name}))], resource[key] || ''));
			return helpers.field('Source file', helpers.select('source', sources, resource.source))+
				helpers.field('Unique resource name', helpers.input('name', resource.name, 'text', 'pattern="[a-z0-9_]{1,23}" maxlength="23"'))+
				(unsupported ? '<div class="notice">This sprite uses an unsupported color mode. Its settings are preserved.</div>' :
				helpers.field('Color / palette', helpers.select('paletteId', [...palettes.map(item => ({value:item.id, label:item.name})),
					{value:'__new_palette__', label:'Generate a new palette…', disabled:palettes.length >= validation.maxPalettes}, {value:'__rgb565__', label:'RGB565 — no palette'}], rgb ? '__rgb565__' : resource.paletteId || '')))+
				(!rgb && !unsupported ? '<div class="minor">'+helpers.bundle.resources.filter(item => item.paletteId && item.paletteId === resource.paletteId).length+' sprites share this palette</div>' : '')+
				helpers.field('Blend', hiddenBlendModes.includes(resource.blend) ? '<span class="minor">Unsupported blend (preserved)</span>' :
					'<select data-key="blend" '+(rgb || unsupported ? 'disabled title="RGB565 uses Opaque blend."' : '')+'>'+['opaque', 'alpha', 'additive', ...(helpers.state.advancedBlend || resource.blend === 'bg' ? ['bg'] : [])].map(value =>
						'<option value="'+value+'" '+(resource.blend === value ? 'selected' : '')+'>'+({opaque:'Opaque', alpha:'Alpha', additive:'Additive', bg:'BG (advanced)'})[value]+'</option>').join('')+'</select>')+
				'<label class="check"><input id="advanced-blend" type="checkbox" '+(helpers.state.advancedBlend ? 'checked' : '')+'> Show advanced blend options</label>'+
				'<label class="check"><input type="checkbox" data-key="fullsize" '+(resource.fullsize ? 'checked' : '')+'> Full size (1:1 runtime pixels)</label>'+
				'<label class="check" title="Dithering is available for RGB565."><input type="checkbox" data-key="dither" '+(resource.dither ? 'checked' : '')+' '+(!rgb ? 'disabled' : '')+'> Dithering</label>'+
				helpers.field('Encoding', rgb ? helpers.select('compression', [{value:'plain', label:'Plain RGB565'}, {value:'softkey', label:'Color Key'}], resource.compression) : '<select disabled title="Encoding options are available for RGB565."><option>Palette indexed</option></select>')+
				helpers.field('Color Key · RGB', '<div class="pair">'+helpers.input('softkeyColor', resource.softkey?.key || '#ff00ff', 'color', rgb && resource.compression === 'softkey' ? '' : 'disabled title="Select RGB565 and Color Key encoding."')+
					helpers.input('softkeyHex', resource.softkey?.key || '#ff00ff', 'text', 'maxlength="7" '+(rgb && resource.compression === 'softkey' ? '' : 'disabled title="Select RGB565 and Color Key encoding."'))+'</div>')+
				helpers.field('Color Key threshold', helpers.input('softkeyThreshold', resource.softkey?.threshold || 0, 'number', 'min="0" max="255" step="1" '+(rgb && resource.compression === 'softkey' ? '' : 'disabled title="Select RGB565 and Color Key encoding."')))+
				(rgb ? '<div class="minor">'+(resource.compression === 'softkey' ? 'Pixels matching the Color Key become transparent after RGB565 quantization.' : 'Plain RGB565 does not store transparency.')+'</div>' : resource.blend === 'bg' ? '<div class="minor">BG currently behaves like Opaque.</div>' : '')+
				'<div class="rule"></div>'+
				classify('Group', 'group', 'groups')+classify('Type', 'objectType', 'types')+
				'<div class="field"><label>Tags</label><div class="checks">'+registries.tags.map(tag => '<label class="check"><input type="checkbox" data-key="tag" data-tag="'+helpers.escape(tag)+'" '+(resource.tags.includes(tag) ? 'checked' : '')+'> '+helpers.escape(tag)+'</label>').join('')+'</div></div>'+
				'<details class="usage" data-classification-manager><summary>Manage groups, types and tags</summary>'+['groups', 'types', 'tags'].map(registry =>
					'<div class="field"><label>'+({groups:'Groups', types:'Types', tags:'Tags'})[registry]+'</label>'+registries[registry].map(name =>
						'<div class="actions"><span>'+helpers.escape(name)+'</span><button data-delete-classification="'+registry+'" data-name="'+helpers.escape(name)+'">Delete</button></div>').join('')+'<button class="link" data-add-classification="'+registry+'">+ Add '+({groups:'group', types:'type', tags:'tag'})[registry]+'</button></div>').join('')+'</details>'+
				'<div class="rule"></div>'+helpers.field('Pivot · source pixels', '<div class="pair">'+
				helpers.input('pivotX', pivot.x, 'number', 'step="0.5" '+(!size ? 'disabled title="Waiting for source image dimensions."' : '')+' aria-label="Pivot X"')+
				helpers.input('pivotY', pivot.y, 'number', 'step="0.5" '+(!size ? 'disabled title="Waiting for source image dimensions."' : '')+' aria-label="Pivot Y"')+'</div>')+
				helpers.field('Pivot preset', helpers.select('pivotPreset', [{value:'', label:'Custom'}, ...['topLeft', 'topCenter', 'topRight', 'leftCenter', 'center', 'rightCenter', 'bottomLeft', 'bottomCenter', 'bottomRight'].map((value, i) => ({value, label:['Top left', 'Top center', 'Top right', 'Left center', 'Center', 'Right center', 'Bottom left', 'Bottom center', 'Bottom right'][i]}))], resource.pivot === null ? 'center' : ''))+
				'<div class="minor" id="stored-pivot">Runtime pivot: waiting for image dimensions</div>'+
				'<div class="notice" id="sprite-diagnostics" hidden></div>'+
				'<button class="link" data-action="center">Reset to center</button><div class="rule"></div>'+
				'<label class="check"><input type="checkbox" data-key="colliderEnabled" '+(resource.collider.enabled ? 'checked' : '')+'> Collider enabled</label>'+
				'<div class="field collider-fields"><div class="minor">Collider · pixels</div><div class="pair">'+helpers.field('X', helpers.input('colliderX', resource.collider.x, 'number', 'step="any" '+(!resource.collider.enabled ? 'disabled' : '')+' aria-label="Collider X"'))+
				helpers.field('Y', helpers.input('colliderY', resource.collider.y, 'number', 'step="any" '+(!resource.collider.enabled ? 'disabled' : '')+' aria-label="Collider Y"'))+'</div><div class="pair">'+
				helpers.field('W', helpers.input('colliderWidth', resource.collider.width, 'number', 'step="any" '+(!resource.collider.enabled ? 'disabled' : '')+' aria-label="Collider width"'))+
				helpers.field('H', helpers.input('colliderHeight', resource.collider.height, 'number', 'step="any" '+(!resource.collider.enabled ? 'disabled' : '')+' aria-label="Collider height"'))+'</div></div>';
		},
		renderPreview:function (resource, helpers)
		{
			const rgb = resource.colorMode === 'rgb565';
			const palette = resource.colorMode === 'palette' ? helpers.bundle.resources.find(item => item.id === resource.paletteId) : undefined;
			return '<div class="preview-head"><span>Sprite preview</span><span id="image-size"></span></div>'+
				'<div class="actions preview-tools"><button data-preview-mode="source" aria-pressed="'+(helpers.state.previewMode === 'source')+'">Source</button>'+
				'<button data-preview-mode="indexed" aria-pressed="'+(helpers.state.previewMode === 'indexed')+'" '+(!palette && !rgb ? 'disabled' : '')+'>'+(rgb ? 'RGB565' : 'Indexed')+'</button>'+
				'<label>Zoom <select id="preview-zoom" aria-label="Preview zoom">'+['fit', ...zoomLevels.map(String)].map(value =>
					'<option value="'+value+'" '+(helpers.state.zoom === value ? 'selected' : '')+'>'+(value === 'fit' ? 'Fit' : value+'×')+'</option>').join('')+'</select></label></div>'+
				'<div class="preview" id="sprite-preview"><span class="minor" id="preview-message">Loading image…</span>'+ 
				'<div class="sprite-surface"><canvas id="sprite-canvas" hidden tabindex="0" aria-label="Sprite preview. Click or drag to place the pivot.'+(palette ? ' Space plus click an indexed pixel to select its palette color.' : '')+'"></canvas>'+
				'<svg id="sprite-overlay" aria-label="Collider corners and pivot"></svg></div></div>'+
				'<div class="view-resize-handle preview-resize-handle" role="separator" tabindex="0" aria-label="Resize sprite view height" aria-orientation="horizontal" aria-controls="sprite-preview"></div>'+
				'<div class="preview-caption">Click or drag to place the pivot. '+(palette ? 'Space + click an indexed pixel to select its palette color. ' : '')+'Shift + scroll to zoom. Drag the blue corner handles to resize the collider. Drag the handle below the preview up or down to resize its height.</div>'+
				(palette ? '<section class="usage palette-editor" data-palette-editor="'+helpers.escape(palette.id)+'" aria-label="Shared palette editor">'+
				'<div class="palette-current"><div class="preview-head"><span>'+helpers.escape(palette.name)+'</span><span>'+palette.colors.length+' colors</span></div>'+
				window.ResourceStudioTypes.get('palette').renderGrid(palette, helpers)+'</div><div class="palette-controls inspector">'+
				window.ResourceStudioTypes.get('palette').renderInspector(palette, helpers).replace(/data-key="/g, 'data-palette-id="'+helpers.escape(palette.id)+'" data-key="')+
				'</div></section>' :
				rgb ? '<div class="notice">RGB565 preview uses 5 red, 6 green and 5 blue bits per pixel.'+(resource.compression === 'softkey' ? ' Color Key matches are transparent.' : ' Plain encoding has no transparency.')+'</div>' : '<div class="notice">This color mode is not supported yet. Source preview remains available.</div>');
		},
		change:function (resource, key, element, helpers)
		{
			if(key === 'source')
			{
				resource.source = element.value;
			}
			else if(key === 'paletteId')
			{
				resource.colorMode = element.value === '__rgb565__' ? 'rgb565' : 'palette';
				resource.paletteId = element.value === '__rgb565__' ? null : element.value || null;
				if(resource.colorMode === 'rgb565') { resource.blend = 'opaque'; resource.compression = 'plain'; }
				else { resource.dither = false; resource.compression = null; }
				resource.softkey = null;
			}
			else if(key === 'compression')
			{
				if(resource.colorMode !== 'rgb565' || !['plain', 'softkey'].includes(element.value)) { throw new Error('V-020: Choose Plain or Color Key encoding for RGB565.'); }
				resource.compression = element.value;
				resource.softkey = element.value === 'softkey' ? {key:'#ff00ff', threshold:0} : null;
			}
			else if(['softkeyColor', 'softkeyHex', 'softkeyThreshold'].includes(key))
			{
				if(resource.colorMode !== 'rgb565' || resource.compression !== 'softkey' || !resource.softkey) { throw new Error('V-020: Select Color Key encoding before editing its color.'); }
				if(key === 'softkeyThreshold')
				{
					const value = Number(element.value);
					const error = validation.integer(value, 0, 255, 'V-020', 'Color Key threshold');
					if(error) { throw new Error(error); }
					resource.softkey.threshold = value;
				}
				else
				{
					if(!/^#[0-9a-f]{6}$/i.test(element.value)) { throw new Error('V-020: Color Key color must use #RRGGBB format.'); }
					resource.softkey.key = element.value.toLowerCase();
				}
			}
			else if(key === 'pivotX' || key === 'pivotY')
			{
				const size = helpers.state.imageSizes?.[resource.source];
				if(!size) { throw new Error('Wait for the source image to load before editing its pivot.'); }
				resource.pivot = spritePivot(resource, size.width, size.height);
				const value = Number(element.value);
				if(!Number.isFinite(value) || !Number.isInteger(value*2)) { throw new Error('V-009: Pivot coordinates must be finite multiples of 0.5.'); }
				resource.pivot[key === 'pivotX' ? 'x' : 'y'] = value;
			}
			else if(key === 'pivotPreset')
			{
				if(!element.value) { return; }
				const size = helpers.state.imageSizes?.[resource.source];
				if(!size) { throw new Error('Wait for the source image to load before choosing a pivot.'); }
				const presets = ['topLeft', 'topCenter', 'topRight', 'leftCenter', 'center', 'rightCenter', 'bottomLeft', 'bottomCenter', 'bottomRight'];
				const index = presets.indexOf(element.value);
				if(index < 0) { return; }
				resource.pivot = index === 4 ? null : {x:(index%3)*size.width/2, y:Math.floor(index/3)*size.height/2};
			}
			else if(['fullsize', 'dither'].includes(key)) { resource[key] = element.checked; }
			else if(['number', 'frameRate'].includes(key))
			{
				const value = Number(element.value);
				const error = validation.integer(value, key === 'number' ? -32768 : 1, key === 'number' ? 32767 : 127, key === 'number' ? 'V-011' : 'V-010', key);
				if(error) { throw new Error(error); }
				resource[key] = value;
			}
			else if(['blend', 'group', 'objectType'].includes(key)) { resource[key] = element.value || null; }
			else if(key === 'tag')
			{
				resource.tags = element.checked ? [...new Set([...resource.tags, element.dataset.tag])] : resource.tags.filter(tag => tag !== element.dataset.tag);
			}
			else if(key === 'colliderEnabled')
			{
				if(!element.checked) { resource.collider = {enabled:false, x:0, y:0, width:0, height:0}; }
				else
				{
					const size = helpers.state.imageSizes?.[resource.source];
					if(!size) { throw new Error('Wait for the source image to load before enabling its collider.'); }
					resource.collider = {enabled:true, x:0, y:0, width:size.width, height:size.height};
				}
			}
			else if(key.startsWith('collider'))
			{
				const size = helpers.state.imageSizes?.[resource.source];
				if(!size) { throw new Error('Wait for the source image to load before editing its collider.'); }
				const property = key.slice(8);
				const collider = {...resource.collider, [property[0].toLowerCase()+property.slice(1)]:Number(element.value)};
				const error = validation.collider(collider, size.width, size.height);
				if(error) { throw new Error(error); }
				resource.collider = collider;
			}
		},
		mountPreview:function (resource, helpers)
		{
			helpers.main.querySelectorAll('[data-color]').forEach(element => { element.style.backgroundColor = element.dataset.color; });
			const canvas = helpers.main.querySelector('#sprite-canvas');
			const message = helpers.main.querySelector('#preview-message');
			const stage = helpers.main.querySelector('#sprite-preview');
			const overlay = helpers.main.querySelector('#sprite-overlay');
			const source = helpers.sources.find(item => item.path === resource.source);
			let disposed = false;
			let dragging = false;
			let colliderDrag;
			let previewCollider;
			let previewPivot;
			let pixels;
			let pixelIndices;
			let scale = 1;
			let restoreScroll = true;
			let imageNotices = [];
			const image = new Image();
			image.crossOrigin = 'anonymous';
			if(!source || source.missing || !source.image)
			{
				message.textContent = 'Source image is missing or unsupported: '+resource.source;
				return;
			}
			const palette = resource.colorMode === 'palette' ? helpers.bundle.resources.find(item => item.id === resource.paletteId) : undefined;
			function colliderCorners(collider)
			{
				const left = Math.min(collider.x, collider.x + collider.width);
				const top = Math.min(collider.y, collider.y + collider.height);
				const right = Math.max(collider.x, collider.x + collider.width);
				const bottom = Math.max(collider.y, collider.y + collider.height);
				return [{name:'topLeft', x:left, y:top}, {name:'topRight', x:right, y:top}, {name:'bottomRight', x:right, y:bottom}, {name:'bottomLeft', x:left, y:bottom}];
			}
			function resizedCollider(point, anchor)
			{
				point = {x:Math.max(0, Math.min(image.naturalWidth, point.x)), y:Math.max(0, Math.min(image.naturalHeight, point.y))};
				anchor = {x:Math.max(0, Math.min(image.naturalWidth, anchor.x)), y:Math.max(0, Math.min(image.naturalHeight, anchor.y))};
				return {enabled:true, x:Math.min(point.x, anchor.x), y:Math.min(point.y, anchor.y), width:Math.abs(point.x - anchor.x), height:Math.abs(point.y - anchor.y)};
			}
			function draw()
			{
				if(disposed || !pixels)
				{
					return;
				}
				const width = image.naturalWidth;
				const height = image.naturalHeight;
				scale = window.ResourceStudioViewport.scale(helpers.state, width, height, stage);
				// Scale the display instead of allocating a canvas 128 times larger in each dimension.
				canvas.width = width;
				canvas.height = height;
				canvas.style.width = Math.ceil(width*scale)+'px';
				canvas.style.height = Math.ceil(height*scale)+'px';
				const context = canvas.getContext('2d');
				context.imageSmoothingEnabled = false;
				context.save();
				context.drawImage(pixels, 0, 0, canvas.width, canvas.height);
				context.restore();
				const authored = previewPivot || spritePivot(resource, width, height);
				const diagnostics = helpers.main.querySelector('#sprite-diagnostics');
				if(diagnostics)
				{
					const notices = [...imageNotices];
					if(resource.collider.enabled)
					{
						const error = validation.collider(resource.collider, width, height);
						if(error) { notices.push(error); }
					}
					if(!resource.fullsize && (width > 120 || height > 120)) { notices.push('V-008: Sprite will draw at '+width*2+'×'+height*2+' screen pixels, larger than a 240 face.'); }
					if(authored.x < 0 || authored.y < 0 || authored.x > width || authored.y > height) { notices.push('V-009: Pivot lies outside the sprite.'); }
					if(resource.blend === 'bg') { notices.push('V-031: BG currently behaves exactly like Opaque.'); }
					diagnostics.textContent = notices.join('\n');
					diagnostics.hidden = notices.length === 0;
				}
				const stored = helpers.main.querySelector('#stored-pivot');
				if(stored)
				{
					stored.textContent = 'Runtime pivot: '+(authored.x*(resource.fullsize ? 1 : 2) - 0.5)+', '+(authored.y*(resource.fullsize ? 1 : 2) - 0.5);
				}
				const x = authored.x;
				const y = authored.y;
				overlay.setAttribute('viewBox', '0 0 '+width+' '+height);
				const collider = previewCollider || resource.collider;
				const corners = colliderCorners(validation.clampCollider(collider, width, height));
				const handleSize = 8/scale;
				overlay.innerHTML = (collider.enabled ? '<rect x="'+corners[0].x+'" y="'+corners[0].y+'" width="'+(corners[2].x - corners[0].x)+'" height="'+(corners[2].y - corners[0].y)+'" fill="none" stroke="#3794ff" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
					corners.map(corner => '<rect data-collider-corner="'+corner.name+'" tabindex="0" role="button" aria-label="Resize collider '+corner.name+' corner" x="'+(corner.x - handleSize/2)+'" y="'+(corner.y - handleSize/2)+'" width="'+handleSize+'" height="'+handleSize+'" fill="#3794ff" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('') : '')+
					'<circle cx="'+x+'" cy="'+y+'" r="'+6/scale+'" fill="none" stroke="#f4b75e" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
					'<path d="M '+(x - 12/scale)+' '+y+' H '+(x + 12/scale)+' M '+x+' '+(y - 12/scale)+' V '+(y + 12/scale)+'" fill="none" stroke="#f4b75e" stroke-width="2" vector-effect="non-scaling-stroke"/>';
				for(const [key, property] of [['colliderX', 'x'], ['colliderY', 'y'], ['colliderWidth', 'width'], ['colliderHeight', 'height']])
				{
					const field = helpers.main.querySelector('[data-key="'+key+'"]');
					if(field && field !== document.activeElement) { field.value = collider[property]; }
					if(field)
					{
						field.min = '0';
						field.max = String(Math.max(0, property === 'x' ? width - collider.width : property === 'y' ? height - collider.height : property === 'width' ? width - collider.x : height - collider.y));
					}
				}
				if(helpers.state.focusColliderCorner)
				{
					overlay.querySelector?.('[data-collider-corner="'+helpers.state.focusColliderCorner+'"]')?.focus({preventScroll:true});
					delete helpers.state.focusColliderCorner;
				}
				if(restoreScroll)
				{
					stage.scrollTop = helpers.previewScroll?.top || 0;
					stage.scrollLeft = helpers.previewScroll?.left || 0;
					restoreScroll = false;
					helpers.onPreviewReady?.();
				}
			}
			image.onload = function ()
			{
				if(disposed)
				{
					return;
				}
				if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 240 || image.naturalHeight > 240)
				{
					message.textContent = !image.naturalWidth || !image.naturalHeight ? 'V-006: Source is not a usable PNG.' : 'V-007: The maximum sprite size is 240×240.';
					return;
				}
				pixels = document.createElement('canvas');
				pixels.width = image.naturalWidth;
				pixels.height = image.naturalHeight;
				helpers.state.imageSizes ||= {};
				const previousSize = helpers.state.imageSizes[resource.source];
				imageNotices = previousSize && (previousSize.width !== pixels.width || previousSize.height !== pixels.height) ? ['V-030: Source size changed; check its pivot.'] : [];
				helpers.state.imageSizes[resource.source] = {width:pixels.width, height:pixels.height};
				const authored = spritePivot(resource, pixels.width, pixels.height);
				for(const axis of ['x', 'y'])
				{
					const field = helpers.main.querySelector('[data-key="pivot'+axis.toUpperCase()+'"]');
					if(field) { field.disabled = false; field.value = authored[axis]; }
				}
				const context = pixels.getContext('2d', {willReadFrequently:true});
				context.drawImage(image, 0, 0);
				try
				{
					if(['opaque', 'bg'].includes(resource.blend))
					{
						const data = context.getImageData(0, 0, pixels.width, pixels.height).data;
						for(let i = 3; i < data.length; i += 4)
						{
							if(data[i] > 0 && data[i] < 255) { imageNotices.push('V-028: Semi-transparent source pixels draw fully opaque with this blend.'); break; }
						}
					}
					pixelIndices = undefined;
					if(helpers.state.previewMode === 'indexed')
					{
						const data = context.getImageData(0, 0, pixels.width, pixels.height);
						pixelIndices = window.ResourceStudioPixels.convert(data.data, pixels.width, resource, palette);
						context.putImageData(data, 0, 0);
					}
					message.hidden = true;
					canvas.hidden = false;
					helpers.main.querySelector('#image-size').textContent = pixels.width+' × '+pixels.height+' px';
					draw();
				}
				catch(error)
				{
					message.textContent = 'Unable to read image pixels: '+error.message;
				}
			};
			image.onerror = function ()
			{
				if(!disposed)
				{
					message.textContent = 'V-006: Unable to decode PNG: '+resource.source;
				}
			};
			function placePivot(event)
			{
				const rect = canvas.getBoundingClientRect();
				let x = (event.clientX - rect.left)/rect.width;
				let y = (event.clientY - rect.top)/rect.height;
				if(!event.shiftKey) { x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y)); }
				previewPivot = {x:Math.round(x*image.naturalWidth*2)/2,
					y:Math.round(y*image.naturalHeight*2)/2};
				draw();
			}
			function moveCollider(event)
			{
				const rect = canvas.getBoundingClientRect();
				const point = {x:Math.round(((event.clientX - rect.left)*image.naturalWidth/rect.width + colliderDrag.offset.x)*2)/2,
					y:Math.round(((event.clientY - rect.top)*image.naturalHeight/rect.height + colliderDrag.offset.y)*2)/2};
				previewCollider = resizedCollider(point, colliderDrag.anchor);
				draw();
			}
			overlay.onpointerdown = function (event)
			{
				if(disposed || helpers.state.busy || dragging || colliderDrag || !pixels || !resource.collider.enabled || event.button !== 0) { return; }
				if(helpers.state.spacePressed && helpers.state.previewMode === 'indexed') { canvas.onpointerdown(event); return; }
				const name = event.target.getAttribute?.('data-collider-corner');
				const corners = colliderCorners(validation.clampCollider(resource.collider, image.naturalWidth, image.naturalHeight));
				const index = corners.findIndex(corner => corner.name === name);
				if(index < 0) { return; }
				event.preventDefault();
				event.stopPropagation();
				const rect = canvas.getBoundingClientRect();
				colliderDrag = {pointerId:event.pointerId, anchor:corners[(index + 2)%4],
					offset:{x:corners[index].x - (event.clientX - rect.left)*image.naturalWidth/rect.width,
						y:corners[index].y - (event.clientY - rect.top)*image.naturalHeight/rect.height}};
				// Capture on the SVG itself: its handles are redrawn while dragging.
				overlay.setPointerCapture(event.pointerId);
			};
			overlay.onpointermove = function (event)
			{
				if(!disposed && colliderDrag && event.pointerId === colliderDrag.pointerId)
				{
					event.preventDefault();
					moveCollider(event);
				}
			};
			overlay.onpointerup = function (event)
			{
				if(!disposed && colliderDrag && event.pointerId === colliderDrag.pointerId)
				{
					moveCollider(event);
					colliderDrag = undefined;
					if(['x', 'y', 'width', 'height'].some(key => previewCollider[key] !== resource.collider[key]))
					{
						helpers.updateResource({...resource, collider:previewCollider});
					}
				}
			};
			overlay.onpointercancel = function ()
			{
				colliderDrag = undefined;
				previewCollider = undefined;
				draw();
			};
			overlay.onlostpointercapture = function ()
			{
				if(colliderDrag) { overlay.onpointercancel(); }
			};
			overlay.onkeydown = function (event)
			{
				if(helpers.state.busy || !pixels || !resource.collider.enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { return; }
				const corners = colliderCorners(validation.clampCollider(resource.collider, image.naturalWidth, image.naturalHeight));
				const index = corners.findIndex(corner => corner.name === event.target.getAttribute?.('data-collider-corner'));
				if(index < 0) { return; }
				event.preventDefault();
				event.stopPropagation();
				const point = {...corners[index]};
				const delta = event.shiftKey ? 5 : 0.5;
				if(event.key === 'ArrowLeft') { point.x -= delta; }
				if(event.key === 'ArrowRight') { point.x += delta; }
				if(event.key === 'ArrowUp') { point.y -= delta; }
				if(event.key === 'ArrowDown') { point.y += delta; }
				const anchor = corners[(index + 2)%4];
				helpers.state.focusColliderCorner = (point.y <= anchor.y ? 'top' : 'bottom')+(point.x <= anchor.x ? 'Left' : 'Right');
				helpers.updateResource({...resource, collider:resizedCollider(point, anchor)});
			};
			canvas.onpointerdown = function (event)
			{
				const pickingColor = helpers.state.spacePressed && helpers.state.previewMode === 'indexed';
				if(helpers.state.busy || event.button !== 0)
				{
					return;
				}
				if(pickingColor)
				{
					event.preventDefault();
					const rect = canvas.getBoundingClientRect();
					if(!pixelIndices || event.clientX < rect.left || event.clientY < rect.top ||
						event.clientX >= rect.left + rect.width || event.clientY >= rect.top + rect.height)
					{
						return;
					}
					let x = Math.floor((event.clientX - rect.left)*image.naturalWidth/rect.width);
					let y = Math.floor((event.clientY - rect.top)*image.naturalHeight/rect.height);
					const index = pixelIndices[y*image.naturalWidth + x];
					if(index >= 0) { helpers.selectPaletteColor(index, true); }
					return;
				}
				dragging = true;
				event.preventDefault();
				canvas.focus({preventScroll:true});
				canvas.setPointerCapture(event.pointerId);
				placePivot(event);
			};
			canvas.onpointermove = function (event)
			{
				if(dragging)
				{
					placePivot(event);
				}
			};
			canvas.onpointerup = function (event)
			{
				if(dragging)
				{
					dragging = false;
					placePivot(event);
					helpers.updateResource({...resource, pivot:previewPivot});
				}
			};
			canvas.onpointercancel = function ()
			{
				dragging = false;
				previewPivot = undefined;
				draw();
			};
			canvas.onkeydown = function (event)
			{
				if(helpers.state.busy || !pixels || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { return; }
				event.preventDefault();
				const pivot = spritePivot(resource, image.naturalWidth, image.naturalHeight);
				const delta = event.shiftKey ? 5 : 0.5;
				if(event.key === 'ArrowLeft') { pivot.x -= delta; }
				if(event.key === 'ArrowRight') { pivot.x += delta; }
				if(event.key === 'ArrowUp') { pivot.y -= delta; }
				if(event.key === 'ArrowDown') { pivot.y += delta; }
				helpers.updateResource({...resource, pivot:pivot});
			};
			const disposeViewport = window.ResourceStudioViewport.mount({stage, canvas, state:helpers.state, draw, saveState:helpers.saveState,
				select:helpers.main.querySelector('#preview-zoom'), getScale:() => scale, ready:() => Boolean(pixels), interacting:() => dragging || colliderDrag});
			image.src = source.uri;
			const dispose = function ()
			{
				disposed = true;
				disposeViewport();
				image.onload = null;
				image.onerror = null;
			};
			dispose.refreshPalette = function ()
			{
				if(pixels && !disposed)
				{
					image.onload();
				}
			};
			return dispose;
		}
	});
}());
