export interface Diagnostic { code:string; severity:'error' | 'warning' | 'info'; message:string; }
export function validName(name:unknown):boolean;
export function deriveName(source:string, used?:string[]):string;
export function nameIssues(sound:any, resources:any[]):Diagnostic[];
export function sourceIssues(sound:any):Diagnostic[];
export function diagnostics(sound:any, resources:any[], info?:any, confirmed?:boolean):Diagnostic[];
