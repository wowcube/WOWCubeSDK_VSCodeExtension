// Exercise builder-produced assets against the installed SDK simulator renderer.
#include "oct_test_shim.h"
#define MINIMP3_IMPLEMENTATION
#include "oct.h"
#include <fstream>
#include <vector>
#include <string>
#include <cstdio>
#include <cassert>
static const uint16_t BG=0x39e7;
static std::vector<uint8_t> load(const std::string& name){std::ifstream input(name,std::ios::binary);assert(input);return std::vector<uint8_t>(std::istreambuf_iterator<char>(input),{});}
static std::vector<uint16_t> draw(const std::vector<uint8_t>& data,int x,int y,int angle,int transparency,int hor=1,int vert=1){
 std::vector<uint16_t> front(SIDE*SIDE,BG);std::fill(OctBack,OctBack+HALFSIDE*HALFSIDE,BG);OctDevMode=0;OctRenderOff=0;
 OCT_RENDER_bmp(front.data(),x,y,(const octBmp_t*)data.data(),nullptr,angle,hor,vert,transparency,0,0,0,nullptr,nullptr,0,0,0,nullptr);
 assert(OCT_RENDER_overlay_flush());front.insert(front.end(),OctBack,OctBack+HALFSIDE*HALFSIDE);return front;
}
int main(int argc,char**argv){assert(argc==2);Debug=new simDebug();Debug->Init("render_matrix.log");SET.TimeZero=SIM_now_ms();OCT_SHIM_init();int cases=0;
 for(const std::string mode:{"argb","rgb"})for(const std::string size:{"one","two"})for(int frame=0;frame<2;frame++){
  auto plain=load(std::string(argv[1])+"/"+mode+"_"+size+"_plain_"+std::to_string(frame)+".raw");auto rle=load(std::string(argv[1])+"/"+mode+"_"+size+"_rle_"+std::to_string(frame)+".raw");
  for(int angle:{0,90,180,270})for(int alpha:{0,8,16,24,31})for(const auto position:std::vector<std::pair<int,int>>{{0,0},{80,80},{-20,-10},{239,239},{500,500}})for(int flip:{1,-1}){
   const auto a=draw(plain,position.first,position.second,angle,alpha,flip,1),b=draw(rle,position.first,position.second,angle,alpha,flip,1);
   if(a!=b){std::fprintf(stderr,"Mismatch %s %s frame %d angle %d transparency %d xy %d,%d flip %d\n",mode.c_str(),size.c_str(),frame,angle,alpha,position.first,position.second,flip);return 1;}cases++;
  }
  const auto visible=draw(rle,0,0,0,0),hidden=draw(rle,0,0,0,31);const size_t offset=size=="one"?0:SIDE*SIDE;
  if(mode=="argb"){
   assert(visible[offset]==BG); // source alpha zero leaves the background intact
   for(size_t i=0;i<(size=="one"?SIDE*SIDE:HALFSIDE*HALFSIDE);i++)assert(hidden[offset+i]==BG);
   const auto* bmp=(const octBmp_t*)plain.data();bool partial=false,opaque=false;
   for(int y=3;y<bmp->H-3;y++)for(int x=3;x<bmp->W-3;x++){
    const auto* pixel=plain.data()+48+(y*bmp->W+x)*3;unsigned texel=pixel[0]|pixel[1]<<8|pixel[2]<<16;unsigned a6=texel>>18;uint16_t fg=((texel>>2)&0xF800)|((texel>>1)&0x7ff);const auto actual=visible[offset+y*(size=="one"?SIDE:HALFSIDE)+x];
    if(a6==63){assert(actual==fg);opaque=true;}
    if(a6>8&&a6<55){assert(actual!=BG&&actual!=fg);partial=true;}
   }
   assert(partial&&opaque);
  }else{assert(visible[offset]==0);assert(visible==hidden);} // RGB565 RLE stays opaque, including black
 }
 std::printf("PASS: %d builder-produced plain/RLE render comparisons, 0/90/180/270 rotation, 1x/2x, frame sizes, clipping, flips, alpha ramp and runtime transparency.\n",cases);return 0;
}
