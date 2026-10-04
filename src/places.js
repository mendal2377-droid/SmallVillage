// Shared map landmarks, measured in the same Three.js metres as the exported world.
export const PLACES=[
  {id:'house',place:'courtyard',label:'Your yard',icon:'⌂',x:-32,z:109,color:'#f0c57b'},
  {id:'village',place:'avenue',label:'Poplar avenue',icon:'↟',x:-480.8,z:241.25,color:'#d5e3b0'},
  {id:'pond',place:'pond',label:'Water & bridges',icon:'≈',x:-285.15,z:48.2,color:'#a3dcce'},
  {id:'fields',place:'fields',label:'Fields & gardens',icon:'✿',x:-154.5,z:206.8,color:'#e8d2a1'},
  {id:'school',place:'school',label:'School lane',icon:'⌖',x:.2,z:-150.7,color:'#e7dfbd'},
  {id:'forest',place:'forest',label:'Forest & lakes',icon:'♧',x:190,z:122,color:'#b5d5be'},
  {id:'coast',place:'coast',label:'Coast & beach',icon:'≈',x:476,z:160,color:'#a4dce5'},
];
export const GARDEN_PLOTS=[
  {kind:'melon',rect:[-181,196,-163,208]},
  {kind:'potato',rect:[-185,210,-163,222]},
  {kind:'tomato',rect:[-214,202,-191,209]},
  {kind:'pepper',rect:[-214,190,-191,198]},
  {kind:'cabbage',rect:[-214,214,-191,223]},
  {kind:'cucumber',rect:[-244,194,-228,215]},
];
export const ACTIVITY_SITES=[
  {id:'fish-woodland',kind:'fish',label:'Woodland pond fishing',x:192,z:124,radius:14},
  {id:'fish-pond',kind:'fish',label:'Pond fishing',x:-290,z:87,radius:11},
  {id:'fish-river',kind:'fish',label:'River fishing',x:-276,z:113,radius:8},
  {id:'fish-bridge',kind:'fish',label:'Bridge-side fishing',x:-285.15,z:48.2,radius:10},
  {id:'potato',kind:'potato',label:'Roast a potato',x:-154.5,z:213,radius:8},
  {id:'melon',kind:'melon',label:'Sneak a watermelon',x:-164,z:202,radius:12},
  {id:'rabbit',kind:'rabbit',label:'Chase a rabbit',x:-174,z:218,radius:16},
  {id:'kite',kind:'kite',label:'Fly a kite',x:-480.8,z:241.25,radius:14},
  {id:'firework',kind:'firework',label:'Night fireworks',x:-472,z:242,radius:18},
];
export const ACTIVITY_TYPES={
  fish:{label:'Fishing',icon:'≈',color:'#7bc6c2',hint:'Spring, summer and autumn'},
  potato:{label:'Roast potato',icon:'♨',color:'#d6ae79',hint:'Dry weather'},
  melon:{label:'Watermelon',icon:'◒',color:'#add27a',hint:'Summer and autumn'},
  rabbit:{label:'Chase rabbit',icon:'♧',color:'#e3c6ae',hint:'All seasons'},
  kite:{label:'Fly kite',icon:'◇',color:'#cbadce',hint:'Dry weather'},
  firework:{label:'Fireworks',icon:'✦',color:'#e5ca82',hint:'Dry nights'},
};
// Entry points must use traversable shore/field ground, never the water or a tree trunk.
export function activitySpawn(nav,site){
  const h=nav.ground??.1;
  for(let ring=0;ring<9;ring++)for(let i=0;i<(ring?16:1);i++){
    const x=site.x+Math.cos(i*Math.PI/8)*ring*.6,z=site.z+Math.sin(i*Math.PI/8)*ring*.6;
    if(x<nav.bounds[0]+.2||x>nav.bounds[2]-.2||z<nav.bounds[1]+.2||z>nav.bounds[3]-.2)continue;
    const bridge=nav.bridges.some(([a,b,c,d])=>x>=a&&x<=c&&z>=b&&z<=d);
    if(!bridge&&nav.waterZones.some(w=>w.shape==='ellipse'?((x-w.center[0])/(w.radius[0]+.2))**2+((z-w.center[1])/(w.radius[1]+.2))**2<1:x>w.rect[0]-.2&&x<w.rect[2]+.2&&z>w.rect[1]-.2&&z<w.rect[3]+.2))continue;
    if(nav.boxes.some(([cx,cz,hx,hz,a,low=-100,high=100])=>high>h+.04&&low<h+1.73&&Math.abs(Math.cos(a)*(x-cx)-Math.sin(a)*(z-cz))<hx+.2&&Math.abs(Math.sin(a)*(x-cx)+Math.cos(a)*(z-cz))<hz+.2))continue;
    return {spawn:[x,h+1.65,z],yaw:0};
  }
  return null;
}
