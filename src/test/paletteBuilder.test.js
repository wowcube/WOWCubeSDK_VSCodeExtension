// Checks CLI arguments, list files, cleanup, failures, and platform-specific tool names.
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const zlib = require('zlib');
const {quantizePaletteColor} = require('../../media/resourcevalidation');

function pngChunk(type, data)
{
	const payload = Buffer.concat([Buffer.from(type), data]);
	let crc = 0xffffffff;
	for(const byte of payload)
	{
		crc ^= byte;
		for(let bit = 0; bit < 8; bit++) { crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
	}
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
	return Buffer.concat([length, payload, checksum]);
}

function rgbaPng(pixels)
{
	const header = Buffer.alloc(13);
	header.writeUInt32BE(pixels.length/4, 0);
	header.writeUInt32BE(1, 4);
	header[8] = 8;
	header[9] = 6;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header),
		pngChunk('IDAT', zlib.deflateSync(Buffer.from([0, ...pixels]))), pngChunk('IEND', Buffer.alloc(0))]);
}
let logged = '';
const channel = {append:function (text) { logged += text; }, appendLine:function (text) { logged += text+'\n'; }, show:function () {}};
const vscode = {window:{createOutputChannel:function () { return channel; }}, EventEmitter:class {}};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain)
{
	return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain);
};
const {Configuration} = require('../../out/Configuration');
const {PaletteBuilder} = require('../../out/PaletteBuilder');
Module._load = originalLoad;

async function run()
{
	const originalPlatform = os.platform;
	const originalExecFile = cp.execFile;
	const originalUtilsPath = Configuration.getUtilsPath;
	const fixture = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wowcube-palette-test-'));
	let temporaryFolder;
	let mode = 'success';
	const sources = [path.join(fixture, 'hero with spaces.bmp'), path.join(fixture, '色 $`sprite.bmp')];
	try
	{
		for(const [platform, filename] of [['darwin', 'palette-builder'], ['linux', 'palette-builder'], ['win32', 'palette-builder.exe']])
		{
			os.platform = () => platform;
			assert.strictEqual(Configuration.getPaletteBuilder(), filename);
			await fs.promises.writeFile(path.join(fixture, filename), 'test tool');
		}
		Configuration.getUtilsPath = () => fixture;
		cp.execFile = function (tool, args, options, callback)
		{
			temporaryFolder = options.cwd;
			Promise.resolve().then(async () =>
			{
				assert.strictEqual(tool, path.join(fixture, 'palette-builder.exe'));
				assert.strictEqual(options.windowsHide, true);
				assert.ok(options.timeout > 0);
				assert.deepStrictEqual(args.slice(0, 2), ['-n', '256']);
				assert.ok(args.includes('-t'));
				assert.strictEqual(await fs.promises.readFile(args.at(-1).slice(1), 'utf8'), sources.join('\n')+'\n');
				if(mode === 'failure')
				{
					callback(new Error('tool exit'), '', 'Unable to decode image');
					return;
				}
				await fs.promises.writeFile(args[3], JSON.stringify({colors:mode === 'invalid' ? ['#ff0000zz'] : ['#00000000', '#FF000084', '#0000ffff']}));
				callback(null, 'Palette: 2 colors\n', 'Quality: test\n');
			}).catch(error => callback(error, '', ''));
		};
		assert.deepStrictEqual(await PaletteBuilder.generate([...sources, sources[0]], 256, true), ['#00000000', '#ff000084', '#0000ffff']);
		assert.ok(logged.includes('Palette: 2 colors'));
		assert.ok(logged.includes('Quality: test'));
		assert.strictEqual(fs.existsSync(temporaryFolder), false);
		mode = 'failure';
		await assert.rejects(PaletteBuilder.generate(sources, 256, true), /Unable to decode image/);
		assert.ok(logged.includes('Unable to decode image'));
		assert.strictEqual(fs.existsSync(temporaryFolder), false);
		mode = 'invalid';
		await assert.rejects(PaletteBuilder.generate(sources, 256, true), /invalid palette/);
		assert.strictEqual(fs.existsSync(temporaryFolder), false);
		await assert.rejects(PaletteBuilder.generate(sources, 257), /2 to 256/);
		await assert.rejects(PaletteBuilder.generate([], 256), /source images/);
		await assert.rejects(PaletteBuilder.generate([sources[0]+'\nextra'], 256), /valid absolute paths/);
		Configuration.getUtilsPath = () => path.join(fixture, 'missing');
		await assert.rejects(PaletteBuilder.generate(sources, 256), /not found/);

		if(process.env.WOWCUBE_PALETTE_BUILDER)
		{
			os.platform = originalPlatform;
			cp.execFile = originalExecFile;
			Configuration.getUtilsPath = () => path.dirname(process.env.WOWCUBE_PALETTE_BUILDER);
			for(let i = 0; i < sources.length; i++)
			{
				const bitmap = Buffer.alloc(58);
				bitmap.write('BM');
				bitmap.writeUInt32LE(58, 2);
				bitmap.writeUInt32LE(54, 10);
				bitmap.writeUInt32LE(40, 14);
				bitmap.writeInt32LE(1, 18);
				bitmap.writeInt32LE(1, 22);
				bitmap.writeUInt16LE(1, 26);
				bitmap.writeUInt16LE(24, 28);
				bitmap[i === 0 ? 56 : 54] = 255;
				await fs.promises.writeFile(sources[i], bitmap);
			}
			const colors = await PaletteBuilder.generate(sources, 256);
			assert.deepStrictEqual(colors.slice(1).sort(), ['#0000ffff', '#ff0000ff']);
			await assert.rejects(PaletteBuilder.generate(sources, 1), /2 to 256/);
			const alphaSource = path.join(fixture, 'semi transparent 色.png');
			await fs.promises.writeFile(alphaSource, rgbaPng([255, 0, 0, 255, 255, 0, 0, 128, 255, 0, 0, 64, 0, 255, 0, 0]));
			const alphaColors = await PaletteBuilder.generate([alphaSource], 16, true);
			assert.strictEqual(alphaColors[0], '#00000000');
			assert.deepStrictEqual(alphaColors.slice(1).sort(), ['#ff000042', '#ff000084', '#ff0000ff']);
			const sharedColors = await PaletteBuilder.generate([...sources, alphaSource], 16, true);
			assert.strictEqual(sharedColors[0], '#00000000');
			assert.deepStrictEqual(sharedColors.slice(1).sort(), ['#0000ffff', '#ff000042', '#ff000084', '#ff0000ff']);
			const limitedColors = await PaletteBuilder.generate([...sources, alphaSource], 2, true);
			assert.strictEqual(limitedColors.length, 2);
			assert.strictEqual(limitedColors[0], '#00000000');
			await fs.promises.writeFile(alphaSource, rgbaPng([127, 127, 127, 127]));
			assert.deepStrictEqual(await PaletteBuilder.generate([alphaSource], 2), ['#00000000', quantizePaletteColor('#7f7f7f7f')]);
			console.log('Installed palette-builder integration passed: RGB565+A5, distinct alpha entries, transparent reservation, shared sources, reduced palette sizes, spaces, and Unicode.');
		}
		console.log('Palette builder checks passed: platform names, CLI/list handling, output validation, and temporary-file cleanup on success and failure.');
	}
	finally
	{
		os.platform = originalPlatform;
		cp.execFile = originalExecFile;
		Configuration.getUtilsPath = originalUtilsPath;
		await fs.promises.rm(fixture, {recursive:true, force:true});
	}
}

run().catch(error =>
{
	console.error(error);
	process.exitCode = 1;
});
