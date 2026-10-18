import * as crypto from 'crypto';
import { ResourceBundle, ResourceTypes, SpriteResource } from './ResourceBundle';
import * as ResourceValidation from '../media/resourcevalidation';

export interface SequenceMembership
{
	id:string;
	name:string;
	index:number;
}

export class SpriteSequences
{
	public static frames(bundle:ResourceBundle, id:string | undefined):SpriteResource[]
	{
		if(!id) { return []; }
		return (bundle.resources.filter(resource => resource.type === 'sprite' && (resource as SpriteResource).sequence?.id === id) as SpriteResource[])
			.sort((a, b) => a.sequence!.index - b.sequence!.index);
	}

	public static validate(bundle:ResourceBundle):string[]
	{
		const errors:string[] = [], groups = new Map<string,SpriteResource[]>();
		for(const resource of bundle.resources)
		{
			if(resource.type !== 'sprite' || resource.sequence === undefined) { continue; }
			const sprite = resource as SpriteResource, sequence = sprite.sequence;
			if(!sequence || typeof sequence.id !== 'string' || !sequence.id || ResourceValidation.name(sequence.name) || !Number.isInteger(sequence.index) || sequence.index < 0)
			{
				errors.push(resource.name+': Invalid sequence membership.'); continue;
			}
			const frames = groups.get(sequence.id) || []; frames.push(sprite); groups.set(sequence.id, frames);
		}
		const names = new Set(bundle.resources.map(resource => resource.name));
		for(const frames of groups.values())
		{
			frames.sort((a, b) => a.sequence!.index - b.sequence!.index);
			const name = frames[0].sequence!.name;
			if(names.has(name)) { errors.push('Sequence names must be unique across sequences and resources: '+name); }
			names.add(name);
			if(frames.some(frame => frame.sequence!.name !== name)) { errors.push('Some frames in animation "'+name+'" use a different animation name. All frames must belong to the same animation.'); }
			if(frames.some((frame, index) => frame.sequence!.index !== index)) { errors.push('Animation "'+name+'" has an invalid frame order. To delete frames, use "Remove selected frame" in the Animations tab so the remaining frames are reordered automatically.'); }
		}
		return errors;
	}

	public static aliasErrors(bundle:ResourceBundle):string[]
	{
		const errors:string[] = [], seen = new Set<string>();
		for(const sprite of bundle.resources as SpriteResource[])
		{
			if(sprite.type !== 'sprite' || !sprite.sequence || seen.has(sprite.sequence.id)) { continue; }
			seen.add(sprite.sequence.id);
			const error = ResourceValidation.animationName(sprite.sequence.name, ResourceValidation.usedNames(bundle.resources, undefined, sprite.sequence.id));
			if(error) { errors.push(error); }
		}
		return errors;
	}

	public static buildErrors(bundle:ResourceBundle):string[]
	{
		const errors = this.aliasErrors(bundle), seen = new Set<string>();
		for(const sprite of bundle.resources as SpriteResource[])
		{
			if(sprite.type !== 'sprite' || !sprite.sequence || seen.has(sprite.sequence.id)) { continue; }
			seen.add(sprite.sequence.id);
			if(this.frames(bundle, sprite.sequence.id).length < 2) { errors.push('Animation "'+sprite.sequence.name+'" needs at least two frames before it can be built. Add another frame in the Animations tab, or remove the animation.'); }
		}
		return errors;
	}

	public static usedNames(bundle:ResourceBundle):string[]
	{
		return ResourceValidation.usedNames(bundle.resources);
	}

	public static createFrames(bundle:ResourceBundle, name:string, sources:{source:string; width:number; height:number}[], rate:number, sequenceId?:string):SpriteResource[]
	{
		const id = sequenceId || crypto.randomBytes(16).toString('hex');
		const offset = this.frames(bundle, id).length, used = [...this.usedNames(bundle), name, name+'_end'];
		return sources.map((source, index) =>
		{
			const frameName = ResourceValidation.deriveName(name.slice(0, 17)+'_'+String(offset + index).padStart(3, '0'), used);
			used.push(frameName);
			const frame = ResourceTypes.get('sprite')!.create(crypto.randomBytes(16).toString('hex'), frameName, source.source) as SpriteResource;
			frame.sequence = {id, name, index:offset + index}; frame.frameRate = rate;
			frame.pivot = {x:source.width/2, y:source.height/2};
			return frame;
		});
	}
}
