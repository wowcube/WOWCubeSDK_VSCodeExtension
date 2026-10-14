(function ()
{
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('resource-studio');
	const validation = window.ResourceStudioValidation;
	const saved = vscode.getState() || {};
	const state = {tab:saved.tab || 'Resources', selected:saved.selected || '', colorIndex:saved.colorIndex || 0,
		previewMode:saved.previewMode || 'indexed', zoom:!saved.zoom || saved.zoom === 'fit' ? 'fit' : String(Math.max(0.5, Math.min(128, Number(saved.zoom) || 1))), previewHeight:saved.previewHeight, filter:'', busy:false, dialog:null, spacePressed:false, advancedBlend:!!saved.advancedBlend};
	let bundle;
	let sources = [];
	let resourceTypes = [];
	let version = 0;
	let dirty = false;
	let project = '';
	let error = '';
	let sourceWarning = '';
	let warnings = [];
	let disposePreview;
	let previewScroll = {top:0, left:0};
	let pendingName = '';
	let selectedSource = '';
	let selectedFolder;
	let saveRequested = false;
	let pendingFocusKey;
	const displayMessage = value => /\bV-020:/.test(String(value)) ? String(value).replace(/\bSoftkey\b/g, 'Color Key') : String(value);
	const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
	const field = (label, html) => '<div class="field"><label>'+escape(label)+html+'</label></div>';
	const input = (key, value, type = 'text', extra = '') => '<input data-key="'+key+'" type="'+type+'" value="'+escape(value)+'" '+extra+'>';
	const select = (key, items, value) => '<select data-key="'+key+'">'+items.map(item => '<option value="'+escape(item.value)+'" '+
		(item.value === value ? 'selected ' : '')+(item.disabled ? 'disabled' : '')+'>'+escape(item.label)+'</option>').join('')+'</select>';

	function helpers()
	{
		return {state, bundle, sources, main:root.querySelector('main'), previewScroll, escape, field, input, select, updateResource, saveState, selectPaletteColor};
	}
	function selectPaletteColor(index, reveal = false)
	{
		state.colorIndex = index;
		render(false, reveal);
	}

	function saveState()
	{
		vscode.setState({tab:state.tab, selected:state.selected, colorIndex:state.colorIndex, previewMode:state.previewMode, zoom:state.zoom, previewHeight:state.previewHeight, advancedBlend:state.advancedBlend});
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
		return window.ResourceStudioTypes.get(resource.type)?.section || 'Resources';
	}

	function sendChange(message)
	{
		if(state.busy)
		{
			return;
		}
		state.busy = true;
		error = '';
		pendingFocusKey = root.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
		root.querySelectorAll('input, select, button').forEach(element =>
		{
			if(element.dataset.action !== 'save')
			{
				element.disabled = true;
			}
		});
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
		const sections = ['Resources', ...new Set(resourceTypes.map(type => window.ResourceStudioTypes.get(type.type)?.section).filter(section => section && section !== 'Resources')), 'Source files'];
		if(!sections.includes(state.tab))
		{
			state.tab = 'Resources';
		}
		const entries = bundle.resources.filter(resource => getSection(resource) === state.tab);
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
			'" aria-pressed="'+(state.tab === tab)+'">'+escape(tab)+(tab === 'Source files' ? ' · '+sources.filter(source => !bundle.resources.some(item => item.source === source.path)).length+' unused' : '')+'</button>').join('')+
			'</nav><div id="studio-error" class="error-banner" role="alert" '+(!error ? 'hidden' : '')+'>'+escape(error)+'</div><div class="layout">'+
			'<aside class="library"><div class="section-label">'+(state.tab === 'Resources' ? 'Registered resources' : escape(state.tab))+'</div>'+
			(state.tab === 'Source files' ? renderFolders() : entries.map(item =>
			{
				const type = window.ResourceStudioTypes.get(item.type);
				return '<button class="item '+(item.id === state.selected ? 'active' : '')+'" data-select="'+escape(item.id)+'" aria-pressed="'+(item.id === state.selected)+'">'+
					'<span class="resource-icon" aria-hidden="true">'+(type?.icon || '◇')+'</span><span>'+escape(item.name)+'<small>'+escape(type?.getSummary(item) || item.type+' · unsupported')+'</small></span></button>';
			}).join(''))+
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
			disposePreview = window.ResourceStudioTypes.get(resource.type)?.mountPreview?.(resource, {...helpers(), onPreviewReady:restoreScrollPositions});
		}
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
			root.querySelectorAll('input, select, button').forEach(element =>
			{
				if(element.dataset.action !== 'save')
				{
					element.disabled = true;
				}
			});
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
		saveState();
	}

	function renderResource(resource)
	{
		const addButton = '<button class="primary" data-action="newResource">+ Add resource</button>';
		if(!resource)
		{
			return '<div class="heading"><strong>'+escape(state.tab)+'</strong><span class="spacer"></span>'+addButton+'</div>'+
				'<div class="empty"><span class="empty-icon">'+(state.tab === 'Palettes' ? '▦' : '▧')+'</span><h2>No '+state.tab.toLowerCase()+' yet</h2>'+
				'<p>'+(state.tab === 'Palettes' ? 'Add a sprite to generate its palette from the source image.' : 'Add source folders, then register a sprite from an image.')+'</p>'+
				addButton+' <button data-tab="Source files">Browse source files</button></div>';
		}
		const type = window.ResourceStudioTypes.get(resource.type);
		return '<div class="heading"><strong>'+escape(resource.name)+'</strong><span class="tag">'+escape(type?.label || resource.type)+
			'</span><span class="spacer"></span>'+addButton+'<button data-action="remove">Remove</button></div>'+
			(type ? '<div class="detail"><div class="visual-editor">'+type.renderPreview(resource, helpers())+'</div><div class="inspector resource-inspector" tabindex="0" aria-label="Resource properties">'+
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
		return '<div class="heading"><strong>Source files</strong><span class="spacer"></span><button data-action="refresh">Refresh</button><button class="primary" data-action="addFolder">+ Add source folders</button></div>'+
			'<p class="minor">Choose any folders inside this project. Files become resources only when registered.</p>'+
			(selectedFolder !== undefined && !bundle.sourceFolders.includes(selectedFolder) ? '<div class="dialog">Source folder: '+escape(selectedFolder)+
				' <button class="primary" data-add-source-folder="'+escape(selectedFolder)+'">Add this source folder</button></div>' : '')+
			(sourceWarning ? '<div class="notice">'+escape(sourceWarning)+'</div>' : '')+
			(source ? '<div class="source-selection"><div class="preview-head"><span>'+escape(source.path)+'</span><button data-action="clearSource">Close preview</button></div>'+
				(source.image && !source.missing ? '<div class="preview"><img id="source-preview-image" class="source-image" alt="'+escape(source.path)+'"></div>' : '<p class="minor">'+(source.missing ? 'Source file is missing.' : 'No image preview for this file type.')+'</p>')+'</div>' : '')+
			'<label class="search">Filter source files<input id="source-filter" type="search" value="'+escape(state.filter)+'" placeholder="Search by path"></label>'+
			'<div class="source-list">'+sources.map(item =>
			{
				const users = bundle.resources.filter(resource => resource.source === item.path);
				return '<div class="source-row" data-source-path="'+escape(item.path)+'" '+(!item.path.toLowerCase().includes(state.filter.toLowerCase()) ? 'hidden' : '')+'>'+
					'<span aria-hidden="true">'+(item.image ? '▧' : '◇')+'</span><div class="source-title"><button class="link" data-source="'+escape(item.path)+'">'+escape(item.path)+'</button>'+ 
					'<small>'+(item.missing ? 'Missing source file' : users.length ? 'Registered as '+escape(users.map(resource => resource.name).join(', ')) : 'Unregistered')+'</small></div>'+
					'<button data-open-source="'+escape(item.path)+'" '+(item.missing ? 'disabled' : '')+'>Open file</button>'+
					(item.image && !item.missing ? '<button data-register-source="'+escape(item.path)+'">+ Register sprite</button>' : '')+'</div>';
			}).join('')+'</div>'+(!sources.length ? '<div class="empty"><h2>No source files</h2><p>Add a source folder to browse its files.</p></div>' : '');
	}

	function renderDialog()
	{
		const dialog = state.dialog;
		const type = window.ResourceStudioTypes.get(dialog.type);
		return '<form id="resource-form" class="dialog"><strong>Register a resource</strong><div class="pair">'+
			field('Type', '<select data-dialog="type">'+resourceTypes.filter(type => type.canCreate !== false && window.ResourceStudioTypes.get(type.type)?.canCreate !== false && window.ResourceStudioTypes.get(type.type)).map(type =>
				'<option value="'+escape(type.type)+'" '+(dialog.type === type.type ? 'selected' : '')+'>'+escape(type.label)+'</option>').join('')+'</select>')+
			(type?.renderCreateSource?.(dialog, helpers()) || field('Unique name', '<input data-dialog="name" value="'+escape(dialog.name)+'" required>'))+'</div>'+
			(window.ResourceStudioTypes.get(dialog.type)?.renderCreate?.(dialog, helpers()) || '')+
			'<div class="actions"><button type="submit" class="primary">Add resource</button><button type="button" data-action="cancel">Cancel</button></div></form>';
	}

	function selectResource(id)
	{
		const resource = bundle.resources.find(item => item.id === id);
		if(resource)
		{
			state.selected = id;
			state.tab = getSection(resource);
			state.dialog = null;
			error = '';
			render();
		}
	}

	function showDialog(type, source = '')
	{
		state.dialog = {type, source, name:source ? validation.deriveName(source, bundle.resources.map(resource => resource.name)) : '', paletteId:bundle.resources.find(item => item.type === 'palette')?.id || '', colorCount:256};
		error = '';
		render();
		root.querySelector('[data-dialog="name"]').focus();
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
				showDialog(resourceTypes.find(type => type.canCreate !== false && window.ResourceStudioTypes.get(type.type)?.canCreate !== false)?.type || 'sprite');
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

	root.addEventListener('input', function (event)
	{
		const element = event.target;
		if(element.dataset.dialog)
		{
			state.dialog[element.dataset.dialog] = element.value;
			if(element.dataset.dialog === 'source' && !state.dialog.name)
			{
				state.dialog.name = validation.deriveName(element.value, bundle.resources.map(resource => resource.name));
				render();
			}
		}
		if(element.id === 'source-filter')
		{
			state.filter = element.value;
			root.querySelectorAll('[data-source-path]').forEach(row => { row.hidden = !row.dataset.sourcePath.toLowerCase().includes(state.filter.toLowerCase()); });
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
			if(element.dataset.dialog === 'type' || element.dataset.dialog === 'paletteId')
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
				const error = validation.name(resource.name, bundle.resources.filter(item => item.id !== resource.id).map(item => item.name));
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
		const nameError = validation.name(name, bundle.resources.map(resource => resource.name));
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
			if(target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName))
			{
				return;
			}
			event.preventDefault();
		}
		if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')
		{
			event.preventDefault();
			if(root.contains(document.activeElement) && document.activeElement.dataset.key)
			{
				document.activeElement.blur();
			}
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
		if(message.type === 'update')
		{
			const initialLoad = !bundle;
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
			dirty = message.dirty;
			project = message.project;
			sourceWarning = message.sourceWarning;
			warnings = (message.warnings || []).map(displayMessage);
			selectedFolder = message.selectedFolder;
			state.busy = Boolean(message.busy);
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
				const resource = bundle.resources.find(item => item.source === message.selectedSource);
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
			render(preserveInput);
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
	});

	vscode.postMessage({type:'ready'});
}());
