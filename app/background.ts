import * as T from 'three';

// Render the reference gradient inside WebGL, independent of canvas transparency.
export function createVillageBackground(){
 const width=512,height=512,data=new Uint8Array(width*height*4);
 const stops=[[65,104,91],[26,65,64],[16,46,50]];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const radius=Math.hypot((x/width-.65)/.80,(y/height-.46)/.71);
  const segment=radius<.48?0:1,t=T.MathUtils.clamp(segment===0?radius/.48:(radius-.48)/.32,0,1);
  const i=(y*width+x)*4;for(let c=0;c<3;c++)data[i+c]=Math.round(T.MathUtils.lerp(stops[segment][c],stops[segment+1][c],t));data[i+3]=255;
 }
 const texture=new T.DataTexture(data,width,height);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.LinearFilter;texture.flipY=true;texture.needsUpdate=true;return texture;
}
