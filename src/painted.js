import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

let assets;
// Imagegen artwork is shipped with the application. No image service is contacted during play.
export async function loadPaintedAssets(){
  if(assets)return assets;
  const loader=new THREE.TextureLoader();
  const [foliage,meadow,ground]=await Promise.all(['foliage','meadow','ground'].map(n=>loader.loadAsync(`/textures/painted/${n}.png`)));
  for(const t of [foliage,meadow,ground]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  ground.wrapS=ground.wrapT=THREE.RepeatWrapping;
  return assets={foliage,meadow,ground};
}
export function paintGround(mat){
  mat.map=assets.ground;mat.color.set('#dce2c3');mat.bumpMap=null;
  if(mat.userData.paintGround)return;mat.userData.paintGround=true;
  const previous=mat.onBeforeCompile,cache=mat.customProgramCacheKey();
  mat.onBeforeCompile=shader=>{previous(shader);shader.vertexShader='varying vec3 brushGround;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbrushGround=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 brushGround;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor*=texture2D(map,brushGround.xz*.10);\n#endif');};
  mat.customProgramCacheKey=()=>cache+'-painted-ground';mat.needsUpdate=true;
}
export function paintedMaterial(kind='foliage',color='#d2ddbc'){
  if(!assets)throw Error('Painted assets must load before vegetation');
  return new THREE.MeshStandardMaterial({map:assets[kind],color,alphaTest:.38,side:THREE.DoubleSide,roughness:1});
}
// Overlapping painted sprays form a volume, with no opaque sphere hiding the branches.
export function canopyGeometry(kind,r){
  const parts=[],height=kind===1?7.2:kind===3?6.8:4.4,width=kind===1?1.7:kind===3?3.0:3.5;
  for(let i=0;i<28;i++){
    const t=r(),a=r()*Math.PI*2,reach=Math.sqrt(r())*width*(kind===3?1-t*.8:Math.sin(t*Math.PI)*.65+.35);
    const g=new THREE.PlaneGeometry(1,1);
    const s=1.6+r()*1.4;g.scale(s,kind===1?s*1.25:s,1);g.rotateY(a);g.rotateZ((r()-.5)*.55);g.rotateX((r()-.5)*.8);
    g.translate(Math.sin(a)*reach,4+t*height,Math.cos(a)*reach);parts.push(g);
  }
  const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geo;
}
