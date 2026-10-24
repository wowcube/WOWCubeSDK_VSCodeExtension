/* Sound diagnostics are separate from structural JSON validation and never prevent saving. */
(function ()
{
	const reserved = ['zero','0','pal','icon','none','last','bmp_none','bmp_last','bmp_0','map_none','map_last'];
	function validName(name) { return typeof name === 'string' && /^[a-z0-9_]{1,23}$/.test(name) && !reserved.includes(name) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(name) && !/^font_\d+_\d{5}$/.test(name); }
	function nameIssues(sound, resources)
	{
		const issues = [], add = (code,message) => issues.push({code,severity:'error',message});
		if(!validName(sound.name)) { add('S-004','“'+sound.name+'” is not a valid sound name. Use up to 23 lowercase letters, digits or underscores, and avoid reserved names.'); }
		const other = resources.find(item => item.id !== sound.id && item.name === sound.name);
		const animation = resources.find(item => item.type === 'sprite' && item.sequence && [item.sequence.name,item.sequence.name+'_end'].includes(sound.name));
		if(other || animation) { add('S-005','“'+sound.name+'” is already used by '+(other ? other.type+' “'+other.name+'”' : 'animation “'+animation.sequence.name+'”')+'. Choose another name.'); }
		return issues;
	}
	function deriveName(source, used = [])
	{
		const stem = source.split(/[\\/]/).pop().replace(/\.[^.]*$/,'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,23), base = stem;
		let name = base;
		for(let i = 2; !validName(name) || used.includes(name); i++) { const suffix = '_'+i; name = base.slice(0,23 - suffix.length)+suffix; }
		return name;
	}
	function sourceIssues(sound)
	{
		return typeof sound.source !== 'string' || !sound.source || sound.source.startsWith('/') || /[\\:\r\n]/.test(sound.source) || sound.source.split('/').some(part => !part || part === '..' || part === '.') ? [{code:'S-003',severity:'error',message:'“'+sound.name+'”: the source must be inside the project folder.'}] : [];
	}
	function diagnostics(sound, resources, info, confirmed = false)
	{
		const issues = [...nameIssues(sound,resources), ...sourceIssues(sound)];
		const add = (code,severity,message) => issues.push({code,severity,message});
		if(info?.error) { if(!issues.some(issue => issue.code === info.code)) { add(info.code || 'S-002','error',sound.name+': '+info.error); } }
		else if(info)
		{
			const size = Math.ceil(Math.ceil(info.duration*22050/576)*104.5), kb = (size/1024).toFixed(1);
			if(size > 65536) { add('S-006','error',sound.name+': about '+kb+' KB after conversion. The device plays sounds up to 64 KB (about 16 seconds).'); }
			else if(size > 49152) { add('S-007','warning',sound.name+': about '+kb+' KB, close to the 64 KB limit.'); }
			if(info.duration < .05 || info.peakDb < -60) { add('S-008','warning',sound.name+': the sound is empty or nearly silent.'); }
			if(info.peakDb >= 0) { add('S-009','warning',sound.name+': clips after conversion to mono. Lower the source level.'); }
			if(info.leadingSilence > .1) { add('S-010','info',sound.name+': starts with '+Math.round(info.leadingSilence*1000)+' ms of silence; playback may feel late.'); }
			if(info.channels === 2) { add('S-011','info',sound.name+': stereo source; the device plays it as mono.'); }
		}
		const duplicate = resources.find(item => item.type === 'sound' && item.id !== sound.id && item.source === sound.source);
		if(duplicate && !confirmed) { add('S-012','error',sound.name+' and '+duplicate.name+' use the same source file. Choose “Keep both” to confirm.'); }
		return issues;
	}
	const validation = {validName,nameIssues,deriveName,sourceIssues,diagnostics};
	if(typeof module !== 'undefined' && module.exports) { module.exports = validation; } else { window.ResourceStudioSoundValidation = validation; }
}());
