export interface NetParams
{
	screenSize?:number;
	innerGap?:number;
	faceEdgeGap?:number;
	frame?:number;
	padding?:{right:number; bottom:number};
	lineColor?:string;
	background?:string | null;
	markers?:boolean;
	markerColor?:string;
}
export interface FaceInfo
{
	side:0 | 1 | 2 | 3 | 4 | 5;
	name:'TOP' | 'FRONT' | 'RIGHT' | 'BACK' | 'LEFT' | 'BOTTOM';
	rect:{x:number; y:number; w:number; h:number};
	centre:{x:number; y:number};
	displays:{x:number; y:number; w:number; h:number}[];
}
export interface NetLayout
{
	params:Required<NetParams>;
	S:number; G:number; E:number; B:number; F:number; k:number;
	gridWidth:number; gridHeight:number; canvasWidth:number; canvasHeight:number;
	faces:FaceInfo[];
}
export function computeNetLayout(p?:NetParams):NetLayout;
export function renderNet(ctx:any, p?:NetParams):NetLayout;
export function canvasToFace(layout:NetLayout, x:number, y:number):{side:number; X:number; Y:number};
export function faceToCanvas(layout:NetLayout, side:number, X:number, Y:number):{x:number; y:number};

export function faceToScreen(layout:NetLayout, side:number, X:number, Y:number):{screen:number; x:number; y:number};
export function screenToFace(layout:NetLayout, side:number, screen:number, x:number, y:number):{X:number; Y:number};
