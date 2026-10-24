import { Resource, ResourceType } from './ResourceBundle';
export interface SoundResource extends Resource
{
	type:'sound'; source:string;
}
export const soundResourceType:ResourceType = {
	type:'sound', label:'Sound',
	create:(id, name, source = ''):SoundResource => ({id, name, type:'sound', source}),
	validate:resource => typeof resource.source === 'string' ? [] : ['A sound source must be a string.'],
	getReferences:() => []
};
