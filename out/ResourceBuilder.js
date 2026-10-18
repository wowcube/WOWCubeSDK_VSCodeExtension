"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceBuilder = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const ResourceStudioProvider_1 = require("./ResourceStudioProvider");
class ResourceBuilder {
    static register(context) {
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.uri.scheme !== 'file' || path.basename(document.uri.fsPath) !== 'wowcubeapp-resources.json') {
                return;
            }
            const folder = path.dirname(document.uri.fsPath);
            try {
                // A save during compilation needs a follow-up build of the latest JSON.
                await this.builds.get(folder)?.catch(() => { });
                await this.build(folder, 'save');
            }
            catch (error) {
                const message = 'Resource compilation failed: ' + (error instanceof Error ? error.message : String(error));
                Output_1.Output.channel().appendLine('[resource-builder] ' + message);
                Output_1.Output.channel().show(true);
                void vscode.window.showErrorMessage(message);
            }
        }));
    }
    static async build(workspace, reason = 'build') {
        const folder = path.resolve(workspace);
        const pending = this.builds.get(folder);
        if (pending) {
            return pending;
        }
        // Install the pending promise before saving a dirty document can fire a save event.
        const build = Promise.resolve().then(() => this.compile(folder, reason));
        this.builds.set(folder, build);
        try {
            await build;
        }
        finally {
            if (this.builds.get(folder) === build) {
                this.builds.delete(folder);
            }
        }
    }
    static async compile(workspace, reason) {
        const resources = path.join(workspace, 'wowcubeapp-resources.json');
        await ResourceStudioProvider_1.ResourceStudioProvider.flushEdits(resources);
        const document = vscode.workspace.textDocuments.find(item => item.uri.scheme === 'file' && path.resolve(item.uri.fsPath) === resources);
        if (document?.isDirty && !await document.save()) {
            throw new Error('Unable to save the resource bundle before building.');
        }
        let contents;
        try {
            contents = await fs.promises.readFile(resources);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            Output_1.Output.channel().appendLine('[resource-builder] No resource bundle; skipping resource compilation.');
            return;
        }
        const hash = crypto.createHash('sha256').update(contents).digest('hex');
        const key = 'resourceBuilder:' + vscode.Uri.file(resources).toString();
        const state = Configuration_1.Configuration.context.workspaceState;
        const channel = Output_1.Output.channel();
        if (state.get(key) === hash) {
            channel.appendLine('[resource-builder] Resources are up to date.');
            return;
        }
        const toolsPath = Configuration_1.Configuration.getUtilsPath();
        if (!toolsPath) {
            throw new Error('Configure the WOWCube Development Kit path before building resources.');
        }
        const tool = path.join(toolsPath, Configuration_1.Configuration.getResourceBuilder());
        try {
            await fs.promises.access(tool, fs.constants.F_OK);
        }
        catch {
            throw new Error('Resource builder not found: ' + tool + '. Install it in the SDK tools folder.');
        }
        channel.appendLine('[resource-builder] ' + (reason === 'save' ? 'Resource file saved. Building resources...' : 'Building resources...'));
        channel.show(true);
        await new Promise((resolve, reject) => {
            const child = cp.spawn(tool, [resources, '--build', path.join(workspace, 'wowcubeapp-build.json')], { cwd: workspace, windowsHide: true });
            child.stdout?.on('data', data => channel.append(data.toString()));
            child.stderr?.on('data', data => channel.append(data.toString()));
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve() : reject(new Error('Resource compilation failed with exit code ' + code + '.')));
        });
        const current = await fs.promises.readFile(resources);
        if (!contents.equals(current) || document?.isDirty) {
            throw new Error('Resource JSON changed during resource compilation. Build again before compiling the app.');
        }
        await state.update(key, hash);
        channel.appendLine('[resource-builder] Resources built successfully.');
    }
}
exports.ResourceBuilder = ResourceBuilder;
ResourceBuilder.builds = new Map();
//# sourceMappingURL=ResourceBuilder.js.map