/* Converted map textures survive editor refreshes; source URIs include file revisions. */
(function ()
{
	const entries = new Map(), queue = [];
	const limit = 128*1024*1024;
	let bytes = 0, running = 0;
	function trim()
	{
		for(const [key, entry] of entries)
		{
			if(bytes <= limit) { break; }
			if(entry.value) { entries.delete(key); bytes -= entry.bytes; }
		}
	}
	function pump()
	{
		while(running < 4 && queue.length)
		{
			const task = queue.shift(); running++;
			Promise.resolve().then(task.work).then(task.resolve, task.reject).finally(() => { running--; pump(); });
		}
	}
	function loadImage(source)
	{
		return new Promise((resolve, reject) =>
		{
			if(!source || source.missing) { reject(new Error('Source image is missing.')); return; }
			const image = new Image(); image.crossOrigin = 'anonymous';
			image.onload = () => { image.onload = image.onerror = null; resolve(image); };
			image.onerror = () => { image.onload = image.onerror = null; reject(new Error('Unable to decode image.')); };
			image.src = source.uri;
		});
	}
	function get(key, work)
	{
		if(entries.has(key))
		{
			const entry = entries.get(key); entries.delete(key); entries.set(key, entry); return entry;
		}
		const entry = {};
		entry.promise = new Promise((resolve, reject) => { queue.push({work, resolve, reject}); }).then(value =>
		{
			entry.value = value; entry.bytes = value.width*value.height*4; bytes += entry.bytes; trim(); return value;
		}, error => { entries.delete(key); throw error; });
		entries.set(key, entry); pump(); return entry;
	}
	function texture(sprite, source, palette)
	{
		const key = JSON.stringify(['sprite', source?.uri, source?.missing, sprite.colorMode, sprite.blend, sprite.dither, sprite.compression, sprite.softkey,
			palette?.colors, palette?.mappingColors, palette?.transparentIndex]);
		return get(key, async () =>
		{
			if(sprite.colorMode === 'rgb6666') { throw new Error('RGB6666 is not supported.'); }
			const image = await loadImage(source);
			if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 240 || image.naturalHeight > 240) { throw new Error('Sprite must be a PNG no larger than 240 × 240.'); }
			const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
			const ctx = canvas.getContext('2d', {willReadFrequently:true}); ctx.drawImage(image, 0, 0);
			const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
			window.ResourceStudioPixels.convert(pixels.data, canvas.width, sprite, palette); ctx.putImageData(pixels, 0, 0);
			return {canvas, width:canvas.width, height:canvas.height};
		});
	}
	function background(source)
	{
		return get(JSON.stringify(['background', source?.uri, source?.missing]), async () =>
		{
			const image = await loadImage(source); return {image, width:image.naturalWidth, height:image.naturalHeight};
		});
	}
	window.ResourceStudioMapTextures = {texture, background};
}());
