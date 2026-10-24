/* Sound authoring and a single shared preview player. No encoded assets are written. */
(function ()
{
	const validation = window.ResourceStudioSoundValidation, player = document.createElement('audio'); player.controls = true; player.preload = 'none';
	let h, rows = [], overlay, request = 0, preview, previewKey;
	const kb = value => Number.isFinite(value) ? (value/1024).toFixed(1)+' KB' : '—';
	const duration = value => Number.isFinite(value) ? value.toFixed(2)+' s' : '—';
	function issues(resource, info) { return validation.diagnostics(resource,h.bundle.resources,info,h.confirmedSounds.includes(resource.source)); }
	function diagnosticList(items)
	{
		return items.length ? '<ul class="sound-diagnostics">'+items.map(issue => '<li class="sound-'+issue.severity+'"><strong>'+({error:'Error',warning:'Warning',info:'Note'}[issue.severity])+':</strong> '+h.escape(issue.message)+'</li>').join('')+'</ul>' : '<p class="minor">No problems found.</p>';
	}
	function stop() { request++; player.pause(); player.removeAttribute('src'); player.load(); }
	function row(resource, helpers)
	{
		const info = helpers.soundData[resource.id], diagnostics = validation.diagnostics(resource,helpers.bundle.resources,info,helpers.confirmedSounds.includes(resource.source));
		const severity = diagnostics.some(d => d.severity === 'error') ? 'error' : diagnostics.some(d => d.severity === 'warning') ? 'warning' : 'ok';
		return '<div class="sound-library-row '+(resource.id === helpers.state.selected ? 'active' : '')+'"><button class="item" data-select="'+helpers.escape(resource.id)+'" aria-pressed="'+(resource.id === helpers.state.selected)+'"><span class="sound-status sound-'+severity+'" aria-label="'+(severity === 'ok' ? 'Sound' : severity)+'">'+({error:'!',warning:'⚠',ok:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2zM11 5a4 4 0 0 1 0 6M13 3a7 7 0 0 1 0 10"/></svg>'}[severity])+'</span><span>'+helpers.escape(resource.name || '(unnamed sound)')+'<small>'+duration(info?.duration)+'</small><small>'+kb(info?.estimatedSize)+' / 64 KB</small></span></button><button data-sound-play="'+helpers.escape(resource.id)+'" '+(info?.error ? 'disabled' : '')+' title="Play device preview" aria-label="Play '+helpers.escape(resource.name)+'">▶</button></div>';
	}
	function render(resource, helpers)
	{
		h = helpers;
		const info = resource ? h.soundData[resource.id] : undefined, diagnostics = resource ? issues(resource,info) : [], e = h.escape;
		return '<div class="heading"><strong>'+e(resource?.name || 'Sounds')+'</strong><span class="spacer"></span><button class="primary" data-sound-action="import">+ Add sounds…</button>'+ (resource ? '<button data-sound-action="delete">Remove</button>' : '')+'</div><div class="sound-workspace" data-sound-drop>'+
			(!resource ? '<div class="empty"><h2>No sounds yet</h2><p>Add WAV or MP3 files, or drop them here. Audio found under Source files can also be added.</p></div>' : '<div class="sound-detail"><div class="sound-center"><div class="preview-head"><span>Approximate device preview</span><span>Mono · 22,050 Hz</span></div><canvas class="sound-waveform" width="1000" height="220" aria-label="Device sound waveform"></canvas><div class="sound-peak"><span>Peak '+(Number.isFinite(info?.peakDb) ? info.peakDb.toFixed(1)+' dBFS' : '—')+'</span><meter min="-60" max="0" low="-40" high="-1" optimum="-12" value="'+Math.max(-60,Math.min(0,info?.peakDb ?? -60))+'" aria-label="Device signal peak"></meter></div><div class="sound-playback"><button class="primary" data-sound-play="'+e(resource.id)+'" '+(info?.error ? 'disabled' : '')+'>▶ Play</button><button data-sound-action="stop">Stop</button><label><input type="checkbox" data-sound-original> Original</label></div><div data-sound-player></div><p class="minor" data-sound-player-status role="status">Approximate: converted to mono at 22,050 Hz. MP3 encoding artefacts are not included.</p>'+diagnosticList(diagnostics)+
			'<p class="notice">The device plays one sound at a time. Starting another sound stops the previous one. Keep effects short; long ambience blocks other effects.</p></div><aside class="sound-inspector resource-inspector" aria-label="Sound properties">'+
			h.field('Name','<input data-sound-name value="'+e(resource.name)+'" spellcheck="false">')+'<p class="minor">Renaming requires updating app code that uses SND_'+e(resource.name)+'.</p><p data-sound-name-error role="status"></p><div class="rule"></div><div class="section-label">Source</div><p class="sound-path">'+e(resource.source)+'</p><div class="actions"><button data-sound-action="reveal">Reveal</button><button data-sound-action="replace">Replace source…</button></div><dl><dt>Duration</dt><dd>'+duration(info?.duration)+'</dd><dt>Format</dt><dd>'+e(info?.format || '—')+'</dd><dt>Sample rate</dt><dd>'+(info?.sampleRate ? (info.sampleRate/1000).toFixed(2)+' kHz' : '—')+'</dd><dt>Channels</dt><dd>'+(info?.channels === 1 ? 'Mono' : info?.channels === 2 ? 'Stereo' : '—')+'</dd><dt>File size</dt><dd>'+kb(info?.fileSize)+'</dd></dl><div class="rule"></div><div class="section-label">Device result</div><p>MP3 · 22,050 Hz · Mono · 32 kbps CBR</p><p>'+kb(info?.estimatedSize)+' / 64 KB (estimated)</p><meter class="sound-size" min="0" max="65536" low="49152" high="65535" optimum="0" value="'+Math.min(65536,info?.estimatedSize || 0)+'" aria-label="Estimated device size"></meter><p class="minor">Duration after resampling: '+duration(info?.duration)+'. Resource builds prepare device-format audio, including checking MP3 sources.</p><p class="minor">Playback volume is fixed on the device. Normalize the source file to adjust loudness.</p>'+ (diagnostics.some(issue => issue.code === 'S-012') ? '<button data-sound-action="keep">Keep both sounds</button>' : '')+'</aside></div>')+'</div>';
	}
	function mount(resource, helpers)
	{
		h = helpers; const main = h.main, slot = main.querySelector('[data-sound-player]'); if(slot) { slot.appendChild(player); }
		const waveform = main.querySelector('.sound-waveform'), info = h.soundData[resource?.id];
		if(waveform && info?.waveform)
		{
			const ctx = waveform.getContext('2d'), values = info.waveform; ctx.clearRect(0,0,waveform.width,waveform.height); ctx.strokeStyle = getComputedStyle(waveform).color; ctx.lineWidth = 1;
			values.forEach((value,i) => { const x = (i + .5)*waveform.width/values.length, height = Math.min(1,value)*95; ctx.beginPath(); ctx.moveTo(x,110 - height); ctx.lineTo(x,110 + height); ctx.stroke(); });
		}
		const name = main.querySelector('[data-sound-name]');
		if(name)
		{
			name.oninput = () => { const messages = validation.nameIssues({...resource,name:name.value},h.bundle.resources); main.querySelector('[data-sound-name-error]').textContent = messages.map(issue => issue.message).join(' '); };
			name.onchange = () => h.sendChange({action:'soundUpdate',id:resource.id,name:name.value});
		}
		const original = main.querySelector('[data-sound-original]');
		if(original)
		{
			original.onchange = () =>
			{
				const wasPlaying = !player.paused, source = h.sources.find(item => item.path === resource.source);
				stop();
				if(original.checked && source && !source.missing) { player.src = source.uri; }
				else if(preview && previewKey === source?.uri) { player.src = preview; }
				status(original.checked ? 'Original source preview.' : 'Approximate mono 22,050 Hz preview. MP3 encoding artefacts are not included.');
				if(wasPlaying) { main.querySelector('.sound-playback [data-sound-play]').click(); }
			};
		}
		main.ondragover = event => { if(event.dataTransfer?.types.includes('Files') || event.dataTransfer?.types.includes('text/uri-list')) { event.preventDefault(); } };
		main.ondrop = async event =>
		{
			event.preventDefault();
			const uris = (event.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).filter(uri => uri && !uri.startsWith('#'));
			const files = uris.length ? uris.map(uri => ({uri,name:decodeURIComponent(uri.split('/').pop())})) : await Promise.all(Array.from(event.dataTransfer.files).map(async file => file.path ? {path:file.path,name:file.name} : {name:file.name,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))}));
			if(files.length) { h.postMessage({type:'soundImport',files}); }
		};
		return () => { stop(); if(name) { name.oninput = name.onchange = null; } if(original) { original.onchange = null; } main.ondragover = main.ondrop = null; };
	}
	function selected() { return h.bundle.resources.find(item => item.id === h.state.selected && item.type === 'sound'); }
	function updateReview()
	{
		if(!overlay) { return; }
		const selectedRows = rows.filter(row => row.include), resources = [...h.bundle.resources,...selectedRows.map(row => ({...row,name:row.name}))]; let invalid = !selectedRows.length;
		for(const row of rows)
		{
			const diagnostics = validation.diagnostics(row,resources,row.info,rows.some(item => item.include && item.source === row.source && item.keepBoth)), container = overlay.querySelector('[data-sound-review-diagnostics="'+row.token+'"]');
			container.innerHTML = diagnosticList(diagnostics);
			const keep = overlay.querySelector('[data-sound-review-keep="'+row.token+'"]'); keep.parentElement.hidden = !resources.some(item => item.type === 'sound' && item.id !== row.id && item.source === row.source);
			if(row.include && diagnostics.some(issue => issue.severity === 'error')) { invalid = true; }
		}
		overlay.querySelector('[data-sound-review-confirm]').disabled = invalid;
	}
	function review(incoming)
	{
		rows = incoming.map(row => { const previous = rows.find(item => item.token === row.token); return {...row,name:previous?.name ?? row.name,include:previous?.include ?? true,keepBoth:previous?.keepBoth || false}; });
		overlay?.remove(); overlay = document.createElement('div'); overlay.className = 'sound-modal'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label','Review sound import');
		overlay.innerHTML = '<section class="sound-review"><h2>Review sounds</h2><p>Device limit: 64 KB per sound (about 16 seconds). Only one sound plays at a time.</p><p data-sound-review-error class="sound-error" role="alert"></p><div class="sound-review-list">'+rows.map(row => '<article data-sound-review-row="'+row.token+'"><label class="check"><input type="checkbox" data-sound-review-include="'+row.token+'" '+(row.include ? 'checked' : '')+'> '+h.escape(row.filename)+'</label><label>Name<input data-sound-review-name="'+row.token+'" value="'+h.escape(row.name)+'" spellcheck="false"></label><p>'+duration(row.info.duration)+' · '+(row.info.sampleRate ? (row.info.sampleRate/1000).toFixed(2)+' kHz '+(row.info.channels === 1 ? 'mono' : 'stereo')+' '+h.escape(row.info.format) : 'Format unavailable')+' · '+kb(row.info.estimatedSize)+' / 64 KB</p><div data-sound-review-diagnostics="'+row.token+'"></div><label class="check"><input type="checkbox" data-sound-review-keep="'+row.token+'" '+(row.keepBoth ? 'checked' : '')+'> Keep both if this source is already used</label>'+(row.canCopy ? '<button data-sound-copy="'+row.token+'">Copy into project folder…</button>' : '')+'</article>').join('')+'</div><div class="actions"><button data-sound-review-cancel>Cancel</button><button class="primary" data-sound-review-confirm>Import selected sounds</button></div></section>';
		document.body.appendChild(overlay);
		overlay.oninput = event =>
		{
			const element = event.target, token = element.dataset.soundReviewName || element.dataset.soundReviewInclude || element.dataset.soundReviewKeep, row = rows.find(row => row.token === token); if(!row) { return; }
			if(element.dataset.soundReviewName) { row.name = element.value; } else if(element.dataset.soundReviewInclude) { row.include = element.checked; } else { row.keepBoth = element.checked; }
			updateReview();
		};
		overlay.onclick = event =>
		{
			const button = event.target.closest('button'); if(!button || button.disabled) { return; }
			if(button.hasAttribute('data-sound-review-cancel')) { overlay.remove(); overlay = undefined; rows = []; }
			else if(button.dataset.soundCopy) { h.postMessage({type:'soundCopy',token:button.dataset.soundCopy}); }
			else if(button.hasAttribute('data-sound-review-confirm')) { h.state.selected = rows.find(row => row.include).id; h.state.tab = 'Sounds'; h.saveState(); h.sendChange({action:'soundConfirm',rows:rows.filter(row => row.include).map(row => ({token:row.token,name:row.name,keepBoth:row.keepBoth}))}); }
		};
		overlay.onkeydown = event => { if(event.key === 'Escape') { overlay.querySelector('[data-sound-review-cancel]').click(); }
			if(event.key === 'Tab') { const inputs = [...overlay.querySelectorAll('input,button')].filter(input => !input.disabled && input.getClientRects().length), first = inputs[0], last = inputs[inputs.length - 1]; if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } };
		updateReview(); overlay.querySelector('input')?.focus();
	}
	document.addEventListener('click',function (event)
	{
		if(!h || !h.root.contains(event.target)) { return; }
		const button = event.target.closest('button'); if(!button || button.disabled) { return; }
		if(button.dataset.registerSound) { h.postMessage({type:'soundImport',source:button.dataset.registerSound}); return; }
		if(button.dataset.soundPlay)
		{
			const id = button.dataset.soundPlay; if(h.state.selected !== id) { h.selectResource(id); }
			const sound = h.bundle.resources.find(item => item.id === id), original = h.main.querySelector('[data-sound-original]')?.checked; if(!sound) { return; }
			stop();
			if(original) { const source = h.sources.find(item => item.path === sound.source); if(source && !source.missing) { player.src = source.uri; player.play().catch(error => status(error.message)); } }
			else
			{
				const key = h.sources.find(item => item.path === sound.source)?.uri;
				if(preview && previewKey === key) { player.src = preview; player.play().catch(error => status(error.message)); }
				else { h.postMessage({type:'soundPreview',id,requestId:++request}); status('Preparing device preview…'); }
			}
			return;
		}
		const action = button.dataset.soundAction, sound = selected();
		if(action === 'import') { h.postMessage({type:'soundImport'}); }
		else if(action === 'stop') { stop(); }
		else if(sound && action === 'reveal') { h.postMessage({type:'soundReveal',id:sound.id}); }
		else if(sound && action) { const actions = {replace:'soundReplace',delete:'soundRemove',keep:'soundKeepBoth'}; if(actions[action]) { h.sendChange({action:actions[action],id:sound.id}); } }
	});
	function status(message) { const element = h?.main.querySelector('[data-sound-player-status]'); if(element) { element.textContent = message; } }
	player.onerror = () => status('Unable to play this version. Try the device preview or check the source file.');
	window.addEventListener('message',event =>
	{
		const message = event.data;
		if(message.type === 'error' && overlay) { overlay.querySelector('[data-sound-review-error]').textContent = message.message; updateReview(); }
		if(message.type === 'soundReview') { review(message.rows); }
		if(message.type === 'soundPreview' && message.requestId === request && selected()?.id === message.id)
		{
			if(message.error || !message.preview) { status(message.error || 'Sound preview unavailable.'); return; }
			preview = message.preview; previewKey = h.sources.find(item => item.path === selected().source)?.uri; player.src = preview;
			player.play().then(() => status('Approximate mono 22,050 Hz preview. MP3 encoding artefacts are not included.')).catch(() => status('Preview ready. Press Play to listen.'));
		}
		if(message.type === 'update' && overlay && !message.busy)
		{
			if(rows.some(row => message.bundle.resources.some(resource => resource.id === row.id))) { overlay.remove(); overlay = undefined; rows = []; }
		}
	});
	window.ResourceStudioSounds = {render,mount,row,setHelpers:helpers => { h = helpers; }};
	window.ResourceStudioTypes.register({type:'sound',label:'Sound',section:'Sounds',icon:'♫',canCreate:true,renderLibraryItem:row,renderWorkspace:render,mountPreview:mount});
}());
