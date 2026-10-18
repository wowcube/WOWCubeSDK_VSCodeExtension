export function name(name:unknown, used?:string[]):string | undefined;
export function deriveName(filename:string, used?:string[]):string;
export function paletteName(name:string):string;
export function integer(value:unknown, min:number, max:number, code:string, label:string):string | undefined;
export function paletteSize(size:unknown):string | undefined;
export function quantizePaletteColor(color:string):string;
export interface Collider { enabled:boolean; x:number; y:number; width:number; height:number; }
export function collider(collider:Collider, width:number, height:number):string | undefined;
export function clampCollider(collider:Collider, width:number, height:number):Collider;
export const maxPalettes:number;

export function usedNames(resources:{id:string; name:string; type:string; sequence?:unknown}[], excludeResource?:string, excludeSequence?:string):string[];
export function animationName(name:string, used?:string[]):string | undefined;
export function deriveAnimationName(base:string, used?:string[]):string;
