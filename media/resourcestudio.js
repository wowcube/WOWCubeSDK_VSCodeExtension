(function ()
{
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('resource-studio');
	const validation = window.ResourceStudioValidation;
	const saved = vscode.getState() || {};
	const state = {tab:saved.tab || 'Sprites', selected:saved.selected || '', colorIndex:saved.colorIndex || 0,
		previewMode:saved.previewMode || 'indexed', zoom:!saved.zoom || saved.zoom === 'fit' ? 'fit' : String(Math.max(0.5, Math.min(128, Number(saved.zoom) || 1))), previewHeight:saved.previewHeight, filter:'', busy:false, dialog:null, spacePressed:false, advancedBlend:!!saved.advancedBlend, mapViews:saved.mapViews || {}, sequenceViews:saved.sequenceViews || {}, fontViews:saved.fontViews || {}, spriteGroupsOpen:saved.spriteGroupsOpen || {}, sourceGroupsOpen:[]};
	let bundle;
	let sources = [];
	let fontData = {};
	let soundData = {}, confirmedSounds = [];
	let resourceTypes = [];
	let version = 0;
	let dirty = false;
	let project = '';
	let error = '';
	let sourceWarning = '';
	let warnings = [];
	let disposePreview;
	let sourceFilesView;
	let previewScroll = {top:0, left:0};
	let pendingName = '';
	let pendingSequenceIds;
	let pendingFontIds;
	let selectedSource = '';
	let selectedFolder;
	let saveRequested = false;
	const flushRequests = [];
	function finishFlush()
	{
		if(state.busy) { return; }
		for(const requestId of flushRequests.splice(0)) { vscode.postMessage({type:'flushedEdits', requestId, error:error || (disposePreview?.validate && !disposePreview.validate() ? 'Correct the invalid animation field before building.' : undefined) || (!bundle ? 'Unable to build an invalid resource bundle.' : undefined)}); }
	}
	let pendingFocusKey;
	const displayMessage = value => /\bV-020:/.test(String(value)) ? String(value).replace(/\bSoftkey\b/g, 'Color Key') : String(value);
	const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
	const field = (label, html) => '<div class="field"><label>'+escape(label)+html+'</label></div>';
	const input = (key, value, type = 'text', extra = '') => '<input data-key="'+key+'" type="'+type+'" value="'+escape(value)+'" '+extra+'>';
	const select = (key, items, value) => '<select data-key="'+key+'">'+items.map(item => '<option value="'+escape(item.value)+'" '+
		(item.value === value ? 'selected ' : '')+(item.disabled ? 'disabled' : '')+'>'+escape(item.label)+'</option>').join('')+'</select>';

	function helpers()
	{
		return {state, bundle, sources, fontData, soundData, confirmedSounds, root, selectResource, postMessage:message => vscode.postMessage(message), main:root.querySelector('main'), previewScroll, escape, field, input, select, updateResource, saveState, selectPaletteColor,
			sendChange, renderSpriteList:(items, renderItem, scope) => window.ResourceStudioSpriteList.render(items, renderItem, scope, state, escape),
			chooseMapBackground:id => sendChange({action:'chooseMapBackground', id})};
	}
	function selectPaletteColor(index, reveal = false)
	{
		state.colorIndex = index;
		render(false, reveal);
	}

	function saveState()
	{
		vscode.setState({tab:state.tab, selected:state.selected, colorIndex:state.colorIndex, previewMode:state.previewMode, zoom:state.zoom, previewHeight:state.previewHeight, advancedBlend:state.advancedBlend, mapViews:state.mapViews, sequenceViews:state.sequenceViews, fontViews:state.fontViews, spriteGroupsOpen:state.spriteGroupsOpen});
	}

	function getResource()
	{
		return bundle.resources.find(resource => resource.id === state.selected);
	}
	function getEditedResource(element)
	{
		return element.dataset.paletteId ? bundle.resources.find(resource => resource.id === element.dataset.paletteId && resource.type === 'palette') : getResource();
	}

	function getSection(resource)
	{
		return resource.type === 'sprite' && resource.sequence ? 'Animations' : window.ResourceStudioTypes.get(resource.type)?.section || 'Sprites';
	}

	function disableBusyControls()
	{
		root.querySelectorAll('input, select, button').forEach(element =>
		{
			if(element.dataset.action === 'save') { return; }
			if(element.dataset.busyDisabled === undefined) { element.dataset.busyDisabled = String(element.disabled); }
			element.disabled = true;
		});
	}
	function restoreBusyControls()
	{
		root.querySelectorAll('[data-busy-disabled]').forEach(element =>
		{
			element.disabled = element.dataset.busyDisabled === 'true'; delete element.dataset.busyDisabled;
		});
	}
	function mapRefreshKey()
	{
		const resource = bundle && getResource();
		if(state.dialog || error) { return; }
		if(state.tab === 'Animations' && resource?.sequence) { return JSON.stringify(['sequence', resource.sequence.id, bundle.resources.map(item => [item.id, item.name, item.sequence])]); }
		if(state.tab !== 'Maps' || resource?.type !== 'map') { return; }
		return JSON.stringify([{...bundle, resources:bundle.resources.map(item => item === resource ? {...item, placements:null} : item)},
			sources, resourceTypes, project, sourceWarning, warnings]);
	}
	function sendChange(message)
	{
		if(state.busy)
		{
			return;
		}
		if(message.action === 'fontImport') { pendingFontIds = new Set(bundle.resources.filter(item => item.type === 'font').map(item => item.id)); }
		if(message.action === 'sequenceImport') { pendingSequenceIds = new Set(bundle.resources.filter(item => item.sequence).map(item => item.sequence.id)); }
		state.busy = true;
		error = '';
		pendingFocusKey = root.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
		disableBusyControls();
		root.querySelector('#save-state').textContent = message.action === 'resizePalette' || message.action === 'generatePalette' || message.action === 'create' && message.resourceType === 'sprite' ? 'Generating palette…' : 'Updating…';
		vscode.postMessage({type:'change', version, ...message});
	}

	function updateResource(resource)
	{
		if(resource.type === 'palette' && getResource()?.type === 'sprite')
		{
			state.previewMode = 'indexed';
		}
		sendChange({action:'update', resource});
	}

	function render(preserveInput = false, revealColor = false)
	{
		if(!bundle)
		{
			return;
		}
		const scroll = root.querySelector('main')?.scrollTop || 0;
		const paletteScroll = root.querySelector('.palette-grid')?.scrollTop || 0;
		const libraryScroll = root.querySelector('.library')?.scrollTop || 0;
		const inspectorScroll = root.querySelector('.resource-inspector')?.scrollTop || 0;
		const visualScroll = root.querySelector('.visual-editor')?.scrollTop || 0;
		const registryOpen = root.querySelector('[data-classification-manager]')?.open || false;
		const stage = root.querySelector('#sprite-preview');
		previewScroll = {top:stage?.scrollTop || 0, left:stage?.scrollLeft || 0};
		if(disposePreview)
		{
			disposePreview();
			disposePreview = undefined;
		}
		const active = document.activeElement;
		const focusKey = (root.contains(active) ? active.dataset.key : undefined) || pendingFocusKey;
		const selectionStart = active?.selectionStart;
		const selectionEnd = active?.selectionEnd;
		const draftValue = active?.value;
		const resourceSections = [...new Set(resourceTypes.map(type => window.ResourceStudioTypes.get(type.type)?.section).filter(section => section && section !== 'Sprites'))];
		const sections = ['Sprites', ...resourceSections.filter(section => section === 'Maps'), ...(window.ResourceStudioSequences ? ['Animations'] : []), ...resourceSections.filter(section => section === 'Fonts'), ...resourceSections.filter(section => section === 'Sounds'), ...resourceSections.filter(section => !['Maps','Fonts','Sounds'].includes(section)), 'Source files'];
		if(!sections.includes(state.tab))
		{
			state.tab = 'Sprites';
		}
		const entries = bundle.resources.filter(resource => (getSection(resource) === state.tab || state.tab === 'Sprites' && resource.type === 'sprite') && (state.tab !== 'Animations' || resource.sequence.index === 0));
		if(state.tab !== 'Source files' && !entries.some(resource => resource.id === state.selected))
		{
			state.selected = entries[0]?.id || '';
		}
		const resource = getResource();
		const palette = resource?.type === 'palette' ? resource : bundle.resources.find(item => item.id === resource?.paletteId);
		if(palette)
		{
			state.colorIndex = Math.min(state.colorIndex, palette.colors.length - 1);
		}
		root.innerHTML = '<div class="studio"><header class="top"><span class="brand">◈ Resource Studio</span><span class="project">'+escape(project)+
			' / wowcubeapp-resources.json</span><span class="spacer"></span><span class="minor" id="save-state">'+(dirty ? 'Unsaved •' : 'Saved')+
			'</span><button data-action="editText">Edit JSON</button><button class="primary" data-action="save">SAVE CHANGES</button></header>'+
			'<nav class="tabs" aria-label="Resource sections">'+sections.map(tab => '<button data-tab="'+escape(tab)+'" class="'+(state.tab === tab ? 'active' : '')+
			'" aria-pressed="'+(state.tab === tab)+'">'+escape(tab)+(tab === 'Source files' ? ' · '+sources.filter(source => !bundle.resources.some(item => (item.source === source.path || item.type === 'font' && item.atlas === source.path))).length+' unused' : '')+'</button>').join('')+
			'</nav><div id="studio-error" class="error-banner" role="alert" '+(!error ? 'hidden' : '')+'>'+escape(error)+'</div><div class="layout">'+
			'<aside class="library"><div class="section-label">'+escape(state.tab)+'</div>'+
			(state.tab === 'Source files' ? renderFolders() : state.tab === 'Sprites' ? window.ResourceStudioSpriteList.render(entries, renderLibraryItem, 'Sprites', state, escape) : entries.map(renderLibraryItem).join(''))+(resource ? window.ResourceStudioTypes.get(resource.type)?.renderLibrary?.(resource, helpers()) || '' : '')+
			'<div class="library-footer">'+bundle.resources.filter(item => item.type !== 'palette').length+' resources<br>'+bundle.resources.filter(item => item.type === 'palette').length+
			' shared palettes<br>'+bundle.sourceFolders.length+' source folders</div></aside><main class="content'+(state.tab !== 'Source files' && resource ? ' resource-view' : '')+'">'+
			(warnings.length ? '<details class="notice"><summary>Resource diagnostics · '+warnings.length+'</summary>'+warnings.map(warning => '<p>'+escape(warning)+'</p>').join('')+'</details>' : '')+
			(state.dialog ? renderDialog() : '')+(state.tab === 'Source files' ? renderSources() : renderResource(resource))+
			'</main></div><footer class="bottom"><span>Project resource manifest</span><span class="spacer"></span><span>Source files are registered explicitly</span></footer></div>';
		const main = root.querySelector('main');
		const registry = root.querySelector('[data-classification-manager]');
		if(registry) { registry.open = registryOpen; }
		const stageScroll = {...previewScroll};
		const grid = root.querySelector('.palette-grid');
		const library = root.querySelector('.library');
		const inspector = root.querySelector('.resource-inspector');
		const visual = root.querySelector('.visual-editor');
		const preview = root.querySelector('#sprite-preview');
		function restoreScrollPositions()
		{
			main.scrollTop = scroll;
			if(grid) { grid.scrollTop = paletteScroll; }
			if(library) { library.scrollTop = libraryScroll; }
			if(inspector) { inspector.scrollTop = inspectorScroll; }
			if(visual) { visual.scrollTop = visualScroll; }
			if(preview) { preview.scrollTop = stageScroll.top; preview.scrollLeft = stageScroll.left; }
			if(revealColor && grid)
			{
				const swatch = grid.querySelector('[data-color-index="'+state.colorIndex+'"]');
				if(swatch)
				{
					const margin = 6;
					if(swatch.offsetTop - margin < grid.scrollTop) { grid.scrollTop = Math.max(0, swatch.offsetTop - margin); }
					else if(swatch.offsetTop + swatch.offsetHeight + margin > grid.scrollTop + grid.clientHeight)
					{
						grid.scrollTop = swatch.offsetTop + swatch.offsetHeight + margin - grid.clientHeight;
					}
					if(visual)
					{
						const item = swatch.getBoundingClientRect();
						const viewport = visual.getBoundingClientRect();
						if(item.top - margin < viewport.top) { visual.scrollTop += item.top - margin - viewport.top; }
						else if(item.bottom + margin > viewport.bottom) { visual.scrollTop += item.bottom + margin - viewport.bottom; }
					}
				}
			}
		}
		if(state.tab !== 'Source files' && resource)
		{
			disposePreview = state.tab === 'Animations' ? window.ResourceStudioSequences.mount(resource, helpers()) : window.ResourceStudioTypes.get(resource.type)?.mountPreview?.(resource, {...helpers(), onPreviewReady:restoreScrollPositions});
		}
		else if(state.tab === 'Animations') { disposePreview = window.ResourceStudioSequences.mount(undefined, helpers()); }
		else if(state.tab === 'Sounds') { disposePreview = window.ResourceStudioSounds.mount(undefined,helpers()); }
		else if(state.tab === 'Source files')
		{
			const source = sources.find(item => item.path === selectedSource);
			const image = main.querySelector('#source-preview-image');
			if(image && source)
			{
				image.src = source.uri;
				image.onerror = function () { image.alt = 'Unable to load image: '+source.path; };
			}
		}
		if(state.busy)
		{
			disableBusyControls();
			root.querySelector('#save-state').textContent = 'Generating palette…';
		}
		if(focusKey)
		{
			const element = Array.from(root.querySelectorAll('[data-key]')).find(item => item.dataset.key === focusKey);
			if(element)
			{
				if(preserveInput && draftValue !== undefined && element.type !== 'checkbox')
				{
					element.value = draftValue;
				}
				element.focus({preventScroll:true});
				if(element.type === 'text')
				{
					element.setSelectionRange(selectionStart, selectionEnd);
				}
			}
		}
		if(!state.busy) { pendingFocusKey = undefined; }
		restoreScrollPositions();
		window.ResourceStudioSounds?.setHelpers(helpers());
		saveState();
	}

	function renderLibraryItem(item)
	{
		const type = window.ResourceStudioTypes.get(item.type);
		if(type?.renderLibraryItem) { return type.renderLibraryItem(item,helpers()); }
		return '<button class="item '+(item.id === state.selected ? 'active' : '')+'" data-select="'+escape(item.id)+'" aria-pressed="'+(item.id === state.selected)+'">'+
			'<span class="resource-icon" aria-hidden="true">'+(type?.icon || '◇')+'</span><span>'+escape(state.tab === 'Animations' ? item.sequence.name : item.name)+'<small>'+escape(state.tab === 'Animations' ? 'Animation' : type?.getSummary(item) || item.type+' · unsupported')+'</small></span></button>';
	}

	function renderResource(resource)
	{
		if(state.tab === 'Animations') { return window.ResourceStudioSequences.render(resource, helpers()); }
		if(state.tab === 'Sounds') { return window.ResourceStudioSounds.render(resource, helpers()); }
		const addButton = '<button class="primary" data-action="newResource">'+(state.tab === 'Sprites' ? '+ Add new sprite' : state.tab === 'Maps' ? '+ Add new map' : state.tab === 'Fonts' ? '+ Add new font' : '+ Add resource')+'</button>';
		if(!resource)
		{
			return '<div class="heading"><strong>'+escape(state.tab)+'</strong><span class="spacer"></span>'+addButton+'</div>'+
				'<div class="empty"><span class="empty-icon">'+(state.tab === 'Palettes' ? '▦' : '▧')+'</span><h2>No '+state.tab.toLowerCase()+' yet</h2>'+
				'<p>'+(state.tab === 'Palettes' ? 'Add a sprite to generate its palette from the source image.' : state.tab === 'Maps' ? 'Create a map, then place registered sprites on its cube net.' : state.tab === 'Fonts' ? 'Choose a binary BMFont .fnt file and its PNG atlas.' : 'Add source folders, then register a sprite from an image.')+'</p>'+
				addButton+' <button data-tab="Source files">Browse source files</button></div>';
		}
		const type = window.ResourceStudioTypes.get(resource.type);
		return '<div class="heading"><strong>'+escape(resource.name)+'</strong><span class="tag">'+escape(type?.label || resource.type)+
			'</span><span class="spacer"></span>'+addButton+'<button data-action="remove">Remove</button></div>'+
			(type?.renderWorkspace ? type.renderWorkspace(resource, helpers()) : type ? '<div class="detail"><div class="visual-editor">'+type.renderPreview(resource, helpers())+'</div><div class="inspector resource-inspector" tabindex="0" aria-label="Resource properties">'+
			(type.ownsName ? '' : field('Unique resource name', input('name', resource.name)))+type.renderInspector(resource, helpers())+'<div class="rule"></div>'+
			'<div class="minor resource-id">ID: '+escape(resource.id)+'</div></div></div>' :
			'<div class="empty"><h2>Unsupported resource type</h2><p>This resource is preserved in the bundle. Use the JSON editor to edit its properties.</p><button data-action="editText">Edit JSON</button></div>');
	}

	function renderFolders()
	{
		return bundle.sourceFolders.map(folder => '<div class="folder"><span>'+escape(folder)+'</span><button data-remove-folder="'+escape(folder)+'" aria-label="Remove source folder '+escape(folder)+'">×</button></div>').join('')+
			'<button class="item" data-action="addFolder">+ Add source folders</button>';
	}

	function renderSources()
	{
		const source = sources.find(item => item.path === selectedSource);
		sourceFilesView = window.ResourceStudioSourceFiles.create(sources, bundle, escape, state);
		return '<div class="heading"><strong>Source files</strong><span class="spacer"></span><button data-action="refresh">Refresh</button><button class="primary" data-action="addFolder">+ Add source folders</button></div>'+
			'<p class="minor">Choose any folders inside this project. Files become resources only when registered.</p>'+
			(selectedFolder !== undefined && !bundle.sourceFolders.includes(selectedFolder) ? '<div class="dialog">Source folder: '+escape(selectedFolder)+
				' <button class="primary" data-add-source-folder="'+escape(selectedFolder)+'">Add this source folder</button></div>' : '')+
			(sourceWarning ? '<div class="notice">'+escape(sourceWarning)+'</div>' : '')+
			(source ? '<div class="source-selection"><div class="preview-head"><span>'+escape(source.path)+'</span><button data-action="clearSource">Close preview</button></div>'+
				(source.image && !source.missing ? '<div class="preview"><img id="source-preview-image" class="source-image" alt="'+escape(source.path)+'"></div>' : '<p class="minor">'+(source.missing ? 'Source file is missing.' : 'No image preview for this file type.')+'</p>')+'</div>' : '')+
			'<label class="search">Filter source files<input id="source-filter" type="search" value="'+escape(state.filter)+'" placeholder="Search by path"></label>'+
			sourceFilesView.html+(!sources.length ? '<div class="empty"><h2>No source files</h2><p>Add a source folder to browse its files.</p></div>' : '');
	}

	function renderDialog()
	{
		const dialog = state.dialog;
		const type = window.ResourceStudioTypes.get(dialog.type);
		return '<form id="resource-form" class="dialog"><strong>Register a resource</strong><div class="resource-create-source">'+
			(type?.renderCreateSource?.(dialog, helpers()) || field('Unique name', '<input data-dialog="name" value="'+escape(dialog.name)+'" required>'))+'</div>'+
			(type?.renderCreate?.(dialog, helpers()) || '')+
			'<div class="actions"><button type="submit" class="primary">Add resource</button><button type="button" data-action="cancel">Cancel</button></div></form>';
	}

	function selectResource(id)
	{
		const resource = bundle.resources.find(item => item.id === id);
		if(resource)
		{
			state.selected = id;
			state.tab = state.tab === 'Sprites' && resource.type === 'sprite' ? 'Sprites' : getSection(resource);
			state.dialog = null;
			error = '';
			render();
		}
	}

	function showDialog(type, source = '')
	{
		if(type === 'sound') { vscode.postMessage({type:'soundImport'}); return; }
		if(type === 'font') { sendChange({action:'fontImport'}); return; }
		state.dialog = {type, source, name:source ? validation.deriveName(source, validation.usedNames(bundle.resources), type) : '', paletteId:bundle.resources.find(item => item.type === 'palette')?.id || '', colorCount:256};
		error = '';
		render();
		root.querySelector('[data-dialog="name"]')?.focus();
	}

	root.addEventListener('click', function (event)
	{
		const button = event.target.closest('button');
		if(!button || button.disabled)
		{
			return;
		}
		if(state.busy)
		{
			if(button.dataset.action === 'save')
			{
				saveRequested = true;
			}
			return;
		}
		if(button.dataset.tab)
		{
			state.tab = button.dataset.tab;
			state.dialog = null;
			error = '';
			render();
			return;
		}
		if(button.dataset.select)
		{
			selectResource(button.dataset.select);
			return;
		}
		if(button.dataset.deleteClassification)
		{
			sendChange({action:'deleteClassification', registry:button.dataset.deleteClassification, name:button.dataset.name});
			return;
		}
		if(button.dataset.addClassification)
		{
			sendChange({action:'addClassification', id:state.selected, registry:button.dataset.addClassification});
			return;
		}
		if(button.dataset.colorIndex !== undefined)
		{
			selectPaletteColor(Number(button.dataset.colorIndex));
			return;
		}
		if(button.dataset.reservePalette)
		{
			sendChange({action:'reservePaletteIndex', id:button.dataset.reservePalette}); return;
		}
		if(button.dataset.rebuildPalette)
		{
			const palette = bundle.resources.find(resource => resource.id === button.dataset.rebuildPalette && resource.type === 'palette');
			if(palette)
			{
				if(getResource()?.type === 'sprite') { state.previewMode = 'indexed'; }
				sendChange({action:'resizePalette', id:palette.id, colorCount:palette.colorCount});
			}
			return;
		}
		if(button.dataset.previewMode)
		{
			state.previewMode = button.dataset.previewMode;
			render();
			return;
		}
		if(button.dataset.registerSource)
		{
			showDialog('sprite', button.dataset.registerSource);
			return;
		}
		if(button.dataset.source)
		{
			selectedSource = button.dataset.source;
			render();
			return;
		}
		if(button.dataset.openSource)
		{
			vscode.postMessage({type:'openSource', source:button.dataset.openSource});
			return;
		}
		if(button.dataset.removeFolder !== undefined)
		{
			sendChange({action:'removeFolder', folder:button.dataset.removeFolder});
			return;
		}
		if(button.dataset.addSourceFolder !== undefined)
		{
			sendChange({action:'addSourceFolder', folder:button.dataset.addSourceFolder});
			return;
		}
		switch(button.dataset.action)
		{
			case 'newResource':
				showDialog(state.tab === 'Sprites' ? 'sprite' : (resourceTypes.find(type => type.canCreate !== false && window.ResourceStudioTypes.get(type.type)?.section === state.tab) ||
					resourceTypes.find(type => type.canCreate !== false && window.ResourceStudioTypes.get(type.type)?.canCreate !== false))?.type || 'sprite');
				break;
			case 'cancel':
				state.dialog = null;
				render();
				break;
			case 'clearSource':
				selectedSource = '';
				render();
				break;
			case 'center':
				updateResource({...getResource(), pivot:null});
				break;
			case 'remove':
				sendChange({action:'remove', id:state.selected});
				break;
			case 'save':
				if(disposePreview?.validate && !disposePreview.validate()) { return; }
			case 'refresh':
			case 'editText':
				vscode.postMessage({type:button.dataset.action});
				break;
			case 'addFolder':
				state.busy = true;
				vscode.postMessage({type:'addFolder', version});
				break;
		}
	});

	root.addEventListener('toggle', function (event)
	{
		if(root.contains(event.target) && event.target.dataset?.spriteGroup !== undefined)
		{
			window.ResourceStudioSpriteList.toggle(event.target, state); saveState();
		}
		if(root.contains(event.target) && event.target.dataset?.sourceFolder !== undefined) { sourceFilesView?.toggle(event.target); }
	}, true);

	root.addEventListener('input', function (event)
	{
		const element = event.target;
		if(element.dataset.dialog)
		{
			state.dialog[element.dataset.dialog] = element.value;
			if(element.dataset.dialog === 'source' && !state.dialog.name)
			{
				state.dialog.name = validation.deriveName(element.value, validation.usedNames(bundle.resources), state.dialog.type);
				render();
			}
		}
		if(element.id === 'source-filter')
		{
			state.filter = element.value;
			sourceFilesView?.filter(root);
		}
		if(bundle && !state.busy && (element.dataset.key === 'colorHex' || element.dataset.key?.startsWith('channel')))
		{
			const palette = getEditedResource(element);
			if(palette?.type === 'palette')
			{
				try
				{
					const type = window.ResourceStudioTypes.get('palette');
					type.change(palette, element.dataset.key, element, helpers());
					type.refreshControls(palette, helpers(), element);
					if(getResource()?.type === 'sprite')
					{
						state.previewMode = 'indexed';
						root.querySelectorAll('[data-preview-mode]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.previewMode === 'indexed')); });
						disposePreview?.refreshPalette?.();
					}
				}
				catch
				{
					// Keep partial hex input editable until it becomes a valid color.
				}
			}
		}
	});

	root.addEventListener('change', function (event)
	{
		const element = event.target;
		if(element.dataset.dialog)
		{
			state.dialog[element.dataset.dialog] = element.value;
			if(element.dataset.dialog === 'name' && state.dialog.paletteName === undefined)
			{
				const paletteName = root.querySelector('[data-dialog="paletteName"]');
				if(paletteName)
				{
					paletteName.value = validation.paletteName(element.value.trim());
				}
			}
			if(element.dataset.dialog === 'paletteId')
			{
				render();
			}
			return;
		}
		if(element.id === 'preview-zoom')
		{
			state.zoom = element.value;
			render();
			return;
		}
		if(element.id === 'advanced-blend')
		{
			state.advancedBlend = element.checked;
			render();
			return;
		}
		if(!bundle || state.busy || !element.dataset.key)
		{
			return;
		}
		try
		{
			const resource = JSON.parse(JSON.stringify(getEditedResource(element)));
			const key = element.dataset.key;
			if(resource.type === 'sprite' && key === 'paletteId') { state.previewMode = 'indexed'; }
			if(resource.type === 'sprite' && key === 'paletteId' && element.value === '__new_palette__')
			{
				state.previewMode = 'indexed';
				sendChange({action:'generatePalette', id:resource.id});
				return;
			}
			if(element.type === 'number' && (!element.value || !Number.isFinite(Number(element.value))))
			{
				throw new Error('Enter a valid number.');
			}
			if(resource.type === 'palette' && key === 'colorCount')
			{
				const size = Number(element.value);
				if(validation.paletteSize(size))
				{
					throw new Error(validation.paletteSize(size));
				}
				if(getResource()?.type === 'sprite') { state.previewMode = 'indexed'; }
				sendChange({action:'resizePalette', id:resource.id, colorCount:size});
				return;
			}
			if(key === 'name')
			{
				resource.name = element.value.trim();
				const error = validation.name(resource.name, validation.usedNames(bundle.resources, resource.id), resource.type);
				if(error) { throw new Error(error); }
			}
			else
			{
				window.ResourceStudioTypes.get(resource.type).change(resource, key, element, helpers());
			}
			updateResource(resource);
		}
		catch(exception)
		{
			error = exception.message;
			render();
		}
	});

	root.addEventListener('submit', function (event)
	{
		event.preventDefault();
		if(state.busy || !state.dialog)
		{
			return;
		}
		const dialog = state.dialog;
		const name = dialog.name.trim();
		const nameError = validation.name(name, validation.usedNames(bundle.resources), dialog.type);
		if(nameError)
		{
			error = nameError;
			render();
			return;
		}
		try
		{
			window.ResourceStudioTypes.get(dialog.type)?.validateCreate?.(dialog, helpers());
		}
		catch(exception)
		{
			error = exception.message;
			render();
			return;
		}
		pendingName = name;
		sendChange({action:'create', name, resourceType:dialog.type, source:dialog.source,
			options:{...dialog, colorMode:dialog.paletteId === '__rgb565__' ? 'rgb565' : 'palette',
				paletteId:dialog.paletteId === '__rgb565__' ? null : dialog.paletteId, paletteName:dialog.paletteName ?? validation.paletteName(name)}});
	});

	window.addEventListener('keydown', function (event)
	{
		if(event.code === 'Space')
		{
			state.spacePressed = true;
			const target = event.target || document.activeElement;
			if(target?.closest?.('.sound-modal, audio, [data-sound-action], [data-sound-play], [data-register-sound], [data-map-lock], [data-sequence-action], [data-sequence-frame], .sprite-group > summary') || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName))
			{
				return;
			}
			event.preventDefault();
		}
		if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')
		{
			event.preventDefault();
			if(root.contains(document.activeElement) && (document.activeElement.dataset.key || document.activeElement.dataset.sequenceKey || document.activeElement.hasAttribute('data-sound-name')))
			{
				document.activeElement.blur();
			}
			if(disposePreview?.validate && !disposePreview.validate()) { return; }
			if(!state.busy)
			{
				vscode.postMessage({type:'save'});
			}
			else
			{
				saveRequested = true;
			}
		}
		if(event.key === 'Escape' && state.dialog && !state.busy)
		{
			state.dialog = null;
			render();
		}
	});
	window.addEventListener('keyup', function (event)
	{
		if(event.code === 'Space') { state.spacePressed = false; }
	});
	window.addEventListener('blur', function ()
	{
		state.spacePressed = false;
	});

	window.addEventListener('message', function (event)
	{
		const message = event.data;
		if(message.type === 'flushEdits')
		{
			flushRequests.push(message.requestId);
			const active = document.activeElement;
			if(!state.busy && root.contains(active) && (active.dataset.key || active.dataset.mapKey || active.dataset.sequenceKey || active.hasAttribute('data-sound-name'))) { active.blur(); }
			finishFlush();
		}
		else if(message.type === 'update')
		{
			const initialLoad = !bundle;
			const refreshKey = mapRefreshKey();
			const preserveInput = version === message.version && !state.busy;
			const sprite = bundle && getResource();
			if(sprite?.type === 'sprite')
			{
				const previous = bundle.resources.find(item => item.id === sprite.paletteId);
				const current = message.bundle.resources.find(item => item.id === sprite.paletteId);
				if(JSON.stringify([previous?.colors, previous?.transparentIndex]) !== JSON.stringify([current?.colors, current?.transparentIndex]))
				{
					state.previewMode = 'indexed';
				}
			}
			bundle = message.bundle;
			sources = message.sources;
			resourceTypes = message.resourceTypes;
			version = message.version;
			fontData = message.fontData || {};
			soundData = message.soundData || {}; confirmedSounds = message.confirmedSounds || [];
			dirty = message.dirty;
			project = message.project;
			sourceWarning = message.sourceWarning;
			warnings = (message.warnings || []).map(displayMessage);
			selectedFolder = message.selectedFolder;
			state.busy = Boolean(message.busy);
			if(pendingFontIds && !state.busy)
			{
				const created = bundle.resources.find(item => item.type === 'font' && !pendingFontIds.has(item.id));
				if(created) { state.selected = created.id; state.tab = 'Fonts'; }
				pendingFontIds = undefined;
			}
			if(pendingSequenceIds && !state.busy)
			{
				const created = bundle.resources.find(item => item.sequence?.index === 0 && !pendingSequenceIds.has(item.sequence.id));
				if(created) { state.selected = created.id; state.tab = 'Animations'; }
				pendingSequenceIds = undefined;
			}
			if(pendingName && !state.busy)
			{
				const created = bundle.resources.find(resource => resource.name === pendingName);
				if(created)
				{
					state.selected = created.id;
					state.tab = getSection(created);
					state.dialog = null;
				}
				pendingName = '';
			}
			if(message.selectedSource)
			{
				const resource = bundle.resources.find(item => (item.source === message.selectedSource || item.type === 'font' && item.atlas === message.selectedSource));
				if(resource)
				{
					state.selected = resource.id;
					state.tab = getSection(resource);
				}
				else
				{
					state.tab = 'Source files';
					selectedSource = message.selectedSource;
				}
			}
			if(!state.busy && refreshKey && refreshKey === mapRefreshKey() && disposePreview?.refreshResource)
			{
				restoreBusyControls();
				disposePreview.refreshResource(getResource(), helpers(), preserveInput);
				root.querySelector('#save-state').textContent = dirty ? 'Unsaved •' : 'Saved';
				saveState();
			}
			else { render(preserveInput); }
			if(initialLoad)
			{
				root.tabIndex = -1;
				root.focus({preventScroll:true});
			}
			if(saveRequested && !state.busy)
			{
				saveRequested = false;
				vscode.postMessage({type:'save'});
			}
		}
		else if(message.type === 'error')
		{
			state.busy = false;
			pendingName = '';
			pendingSequenceIds = undefined;
			saveRequested = false;
			error = displayMessage(message.message);
			render();
		}
		else if(message.type === 'invalid')
		{
			state.busy = false;
			bundle = undefined;
			saveRequested = false;
			if(disposePreview)
			{
				disposePreview();
				disposePreview = undefined;
			}
			root.innerHTML = '<div class="invalid"><h2>Unable to open resource bundle</h2><p class="error-banner">'+escape(displayMessage(message.message))+
				'</p><button data-action="editText">Edit JSON to correct it</button><button data-action="refresh">Retry</button></div>';
		}
		finishFlush();
	});

	vscode.postMessage({type:'ready'});
}());
