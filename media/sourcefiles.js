/* Source-folder grouping and lazy file rows, separate from resource editors. */
(function ()
{
	function create(sources, bundle, escape, state)
	{
		const groups = new Map(), sprites = new Map();
		for(const resource of bundle.resources)
		{
			if(!['sprite', 'font', 'sound'].includes(resource.type)) { continue; }
			for(const source of new Set([resource.source, ...(resource.type === 'font' ? [resource.atlas] : [])]))
			{
				if(!sprites.has(source)) { sprites.set(source, []); }
				sprites.get(source).push(resource);
			}
		}
		for(const source of sources)
		{
			const slash = source.path.lastIndexOf('/'), folder = slash < 0 ? '.' : source.path.slice(0, slash);
			if(!groups.has(folder)) { groups.set(folder, []); }
			groups.get(folder).push(source);
		}
		function matches(item) { return item.path.toLowerCase().includes(state.filter.toLowerCase()); }
		function rows(items)
		{
			return items.filter(matches).map(item =>
			{
				const users = sprites.get(item.path) || [];
				return '<div class="source-row'+(users.length ? ' registered' : '')+'" data-source-path="'+escape(item.path)+'">'+
					'<span aria-hidden="true">'+(item.image ? '▧' : '◇')+'</span><div class="source-title"><button class="link" data-source="'+escape(item.path)+'">'+escape(item.path)+'</button>'+
					(item.missing ? '<small>Missing source file</small>' : '')+'</div>'+
					(!users.length ? '<button data-open-source="'+escape(item.path)+'" '+(item.missing ? 'disabled' : '')+'>Open file</button>' : '')+
					(users.length ? '<strong class="source-sprite-names">'+escape(users.map(resource => resource.name).join(', '))+'</strong>' : /\.(wav|mp3|ogg|flac)$/i.test(item.path) && !item.missing ? '<button data-register-sound="'+escape(item.path)+'">+ Add sound</button>' : item.image && !item.missing ? '<button data-register-source="'+escape(item.path)+'">+ Register sprite</button>' : '')+'</div>';
			}).join('');
		}
		function isOpen(folder, items) { return state.filter ? items.some(matches) : state.sourceGroupsOpen.includes(folder); }
		return {
			html:'<div class="source-list">'+[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([folder, items]) =>
				'<details class="source-group" data-source-folder="'+escape(folder)+'" '+(!items.some(matches) ? 'hidden' : '')+' '+(isOpen(folder, items) ? 'open' : '')+'><summary><span>'+escape(folder)+'</span><span class="minor">'+items.length+' files</span></summary><div class="source-group-files">'+(isOpen(folder, items) ? rows(items) : '')+'</div></details>').join('')+'</div>',
			toggle:function (element)
			{
				const folder = element.dataset?.sourceFolder, items = groups.get(folder);
				if(!items) { return; }
				const container = element.querySelector('.source-group-files');
				container.innerHTML = element.open ? rows(items) : '';
				if(!state.filter)
				{
					state.sourceGroupsOpen = state.sourceGroupsOpen.filter(item => item !== folder);
					if(element.open) { state.sourceGroupsOpen.push(folder); }
				}
			},
			filter:function (root)
			{
				root.querySelectorAll('[data-source-folder]').forEach(element =>
				{
					const items = groups.get(element.dataset.sourceFolder);
					element.hidden = !items.some(matches); element.open = isOpen(element.dataset.sourceFolder, items);
					element.querySelector('.source-group-files').innerHTML = element.open ? rows(items) : '';
				});
			}
		};
	}
	window.ResourceStudioSourceFiles = {create};
}());
