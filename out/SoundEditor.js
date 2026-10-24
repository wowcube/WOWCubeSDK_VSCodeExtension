"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundEditor = void 0;
const vscode = require("vscode");
const path = require("path");
const crypto = require("crypto");
const ResourceBundle_1 = require("./ResourceBundle");
const SoundAudio_1 = require("./SoundAudio");
const Validation = require("../media/soundvalidation");
const ResourceValidation = require("../media/resourcevalidation");
class SoundEditor {
    constructor(project, context) {
        this.project = project;
        this.context = context;
        this.rows = new Map();
    }
    static key(project) { return 'soundDuplicates:' + project.toString(); }
    static confirmed(context, project, bundle) {
        if (!bundle.resources.some(item => item.type === 'sound')) {
            return [];
        }
        const saved = context.workspaceState.get(this.key(project)) || {};
        return Object.keys(saved).filter(source => bundle.resources.filter(item => item.type === 'sound' && item.source === source).every(item => saved[source].includes(item.id)));
    }
    static async errors(context, project, bundle) {
        const errors = [], confirmed = this.confirmed(context, project, bundle);
        for (const resource of bundle.resources.filter(item => item.type === 'sound')) {
            const result = await SoundAudio_1.SoundAudio.read(project, resource.source);
            errors.push(...Validation.diagnostics(resource, bundle.resources, result.info, confirmed.includes(resource.source)).filter(issue => issue.severity === 'error').map(issue => issue.message));
        }
        return errors;
    }
    relative(uri) {
        const source = path.posix.relative(this.project.path, uri.path);
        return uri.scheme === this.project.scheme && uri.authority === this.project.authority && (0, ResourceBundle_1.isResourcePath)(source) ? source : '';
    }
    // Some VS Code webviews expose dropped File bytes but omit the native path.
    // Match those bytes to project files before offering an explicit copy.
    async locate(name, bytes) {
        const matches = [], expected = crypto.createHash('sha256').update(bytes).digest('hex');
        let entries = 0;
        const scan = async (folder) => {
            let children;
            try {
                children = await vscode.workspace.fs.readDirectory(folder);
            }
            catch {
                return;
            }
            for (const [filename, type] of children) {
                if (++entries > 5000) {
                    return;
                }
                const uri = vscode.Uri.joinPath(folder, filename);
                if (type === vscode.FileType.Directory && !['.git', '.vscode', 'node_modules'].includes(filename)) {
                    await scan(uri);
                }
                else if (type === vscode.FileType.File && filename === name) {
                    try {
                        if ((await vscode.workspace.fs.stat(uri)).size === bytes.length && crypto.createHash('sha256').update(await vscode.workspace.fs.readFile(uri)).digest('hex') === expected) {
                            matches.push(uri);
                        }
                    }
                    catch { /* Missing or unreadable candidates remain unassigned. */ }
                }
            }
        };
        await scan(this.project);
        if (matches.length === 1) {
            return matches[0];
        }
        if (matches.length > 1) {
            const choice = await vscode.window.showQuickPick(matches.map(uri => ({ label: this.relative(uri), uri })), { title: 'Choose the matching project source', placeHolder: 'Several project files have the same name and contents' });
            return choice?.uri;
        }
    }
    async prepare(bundle, message) {
        let files;
        if (message.source && (0, ResourceBundle_1.isResourcePath)(message.source)) {
            files = [{ uri: vscode.Uri.joinPath(this.project, message.source), name: message.source.split('/').pop() }];
        }
        else if (Array.isArray(message.files)) {
            files = message.files.map((file) => ({ name: String(file.name || 'sound'), uri: typeof file.uri === 'string' ? vscode.Uri.parse(file.uri) : typeof file.path === 'string' ? vscode.Uri.file(file.path) : undefined, bytes: Array.isArray(file.bytes) ? Uint8Array.from(file.bytes) : undefined }));
        }
        else {
            const selection = await vscode.window.showOpenDialog({ defaultUri: this.project, canSelectMany: true, canSelectFiles: true, canSelectFolders: false, openLabel: 'Review sounds', filters: { audio: ['wav', 'mp3'] } });
            if (!selection?.length) {
                return;
            }
            files = selection.map(uri => ({ uri, name: path.posix.basename(uri.path) }));
        }
        if (!files.length) {
            return;
        }
        this.rows.clear();
        const used = ResourceValidation.usedNames(bundle.resources);
        for (const file of files) {
            if (!file.uri && file.bytes) {
                file.uri = await this.locate(file.name, file.bytes);
            }
            const source = file.uri ? this.relative(file.uri) : '', name = Validation.deriveName(file.name, used);
            used.push(name);
            const sound = ResourceBundle_1.ResourceTypes.get('sound').create(crypto.randomBytes(16).toString('hex'), name, source);
            const token = crypto.randomBytes(16).toString('hex');
            const info = !/\.(wav|mp3|ogg|flac)$/i.test(file.name) ? { code: 'S-002', error: 'This is not a supported audio source. Choose a WAV or MP3 file.' } : source ? (await SoundAudio_1.SoundAudio.read(this.project, source)).info : { code: 'S-003', error: 'The source must be inside the project folder. Use “Copy into project folder…” to import a copy.' };
            this.rows.set(token, { token, sound, info, file: file.uri, bytes: file.bytes, filename: file.name });
        }
        return this.review();
    }
    review() { return [...this.rows.values()].map(row => ({ token: row.token, ...row.sound, info: row.info, filename: row.filename, canCopy: !row.sound.source && row.info.code === 'S-003' })); }
    async copy(token) {
        const row = this.rows.get(token);
        if (!row || row.sound.source) {
            throw new Error('Import file no longer exists.');
        }
        const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(this.project, path.posix.basename(row.filename)), saveLabel: 'Copy into project folder' });
        if (!target) {
            return;
        }
        const source = this.relative(target);
        if (!source) {
            throw new Error('Choose a destination inside the project folder.');
        }
        await vscode.workspace.fs.writeFile(target, row.bytes || await vscode.workspace.fs.readFile(row.file));
        row.sound.source = source;
        row.info = (await SoundAudio_1.SoundAudio.read(this.project, source)).info;
        return this.review();
    }
    async keep(bundle, source) {
        const key = SoundEditor.key(this.project), saved = { ...this.context.workspaceState.get(key, {}) };
        saved[source] = bundle.resources.filter(item => item.type === 'sound' && item.source === source).map(item => item.id);
        await this.context.workspaceState.update(key, saved);
    }
    async change(bundle, message) {
        if (message.action === 'soundConfirm') {
            if (!Array.isArray(message.rows)) {
                throw new Error('Invalid sound import.');
            }
            const added = [], keep = [];
            for (const edit of message.rows) {
                const row = this.rows.get(edit.token);
                if (!row || added.some(item => item.id === row.sound.id)) {
                    throw new Error('The sound import review has expired.');
                }
                const sound = { ...row.sound, name: edit.name };
                added.push(sound);
                if (edit.keepBoth) {
                    keep.push(sound.source);
                }
            }
            if (!added.length) {
                return false;
            }
            const resources = [...bundle.resources, ...added];
            if (1 + resources.filter(item => ['sound', 'sprite', 'palette', 'map'].includes(item.type)).length > 5120) {
                throw new Error('The bundle cannot contain more than 5120 runtime assets.');
            }
            for (const sound of added) {
                const result = await SoundAudio_1.SoundAudio.read(this.project, sound.source), issues = Validation.diagnostics(sound, resources, result.info, keep.includes(sound.source));
                const errors = issues.filter(issue => issue.severity === 'error');
                if (errors.length) {
                    throw new Error(errors.map(issue => issue.message).join('\n'));
                }
            }
            bundle.resources.push(...added);
            for (const source of keep) {
                await this.keep(bundle, source);
            }
            return true;
        }
        const sound = bundle.resources.find(item => item.type === 'sound' && item.id === message.id);
        if (!sound) {
            throw new Error('Sound no longer exists.');
        }
        if (message.action === 'soundUpdate') {
            if (typeof message.name !== 'string') {
                throw new Error('Sound name must be text.');
            }
            sound.name = message.name;
            return true;
        }
        if (message.action === 'soundKeepBoth') {
            await this.keep(bundle, sound.source);
            return false;
        }
        if (message.action === 'soundReplace') {
            const selection = await vscode.window.showOpenDialog({ defaultUri: this.project, canSelectMany: false, filters: { audio: ['wav', 'mp3'] }, openLabel: 'Replace sound source' });
            if (!selection?.length) {
                return false;
            }
            let source = this.relative(selection[0]);
            if (!source) {
                if (await vscode.window.showQuickPick(['Copy into project folder…'], { placeHolder: 'The source must be inside the project folder.' }) === undefined) {
                    return false;
                }
                const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(this.project, path.posix.basename(selection[0].path)), saveLabel: 'Copy into project folder' });
                if (!target) {
                    return false;
                }
                source = this.relative(target);
                if (!source) {
                    throw new Error('Choose a destination inside the project folder.');
                }
                await vscode.workspace.fs.writeFile(target, await vscode.workspace.fs.readFile(selection[0]));
            }
            const info = (await SoundAudio_1.SoundAudio.read(this.project, source)).info;
            if (info.error) {
                throw new Error(info.error);
            }
            sound.source = source;
            return true;
        }
        if (message.action === 'soundRemove') {
            const dependents = ResourceBundle_1.ResourceBundles.getDependents(bundle, sound.id);
            if (dependents.length) {
                throw new Error('Remove references first: ' + dependents.map(item => item.name).join(', '));
            }
            if (bundle.resources.some(item => !ResourceBundle_1.ResourceTypes.get(item.type))) {
                throw new Error('Cannot verify references from unsupported resource types. Use Edit JSON to remove this sound.');
            }
            if (await vscode.window.showWarningMessage('Delete sound “' + sound.name + '”? The source file will be kept.', { modal: true }, 'Delete') !== 'Delete') {
                return false;
            }
            bundle.resources = bundle.resources.filter(item => item.id !== sound.id);
            return true;
        }
        throw new Error('Unknown sound action.');
    }
}
exports.SoundEditor = SoundEditor;
//# sourceMappingURL=SoundEditor.js.map