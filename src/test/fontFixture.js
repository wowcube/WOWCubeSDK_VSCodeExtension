const block = (type, bytes) => { const header = Buffer.alloc(5); header[0] = type; header.writeUInt32LE(bytes.length,1); return Buffer.concat([header,bytes]); };
function fontFixture(codes = [32,65,110,127], page = 'atlas.png')
{
	const info = Buffer.alloc(14); info.writeInt16LE(20); const common = Buffer.alloc(15); common.writeUInt16LE(24); common.writeUInt16LE(18,2); common.writeUInt16LE(256,4); common.writeUInt16LE(256,6); common.writeUInt16LE(1,8);
	const chars = Buffer.concat(codes.map((code,i) => { const b = Buffer.alloc(20); b.writeUInt32LE(code); b.writeUInt16LE(i*20,4); b.writeUInt16LE(12,8); b.writeUInt16LE(16,10); b.writeInt16LE(-1,12); b.writeInt16LE(2,14); b.writeInt16LE(14,16); b[19] = 15; return b; }));
	return Buffer.concat([Buffer.from('BMF\x03'),block(1,Buffer.concat([info,Buffer.from('Fixture\0')])),block(2,common),block(3,Buffer.from(page+'\0')),block(4,chars)]);
}
function pngHeader(width = 256, height = 256) { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a','hex').copy(b); b.writeUInt32BE(13,8); b.write('IHDR',12); b.writeUInt32BE(width,16); b.writeUInt32BE(height,20); b[24] = 8; b[25] = 6; return b; }
module.exports = {fontFixture,pngHeader};
