interface Palette {name:string; colors:string[]; mappingColors:string[]; transparentIndex:number | null; colorCount:number;}
export function issue(palette:Palette):string | undefined;
export function reserve(palette:Palette):void;
