/* Shared sprite color conversion for sprite and map previews. */
(function ()
{
	function rgb565Preview(data, width, dither, softkey)
	{
		const errors = dither ? new Float32Array(data.length) : null;
		const key = softkey ? [0, 1, 2].map(channel => Math.floor((parseInt(softkey.key.slice(1 + channel*2, 3 + channel*2), 16)*(channel === 1 ? 63 : 31) + 127)/255)) : null;
		for(let i = 0; i < data.length; i += 4)
		{
			let keyedOut = Boolean(key);
			for(let channel = 0; channel < 3; channel++)
			{
				const value = Math.max(0, Math.min(255, data[i + channel] + (errors?.[i + channel] || 0)));
				const levels = channel === 1 ? 63 : 31;
				const quantized = Math.floor((value*levels + 127)/255);
				if(key && Math.abs(quantized - key[channel]) > softkey.threshold*(channel === 1 ? 2 : 1)) { keyedOut = false; }
				const expanded = channel === 1 ? (quantized << 2) | (quantized >> 4) : (quantized << 3) | (quantized >> 2);
				data[i + channel] = expanded;
				if(errors)
				{
					const error = value - expanded;
					const x = (i/4)%width;
					if(x + 1 < width) { errors[i + 4 + channel] += error*7/16; }
					if(i + width*4 < data.length)
					{
						if(x > 0) { errors[i + (width - 1)*4 + channel] += error*3/16; }
						errors[i + width*4 + channel] += error*5/16;
						if(x + 1 < width) { errors[i + (width + 1)*4 + channel] += error/16; }
					}
				}
			}
			// Plain RGB565 has no alpha channel or transparent palette index.
			data[i + 3] = keyedOut ? 0 : 255;
		}
	}
	function colorChannels(color)
	{
		return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16),
			color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255];
	}
	function paletteChannels(resource, index)
	{
		const channels = colorChannels(resource.colors[index]);
		if(index === 0) { channels[3] = 0; }
		return channels;
	}
	function convert(data, width, resource, palette)
	{
		if(resource.colorMode === 'rgb565') { rgb565Preview(data, width, resource.dither, resource.compression === 'softkey' ? resource.softkey : null); return; }
		if(resource.colorMode !== 'palette' || !palette) { return; }
		const mappingColors = palette.mappingColors.map(colorChannels);
		const paletteAlpha = ['alpha', 'additive'].includes(resource.blend);
		const colors = palette.colors.map((color, index) => paletteChannels(palette, index));
		const indices = new Int16Array(data.length/4).fill(-1);
		const cache = new Map();
		for(let i = 0; i < data.length; i += 4)
		{
			if(data[i + 3] === 0)
			{
				indices[i/4] = 0;
				continue;
			}
			const alpha = paletteAlpha ? data[i + 3] : 255;
			const key = (data[i]*65536 + data[i + 1]*256 + data[i + 2])*256 + alpha;
			let index = cache.get(key);
			if(index === undefined)
			{
				let distance = Infinity;
				index = 0;
				mappingColors.forEach((color, j) =>
				{
					if(j === 0) { return; }
					const current = (data[i] - color[0])**2 + (data[i + 1] - color[1])**2 + (data[i + 2] - color[2])**2 + (paletteAlpha ? (alpha - color[3])**2 : 0);
					if(current < distance) { distance = current; index = j; }
				});
				cache.set(key, index);
			}
			indices[i/4] = index;
			data[i] = colors[index][0]; data[i + 1] = colors[index][1]; data[i + 2] = colors[index][2];
			data[i + 3] = index === 0 ? 0 : paletteAlpha ? colors[index][3] : 255;
		}
		return indices;
	}
	const pixels = {convert, rgb565Preview, colorChannels, paletteChannels};
	if(typeof module !== 'undefined' && module.exports) { module.exports = pixels; }
	else { window.ResourceStudioPixels = pixels; }
}());
