const block = (type, bytes) => { const header = Buffer.alloc(5); header[0] = type; header.writeUInt32LE(bytes.length,1); return Buffer.concat([header,bytes]); };
function fontFixture(codes = [32,65,110,127], page = 'atlas.png')
{
	const info = Buffer.alloc(14); info.writeInt16LE(20); const common = Buffer.alloc(15); common.writeUInt16LE(24); common.writeUInt16LE(18,2); common.writeUInt16LE(256,4); common.writeUInt16LE(256,6); common.writeUInt16LE(1,8);
	const chars = Buffer.concat(codes.map((code,i) => { const b = Buffer.alloc(20); b.writeUInt32LE(code); b.writeUInt16LE(i*20,4); b.writeUInt16LE(12,8); b.writeUInt16LE(16,10); b.writeInt16LE(-1,12); b.writeInt16LE(2,14); b.writeInt16LE(14,16); b[19] = 15; return b; }));
	return Buffer.concat([Buffer.from('BMF\x03'),block(1,Buffer.concat([info,Buffer.from('Fixture\0')])),block(2,common),block(3,Buffer.from(page+'\0')),block(4,chars)]);
}
function pngHeader(width = 256, height = 256) { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a','hex').copy(b); b.writeUInt32BE(13,8); b.write('IHDR',12); b.writeUInt32BE(width,16); b.writeUInt32BE(height,20); b[24] = 8; b[25] = 6; return b; }
module.exports = {fontFixture,pngHeader};

function atlasPng()
{
	const width=256,height=256,header=Buffer.alloc(13),pixels=Buffer.alloc((width*4+1)*height);
	header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
	for(let y=0;y<height;y++)for(let x=0;x<width;x++){const offset=y*(width*4+1)+1+x*4;pixels[offset]=123;pixels[offset+1]=125;pixels[offset+2]=123;pixels[offset+3]=123;}
	function chunk(type,data)
	{
		const payload=Buffer.concat([Buffer.from(type),data]),length=Buffer.alloc(4),checksum=Buffer.alloc(4);let crc=0xffffffff;
		for(const byte of payload){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
		length.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,payload,checksum]);
	}
	return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',require('zlib').deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
module.exports.atlasPng=atlasPng;
