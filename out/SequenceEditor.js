"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceEditor = void 0;
const vscode = require("vscode");
const crypto = require("crypto");
const ResourceBundle_1 = require("./ResourceBundle");
const SpriteSequence_1 = require("./SpriteSequence");
const ResourceValidation = require("../media/resourcevalidation");
class SequenceEditor {
    static async change(bundle, message, project, services) {
        const frames = SpriteSequence_1.SpriteSequences.frames(bundle, message.sequenceId);
        if (message.sequenceId && !frames.length) {
            throw new Error('Sequence no longer exists.');
        }
        if (message.action === 'sequenceImport') {
            const selection = await vscode.window.showOpenDialog({ canSelectFiles: !message.folder, canSelectFolders: !!message.folder, canSelectMany: !message.folder,
                defaultUri: project, openLabel: message.folder ? 'Import sequence folder' : 'Import sequence frames', filters: { images: ['png'] } });
            if (!selection?.length) {
                return false;
            }
            let paths = [];
            if (message.folder) {
                const folder = services.relative(selection[0]);
                paths = (await vscode.workspace.fs.readDirectory(selection[0])).filter(([name, type]) => type === vscode.FileType.File && /\.png$/i.test(name)).map(([name]) => folder === '.' ? name : folder + '/' + name);
            }
            else {
                paths = selection.map(services.relative);
            }
            paths = [...new Set(paths)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
            if (!paths.length) {
                throw new Error('The selection contains no PNG frames.');
            }
            if (frames.length + paths.length < 2) {
                throw new Error('An animation needs at least two frames. Select two or more PNG files, or use a folder containing at least two PNG files.');
            }
            const sizes = [];
            for (const source of paths) {
                sizes.push({ source, ...await services.size(source) });
            }
            let name = frames[0]?.sequence.name;
            if (!name) {
                name = await vscode.window.showInputBox({ title: 'New animation', prompt: 'Sequence name (frame names are generated from this name)',
                    value: ResourceValidation.deriveAnimationName('animation', SpriteSequence_1.SpriteSequences.usedNames(bundle)), validateInput: value => ResourceValidation.animationName(value, SpriteSequence_1.SpriteSequences.usedNames(bundle)) });
                if (name === undefined) {
                    return false;
                }
            }
            const duration = await vscode.window.showInputBox({ title: 'Frame duration', prompt: 'Hold time in milliseconds, 50–6400 in steps of 50 (engine multiplier 1)', value: '100',
                validateInput: value => !/^\d+$/.test(value) || +value < 50 || +value > 6400 || +value % 50 !== 0 ? 'Use 50–6400 ms in steps of 50.' : undefined });
            if (duration === undefined) {
                return false;
            }
            const palettes = bundle.resources.filter(resource => resource.type === 'palette');
            const mode = await vscode.window.showQuickPick([{ label: 'Generate a new shared palette', id: 'new' }, ...palettes.map(palette => ({ label: palette.name, id: palette.id })), { label: 'Plain RGB565', id: 'rgb565' }], { title: 'Animation frame colors', placeHolder: 'Choose a shared palette or RGB565' });
            if (!mode) {
                return false;
            }
            const added = SpriteSequence_1.SpriteSequences.createFrames(bundle, name, sizes, +duration / 50 - 1, frames[0]?.sequence.id);
            let palette;
            if (mode.id !== 'rgb565') {
                palette = palettes.find(palette => palette.id === mode.id);
                if (mode.id === 'new') {
                    palette = await this.createPalette(bundle, added[0].name, [name, name + '_end', ...added.map(frame => frame.name)]);
                    if (!palette) {
                        return false;
                    }
                }
                if (!palette) {
                    throw new Error('Palette no longer exists.');
                }
            }
            this.setColors(bundle, [...frames, ...added], palette);
            const confirmed = await vscode.window.showQuickPick([{ label: 'Import ' + added.length + ' frames', description: added.map(frame => frame.name).join(', ') }], { title: 'Confirm animation import', placeHolder: 'Frames are imported in natural filename order; each gets a distinct sprite ID' });
            if (!confirmed) {
                return false;
            }
            bundle.resources.push(...added);
            const errors = [...ResourceBundle_1.ResourceBundles.validate(bundle), ...SpriteSequence_1.SpriteSequences.aliasErrors(bundle)];
            if (errors.length) {
                throw new Error(errors.join('\n'));
            }
            if (palette) {
                await services.palette(palette);
            }
            return true;
        }
        if (!frames.length) {
            throw new Error('Sequence no longer exists.');
        }
        if (message.action === 'sequenceGeneratePalette') {
            const palette = await this.createPalette(bundle, frames[0].name);
            if (!palette) {
                return false;
            }
            this.setColors(bundle, frames, palette);
            const errors = [...ResourceBundle_1.ResourceBundles.validate(bundle), ...SpriteSequence_1.SpriteSequences.aliasErrors(bundle)];
            if (errors.length) {
                throw new Error(errors.join('\n'));
            }
            await services.palette(palette);
            return true;
        }
        if (message.action === 'sequenceUpdate') {
            if (!Array.isArray(message.frames) || message.frames.length !== frames.length || new Set(message.frames.map((frame) => frame.id)).size !== frames.length) {
                throw new Error('Invalid sequence frames.');
            }
            for (const [index, edit] of message.frames.entries()) {
                const frame = frames.find(frame => frame.id === edit.id);
                if (!frame) {
                    throw new Error('Frame does not belong to this sequence.');
                }
                frame.name = edit.name;
                frame.pivot = edit.pivot;
                frame.frameRate = edit.frameRate;
                frame.sequence = { ...frame.sequence, name: message.name, index };
            }
            if (message.paletteId !== undefined) {
                const palette = bundle.resources.find(resource => resource.id === message.paletteId && resource.type === 'palette');
                if (message.paletteId !== null && !palette) {
                    throw new Error('Palette no longer exists.');
                }
                const changed = frames.some(frame => frame.paletteId !== (palette?.id || null));
                this.setColors(bundle, frames, palette);
                const errors = [...ResourceBundle_1.ResourceBundles.validate(bundle), ...SpriteSequence_1.SpriteSequences.aliasErrors(bundle)];
                if (errors.length) {
                    throw new Error(errors.join('\n'));
                }
                if (changed && palette) {
                    await services.palette(palette);
                }
            }
            return true;
        }
        const selected = frames.filter(frame => Array.isArray(message.ids) && message.ids.includes(frame.id));
        if (!selected.length) {
            return false;
        }
        if (message.action === 'sequenceRemove') {
            if (frames.length - selected.length === 1) {
                throw new Error('Cannot remove these frames because the animation would have only one frame left. Keep at least two frames, or select all frames to remove the entire animation.');
            }
            for (const frame of selected) {
                if (ResourceBundle_1.ResourceBundles.getDependents(bundle, frame.id).length) {
                    throw new Error(frame.name + ' is referenced by another resource. Remove those references first.');
                }
            }
            bundle.resources = bundle.resources.filter(resource => !selected.includes(resource));
        }
        else if (message.action === 'sequenceDuplicate') {
            const used = SpriteSequence_1.SpriteSequences.usedNames(bundle);
            for (const frame of selected) {
                const copy = JSON.parse(JSON.stringify(frame));
                copy.id = crypto.randomBytes(16).toString('hex');
                copy.name = ResourceValidation.deriveName(frame.name, used);
                used.push(copy.name);
                const position = frames.indexOf(frame);
                frames.splice(position + 1, 0, copy);
                bundle.resources.push(copy);
            }
        }
        else {
            throw new Error('Unknown sequence action.');
        }
        frames.filter(frame => bundle.resources.includes(frame)).forEach((frame, index) => frame.sequence.index = index);
        return true;
    }
    static async createPalette(bundle, frameName, reserved = []) {
        if (bundle.resources.filter(resource => resource.type === 'palette').length >= ResourceValidation.maxPalettes) {
            throw new Error('At most 64 palettes are allowed.');
        }
        const used = [...SpriteSequence_1.SpriteSequences.usedNames(bundle), ...reserved];
        const name = await vscode.window.showInputBox({ title: 'New shared palette', value: ResourceValidation.deriveName(ResourceValidation.paletteName(frameName), used), validateInput: value => ResourceValidation.name(value, used) });
        if (name === undefined) {
            return;
        }
        const count = await vscode.window.showInputBox({ title: 'Palette size', value: '256', validateInput: value => ResourceValidation.paletteSize(Number(value)) });
        if (count === undefined) {
            return;
        }
        const palette = ResourceBundle_1.ResourceTypes.get('palette').create(crypto.randomBytes(16).toString('hex'), name);
        palette.colorCount = Number(count);
        bundle.resources.push(palette);
        return palette;
    }
    static setColors(bundle, frames, palette) {
        const opaque = !palette || bundle.resources.some(item => item.type === 'sprite' && item.paletteId === palette.id && ['opaque', 'bg'].includes(item.blend));
        for (const frame of frames) {
            frame.paletteId = palette?.id || null;
            frame.colorMode = palette ? 'palette' : 'rgb565';
            frame.blend = opaque ? 'opaque' : frame.blend === 'additive' ? 'additive' : 'alpha';
            frame.compression = palette ? null : 'plain';
            frame.softkey = null;
            frame.dither = false;
        }
    }
}
exports.SequenceEditor = SequenceEditor;
//# sourceMappingURL=SequenceEditor.js.map