import {seeded} from './organic.js';

// Shared geometry and navigation: the bridge crosses only the shallow western cove.
export const POND_GARDEN={bridge:{x:195,z:134,width:3.4,length:24},pavilion:[173,155],branch:[[179,132],[190,122],[195,122],[195,146],[192,179]]};
export function bridgeHeight(z){return .1+.9*Math.max(0,1-Math.abs(z-134)/12);}
export function koiPose(f,time){const a=time*f.speed+f.phase;return {x:f.cx+Math.sin(a)*f.rx,z:f.cz+Math.cos(a)*f.rz,y:-.48+Math.sin(a*2+f.phase)*.09,yaw:Math.atan2(-Math.cos(a)*f.rx,Math.sin(a)*f.rz)};}
export function installPondGarden(nav){
  const garden={...POND_GARDEN,rocks:[],trees:[]},r=seeded(812),[px,pz]=garden.pavilion;
  nav.roads.push([px,pz,3.2,3.2,0]);
  nav.bridges.push([193.3,122,196.7,146]);
  nav.surfaces.push({rect:[193.3,122,196.7,134],height:.1,rise:.9,axis:'z'},{rect:[193.3,134,196.7,146],height:1,rise:-.9,axis:'z'});
  for(const x of [193.25,196.75])for(let z=124;z<146;z+=2)nav.boxes.push([x,z,.075,1,0,bridgeHeight(z),bridgeHeight(z)+1]);
  for(const x of [px-2.2,px+2.2])for(const z of [pz-2.2,pz+2.2])nav.boxes.push([x,z,.16,.16,0,.1,3.8]);
  for(const z of [pz-2,pz+2])nav.boxes.push([px,z,1.7,.25,0,.1,.7]);
  for(const [pi,pond] of nav.woodland.ponds.entries())for(let i=0;i<95;i++){
    const a=i/95*Math.PI*2+(r()-.5)*.045,rad=.995+r()*.025,x=pond.center[0]+Math.cos(a)*pond.radius[0]*rad,z=pond.center[1]+Math.sin(a)*pond.radius[1]*rad;
    if(nav.roads.some(([cx,cz,hx,hz,angle])=>{const dx=x-cx,dz=z-cz,c=Math.cos(angle),s=Math.sin(angle);return Math.abs(c*dx-s*dz)<hx+1.7&&Math.abs(s*dx+c*dz)<hz+1.7;})||Math.abs(x-195)<3&&z>118&&z<150)continue;
    const scale=[1.1+r()*1.5,.35+r()*.55,.8+r()*1.1];garden.rocks.push({x,z,y:.03,scale,angle:r()*6.28,pond:pi});nav.boxes.push([x,z,scale[0]*.7,scale[2]*.7,0,-1,scale[1]]);
  }
  for(const [x,z,kind] of [[181,151,'blossom'],[170,143,'maple'],[183,167,'blossom'],[206,174,'maple'],[223,176,'blossom'],[204,100,'blossom'],[154,57,'blossom'],[218,56,'maple']]){garden.trees.push({x,z,kind,angle:r()*6.28});nav.boxes.push([x,z,.25,.25,0,.1,8]);}
  nav.pondGarden=garden;return garden;
}
