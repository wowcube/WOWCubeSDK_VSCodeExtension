import { Resource, ResourceBundle, ResourceType, isResourcePath } from './ResourceBundle';

export interface FontResource extends Resource
{
	type:'font'; source:string; atlas:string; slot:number; paletteId:string; fullsize:boolean; blend:'alpha';
}
export const fontResourceType:ResourceType = {
	type:'font', label:'Font', getPaletteSource:resource => resource.atlas as string,
	create:(id, name, source = '', options = {}) => ({id, name, type:'font', source, atlas:options.atlas || '', slot:options.slot ?? 1, paletteId:options.paletteId || '', fullsize:true, blend:'alpha'}),
	validate:(resource:Resource, bundle:ResourceBundle):string[] =>
	{
		const errors:string[] = [];
		if(!isResourcePath(resource.source) || !/\.fnt$/i.test(resource.source)) { errors.push('Choose a project-relative .fnt source file.'); }
		if(!isResourcePath(resource.atlas) || !/\.png$/i.test(resource.atlas)) { errors.push('Choose a project-relative PNG atlas.'); }
		if(!Number.isInteger(resource.slot) || ![1, 2, 3].includes(resource.slot as number)) { errors.push('Font slot must be 1, 2 or 3.'); }
		if(bundle.resources.some(item => item !== resource && item.id !== resource.id && item.type === 'font' && item.slot === resource.slot)) { errors.push('Font slot '+resource.slot+' is already occupied. Choose another slot.'); }
		if(!bundle.resources.some(item => item.type === 'palette' && item.id === resource.paletteId)) { errors.push('Choose an alpha palette for this font.'); }
		if(typeof resource.fullsize !== 'boolean' || resource.blend !== 'alpha') { errors.push('Fonts require an alpha blend and a boolean FULLSIZE setting.'); }
		return errors;
	},
	getReferences:resource => [resource.paletteId as string]
};
