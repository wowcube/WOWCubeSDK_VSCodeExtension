import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { BitmapFont, parseBitmapFont } from './BitmapFont';
import { FontResource } from './FontResource';
import { ResourceBundle, ResourceBundles, ResourceTypes, PaletteResource, isResourcePath } from './ResourceBundle';
import * as ResourceValidation from '../media/resourcevalidation';

export class FontEditor
{
	public static async read(project:vscode.Uri, resource:FontResource):Promise<BitmapFont>
	{
		if(!isResourcePath(resource.source) || !isResourcePath(resource.atlas)) { throw new Error('Font files must be inside the project.'); }
		const font = parseBitmapFont(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(project, resource.source)));
		const png = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(project, resource.atlas)));
		if(png.length < 33 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== font.width || png.readUInt32BE(20) !== font.height) { throw new Error('The PNG atlas must match the font dimensions ('+font.width+' × '+font.height+').'); }
		font.referencedAtlas = path.posix.normalize(path.posix.join(path.posix.dirname(resource.source), font.page.replace(/\\/g, '/')));
		return font;
	}

	public static async change(bundle:ResourceBundle, message:any, project:vscode.Uri, relative:(uri:vscode.Uri) => string, generate:(palette:PaletteResource) => Promise<void>):Promise<boolean>
	{
		const fonts = bundle.resources.filter(item => item.type === 'font');
		if(message.action === 'fontImport')
		{
			const slot = [1, 2, 3].find(slot => !fonts.some(font => font.slot === slot));
			if(!slot) { throw new Error('All three font slots are occupied. Remove a font before adding another.'); }
			const selection = await vscode.window.showOpenDialog({defaultUri:project, canSelectMany:false, filters:{bmFont:['fnt']}, openLabel:'Add bitmap font'});
			if(!selection?.length) { return false; }
			const source = relative(selection[0]), parsed = parseBitmapFont(await vscode.workspace.fs.readFile(selection[0]));
			const atlas = path.posix.normalize(path.posix.join(path.posix.dirname(source), parsed.page.replace(/\\/g, '/')));
			if(!isResourcePath(atlas)) { throw new Error('The referenced atlas must be inside the project.'); }
			const resource = ResourceTypes.get('font')!.create(crypto.randomBytes(16).toString('hex'), ResourceValidation.deriveName('font_'+slot, ResourceValidation.usedNames(bundle.resources)), source, {slot, atlas}) as FontResource;
			try { await this.read(project, resource); }
			catch(error)
			{
				const choice = await vscode.window.showQuickPick([{label:'Choose a different PNG atlas'}], {title:'Referenced atlas unavailable: '+atlas, placeHolder:error instanceof Error ? error.message : String(error)});
				if(!choice) { return false; }
				const png = await vscode.window.showOpenDialog({defaultUri:selection[0], filters:{png:['png']}, canSelectMany:false});
				if(!png?.length) { return false; } resource.atlas = relative(png[0]); await this.read(project, resource);
			}
			const name = await vscode.window.showInputBox({title:'Font name', value:resource.name, validateInput:value => ResourceValidation.name(value, ResourceValidation.usedNames(bundle.resources))});
			if(name === undefined) { return false; } resource.name = name;
			bundle.resources.push(resource);
			if(!await this.palette(bundle, resource, generate)) { return false; }
			return true;
		}
		const resource = fonts.find(item => item.id === message.id) as FontResource | undefined;
		if(!resource) { throw new Error('Font no longer exists.'); }
		if(message.action === 'fontAtlas')
		{
			const selection = await vscode.window.showOpenDialog({defaultUri:vscode.Uri.joinPath(project, resource.atlas), filters:{png:['png']}, canSelectMany:false});
			if(!selection?.length) { return false; } resource.atlas = relative(selection[0]); await this.read(project, resource);
			await generate(bundle.resources.find(item => item.id === resource.paletteId) as PaletteResource); return true;
		}
		if(message.action === 'fontPalette') { return this.palette(bundle, resource, generate); }
		throw new Error('Unknown font action.');
	}

	private static async palette(bundle:ResourceBundle, resource:FontResource, generate:(palette:PaletteResource) => Promise<void>):Promise<boolean>
	{
		const palettes = bundle.resources.filter(item => item.type === 'palette' && !bundle.resources.some(user => user.paletteId === item.id && user.type === 'sprite' && ['opaque', 'bg'].includes(user.blend as string))) as PaletteResource[];
		const mode = await vscode.window.showQuickPick([{label:'Generate a new font palette', id:'new'}, ...palettes.map(palette => ({label:palette.name, id:palette.id}))], {title:'Font colors', placeHolder:'Only alpha-compatible palettes are listed'});
		if(!mode) { return false; }
		let palette = palettes.find(palette => palette.id === mode.id);
		if(mode.id === 'new')
		{
			if(bundle.resources.filter(item => item.type === 'palette').length >= 64) { throw new Error('At most 64 palettes are allowed.'); }
			const name = await vscode.window.showInputBox({title:'Font palette name', value:ResourceValidation.deriveName(ResourceValidation.paletteName(resource.name), ResourceValidation.usedNames(bundle.resources)), validateInput:value => ResourceValidation.name(value, ResourceValidation.usedNames(bundle.resources))});
			if(name === undefined) { return false; }
			const count = await vscode.window.showInputBox({title:'Font palette size', value:'32', prompt:'16–32 colors usually suit anti-aliased text; supported range is 2–256.', validateInput:value => ResourceValidation.paletteSize(Number(value))});
			if(count === undefined) { return false; }
			palette = ResourceTypes.get('palette')!.create(crypto.randomBytes(16).toString('hex'), name) as PaletteResource; palette.colorCount = +count; bundle.resources.push(palette);
		}
		if(!palette) { throw new Error('Palette no longer exists.'); }
		resource.paletteId = palette.id;
		const errors = ResourceBundles.validate(bundle); if(errors.length) { throw new Error(errors.join('\n')); }
		await generate(palette); return true;
	}
}
