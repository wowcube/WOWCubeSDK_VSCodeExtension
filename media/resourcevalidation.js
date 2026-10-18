(function ()
{
	const reservedNames = ['zero', '0', 'pal', 'icon', 'bmp_none', 'bmp_last', 'bmp_0', 'map_none', 'map_last'];
	const validation = {
		maxPalettes:64,
		name:function (name, used = [])
		{
			if(typeof name !== 'string' || !/^[a-z0-9_]+$/.test(name)) { return 'V-001: Names may use only a-z, 0-9 and _.'; }
			if(name.length > 23) { return 'V-002: "'+name+'" is '+name.length+' characters; the limit is 23.'; }
			if(reservedNames.includes(name)) { return 'V-003: "'+name+'" is reserved.'; }
			if(used.includes(name)) { return 'V-004: the name "'+name+'" is already used.'; }
		},
		deriveName:function (filename, used = [])
		{
			const base = filename.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase().replace(/[ -]/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 23) || 'sprite';
			let name = base;
			for(let index = 1; reservedNames.includes(name) || used.includes(name); index++)
			{
				const suffix = '_'+index;
				name = base.slice(0, 23 - suffix.length)+suffix;
			}
			return name;
		},
		usedNames:function (resources, excludeResource, excludeSequence)
		{
			const used = resources.filter(item => item.id !== excludeResource).map(item => item.name);
			for(const item of resources)
			{
				if(item.type === 'sprite' && item.sequence && item.sequence.id !== excludeSequence) { used.push(item.sequence.name, item.sequence.name+'_end'); }
			}
			return used;
		},
		animationName:function (name, used = [])
		{
			if(['none', 'last'].includes(name)) { return 'Animation name "'+name+'" is reserved by the engine. Choose another name.'; }
			return validation.name(name, used) || (used.includes(name+'_end') ? 'Animation "'+name+'" would create a reserved or already used identifier "'+name+'_end". Choose another name.' : undefined);
		},
		deriveAnimationName:function (base, used = [])
		{
			const reserved = used.slice(); let name = validation.deriveName(base, reserved);
			while(validation.animationName(name, used)) { reserved.push(name); name = validation.deriveName(base, reserved); }
			return name;
		},
		paletteName:function (name)
		{
			return name.slice(0, 15)+'_palette';
		},
		integer:function (value, min, max, code, label)
		{
			if(!Number.isInteger(value) || value < min || value > max) { return code+': '+label+' must be an integer from '+min+' to '+max+'.'; }
		},
		paletteSize:function (size)
		{
			return validation.integer(size, 2, 256, 'V-015', 'Palette size');
		},
		quantizePaletteColor:function (color)
		{
			if(typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))
			{
				throw new Error('Use a six-digit hex color or eight-digit RGBA color, for example #347e98ff.');
			}
			let result = '#';
			for(let offset = 1; offset < color.length; offset += 2)
			{
				const shift = offset === 3 ? 2 : 3;
				const value = parseInt(color.slice(offset, offset + 2), 16) >> shift;
				const expanded = (value << shift) | (value >> (8 - shift*2));
				result += expanded.toString(16).padStart(2, '0');
			}
			return result;
		},
		collider:function (collider, width, height)
		{
			if([collider.x, collider.y, collider.width, collider.height].some(value => !Number.isFinite(value) || value < 0) || collider.x + collider.width > width || collider.y + collider.height > height)
			{
				return 'Collider must stay within the sprite ('+width+' × '+height+' pixels).';
			}
		},
		clampCollider:function (collider, width, height)
		{
			const x = Math.max(0, Math.min(width, collider.x));
			const y = Math.max(0, Math.min(height, collider.y));
			return {...collider, x, y, width:Math.max(0, Math.min(width - x, collider.width)), height:Math.max(0, Math.min(height - y, collider.height))};
		}
	};
	if(typeof module !== 'undefined' && module.exports) { module.exports = validation; }
	else { window.ResourceStudioValidation = validation; }
}());
