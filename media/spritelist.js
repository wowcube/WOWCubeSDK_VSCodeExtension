/* Shared animation grouping for sprite libraries. Expansion is editor state only. */
(function ()
{
	function render(items, renderItem, scope, state, escape)
	{
		const groups = new Map();
		for(const item of items)
		{
			if(!item.sequence) { continue; }
			if(!groups.has(item.sequence.id)) { groups.set(item.sequence.id, []); }
			groups.get(item.sequence.id).push(item);
		}
		const emitted = new Set(), open = state.spriteGroupsOpen?.[scope] || [];
		return items.map(item =>
		{
			if(!item.sequence) { return renderItem(item); }
			const id = item.sequence.id;
			if(emitted.has(id)) { return ''; }
			emitted.add(id);
			const frames = groups.get(id).sort((a, b) => a.sequence.index - b.sequence.index);
			return '<details class="sprite-group" data-sprite-group="'+escape(id)+'" data-sprite-group-scope="'+escape(scope)+'" '+(open.includes(id) ? 'open' : '')+'><summary>'+escape(item.sequence.name)+
				'<span class="sprite-group-count">'+frames.length+' '+(frames.length === 1 ? 'sprite' : 'sprites')+'</span></summary><div class="sprite-group-items">'+frames.map(renderItem).join('')+'</div></details>';
		}).join('');
	}
	function toggle(element, state)
	{
		const id = element.dataset.spriteGroup, scope = element.dataset.spriteGroupScope;
		state.spriteGroupsOpen ||= {};
		state.spriteGroupsOpen[scope] = (state.spriteGroupsOpen[scope] || []).filter(value => value !== id);
		if(element.open) { state.spriteGroupsOpen[scope].push(id); }
	}
	window.ResourceStudioSpriteList = {render, toggle};
}());
