import * as ResourceValidation from '../media/resourcevalidation';
import { mapResourceType } from './MapResource';

export interface Resource
{
	id:string;
	name:string;
	type:string;
	[key:string]:unknown;
}

export interface PaletteResource extends Resource
{
	type:'palette';
	colors:string[];
	mappingColors:string[];
	colorCount:number;
	transparentIndex:number | null;
}

export interface SpriteResource extends Resource
{
	type:'sprite';
	source:string;
	paletteId:string | null;
	colorMode:'palette' | 'rgb565' | 'rgb6666';
	blend:'opaque' | 'alpha' | 'additive' | 'bg' | 'bump' | 'dudv' | 'refl';
	fullsize:boolean;
	dither:boolean;
	compression:'plain' | 'softkey' | null;
	softkey?:{key:string; threshold:number} | null;
	number:number;
	frameRate:number;
	group:string | null;
	objectType:string | null;
	tags:string[];
	pivot:{x:number; y:number} | null;
	collider:{enabled:boolean; x:number; y:number; width:number; height:number};
}

export interface ResourceBundle
{
	schemaVersion:2;
	sourceFolders:string[];
	resources:Resource[];
	registries:{groups:string[]; types:string[]; tags:string[]; [key:string]:unknown};
	[key:string]:unknown;
}

// These modes are preserved for future support but never offered by the editor.
export const hiddenSpriteModes = {color:['rgb6666'], blend:['bump', 'dudv', 'refl']} as const;

export interface ResourceType
{
	type:string;
	label:string;
	canCreate?:boolean;
	getPaletteSource?:(resource:Resource) => string | undefined;
	create:(id:string, name:string, source?:string, options?:Record<string,unknown>) => Resource;
	validate:(resource:Resource, bundle:ResourceBundle) => string[];
	getReferences:(resource:Resource) => string[];
}

function isNumber(value:unknown, min:number, max:number = Infinity):boolean
{
	return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// All paths are relative to the bundle's project folder, including source folders.
export function isResourcePath(value:unknown, allowRoot:boolean = false):value is string
{
	return typeof value === 'string' && (allowRoot && value === '.' ||
		value.length > 0 && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') &&
		!value.split('/').some(part => part === '..' || part === '.' || part.length === 0));
}

export class ResourceTypes
{
	private static types:Map<string,ResourceType> = new Map<string,ResourceType>();

	public static register(resourceType:ResourceType):void
	{
		if(this.types.has(resourceType.type))
		{
			throw new Error('Resource type is already registered: '+resourceType.type);
		}
		this.types.set(resourceType.type, resourceType);
	}

	public static get(type:string):ResourceType | undefined
	{
		return this.types.get(type);
	}

	public static getAll():ResourceType[]
	{
		return Array.from(this.types.values());
	}
}

ResourceTypes.register({
	type:'palette',
	label:'Palette',
	canCreate:false,
	create:(id, name):PaletteResource => ({id, name, type:'palette', colors:['#000000', '#ffffff'], mappingColors:['#000000', '#ffffff'], colorCount:256, transparentIndex:null}),
	getReferences:() => [],
	validate:(resource) =>
	{
		const errors:string[] = [];
		const colors = resource.colors;
		if(ResourceValidation.paletteSize(resource.colorCount))
		{
			errors.push(ResourceValidation.paletteSize(resource.colorCount)!);
		}
		if(!Array.isArray(colors) || colors.length < 1 || colors.length > 256 ||
			colors.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)))
		{
			errors.push('Palette must contain 1–256 colors in #RRGGBB or #RRGGBBAA format.');
		}
		if(Array.isArray(colors) && typeof resource.colorCount === 'number' && colors.length > resource.colorCount)
		{
			errors.push('V-015: Palette colors exceed the requested palette size.');
		}
		if(resource.transparentIndex !== null && (!Number.isInteger(resource.transparentIndex) ||
			!isNumber(resource.transparentIndex, 0, Array.isArray(colors) ? colors.length - 1 : -1)))
		{
			errors.push('Transparent index must be null or a valid palette index.');
		}
		if((!Array.isArray(resource.mappingColors) || !Array.isArray(colors) ||
			resource.mappingColors.length !== colors.length || resource.mappingColors.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))))
		{
			errors.push('Palette mapping colors must contain one valid RGB or RGBA color per palette entry.');
		}
		return errors;
	}
});

