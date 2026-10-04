import {createPlantingMask} from './planting.js';

export const WOODLAND={rect:[112,-78,304,223],ponds:[
  {shape:'ellipse',center:[183,30],radius:[43,32],name:'Willow pond'},
  {shape:'ellipse',center:[240,134],radius:[46,34],name:'Dragonfly pond'},
],trail:[[.2,132],[110,132],[146,95],[181,82],[194,94],[179,132],[192,179],[240,186],[291,177],[300,128],[281,85],[236,76],[240,-16],[180,-21],[131,-7],[125,58],[146,95]],spawn:[194,1.75,94]};

// An additive landscape layer leaves the measured courtyard and Blender exports intact.
// Every consumer receives these same water boundaries, path footprints and trunk colliders.
export function extendWoodlandNavigation(source){
  const nav=structuredClone(source);nav.waterZones.push(...WOODLAND.ponds);
  nav.places.forest={spawn:WOODLAND.spawn,yaw:Math.atan2(-46,-40)};nav.woodland=WOODLAND;
  const trails=[];
  for(let i=1;i<WOODLAND.trail.length;i++){
    const [x,z]=WOODLAND.trail[i-1],[a,b]=WOODLAND.trail[i],dx=a-x,dz=b-z;
    trails.push([(x+a)/2,(z+b)/2,Math.hypot(dx,dz)/2+1.3,1.7,-Math.atan2(dz,dx)]);
  }
  nav.roads.push(...trails);nav.flowerTrails=trails;
  const mask=createPlantingMask(nav);let seed=7841;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const trees=[];
  for(let i=0;i<1600&&trees.length<330;i++){
    const x=114+random()*185,z=-75+random()*293;
    if(!mask.land(x,z,3.5)||trees.some(p=>Math.hypot(x-p.x,z-p.z)<6))continue;
    const kind=Math.floor(random()*5),scale=.72+random()*.8;
    trees.push({x,z,y:.1,kind,angle:random()*Math.PI*2,scale});
    nav.boxes.push([x,z,.23*scale,.23*scale,0,.1,14*scale]);
  }
  nav.woodlandTrees=trees;
  return nav;
}
