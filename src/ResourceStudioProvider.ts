import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { getNonce } from './getNonce';
import { ResourceBundles, ResourceTypes, isResourcePath, ResourceBundle, PaletteResource, SpriteResource } from './ResourceBundle';
import { PaletteBuilder } from './PaletteBuilder';
import * as PaletteCompatibility from '../media/palettecompatibility';
import { SpriteSequences } from './SpriteSequence';
import { SoundEditor } from './SoundEditor';
import { SoundAudio } from './SoundAudio';
import { FontEditor } from './FontEditor';
import { FontResource } from './FontResource';
import { SequenceEditor } from './SequenceEditor';
import { MapResource } from './MapResource';
import * as ResourceValidation from '../media/resourcevalidation';

interface SourceFile
{
	path:string;
	uri:string;
	image:boolean;
	missing:boolean;
}

export class ResourceStudioProvider implements vscode.CustomTextEditorProvider
{
	public static readonly viewType = 'WOWCubeSDK.resourceStudio';
	public static readonly filename = 'wowcubeapp-resources.json';
	private static editors:Map<string,() => Promise<void>> = new Map<string,() => Promise<void>>();

	public static async flushEdits(resources:string):Promise<void>
	{
		await this.editors.get(path.resolve(resources))?.();
	}

	private pendingSources:Map<string,string> = new Map<string,string>();
	private editQueues:Map<string,Promise<void>> = new Map<string,Promise<void>>();
	private sourceSelections:Map<string,(source:string) => void> = new Map<string,(source:string) => void>();

	constructor(private readonly context:vscode.ExtensionContext)
	{
	}

	public static register(context:vscode.ExtensionContext):void
	{
		const provider = new ResourceStudioProvider(context);
		context.subscriptions.push(
			vscode.window.registerCustomEditorProvider(this.viewType, provider, {supportsMultipleEditorsPerDocument:false}),
			vscode.commands.registerCommand('WOWCubeSDK.openResourceStudio', (uri?:vscode.Uri) => provider.open(uri))
		);
	}

