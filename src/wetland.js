import * as THREE from 'three';
import {seeded,material,oval,stem,leaf,lotusLeaf,merged,instances} from './organic.js';
import {createPlantingMask} from './planting.js';

// Representative pond ecology; species/positions are decorative interpretations.
export function createWetland({parent,nav,environment}){
  const root=new THREE.Group();root.name='Living pond margins';parent.add(root);
  const mask=createPlantingMask(nav),r=seeded(1514),frogs=[],dragonflies=[],rings=[];
  const green=material('#507c43'),dark=material('#314b2d'),cream=material('#c3bd84'),reedMat=material('#788457'),brown=material('#795b36');
  const ribbon=new THREE.Group();for(let j=0;j<7;j++)leaf(ribbon,[0,-.22,0],.023,.32+r()*.3,j*2.4,green,0,-1.0+r()*.3);
  const cattail=new THREE.Group();for(let j=0;j<3;j++){const a=j*2.4,x=Math.sin(a)*.13,z=Math.cos(a)*.13,h=.8+r()*.6;stem(cattail,[[x,0,z],[x+.06,h*.7,z],[x,h,z]],.009,reedMat);oval(cattail,[x,h,z],[.032,.17,.032],brown);for(let k=0;k<3;k++)leaf(cattail,[x,.05,z],.022,h*.85,a+k*1.7,reedMat,0,-.8);}
  const duck=new THREE.Group();for(let j=0;j<8;j++){const m=new THREE.Mesh(lotusLeaf(.04+r()*.05),green);m.position.set((r()-.5)*.5,0,(r()-.5)*.5);m.scale.y=.08;duck.add(m);}
  const submerged=[],margins=[],floating=[];
  const ponds=nav.waterZones.filter(w=>w.shape==='ellipse');
  for(const [pi,w] of ponds.entries()){
    for(let j=0;j<180;j++){const a=r()*6.28,t=.76+r()*.18,x=w.center[0]+Math.cos(a)*w.radius[0]*t,z=w.center[1]+Math.sin(a)*w.radius[1]*t;if(mask.onRoad(x,z,.6))continue;submerged.push({x,z,y:0,angle:r()*6.28,scale:.65+r()*.7});if(j%4===0)floating.push({x,z,y:.063,angle:r()*6.28,scale:.7+r()*.6});}
    for(let j=0;j<90;j++){const a=r()*6.28,t=1.04+r()*.025,x=w.center[0]+Math.cos(a)*w.radius[0]*t,z=w.center[1]+Math.sin(a)*w.radius[1]*t;if(mask.land(x,z,.55))margins.push({x,z,y:.1,scale:.65+r()*.6,angle:r()*6.28});}
    for(let j=0;j<10;j++){const a=(j+.35+r()*.35)/10*6.28,x=w.center[0]+Math.cos(a)*(w.radius[0]+.9),z=w.center[1]+Math.sin(a)*(w.radius[1]+.9);if(!mask.land(x,z,.5))continue;const target=new THREE.Vector3(w.center[0]+Math.cos(a)*w.radius[0]*.94,.075,w.center[1]+Math.sin(a)*w.radius[1]*.94);if(Array.from({length:9},(_,i)=>mask.onRoad(x+(target.x-x)*i/8,z+(target.z-z)*i/8,.3)).some(Boolean))continue;
      const g=new THREE.Group();g.name='Black-spotted pond frog';oval(g,[0,.07,.025],[.085,.055,.13],green);oval(g,[0,.075,-.095],[.083,.04,.073],green);oval(g,[0,.03,-.025],[.06,.027,.095],cream);
      for(const s of [-1,1]){oval(g,[s*.055,.108,-.125],[.026,.025,.026],green);oval(g,[s*.055,.118,-.143],[.017,.018,.011],material('#b8a75c'));oval(g,[s*.055,.12,-.154],[.009,.012,.006],dark);stem(g,[[s*.055,.06,-.07],[s*.11,.028,-.04],[s*.085,.011,-.14]],.012,green);oval(g,[s*.105,.045,.12],[.06,.038,.085],green);stem(g,[[s*.13,.03,.12],[s*.17,.014,.17],[s*.1,.008,.20]],.015,green);for(let k=0;k<3;k++)stem(g,[[s*.1,.012,.20],[s*(.09+k*.025),.008,.25+k*.012]],.004,green);stem(g,[[s*.045,.117,-.06],[s*.05,.123,.03],[s*.045,.108,.1]],.008,cream);}
      for(let k=0;k<12;k++)oval(g,[(r()-.5)*.10,.116+r()*.007,(r()-.5)*.17],[.009,.003,.012],dark);
      const body=merged(g),home=new THREE.Vector3(x,.11,z);body.position.copy(home);body.scale.setScalar(.85+r()*.45);root.add(body);frogs.push({g:body,home,target,water:false,jump:null,next:0,phase:r()*6.28});
    }
    for(let j=0;j<5;j++){const g=new THREE.Group(),blue=material('#528f88');oval(g,[0,0,0],[.013,.014,.10],blue);oval(g,[0,0,-.075],[.035,.027,.032],dark);for(const s of [-1,1])for(const z of [-.015,.04]){const wing=oval(g,[s*.08,.005,z],[.09,.003,.023],new THREE.MeshStandardMaterial({color:'#c8ddd1',transparent:true,opacity:.5,roughness:.3,side:THREE.DoubleSide,depthWrite:false}));wing.rotation.y=s*.3;}root.add(g);dragonflies.push({g,cx:w.center[0],cz:w.center[1],rx:w.radius[0]*.8,rz:w.radius[1]*.8,phase:r()*6.28});}
  }
  // Channel weeds are grouped along shallows, leaving all crossings clear.
  for(const w of nav.waterZones.filter(w=>w.shape==='rect')){const [a,b,c,d]=w.rect,len=Math.max(c-a,d-b);for(let j=0;j<len;j+=3+r()*4){const t=j/len,side=r()>.5?1:-1,x=c-a>d-b?a+t*(c-a):(a+c)/2+side*(c-a)*.35,z=c-a>d-b?(b+d)/2+side*(d-b)*.35:b+t*(d-b);if(mask.onRoad(x,z,.6))continue;submerged.push({x,z,y:0,angle:r()*6.28,scale:.6+r()*.6});}}
  for(const w of nav.waterZones.filter(w=>w.shape==='rect')){const [a,b,c,d]=w.rect,len=Math.max(c-a,d-b);for(let j=0;j<len;j+=4+r()*5){const t=j/len,side=r()>.5?1:-1,x=c-a>d-b?a+t*(c-a):side>0?c+.8:a-.8,z=c-a>d-b?side>0?d+.8:b-.8:b+t*(d-b);if(mask.land(x,z,.55))margins.push({x,z,y:.1,angle:r()*6.28,scale:.6+r()*.5});}}
  const weeds=instances(merged(ribbon),submerged),rushes=instances(merged(cattail),margins),duckweed=instances(merged(duck),floating);root.add(weeds,rushes,duckweed);
  green.userData.clock={value:0};green.onBeforeCompile=s=>{s.uniforms.weedTime=green.userData.clock;s.vertexShader='uniform float weedTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(weedTime*.8+instanceMatrix[3].x*.7)*max(position.y+.22,0.)*.035;');};green.customProgramCacheKey=()=> 'water-grass-wind';
  // Green is also used by frog meshes, so wind belongs only to instanced weed materials.
  const weedGreen=green.clone();weedGreen.onBeforeCompile=green.onBeforeCompile;weedGreen.customProgramCacheKey=green.customProgramCacheKey;weedGreen.userData.clock=green.userData.clock;green.onBeforeCompile=()=>{};green.customProgramCacheKey=()=> 'frog-green';for(const group of [weeds,duckweed])for(const m of group.children)if(m.material===green)m.material=weedGreen;
  for(let j=0;j<12;j++){const mesh=new THREE.Mesh(new THREE.RingGeometry(.08,.10,24),new THREE.MeshBasicMaterial({color:'#c2d4b4',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;root.add(mesh);rings.push({mesh,birth:-100});}
  function splash(p,time){const ring=rings.reduce((a,b)=>a.birth<b.birth?a:b);ring.birth=time;ring.mesh.position.set(p.x,.063,p.z);}
  return {root,frogs,weeds,rushes,dragonflies,update(dt,time,camera,season){weedGreen.userData.clock.value=time;const warm=season!=='winter'&&environment.weather!=='snow';weeds.visible=warm;rushes.visible=warm;duckweed.visible=warm;for(const f of frogs){f.g.visible=warm&&f.g.position.distanceTo(camera.position)<90;if(!warm)continue;if(f.jump){const t=Math.min(1,(time-f.jump.start)/.65);f.g.position.lerpVectors(f.jump.from,f.jump.to,t);f.g.position.y+=Math.sin(t*Math.PI)*.22;f.g.rotation.y=Math.atan2(f.jump.from.x-f.jump.to.x,f.jump.from.z-f.jump.to.z);if(t>=1){f.water=!f.water;f.jump=null;f.next=time+10+f.phase*3;if(f.water)splash(f.g.position,time);}}else{const d=f.g.position.distanceTo(camera.position);if(time>f.next&&(!f.water&&d<4||f.water&&d>4)){f.jump={from:f.g.position.clone(),to:(f.water?f.home:f.target).clone(),start:time};}f.g.scale.y=(.85+f.phase*.06)*(1+Math.sin(time*2+f.phase)*.015);}}
    for(const fly of dragonflies){const a=time*.5+fly.phase;fly.g.position.set(fly.cx+Math.cos(a)*fly.rx,1.1+Math.sin(time*1.3+fly.phase)*.3,fly.cz+Math.sin(a)*fly.rz);fly.g.rotation.y=-a;fly.g.visible=warm&&environment.daylight>.15&&fly.g.position.distanceTo(camera.position)<65;}
    for(const ring of rings){const age=time-ring.birth;ring.mesh.visible=warm&&age<1.8;if(ring.mesh.visible){ring.mesh.scale.setScalar(1+age*8);ring.mesh.material.opacity=(1-age/1.8)*.5;}}
  }};
}
