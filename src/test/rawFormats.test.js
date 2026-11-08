// Raw-format contract, shared preview quantization, and optional real-builder verification.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const zlib = require('zlib');
const {ResourceBundles,ResourceTypes} = require('../../out/ResourceBundle');
const pixels = require('../../media/spritepixels');
const validate = new (require('ajv'))({allErrors:true}).compile(require('../../schemas/wowcubeapp-resources.schema.json'));
const bundle=ResourceBundles.create();const sprite=ResourceTypes.get('sprite').create('raw','raw','source.png',{colorMode:'rgb6666'});bundle.resources.push(sprite);
for(const compression of [null,'plain','rle']) {
    sprite.compression=compression;assert(validate(bundle),JSON.stringify(validate.errors));assert.deepStrictEqual(ResourceBundles.validate(bundle),[]);
}
for(const blend of ['opaque','additive','bg','bump','dudv','refl']) {sprite.blend=blend;assert(!validate(bundle));assert(ResourceBundles.validate(bundle).length);}
sprite.blend='alpha';sprite.compression='softkey';assert(!validate(bundle));
sprite.compression='rle';sprite.paletteId='unexpected';assert(!validate(bundle));sprite.paletteId=null;
const input=Uint8ClampedArray.from(Array.from({length:256},(_,i)=>[i,255-i,(i*11)%256,i]).flat());
for(const dither of [false,true]) {
    const converted=input.slice();pixels.convert(converted,16,{...sprite,dither});
    for(let i=0;i<256;i++) {const q=i>>2;assert.strictEqual(converted[i*4+3],(q<<2)|(q>>4));}
    const plain=input.slice(),rle=input.slice();pixels.convert(plain,16,{...sprite,dither,compression:'plain'});pixels.convert(rle,16,{...sprite,dither,compression:'rle'});assert.deepStrictEqual(plain,rle);
}
const quantized=Uint8ClampedArray.from([3,4,127,128,255,0,254,255]);pixels.convert(quantized,2,{...sprite,dither:false});assert.deepStrictEqual([...quantized],[0,4,125,130,255,0,255,255]);
function png(w,h,data) {
    function chunk(type,body) {const bytes=Buffer.concat([Buffer.from(type),body]),length=Buffer.alloc(4),crc=Buffer.alloc(4);let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}length.writeUInt32BE(body.length);crc.writeUInt32BE((value^0xffffffff)>>>0);return Buffer.concat([length,bytes,crc]);}
    const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
    const rows=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)Buffer.from(data.slice(y*w*4,(y+1)*w*4)).copy(rows,y*(w*4+1)+1);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
