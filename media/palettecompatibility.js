/* Palette slot zero is reserved by the resource builder and device engine. */
(function ()
{
	function issue(palette)
	{
		return palette.transparentIndex !== 0 || palette.colors[0].toLowerCase() !== '#00000000' || palette.mappingColors[0].toLowerCase() !== '#00000000' ?
			'Palette "'+palette.name+'" must reserve color 0 for transparency. Use "Reserve transparent color 0" in its palette controls before building.' : undefined;
	}
	function reserve(palette)
	{
		const colors = palette.colors.slice(), mapping = palette.mappingColors.slice();
		if(palette.transparentIndex !== null)
		{
			const index = palette.transparentIndex;
			[colors[0], colors[index]] = [colors[index], colors[0]];
			[mapping[0], mapping[index]] = [mapping[index], mapping[0]];
			colors[0] = mapping[0] = '#00000000';
		}
		else if(colors[0].toLowerCase() === '#00000000' && mapping[0].toLowerCase() === '#00000000') { /* Already has a transparent slot. */ }
		else
		{
			if(colors.length === 256)
			{
				const duplicate = colors.findIndex((color, index) => colors.slice(0, index).some((previous, first) => previous.toLowerCase() === color.toLowerCase() && mapping[first].toLowerCase() === mapping[index].toLowerCase()));
				if(duplicate < 0) { throw new Error('Palette "'+palette.name+'" uses all 256 entries. Reserving color 0 requires reducing it to 255 colors. Use "Rebuild palette" to regenerate it; this replaces manually edited colors.'); }
				colors.splice(duplicate, 1); mapping.splice(duplicate, 1);
			}
			colors.unshift('#00000000'); mapping.unshift('#00000000');
		}
		palette.colors = colors; palette.mappingColors = mapping; palette.transparentIndex = 0;
		palette.colorCount = Math.max(palette.colorCount, colors.length);
	}
	const compatibility = {issue, reserve};
	if(typeof module !== 'undefined' && module.exports) { module.exports = compatibility; }
	else { window.ResourceStudioPaletteCompatibility = compatibility; }
}());
