function wav({rate=44100,channels=2,bits=16,float=false,seconds=.8,sample=(i,c)=>Math.sin(i/30)*.5}={})
{
	const count=Math.round(seconds*rate), data=Buffer.alloc(44+count*channels*bits/8);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(float?3:1,20);data.writeUInt16LE(channels,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*channels*bits/8,28);data.writeUInt16LE(channels*bits/8,32);data.writeUInt16LE(bits,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);
	for(let i=0;i<count;i++)for(let c=0;c<channels;c++){const offset=44+(i*channels+c)*bits/8,v=sample(i,c);if(float)data.writeFloatLE(v,offset);else if(bits===8)data[offset]=Math.max(0,Math.min(255,Math.round(v*127+128)));else if(bits===16)data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(v*32768))),offset);else data.writeIntLE(Math.max(-8388608,Math.min(8388607,Math.round(v*8388608))),offset,3);}
	return data;
}
module.exports={wav};
