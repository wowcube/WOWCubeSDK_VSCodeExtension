// Generate an isolated, paired plain/RLE simulator gallery; never touches a user project.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const {ResourceBundles,ResourceTypes}=require('../../out/ResourceBundle');
if(!process.argv[2]) { throw new Error('Pass a temporary fixture directory.'); }
const base=path.resolve(process.argv[2]),app=path.join(base,'app_raw');fs.mkdirSync(path.join(app,'src'),{recursive:true});fs.mkdirSync(path.join(base,'images'),{recursive:true});
function png(w,h,pixels){function chunk(t,data){const bytes=Buffer.concat([Buffer.from(t),data]),len=Buffer.alloc(4),crc=Buffer.alloc(4);let v=0xffffffff;for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}len.writeUInt32BE(data.length);crc.writeUInt32BE((v^0xffffffff)>>>0);return Buffer.concat([len,bytes,crc]);}const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const data=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)Buffer.from(pixels.slice(y*w*4,(y+1)*w*4)).copy(data,y*(w*4+1)+1);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);}
for(let f=0;f<2;f++){const w=f?39:47,h=f?43:31;const rgba=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const border=x<3||y<3||x>=w-3||y>=h-3;const alpha=border?0:[0,64,128,192,255][Math.min(4,Math.floor(x*5/w))];rgba.push(f?20:220,Math.floor(y*255/h),f?240:30,alpha);}fs.writeFileSync(path.join(base,'images','frame'+f+'.png'),png(w,h,rgba));}
const bundle=ResourceBundles.create();let order=[];
for(const mode of ['rgb6666','rgb565'])for(const fullsize of [true,false])for(const encoding of ['plain','rle'])for(let f=0;f<2;f++){
 const name=(mode==='rgb6666'?'argb':'rgb')+'_'+(fullsize?'one':'two')+'_'+encoding+'_'+f;
 const sprite=ResourceTypes.get('sprite').create(name,name,'images/frame'+f+'.png',{colorMode:mode});Object.assign(sprite,{fullsize,compression:encoding,frameRate:f?3:1,sequence:{id:name.slice(0,-2),name:name.slice(0,-2),index:f}});bundle.resources.push(sprite);order.push(name);
}
fs.writeFileSync(path.join(base,'wowcubeapp-resources.json'),JSON.stringify(bundle,null,2));fs.writeFileSync(path.join(base,'wowcubeapp-build.json'),JSON.stringify({appFolder:'app_raw',idsFile:'raw_ids.h',version:'1.0.0',metadata:{application:{name:'Raw format simulator test',category:'APP_CATEGORY_GAME',guid1:'1122334455667788',guid2:'0'}}}));fs.writeFileSync(path.join(app,'app_raw.target'),'');
let pairs=[];
for(let q=0;q<4;q++)for(let side=0;side<6;side++){
 const mode=q%2?'rgb':'argb',size=side%2?'two':'one';pairs.push(`    AddPair(${side}, ${q}, BMP_${mode}_${size}_plain_0, BMP_${mode}_${size}_plain_1, BMP_${mode}_${size}_rle_0, BMP_${mode}_${size}_rle_1, ${q>=2?'true':'false'});`);
}
const text=`#pragma once
#include "oct_api.h"
#include "raw_ids.h"
#define APP_VERSION 0x01010000
#define APP_GUID1 0x1122334455667788ULL
#define APP_TITLE "Raw format simulator test"
#define APP_CATEGORIES APP_CATEGORY_GAME
struct appObject_t : octSprite_t {};
TL appObject_t Objects[200];
TL int Tick;
TL int PairIds[48];
TL int PairCount;
void AddPair(int side,int q,int a0,int a1,int b0,int b1,bool animated) {
 const float xs[4]={120,-120,-120,120},ys[4]={120,120,-120,-120};
 PairIds[PairCount++]=OCT_add(0,false,side,xs[q]-53,ys[q],0,animated,a0,animated?a1:a0,1);
 PairIds[PairCount++]=OCT_add(0,false,side,xs[q]+53,ys[q],0,animated,b0,animated?b1:b0,1);
}
OCT_CALLBACK void on_init(){OCT_restart((int*)Objects,200,sizeof(appObject_t));OCT_viewports_layout(SCHEME_CUBE,18,18);OCT_background(0x39e7);Tick=0;PairCount=0;
${pairs.join('\n')}
}
OCT_CALLBACK void on_tick(){Tick++;for(int i=0;i<PairCount;i++){auto* object=&Objects[PairIds[i]];object->Tm.A=((Tick/10)%4)*90;object->Transp=object->FrameFrom<=BMP_argb_two_rle_1 ? ((Tick/40)%4)*8:0;}}
OCT_CALLBACK void on_pretwisted(int32_t){}
OCT_CALLBACK void on_twisted(int32_t,uint32_t){}
OCT_CALLBACK void on_tap(int32_t,int32_t){}
OCT_CALLBACK void on_shake(int32_t){}
`;
fs.writeFileSync(path.join(app,'src/app.h'),text);console.log(base);
