// Exact paving footprints are exported from the saved Blender scene.
import {inCoastWater} from './coast-layout.js';
// Keep every generated trunk, tuft and bank prop off roads, bridge approaches and buildings.
export function createPlantingMask(nav,roads=nav.roads||[]){
  function onRoad(x,z,margin=0){return roads.some(([cx,cz,hx,hz,a])=>{const c=Math.cos(a),s=Math.sin(a),dx=x-cx,dz=z-cz;return Math.abs(c*dx-s*dz)<hx+margin&&Math.abs(s*dx+c*dz)<hz+margin;})||(nav.bridges||[]).some(([a,b,c,d])=>x>a-margin&&x<c+margin&&z>b-margin&&z<d+margin);}
  function inWater(x,z,margin=0){return inCoastWater(nav,x,z,margin)||(nav.waterZones||[]).some(w=>w.shape==='ellipse'?((x-w.center[0])/(w.radius[0]+margin))**2+((z-w.center[1])/(w.radius[1]+margin))**2<1:x>w.rect[0]-margin&&x<w.rect[2]+margin&&z>w.rect[1]-margin&&z<w.rect[3]+margin);}
  function inBuilding(x,z,margin=0){return (nav.boxes||[]).some(([cx,cz,hx,hz,a,low,high])=>{if(high<.55)return false;const c=Math.cos(a),s=Math.sin(a),dx=x-cx,dz=z-cz;return Math.abs(c*dx-s*dz)<hx+margin&&Math.abs(s*dx+c*dz)<hz+margin;});}
  function land(x,z,margin=.4){const [a,b,c,d]=nav.bounds;return x>a+margin&&x<c-margin&&z>b+margin&&z<d-margin&&!onRoad(x,z,margin)&&!inWater(x,z,margin)&&!inBuilding(x,z,margin);}
  function tree(x,z,occupied=[]){for(const distance of [0,2,4,6,8,12,16])for(let j=0;j<(distance?24:1);j++){const a=j/24*Math.PI*2,px=x+Math.cos(a)*distance,pz=z+Math.sin(a)*distance;if(land(px,pz,.9)&&occupied.every(([tx,tz])=>Math.hypot(px-tx,pz-tz)>3))return [px,pz];}return null;}
  return {onRoad,inWater,inBuilding,land,tree};
}
