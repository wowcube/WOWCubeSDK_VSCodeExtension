"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBitmapFont = parseBitmapFont;
// BMFont binary v3; the engine does not apply BMFont kerning pairs.
function parseBitmapFont(bytes) {
    const data = Buffer.from(bytes);
    if (data.length < 4 || data.toString('ascii', 0, 3) !== 'BMF' || data[3] !== 3) {
        throw new Error('Choose a binary BMFont v3 .fnt file.');
    }
    const blocks = new Map();
    for (let offset = 4; offset < data.length;) {
        if (offset + 5 > data.length) {
            throw new Error('The font contains a truncated block header.');
        }
        const type = data[offset], size = data.readUInt32LE(offset + 1);
        offset += 5;
        if (offset + size > data.length) {
            throw new Error('The font contains a truncated block.');
        }
        if (blocks.has(type)) {
            throw new Error('The font contains a duplicate block.');
        }
        blocks.set(type, data.subarray(offset, offset + size));
        offset += size;
    }
    const info = blocks.get(1), common = blocks.get(2), pages = blocks.get(3), chars = blocks.get(4);
    if (!info || info.length < 15 || info[info.length - 1] !== 0 || !common || common.length !== 15 || !pages || pages[pages.length - 1] !== 0 || !chars || chars.length % 20) {
        throw new Error('The font is missing valid information, page or character blocks.');
    }
    if (common.readUInt16LE(8) !== 1 || common[10] & 128 || pages.subarray(0, -1).includes(0)) {
        throw new Error('Only single-page, unpacked bitmap fonts are supported.');
    }
    const font = { family: info.toString('utf8', 14).replace(/\0$/, ''), size: Math.abs(info.readInt16LE(0)), lineHeight: common.readUInt16LE(0), baseline: common.readUInt16LE(2), width: common.readUInt16LE(4), height: common.readUInt16LE(6), page: pages.toString('utf8', 0, pages.length - 1), glyphs: [], ignored: [] };
    if (/^[\\/]|[:\r\n]/.test(font.page)) {
        throw new Error('The atlas reference must be a relative PNG path.');
    }
    if (!font.width || !font.height || !font.lineHeight || !font.page || !/\.png$/i.test(font.page)) {
        throw new Error('The font must reference a PNG atlas and have nonzero dimensions.');
    }
    const codes = new Set();
    for (let i = 0; i < chars.length; i += 20) {
        const glyph = { code: chars.readUInt32LE(i), x: chars.readUInt16LE(i + 4), y: chars.readUInt16LE(i + 6), width: chars.readUInt16LE(i + 8), height: chars.readUInt16LE(i + 10), xOffset: chars.readInt16LE(i + 12), yOffset: chars.readInt16LE(i + 14), advance: chars.readInt16LE(i + 16) };
        if (codes.has(glyph.code)) {
            throw new Error('Duplicate character code ' + glyph.code + '.');
        }
        codes.add(glyph.code);
        if (chars[i + 18] !== 0 || chars[i + 19] !== 15 || glyph.x + glyph.width > font.width || glyph.y + glyph.height > font.height) {
            throw new Error('Character ' + glyph.code + ' has invalid atlas bounds, page or channels.');
        }
        if (glyph.code < 32 || glyph.code > 127) {
            font.ignored.push(glyph.code);
            continue;
        }
        if (glyph.width > 240 || glyph.height > 240) {
            throw new Error('Character ' + glyph.code + ' exceeds the 240 × 240 sprite limit.');
        }
        font.glyphs.push(glyph);
    }
    if (!font.glyphs.some(glyph => glyph.code === 110)) {
        throw new Error('The font must contain “n” (character 110). The engine needs it to draw labels and calculate spacing.');
    }
    font.glyphs.sort((a, b) => a.code - b.code);
    return font;
}
//# sourceMappingURL=BitmapFont.js.map