	public async open(sourceUri?:vscode.Uri):Promise<void>
	{
		try
		{
			if(sourceUri && path.posix.basename(sourceUri.path) === ResourceStudioProvider.filename)
			{
				await vscode.commands.executeCommand('vscode.openWith', sourceUri, ResourceStudioProvider.viewType);
				return;
			}
			const folders = vscode.workspace.workspaceFolders;
			let folder = sourceUri ? vscode.workspace.getWorkspaceFolder(sourceUri) : undefined;
			if(!folder && !sourceUri)
			{
				const activeUri = vscode.window.activeTextEditor?.document.uri;
				folder = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
				if(!folder && folders?.length === 1)
				{
					folder = folders[0];
				}
				if(!folder && folders && folders.length > 1)
				{
					folder = await vscode.window.showWorkspaceFolderPick({placeHolder:'Select a project for Resource Studio'});
				}
			}
			if(!folder)
			{
				if(!folders?.length || sourceUri)
				{
					vscode.window.showInformationMessage('Open a project folder to use Resource Studio.');
				}
				return;
			}
			const bundleUri = vscode.Uri.joinPath(folder.uri, ResourceStudioProvider.filename);
			try
			{
				await vscode.workspace.fs.stat(bundleUri);
			}
			catch(error)
			{
				if(!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound')
				{
					throw error;
				}
				await vscode.workspace.fs.writeFile(bundleUri, Buffer.from(JSON.stringify(ResourceBundles.create(), null, 2)+'\n'));
			}
			if(sourceUri)
			{
				const source = this.getRelativePath(folder.uri, sourceUri);
				this.pendingSources.set(bundleUri.toString(), source);
				this.sourceSelections.get(bundleUri.toString())?.(source);
			}
			await vscode.commands.executeCommand('vscode.openWith', bundleUri, ResourceStudioProvider.viewType);
		}
		catch(error)
		{
			vscode.window.showErrorMessage('Unable to open Resource Studio: '+this.getError(error));
		}
	}

	public async resolveCustomTextEditor(document:vscode.TextDocument, panel:vscode.WebviewPanel):Promise<void>
	{
		const projectUri = vscode.Uri.joinPath(document.uri, '..');
		panel.webview.options = {
			enableScripts:true,
			localResourceRoots:[vscode.Uri.joinPath(this.context.extensionUri, 'media'), projectUri]
		};
		panel.webview.html = this.getHtmlForWebview(panel.webview);
		const soundEditor = new SoundEditor(projectUri,this.context);
		let disposed = false;
		let working = false;
		let updateNumber = 0;
		let timer:ReturnType<typeof setTimeout> | undefined;
		let selectedSource:string | undefined;
		let browseSource:string | undefined;
		const editorKey = path.resolve(document.uri.fsPath);
		const flushRequests = new Map<string,(error?:string) => void>();
		const flushEdits = async ():Promise<void> =>
		{
			await this.editQueues.get(document.uri.toString());
			if(disposed || !panel.visible) { return; }
			await new Promise<void>((resolve, reject) =>
			{
				const requestId = crypto.randomBytes(16).toString('hex');
				const finish = (error?:string):void =>
				{
					clearTimeout(timeout); flushRequests.delete(requestId);
					if(error) { reject(new Error(error)); } else { resolve(); }
				};
				const timeout = setTimeout(() => finish('Resource Studio did not finish committing edits. Try building again.'), 30000);
				flushRequests.set(requestId, finish);
				void panel.webview.postMessage({type:'flushEdits', requestId}).then(delivered =>
				{
					if(!delivered) { finish('Unable to commit Resource Studio edits before building.'); }
				}, () => finish('Unable to reach Resource Studio before building.'));
			});
		};
		const updateWebview = async ():Promise<void> =>
		{
			const number = ++updateNumber;
			const version = document.version;
			try
			{
				const bundle = ResourceBundles.parse(document.getText());
				if(selectedSource !== undefined)
				{
					browseSource = selectedSource;
				}
				let selectedFolder:string | undefined;
				if(browseSource !== undefined)
				{
					try
					{
						const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(projectUri, browseSource));
						if(stat.type & vscode.FileType.Directory)
						{
							selectedFolder = browseSource;
						}
					}
					catch
					{
						// Keep missing source files visible without changing the bundle.
					}
				}
				const sources = await this.getSources(projectUri, bundle.sourceFolders,
					[...bundle.resources.map(resource => resource.source), ...bundle.resources.filter(resource => resource.type === 'font').map(resource => resource.atlas), ...bundle.resources.filter(resource => resource.type === 'map').map(resource => (resource as MapResource).net.backgroundImage), selectedFolder === undefined ? browseSource : undefined]
						.filter((source):source is string => typeof source === 'string'), panel.webview);
				const fontData:Record<string,unknown> = {};
				for(const resource of bundle.resources.filter(resource => resource.type === 'font'))
				{
					try { fontData[resource.id] = await FontEditor.read(projectUri, resource as FontResource); }
					catch(error) { fontData[resource.id] = {error:this.getError(error)}; }
				}
				const soundData:Record<string,unknown> = {};
				for(const resource of bundle.resources.filter(resource => resource.type === 'sound')) { soundData[resource.id] = (await SoundAudio.read(projectUri,resource.source as string)).info; }
				if(disposed || number !== updateNumber || version !== document.version)
				{
					return;
				}
				await panel.webview.postMessage({
					type:'update', bundle, fontData, soundData, confirmedSounds:SoundEditor.confirmed(this.context,projectUri,bundle), version, dirty:document.isDirty, busy:working,
					project:path.posix.basename(projectUri.path), sources:sources.files, sourceWarning:sources.warning, warnings:ResourceBundles.getWarnings(bundle),
					resourceTypes:ResourceTypes.getAll().map(resourceType => ({type:resourceType.type, label:resourceType.label, canCreate:resourceType.canCreate !== false})),
					selectedSource, selectedFolder
				});
				selectedSource = undefined;
			}
			catch(error)
			{
				if(!disposed && number === updateNumber)
				{
					await panel.webview.postMessage({type:'invalid', message:this.getError(error)});
				}
			}
		};
		const refresh = ():void =>
		{
			if(timer)
			{
				clearTimeout(timer);
			}
			timer = setTimeout(() => { void updateWebview(); }, 150);
		};
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectUri, '**/*'));
		const selectSource = (source:string):void =>
		{
			selectedSource = source;
			this.pendingSources.delete(document.uri.toString());
			refresh();
		};
		this.sourceSelections.set(document.uri.toString(), selectSource);
		const subscriptions = [
			watcher, watcher.onDidCreate(refresh), watcher.onDidDelete(refresh), watcher.onDidChange(refresh),
			vscode.workspace.onDidChangeTextDocument(event =>
			{
				if(event.document.uri.toString() === document.uri.toString())
				{
					refresh();
				}
			}),
			vscode.workspace.onDidSaveTextDocument(saved =>
			{
				if(saved.uri.toString() === document.uri.toString())
				{
					refresh();
				}
			}),
			panel.onDidChangeViewState(() =>
			{
				const source = this.pendingSources.get(document.uri.toString());
				if(panel.visible && source !== undefined)
				{
					selectedSource = source;
					this.pendingSources.delete(document.uri.toString());
					refresh();
				}
			}),
			panel.webview.onDidReceiveMessage(async message =>
			{
				try
				{
					switch(message.type)
					{
						case 'soundImport':
							const review = await soundEditor.prepare(ResourceBundles.parse(document.getText()),message);
							if(review) { await panel.webview.postMessage({type:'soundReview',rows:review}); }
							break;
						case 'soundCopy':
							const copied = await soundEditor.copy(message.token);
							if(copied) { await panel.webview.postMessage({type:'soundReview',rows:copied}); }
							break;
						case 'soundPreview':
							const audioResource = ResourceBundles.parse(document.getText()).resources.find(item => item.id === message.id && item.type === 'sound');
							if(audioResource)
							{
								const audio = await SoundAudio.read(projectUri,audioResource.source as string,true);
								await panel.webview.postMessage({type:'soundPreview',id:audioResource.id,requestId:message.requestId,preview:audio.preview,error:audio.info.error});
							}
							break;
						case 'soundReveal':
							const reveal = ResourceBundles.parse(document.getText()).resources.find(item => item.type === 'sound' && item.id === message.id);
							if(reveal && isResourcePath(reveal.source)) { await vscode.commands.executeCommand('revealFileInOS',vscode.Uri.joinPath(projectUri,reveal.source)); }
							break;
						case 'ready':
							ResourceStudioProvider.editors.set(editorKey, flushEdits);
							selectedSource = this.pendingSources.get(document.uri.toString());
							this.pendingSources.delete(document.uri.toString());
							await updateWebview();
							break;
						case 'flushedEdits':
							await this.editQueues.get(document.uri.toString());
							flushRequests.get(message.requestId)?.(typeof message.error === 'string' ? message.error : undefined);
							break;
						case 'save':
							await this.editQueues.get(document.uri.toString());
							if(!await document.save())
							{
								throw new Error('Unable to save the resource bundle.');
							}
							await updateWebview();
							break;
						case 'refresh':
							await updateWebview();
							break;
						case 'editText':
							await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
							break;
						case 'openSource':
							if(!isResourcePath(message.source))
							{
								throw new Error('Invalid source path.');
							}
							await vscode.commands.executeCommand('vscode.open', vscode.Uri.joinPath(projectUri, message.source));
							break;
						case 'addFolder':
							const folders = await vscode.window.showOpenDialog({canSelectFiles:false, canSelectFolders:true,
								canSelectMany:true, defaultUri:projectUri, openLabel:'Add source folders'});
							if(folders)
							{
								const paths = folders.map(folder => this.getRelativePath(projectUri, folder));
								await this.edit(document, message.version, bundle =>
								{
									bundle.sourceFolders = Array.from(new Set([...bundle.sourceFolders, ...paths]));
								});
							}
							await updateWebview();
							break;
						case 'change':
							working = true;
							try
							{
								await this.edit(document, message.version, async bundle =>
								{
									if(typeof message.action === 'string' && message.action.startsWith('sound')) { return soundEditor.change(bundle,message); }
									if(typeof message.action === 'string' && message.action.startsWith('font'))
									{
										return FontEditor.change(bundle, message, projectUri, uri => this.getRelativePath(projectUri, uri), palette => this.generatePalette(projectUri, bundle, palette, palette.colorCount));
									}
									if(typeof message.action === 'string' && message.action.startsWith('sequence'))
									{
										return SequenceEditor.change(bundle, message, projectUri, {relative:uri => this.getRelativePath(projectUri, uri), size:source => this.validateSpriteSource(projectUri, source), palette:palette => this.generatePalette(projectUri, bundle, palette, palette.colorCount)});
									}
									switch(message.action)
									{
										case 'create':
											const resourceType = ResourceTypes.get(message.resourceType);
											if(!resourceType || resourceType.canCreate === false)
											{
												throw new Error('This resource type cannot be created independently. Add a sprite to generate a palette.');
											}
											const resource = resourceType.create(crypto.randomBytes(16).toString('hex'), message.name, message.source, message.options);
											if(resource.type === 'sprite')
											{
												await this.validateSpriteSource(projectUri, resource.source);
											}
											if(resourceType.getPaletteSource?.(resource))
											{
												let palette = bundle.resources.find(item => item.type === 'palette' && item.id === message.options?.paletteId) as PaletteResource | undefined;
												if(!message.options?.paletteId)
												{
													const name = typeof message.options?.paletteName === 'string' ? message.options.paletteName.trim() : '';
													if(!name)
													{
														throw new Error('Enter a palette name before adding the resource.');
													}
													palette = ResourceTypes.get('palette')!.create(crypto.randomBytes(16).toString('hex'), name) as PaletteResource;
													palette.colorCount = Number(message.options.colorCount);
													palette.colors = ['#00000000'];
													palette.mappingColors = palette.colors.slice();
													bundle.resources.push(palette);
												}
												if(!palette)
												{
													throw new Error('Choose an existing palette or generate a new one.');
												}
												resource.paletteId = palette.id;
												bundle.resources.push(resource);
												await this.generatePalette(projectUri, bundle, palette, palette.colorCount);
											}
											else
											{
												bundle.resources.push(resource);
											}
											break;
										case 'chooseMapBackground':
											const map = bundle.resources.find(resource => resource.id === message.id && resource.type === 'map') as MapResource | undefined;
											if(!map) { throw new Error('Map no longer exists.'); }
											const images = await vscode.window.showOpenDialog({canSelectMany:false, canSelectFolders:false, canSelectFiles:true, defaultUri:projectUri, openLabel:'Use map background', filters:{images:['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']}});
											if(!images?.length) { return false; }
											if(images?.length)
											{
												const image = this.getRelativePath(projectUri, images[0]);
												const stat = await vscode.workspace.fs.stat(images[0]);
												if(!(stat.type & vscode.FileType.File) || !/\.(png|jpe?g|webp|gif|bmp)$/i.test(image)) { throw new Error('Choose an image file inside the project.'); }
												map.net.backgroundImage = image;
											}
											break;
										case 'update':
											const index = bundle.resources.findIndex(resource => resource.id === message.resource?.id);
											if(index === -1 || bundle.resources[index].type !== message.resource.type)
											{
												throw new Error('Resource no longer exists or its type changed.');
											}
											const previous = bundle.resources[index];
											if(previous.type === 'sprite' && message.resource.collider?.enabled === false)
											{
												message.resource.collider = {...message.resource.collider, x:0, y:0, width:0, height:0};
											}
											if(previous.type === 'sprite' && (previous.source !== message.resource.source || message.resource.collider?.enabled === true))
											{
												const size = await this.validateSpriteSource(projectUri, message.resource.source);
												if(message.resource.collider?.enabled === true)
												{
													const error = ResourceValidation.collider(message.resource.collider, size.width, size.height);
													if(error) { throw new Error(error); }
												}
											}
											if(previous.type === 'palette' && (message.resource.colors?.length !== (previous as PaletteResource).colors.length ||
												message.resource.colorCount !== previous.colorCount))
											{
												throw new Error('Change the palette size to regenerate it from its source images.');
											}
											if(previous.type === 'palette')
											{
												const palette = previous as PaletteResource;
												if(message.resource.transparentIndex !== palette.transparentIndex || message.resource.colors[0] !== palette.colors[0]) { throw new Error('Color 0 is reserved for transparency and cannot be edited.'); }
												message.resource.mappingColors = palette.mappingColors.slice();
												message.resource.colors = (message.resource.colors as string[]).map(ResourceValidation.quantizePaletteColor);
											}
											if(previous.type === 'font') { await FontEditor.read(projectUri, message.resource); }
											bundle.resources[index] = message.resource;
											const getPaletteSource = ResourceTypes.get(previous.type)?.getPaletteSource;
											if(getPaletteSource?.(message.resource) && (previous.paletteId !== message.resource.paletteId ||
												getPaletteSource(previous) !== getPaletteSource(message.resource)))
											{
												const palette = bundle.resources.find(item => item.id === message.resource.paletteId && item.type === 'palette') as PaletteResource | undefined;
												if(!palette)
												{
													throw new Error('Choose a palette for the sprite.');
												}
												await this.generatePalette(projectUri, bundle, palette, palette.colorCount);
											}
											break;
										case 'generatePalette':
											const sprite = bundle.resources.find(item => item.id === message.id && item.type === 'sprite');
											if(!sprite)
											{
												throw new Error('Sprite no longer exists.');
											}
											let name = ResourceValidation.paletteName(sprite.name);
											if(bundle.resources.some(item => item.name === name))
											{
												const chosen = await vscode.window.showInputBox({value:name, title:'Generate a new palette',
													prompt:'This palette name already exists. Enter a unique name for the new palette.',
													validateInput:value => ResourceValidation.name(value, SpriteSequences.usedNames(bundle))});
												if(chosen === undefined) { return false; }
												name = chosen.trim();
											}
											const generated = ResourceTypes.get('palette')!.create(crypto.randomBytes(16).toString('hex'), name) as PaletteResource;
											generated.colorCount = 256;
											bundle.resources.push(generated);
											sprite.paletteId = generated.id;
											sprite.colorMode = 'palette';
											sprite.dither = false;
											sprite.compression = null;
											sprite.softkey = null;
											await this.generatePalette(projectUri, bundle, generated, 256);
											break;
										case 'addClassification':
											if(!['groups', 'types', 'tags'].includes(message.registry)) { throw new Error('Unknown sprite registry.'); }
											const member = bundle.resources.find(item => item.id === message.id && item.type === 'sprite');
											if(!member) { throw new Error('Sprite no longer exists.'); }
											const registryName = await vscode.window.showInputBox({title:'Add '+({groups:'group', types:'type', tags:'tag'} as Record<string,string>)[message.registry],
												prompt:'Enter a unique name.', validateInput:value => !value.trim() || bundle.registries[message.registry as 'groups'].includes(value.trim()) ? 'Choose a unique name.' : undefined});
											if(registryName === undefined) { return false; }
											bundle.registries[message.registry as 'groups'].push(registryName.trim());
											if(message.registry === 'tags') { member.tags = [...new Set([...(member.tags as string[]), registryName.trim()])]; }
											else { member[message.registry === 'groups' ? 'group' : 'objectType'] = registryName.trim(); }
											break;
										case 'deleteClassification':
											if(!['groups', 'types', 'tags'].includes(message.registry)) { throw new Error('Unknown sprite registry.'); }
											const entries = bundle.registries[message.registry as 'groups'];
											const position = entries.indexOf(message.name);
											if(position < 0) { throw new Error('Classification entry no longer exists.'); }
											const field = message.registry === 'groups' ? 'group' : 'objectType';
											const users = bundle.resources.filter(item => item.type === 'sprite' && (message.registry === 'tags' ? (item.tags as string[]).includes(message.name) : item[field] === message.name));
											const prefix = message.registry === 'groups' ? 'GROUP_' : message.registry === 'types' ? 'TYPE_' : 'TAG_';
											const changed = entries.slice(position + 1).map((name, offset) => prefix+name+': '+(position + offset + 2)+' → '+(position + offset + 1)+(message.registry === 'tags' ? ' (bit '+(position + offset + 1)+' → '+(position + offset)+')' : ''));
											if(users.length || changed.length)
											{
												const answer = await vscode.window.showWarningMessage('Delete "'+message.name+'"? '+users.length+' sprite assignment(s) will be cleared. '+prefix+message.name+' will be removed.'+(changed.length ? '\nConstants that change:\n'+changed.join('\n') : ''), {modal:true}, 'Delete');
												if(answer !== 'Delete') { return false; }
											}
											entries.splice(position, 1);
											for(const item of users)
											{
												if(message.registry === 'tags') { item.tags = (item.tags as string[]).filter(tag => tag !== message.name); }
												else { item[field] = null; }
												}
											break;
										case 'reservePaletteIndex':
											const legacyPalette = bundle.resources.find(item => item.id === message.id && item.type === 'palette') as PaletteResource | undefined;
											if(!legacyPalette) { throw new Error('Palette no longer exists.'); }
											PaletteCompatibility.reserve(legacyPalette);
											break;
										case 'resizePalette':
											const palette = bundle.resources.find(item => item.id === message.id && item.type === 'palette') as PaletteResource | undefined;
											if(!palette)
											{
												throw new Error('Palette no longer exists.');
											}
											await this.generatePalette(projectUri, bundle, palette, Number(message.colorCount));
											break;
										case 'remove':
											const removedSprite = bundle.resources.find(resource => resource.id === message.id && resource.type === 'sprite') as SpriteResource | undefined;
											if(removedSprite?.sequence)
											{
												throw new Error('Cannot delete sprite "'+removedSprite.name+'" here because it is a frame in animation "'+removedSprite.sequence.name+'". Open that animation in the Animations tab and use "Remove selected frame" to remove it and update the animation.');
											}
											const dependents = ResourceBundles.getDependents(bundle, message.id);
											if(dependents.length)
											{
												throw new Error('Reassign references first: '+dependents.map(resource => resource.name).join(', '));
											}
											if(bundle.resources.some(resource => !ResourceTypes.get(resource.type)))
											{
												throw new Error('Cannot check references in unsupported resource types. Remove this resource in the text editor.');
											}
											bundle.resources = bundle.resources.filter(resource => resource.id !== message.id);
											break;
										case 'removeFolder':
											bundle.sourceFolders = bundle.sourceFolders.filter(folder => folder !== message.folder);
											break;
										case 'addSourceFolder':
											if(!isResourcePath(message.folder, true))
											{
												throw new Error('Source folders must be inside this project.');
											}
											bundle.sourceFolders = Array.from(new Set([...bundle.sourceFolders, message.folder]));
											break;
										default:
											throw new Error('Unknown resource operation.');
									}
								});
							}
							finally
							{
								working = false;
							}
							await updateWebview();
							break;
					}
				}
				catch(error)
				{
					for(const finish of flushRequests.values()) { finish(this.getError(error)); }
					await updateWebview();
					await panel.webview.postMessage({type:'error', message:this.getError(error)});
				}
			})
		];
		panel.onDidDispose(() =>
		{
			disposed = true;
			if(ResourceStudioProvider.editors.get(editorKey) === flushEdits) { ResourceStudioProvider.editors.delete(editorKey); }
			for(const finish of flushRequests.values()) { finish('Resource Studio closed before its edits could be committed.'); }
			if(this.sourceSelections.get(document.uri.toString()) === selectSource)
			{
				this.sourceSelections.delete(document.uri.toString());
			}
			if(timer)
			{
				clearTimeout(timer);
			}
			subscriptions.forEach(subscription => subscription.dispose());
		});
	}

	private async edit(document:vscode.TextDocument, version:number, change:(bundle:ResourceBundle) => void | boolean | Promise<void | boolean>):Promise<void>
	{
		const key = document.uri.toString();
		const previous = this.editQueues.get(key) || Promise.resolve();
		const current = previous.catch(() => {}).then(async () =>
		{
			if(document.version !== version)
			{
				throw new Error('The bundle changed in another editor. Review the refreshed values and try again.');
			}
			const bundle = ResourceBundles.parse(document.getText());
			const previousAliases = SpriteSequences.aliasErrors(bundle);
			if(await change(bundle) === false) { return; }
			if(document.version !== version)
			{
				throw new Error('The bundle changed while generating the palette. Review the refreshed values and try again.');
			}
			const errors = [...ResourceBundles.validate(bundle), ...SpriteSequences.aliasErrors(bundle).filter(error => !previousAliases.includes(error))];
			if(errors.length)
			{
				throw new Error(errors.join('\n'));
			}
			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(bundle, null, 2)+'\n');
			if(!await vscode.workspace.applyEdit(edit))
			{
				throw new Error('Unable to update the resource bundle.');
			}
		});
		this.editQueues.set(key, current);
		try
		{
			await current;
		}
		finally
		{
			if(this.editQueues.get(key) === current)
			{
				this.editQueues.delete(key);
			}
		}
	}

	private async generatePalette(projectUri:vscode.Uri, bundle:ResourceBundle, palette:PaletteResource, size:number):Promise<void>
	{
		const sizeError = ResourceValidation.paletteSize(size);
		if(sizeError) { throw new Error(sizeError); }
		const errors = [...ResourceBundles.validate(bundle), ...SpriteSequences.aliasErrors(bundle)];
		if(errors.length)
		{
			throw new Error(errors.join('\n'));
		}
		if(projectUri.scheme !== 'file')
		{
			throw new Error('Palette builder requires a local project folder.');
		}
		const sources:string[] = [];
		for(const resource of bundle.resources.filter(item => item.paletteId === palette.id))
		{
			const source = ResourceTypes.get(resource.type)?.getPaletteSource?.(resource);
			if(!source || !isResourcePath(source) || /[\r\n]/.test(source))
			{
				throw new Error('Cannot find a palette source for '+resource.name+'.');
			}
			const uri = vscode.Uri.joinPath(projectUri, source);
			if(resource.type === 'font') { await FontEditor.read(projectUri, resource as FontResource); }
			else { await this.validateSpriteSource(projectUri, source); }
			try
			{
				const stat = await vscode.workspace.fs.stat(uri);
				if(!(stat.type & vscode.FileType.File))
				{
					throw new Error('Not a file.');
				}
			}
			catch
			{
				throw new Error('Palette source is missing or unavailable: '+source);
			}
			sources.push(uri.fsPath);
		}
		palette.colors = await PaletteBuilder.generate(sources, size, true);
		palette.transparentIndex = 0;
		palette.mappingColors = palette.colors.slice();
		palette.colorCount = size;
		if(palette.transparentIndex !== null && palette.transparentIndex >= palette.colors.length)
		{
			palette.transparentIndex = null;
		}
	}

	private async validateSpriteSource(projectUri:vscode.Uri, source:unknown):Promise<{width:number; height:number}>
	{
		if(!isResourcePath(source) || !/\.png$/i.test(source)) { throw new Error('V-006: Choose a project-relative PNG source file.'); }
		let bytes:Buffer;
		try
		{
			bytes = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(projectUri, source)));
		}
		catch
		{
			throw new Error('V-005: Sprite source is missing or unavailable: '+source);
		}
		if(bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR')
		{
			throw new Error('V-006: '+source+' is not a usable PNG.');
		}
		const width = bytes.readUInt32BE(16);
		const height = bytes.readUInt32BE(20);
		if(!width || !height) { throw new Error('V-006: '+source+' has zero image dimensions.'); }
		if(width > 240 || height > 240) { throw new Error('V-007: '+source+' is '+width+'×'+height+'; the maximum is 240×240.'); }
		return {width, height};
	}

	private getRelativePath(projectUri:vscode.Uri, uri:vscode.Uri):string
	{
		const relative = path.posix.relative(projectUri.path, uri.path) || '.';
		if(uri.scheme !== projectUri.scheme || uri.authority !== projectUri.authority || !isResourcePath(relative, true))
		{
			throw new Error('Select source files and folders inside this project.');
		}
		return relative;
	}

	private async getSources(projectUri:vscode.Uri, folders:string[], referenced:string[], webview:vscode.Webview):Promise<{files:SourceFile[]; warning:string}>
	{
		const files:Map<string,SourceFile> = new Map<string,SourceFile>();
		const visited = new Set<string>();
		const warnings:string[] = [];
		let entries = 0;
		const add = (source:string, missing:boolean, modified?:number):void =>
		{
			const uri = webview.asWebviewUri(vscode.Uri.joinPath(projectUri, source));
			files.set(source, {path:source, uri:uri.toString()+(modified === undefined ? '' : (uri.query ? '&' : '?')+'v='+modified),
				image:/\.(png|jpe?g|gif|webp|bmp)$/i.test(source), missing});
		};
		const scan = async (folder:string):Promise<void> =>
		{
			if(visited.has(folder) || entries >= 5000)
			{
				return;
			}
			visited.add(folder);
			try
			{
				const children = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(projectUri, folder));
				for(const [name, type] of children)
				{
					if(entries++ >= 5000)
					{
						break;
					}
					const source = folder === '.' ? name : folder+'/'+name;
					if(type & vscode.FileType.SymbolicLink)
					{
						continue;
					}
					if(type & vscode.FileType.Directory)
					{
						if(!['.git', 'node_modules', '.vscode'].includes(name))
						{
							await scan(source);
						}
					}
					else if(type & vscode.FileType.File && name !== ResourceStudioProvider.filename && !name.startsWith('.'))
					{
						add(source, false);
					}
				}
			}
			catch(error)
			{
				warnings.push('Cannot read '+folder+': '+this.getError(error));
			}
		};
		for(const folder of folders)
		{
			await scan(folder);
		}
		for(const source of new Set(referenced))
		{
			if(!isResourcePath(source))
			{
				continue;
			}
			try
			{
				const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(projectUri, source));
				add(source, !(stat.type & vscode.FileType.File), stat.mtime);
			}
			catch
			{
				add(source, true);
			}
		}
		if(entries >= 5000)
		{
			warnings.push('Source browser is limited to 5000 entries. Choose narrower source folders.');
		}
		return {files:Array.from(files.values()).sort((a, b) => a.path.localeCompare(b.path)), warning:warnings.join('\n')};
	}

	private getError(error:unknown):string
	{
		return error instanceof Error ? error.message : String(error);
	}

	private getHtmlForWebview(webview:vscode.Webview):string
	{
		const nonce = getNonce();
		const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, 'media');
		const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'resourcestudio.css'));
		const typesUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'resourcetypes.js'));
		const validationUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'resourcevalidation.js'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'resourcestudio.js'));
		const sequenceCssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'sequenceeditor.css'));
		const mapCssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'mapeditor.css'));
		const sharedScripts = ['spritepixels.js', 'previewviewport.js', 'mapgeometry.js', 'sourcefiles.js', 'spritelist.js', 'palettecompatibility.js', 'soundvalidation.js'].map(file => webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, file)));
		const mapScripts = ['maptextures.js', 'maprenderer.js', 'mapeditor.js', 'mapresource.js', 'sequenceeditor.js', 'fonteditor.js', 'soundeditor.js'].map(file => webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, file)));
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; media-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<link href="${cssUri}" rel="stylesheet">
			<link href="${webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'soundeditor.css'))}" rel="stylesheet">
			<link href="${mapCssUri}" rel="stylesheet">
			<link href="${sequenceCssUri}" rel="stylesheet">
			<link href="${webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'fonteditor.css'))}" rel="stylesheet">
			<title>Resource Studio</title>
		</head>
		<body>
			<div id="resource-studio" aria-label="Resource Studio"><p class="loading">Loading resource bundle…</p></div>
			<script nonce="${nonce}" src="${validationUri}"></script>
			${sharedScripts.map(uri => `<script nonce="${nonce}" src="${uri}"></script>`).join('\n')}
			<script nonce="${nonce}" src="${typesUri}"></script>
			${mapScripts.map(uri => `<script nonce="${nonce}" src="${uri}"></script>`).join('\n')}
			<script nonce="${nonce}" src="${scriptUri}"></script>
		</body>
		</html>`;
	}
}