function decode(raw,bytes) {
    const w=raw.readInt16LE(36),h=raw.readInt16LE(38),format=raw.readUInt32LE(32)&255;
    if(format===0||format===3)return raw.subarray(48,48+w*h*bytes);
    const table=(h*2+3)&~3;assert(raw.subarray(48+h*2,48+table).every(byte=>byte===0));let position=48+table;const output=[];
    for(let y=0;y<h;y++) {const end=position+raw.readUInt16LE(48+y*2);let count=0;while(position<end){const control=raw[position++],n=control<128?control+1:control-128+2;const texel=raw.subarray(position,position+bytes);for(let i=0;i<n;i++){output.push(...(control<128?raw.subarray(position+i*bytes,position+(i+1)*bytes):texel));}position+=bytes*(control<128?n:1);count+=n;}assert.strictEqual(position,end);assert.strictEqual(count,w);}
    return Buffer.from(output);
}
async function run() {
    if(process.env.WOWCUBE_RESOURCE_BUILDER) {
        const folder=await fs.promises.mkdtemp(path.join(os.tmpdir(),'wowcube raw formats 色 '));
        try {
            await fs.promises.mkdir(path.join(folder,'app'));
            const manifest=path.join(folder,'wowcubeapp-resources.json'),build=path.join(folder,'wowcubeapp-build.json');
            await fs.promises.writeFile(build,JSON.stringify({appFolder:'app',idsFile:'ids.h',metadata:{application:{name:'RAW'}}}));
            const output=path.join(folder,'app/art/packed/raw.raw');
            bundle.registries={groups:['raw_group'],types:['raw_type'],tags:['raw_tag']};Object.assign(sprite,{group:'raw_group',objectType:'raw_type',tags:['raw_tag'],number:-17,frameRate:2});
            const compile=async(expected=0)=>{const result=cp.spawnSync(process.env.WOWCUBE_RESOURCE_BUILDER,[manifest,'--build',build],{encoding:'utf8'});assert.strictEqual(result.status,expected,result.stdout+result.stderr);return result;};
            for(const [w,h] of [1,2,127,128,129,130,240].map(w=>[w,3]).concat([[240,240]])) {
                const rgba=Array.from({length:w*h},(_,i)=>i<w?[255,127,64,(i*4)%256]:i<w*2?[20,40,60,128]:[(i*17)%256,(i*11)%256,(i*5)%256,255]).flat();
                await fs.promises.writeFile(path.join(folder,'source.png'),png(w,h,rgba));
                for(const dither of [false,true]) {
                    let previous;
                    for(const compression of ['plain','rle',null]) {
                        Object.assign(sprite,{colorMode:'rgb6666',blend:'alpha',compression,dither,pivot:{x:0.5,y:1},collider:{enabled:true,x:0,y:0,width:1,height:2}});
                        await fs.promises.writeFile(manifest,JSON.stringify(bundle));await compile();const raw=await fs.promises.readFile(output);
                        assert.strictEqual(raw.readUInt32LE(32)&255,compression==='plain'?3:4);assert.strictEqual(raw[44]&0x81,0x80);assert.strictEqual(raw.readUInt16LE(0),0);
                        assert.strictEqual(raw.readFloatLE(4),0.5);assert.strictEqual(raw.readFloatLE(8),1.5);
                        assert.strictEqual(raw.readUInt32LE(28),1);assert.strictEqual(raw.readInt16LE(40),-17);assert.strictEqual(raw[42],1);assert.strictEqual(raw[43],1);assert.strictEqual(raw[45],2);assert.strictEqual(raw.readFloatLE(20),0.5);assert.strictEqual(raw.readFloatLE(24),1);
                        const decoded=decode(raw,3),expected=Uint8ClampedArray.from(rgba);pixels.argb6666Preview(expected,w,dither);
                        for(let i=0;i<w*h;i++){const packed=decoded[i*3]|decoded[i*3+1]<<8|decoded[i*3+2]<<16;assert.deepStrictEqual([(packed>>12)&63,(packed>>6)&63,packed&63,(packed>>18)&63],[expected[i*4]>>2,expected[i*4+1]>>2,expected[i*4+2]>>2,rgba[i*4+3]>>2]);}
                        if(previous)assert.deepStrictEqual(decoded,previous);previous=decoded;
                        if(compression==='rle' && process.env.WOWCUBE_ARGB_REFERENCE) {
                            const rows=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>decoded.subarray((y*w+x)*3,(y*w+x+1)*3).toString('hex')));
                            const reference=cp.spawnSync(process.env.WOWCUBE_REFERENCE_PYTHON || 'python3',[path.join(__dirname,'argbReference.py'),process.env.WOWCUBE_ARGB_REFERENCE],{input:JSON.stringify(process.env.WOWCUBE_REFERENCE_PYTHON ? {rgba,width:w,height:h,dither} : rows),encoding:'utf8'});
                            assert.strictEqual(reference.status,0,reference.stderr);const expectedRows=JSON.parse(reference.stdout);
                            if(process.env.WOWCUBE_REFERENCE_PYTHON) {
                                assert.strictEqual(decoded.toString('hex'),expectedRows.texels);
                                assert.strictEqual(raw.subarray(48,48+expectedRows.body.length/2).toString('hex'),expectedRows.body);
                            } else {
                                let at=48+((2*h+3)&~3);for(let y=0;y<h;y++){const length=raw.readUInt16LE(48+y*2);assert.strictEqual(raw.subarray(at,at+length).toString('hex'),expectedRows[y]);at+=length;}
                            }
                        }
                    }
                }
                Object.assign(sprite,{colorMode:'rgb565',blend:'opaque',compression:'plain',dither:false});await fs.promises.writeFile(manifest,JSON.stringify(bundle));await compile();const plain=decode(await fs.promises.readFile(output),2);
                sprite.compression='rle';await fs.promises.writeFile(manifest,JSON.stringify(bundle));await compile();const rleRaw=await fs.promises.readFile(output);assert.strictEqual(rleRaw.readUInt32LE(32),1);assert.deepStrictEqual(decode(rleRaw,2),plain);
            }
            for(const edit of [{colorMode:'rgb6666',blend:'opaque',compression:'rle'},{colorMode:'rgb6666',blend:'alpha',compression:'softkey'},{colorMode:'unknown'},{colorMode:'palette',blend:'bump'}]) {
                Object.assign(sprite,{colorMode:'rgb6666',blend:'alpha',compression:'rle'},edit);await fs.promises.writeFile(manifest,JSON.stringify(bundle));const before=await fs.promises.readFile(output);await compile(1);assert.deepStrictEqual(await fs.promises.readFile(output),before);
            }
            console.log('Installed raw builder checks passed: ARGB6666 plain/RLE/null, six-bit quantization and RGB dithering, alpha, row boundaries/padding, RGB565 RLE and rejected combinations.');
        } finally {await fs.promises.rm(folder,{recursive:true,force:true});}
    }
    console.log('Raw-format checks passed: schema/model parity, Embedded alpha only, lossless RLE preview equivalence and alpha-preserving dithering.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
