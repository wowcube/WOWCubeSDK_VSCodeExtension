"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaletteBuilder = void 0;
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
class PaletteBuilder {
    static async generate(sources, size, reserveTransparent = false) {
        if (!Number.isInteger(size) || size < 1 || size > 256) {
            throw new Error('Palette size must be an integer from 1 to 256.');
        }
        if (!sources.length || sources.some(source => !path.isAbsolute(source) || /[\r\n]/.test(source))) {
            throw new Error('Palette generation requires source images with valid absolute paths.');
        }
        const toolsPath = Configuration_1.Configuration.getUtilsPath();
        if (!toolsPath) {
            throw new Error('Configure the WOWCube Development Kit path before generating a palette.');
        }
        const tool = path.join(toolsPath, Configuration_1.Configuration.getPaletteBuilder());
        try {
            await fs.promises.access(tool, fs.constants.F_OK);
        }
        catch {
            throw new Error('Palette builder not found: ' + tool + '. Install it in the SDK tools folder.');
        }
        const temporaryFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wowcube-palette-'));
        try {
            const list = path.join(temporaryFolder, 'sources.txt');
            const output = path.join(temporaryFolder, 'palette.json');
            await fs.promises.writeFile(list, Array.from(new Set(sources)).join('\n') + '\n', 'utf8');
            const args = ['-n', String(size), '-o', output];
            if (reserveTransparent) {
                args.push('-t');
            }
            args.push('@' + list);
            const channel = Output_1.Output.channel();
            channel.appendLine('[palette-builder] Generating palette from ' + new Set(sources).size + ' source image(s), color limit ' + size + '.');
            channel.show(true);
            await new Promise((resolve, reject) => {
                let stdoutStreamed = false;
                let stderrStreamed = false;
                const child = cp.execFile(tool, args, { cwd: temporaryFolder, timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
                    if (!stdoutStreamed && stdout) {
                        channel.append(stdout);
                    }
                    if (!stderrStreamed && stderr) {
                        channel.append(stderr);
                    }
                    if (error) {
                        channel.appendLine('[palette-builder] ' + error.message);
                        reject(new Error('Palette generation failed: ' + (stderr.trim() || stdout.trim() || error.message)));
                    }
                    else {
                        resolve();
                    }
                });
                child?.stdout?.on('data', data => { stdoutStreamed = true; channel.append(data.toString()); });
                child?.stderr?.on('data', data => { stderrStreamed = true; channel.append(data.toString()); });
            });
            const result = JSON.parse(await fs.promises.readFile(output, 'utf8'));
            if (!Array.isArray(result.colors) || result.colors.length < 1 || result.colors.length > size ||
                result.colors.some((color) => typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))) {
                throw new Error('Palette builder returned an invalid palette or too many colors.');
            }
            return result.colors.map((color) => color.toLowerCase());
        }
        finally {
            await fs.promises.rm(temporaryFolder, { recursive: true, force: true });
        }
    }
}
exports.PaletteBuilder = PaletteBuilder;
//# sourceMappingURL=PaletteBuilder.js.map