ResourceTypes.register({
	type:'sprite',
	label:'Sprite',
	getPaletteSource:(resource) => resource.colorMode === 'palette' && typeof resource.source === 'string' ? resource.source : undefined,
	create:(id, name, source = '', options = {}):SpriteResource => ({
		id, name, type:'sprite', source, colorMode:options.colorMode === 'rgb565' ? 'rgb565' : 'palette',
		paletteId:options.colorMode !== 'rgb565' && typeof options.paletteId === 'string' && options.paletteId ? options.paletteId : null,
		blend:options.colorMode === 'rgb565' ? 'opaque' : 'alpha', fullsize:false, dither:false, compression:options.colorMode === 'rgb565' ? 'plain' : null, softkey:null,
		number:0, frameRate:1, group:null, objectType:null, tags:[],
		pivot:null, collider:{enabled:false, x:0, y:0, width:0, height:0}
	}),
	getReferences:(resource) => typeof resource.paletteId === 'string' ? [resource.paletteId] : [],
	validate:(resource, bundle) =>
	{
		const errors:string[] = [];
		if(!isResourcePath(resource.source))
		{
			errors.push('V-006: Sprite source must be a project-relative PNG file path.');
		}
		else if(!/\.png$/i.test(resource.source as string)) { errors.push('V-006: Sprite sources must be PNG files.'); }
		if(resource.colorMode === 'palette' && !bundle.resources.some(item => item.id === resource.paletteId && item.type === 'palette'))
		{
			errors.push('V-014: Sprite palette must reference an existing palette.');
		}
		if(typeof resource.colorMode !== 'string' || !['palette', 'rgb565', ...hiddenSpriteModes.color].includes(resource.colorMode))
		{
			errors.push('Unknown sprite color mode.');
		}
		if(typeof resource.blend !== 'string' || !['opaque', 'alpha', 'additive', 'bg', ...hiddenSpriteModes.blend].includes(resource.blend))
		{
			errors.push('Unknown sprite blend mode.');
		}
		if(resource.colorMode === 'rgb565' && (resource.paletteId !== null || resource.blend !== 'opaque'))
		{
			errors.push('V-019: RGB565 sprites require Opaque blend and no palette.');
		}
		if(resource.colorMode !== 'rgb565' && resource.dither) { errors.push('Dithering is available only for RGB565.'); }
		for(const key of ['fullsize', 'dither'])
		{
			if(typeof resource[key] !== 'boolean') { errors.push(key+' must be a boolean.'); }
		}
		if(resource.colorMode === 'rgb565' ? !['plain', 'softkey'].includes(resource.compression as string) : resource.compression !== null)
		{
			errors.push('V-020: RGB565 requires Plain or Softkey encoding; other color modes must leave compression unset.');
		}
		const softkey = resource.softkey as SpriteResource['softkey'];
		if(resource.compression === 'softkey' && (!softkey || typeof softkey.key !== 'string' || !/^#[0-9a-f]{6}$/i.test(softkey.key) || ResourceValidation.integer(softkey.threshold, 0, 255, 'V-020', 'Softkey threshold')))
		{
			errors.push('V-020: Softkey requires a #RRGGBB color and an integer threshold from 0 to 255.');
		}
		if(resource.compression !== 'softkey' && softkey != null) { errors.push('V-020: Softkey settings require Softkey encoding.'); }
		for(const [key, min, max] of [['number', -32768, 32767], ['frameRate', 1, 127]] as const)
		{
			if(!Number.isInteger(resource[key]) || !isNumber(resource[key], min, max))
			{
				errors.push(ResourceValidation.integer(resource[key], min, max, key === 'number' ? 'V-011' : 'V-010', key)!);
			}
		}
		for(const [key, registry] of [['group', 'groups'], ['objectType', 'types']] as const)
		{
			if(resource[key] !== null && !bundle.registries[registry].includes(resource[key] as string))
			{
				errors.push('V-013: Sprite references an unknown '+key+'.');
			}
		}
		if(!Array.isArray(resource.tags) || new Set(resource.tags).size !== resource.tags.length || resource.tags.some(tag => !bundle.registries.tags.includes(tag)))
		{
			errors.push('V-013: Sprite tags must reference registered tags.');
		}
		const pivot = resource.pivot as SpriteResource['pivot'];
		if(pivot !== null && (!pivot || ![pivot.x, pivot.y].every(value => typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value*2))))
		{
			errors.push('V-009: Pivot coordinates must be finite multiples of 0.5 in source pixels, or null for center.');
		}
		const collider = resource.collider as SpriteResource['collider'] | undefined;
		if(!collider || typeof collider.enabled !== 'boolean' ||
			![collider.x, collider.y, collider.width, collider.height].every(value => isNumber(value, 0)))
		{
			errors.push('Collider coordinates and dimensions must be finite, nonnegative numbers.');
		}
		return errors;
	}
});

ResourceTypes.register(mapResourceType);

export class ResourceBundles
{
	public static create():ResourceBundle
	{
		return {schemaVersion:2, sourceFolders:[], resources:[], registries:{groups:[], types:[], tags:[]}};
	}

	public static parse(text:string):ResourceBundle
	{
		const bundle = JSON.parse(text);
		const errors = this.validate(bundle);
		if(errors.length > 0)
		{
			throw new Error(errors.join('\n'));
		}
		return bundle;
	}

	public static validate(value:unknown):string[]
	{
		if(!value || typeof value !== 'object' || Array.isArray(value))
		{
			return ['Resource bundle must be a JSON object.'];
		}
		const bundle = value as ResourceBundle;
		if(bundle.schemaVersion !== 2)
		{
			return ['Unsupported resource bundle schema version. Expected 2. Create a new resource bundle.'];
		}
		if(!Array.isArray(bundle.sourceFolders) || !bundle.sourceFolders.every(folder => isResourcePath(folder, true)))
		{
			return ['Source folders must be project-relative paths.'];
		}
		if(!Array.isArray(bundle.resources))
		{
			return ['Resources must be an array.'];
		}
		if(!bundle.registries || typeof bundle.registries !== 'object' || Array.isArray(bundle.registries)) { return ['Invalid sprite registries.']; }
		for(const [key, limit] of [['groups', 255], ['types', 255], ['tags', 32]] as const)
		{
			const entries = bundle.registries[key];
			if(!Array.isArray(entries) || entries.length > limit || entries.some(entry => typeof entry !== 'string' || !entry.trim() || entry !== entry.trim()) || new Set(entries).size !== entries.length)
			{
				return ['V-012: Registry '+key+' requires unique names and at most '+limit+' entries.'];
			}
		}
		const errors:string[] = [];
		const ids = new Set<string>();
		const names = new Set<string>();
		for(const resource of bundle.resources)
		{
			if(!resource || typeof resource !== 'object' || Array.isArray(resource))
			{
				errors.push('Each resource must be an object.');
				continue;
			}
			if(typeof resource.id !== 'string' || resource.id.length === 0 || ids.has(resource.id))
			{
				errors.push('Resource IDs must be nonempty and unique.');
			}
			if(typeof resource.name !== 'string' || !resource.name.trim() || resource.name !== resource.name.trim() || names.has(resource.name))
			{
				errors.push('V-004: Resource names must be nonempty, trimmed, and unique.');
			}
			if(['sprite', 'palette', 'map', 'sound'].includes(resource.type))
			{
				const error = ResourceValidation.name(resource.name);
				if(error) { errors.push(error); }
			}
			if(typeof resource.type !== 'string' || !resource.type)
			{
				errors.push('Resource type is required.');
			}
			ids.add(resource.id);
			names.add(resource.name);
		}
		if(errors.length > 0)
		{
			return errors;
		}
		for(const resource of bundle.resources)
		{
			// Resource descriptors validate supported types; extension data stays intact.
			const resourceType = ResourceTypes.get(resource.type);
			if(resourceType)
			{
				errors.push(...resourceType.validate(resource, bundle).map(error => resource.name+': '+error));
			}
		}
		const palettes = bundle.resources.filter(resource => resource.type === 'palette');
		if(palettes.length > ResourceValidation.maxPalettes) { errors.push('V-016: At most '+ResourceValidation.maxPalettes+' palettes are allowed.'); }
		if(1 + bundle.resources.filter(resource => ['sprite', 'palette', 'map', 'sound'].includes(resource.type)).length > 5120)
		{
			errors.push('V-025: At most 5120 runtime assets are allowed.');
		}
		for(const palette of palettes)
		{
			const members = bundle.resources.filter(resource => resource.type === 'sprite' && resource.colorMode === 'palette' && resource.paletteId === palette.id);
			if(members.some(resource => ['alpha', 'additive'].includes(resource.blend as string)) && members.some(resource => ['opaque', 'bg'].includes(resource.blend as string)))
			{
				errors.push('V-017: Palette '+palette.name+' mixes alpha and opaque sprites.');
			}
		}
		return errors;
	}

	public static getWarnings(bundle:ResourceBundle):string[]
	{
		const warnings:string[] = [];
		const palettes = bundle.resources.filter(resource => resource.type === 'palette');
		for(const palette of palettes)
		{
			if(!bundle.resources.some(resource => resource.paletteId === palette.id)) { warnings.push('V-018: Palette '+palette.name+' is not used.'); }
		}
		if(palettes.reduce((sum, resource) => sum + (resource as PaletteResource).colorCount, 0) > 4096) { warnings.push('V-026: Palettes total more than 4096 entries; the engine may swap palettes at runtime.'); }
		for(const resource of bundle.resources.filter(resource => resource.type === 'sprite'))
		{
			if(resource.blend === 'bg') { warnings.push('V-031: BG currently behaves exactly like Opaque.'); }
			if(hiddenSpriteModes.blend.includes(resource.blend as typeof hiddenSpriteModes.blend[number])) { warnings.push('V-027: '+resource.name+' uses an unsupported blend and would not be drawn.'); }
		}
		return warnings;
	}

	public static getDependents(bundle:ResourceBundle, id:string):Resource[]
	{
		return bundle.resources.filter(resource => ResourceTypes.get(resource.type)?.getReferences(resource).includes(id));
	}
}
