import * as THREE from 'three';
import {seeded,material,oval,stem,merged,instances} from './organic.js';
import {pondBedMaterial,pondWaterMaterial} from './pond-materials.js';
import {createKoi,lilyGeometry,lilyMaterial,lotus,pondFrog,pondTurtle,gardenCrownMaterial} from './pond-life.js';
import {bridgeHeight,koiPose} from './pond-layout.js';

function bowl(pond){
  const v=[],idx=[],rings=18,sides=96;
  for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
    const r=j/rings,a=k/sides*Math.PI*2;v.push(pond.center[0]+Math.cos(a)*pond.radius[0]*r,-.12-1.55*(1-Math.pow(r,8)),pond.center[1]+Math.sin(a)*pond.radius[1]*r);
    if(j<rings&&k<sides){const n=j*(sides+1)+k;idx.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function createForestPonds({parent,scene,camera,nav,environment,host}){
  const root=new THREE.Group();root.name='Clear koi ponds and woodland garden';parent.add(root);
  const r=seeded(581),bedMat=pondBedMaterial(),waters=[],fish=[],pads=[],frogs=[],seasonal=[],blossoms=[],snowMaterials=[];
  const wood=material('#88573d'),darkWood=material('#523d32'),stone=material('#777f72'),moss=material('#71834c');
  function box(p,size,mat=wood){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...p);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  // Shallow cove bridge: two gentle deck ramps share the exact collision heights.
  for(let i=0;i<24;i++){const z=122.5+i,y=bridgeHeight(z),plank=box([195,y-.075,z],[3.4,.15,.98]);plank.rotation.x=i<12?-Math.atan(.9/12):Math.atan(.9/12);}
  for(const x of [193.25,196.75]){
    const rail=[];for(let z=124;z<=144;z+=2){const y=bridgeHeight(z);box([x,y+.48,z],[.14,.96,.14]);rail.push([x,y+.96,z]);}
    stem(root,rail,.075,wood);stem(root,rail.map(([x,y,z])=>[x,y-.38,z]),.045,wood);
  }
  for(const z of [127,134,141])for(const x of [193.6,196.4])box([x,-.20,z],[.24,2.4,.24],darkWood);

  // Open pavilion with a curved, upturned roof and shaded seats on the dry bank.
  const [px,pz]=nav.pondGarden.pavilion;box([px,.10,pz],[5.2,.14,5.2],stone);
  for(const x of [px-2.2,px+2.2])for(const z of [pz-2.2,pz+2.2])box([x,1.85,z],[.29,3.5,.29]);
  for(const z of [pz-2.2,pz+2.2])box([px,3.5,z],[4.7,.22,.23]);for(const x of [px-2.2,px+2.2])box([x,3.5,pz],[.23,.22,4.7]);
  for(const z of [pz-2,pz+2]){box([px,.60,z],[3.5,.14,.45]);for(const x of [px-1.5,px+1.5])box([x,.35,z],[.14,.5,.3]);}
  const roofMat=material('#4d6263');snowMaterials.push({mat:roofMat,color:'#4d6263'});
  const rv=[],ri=[],steps=16;
  for(let j=0;j<=steps;j++)for(let k=0;k<=steps;k++){const x=(j/steps-.5)*6.3,z=(k/steps-.5)*6.3,t=Math.max(Math.abs(x),Math.abs(z))/3.15;rv.push(px+x,4.9-1.4*t+.55*Math.pow(t,6),pz+z);if(j<steps&&k<steps){const n=j*(steps+1)+k;ri.push(n,n+1,n+steps+1,n+1,n+steps+2,n+steps+1);}}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rv,3));rg.setIndex(ri);rg.computeVertexNormals();const roof=new THREE.Mesh(rg,roofMat);roof.castShadow=roof.receiveShadow=true;root.add(roof);
  for(const side of [-1,1]){stem(root,Array.from({length:17},(_,i)=>{const x=(i/16-.5)*6.3,t=Math.max(Math.abs(x),3.15)/3.15;return [px+x,4.9-1.4*t+.55*Math.pow(t,6),pz+side*3.15];}),.07,wood);stem(root,Array.from({length:17},(_,i)=>[px+side*3.15,4.05,pz+(i/16-.5)*6.3]),.07,wood);}
  // Narrow roof ribs give the silhouette and surface a tiled rhythm.
  for(let i=-7;i<=7;i++)for(const side of [-1,1]){const line=[];for(let j=0;j<=12;j++){const z=side*j/12*3.15,x=i*.4,t=Math.max(Math.abs(x),Math.abs(z))/3.15;line.push([px+x,4.92-1.4*t+.55*Math.pow(t,6),pz+z]);}stem(root,line,.018,roofMat);}

  const rockTemplate=new THREE.Group();const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),stone);rockTemplate.add(rock);const cap=new THREE.Mesh(new THREE.SphereGeometry(1,12,6),moss);cap.position.y=.42;cap.scale.set(.92,.45,.87);rockTemplate.add(cap);
  const temp=new THREE.Object3D();for(const source of rockTemplate.children){const mesh=new THREE.InstancedMesh(source.geometry,source.material,nav.pondGarden.rocks.length);nav.pondGarden.rocks.forEach((p,i)=>{temp.position.set(p.x,p.y,p.z);temp.rotation.set(0,p.angle,0);temp.scale.set(...p.scale);temp.updateMatrix();source.updateMatrix();mesh.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(temp.matrix,source.matrix));});mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}snowMaterials.push({mat:moss,color:'#71834c'});

  const lilyGeo=lilyGeometry(),lilyMat=lilyMaterial(),bloom=lotus(),frogTemplate=pondFrog();
  for(const [pi,pond] of nav.woodland.ponds.entries()){
    const bed=new THREE.Mesh(bowl(pond),bedMat);bed.name=`${pond.name} gravel bed`;bed.receiveShadow=true;root.add(bed);
    const waterMat=pondWaterMaterial(),water=new THREE.Mesh(new THREE.CircleGeometry(1,96),waterMat);water.rotation.x=-Math.PI/2;water.scale.set(...pond.radius,1);water.position.set(pond.center[0],.055,pond.center[1]);water.renderOrder=3;water.name=`${pond.name} clear water`;root.add(water);waters.push(water);
    const focus=pi===1?[203,134]:[207,43];
    // A school near the path makes the fish legible at normal walking height.
    for(let j=0;j<24;j++){
      const close=j<14,cx=close?focus[0]:pond.center[0],cz=close?focus[1]:pond.center[1],rx=close?2+r()*3:pond.radius[0]*(.2+r()*.5),rz=close?2+r()*5:pond.radius[1]*(.2+r()*.5);
      const koi=createKoi(j%6),size=.8+r()*.5;koi.root.scale.setScalar(size);root.add(koi.root);fish.push({...koi,cx,cz,rx,rz,phase:r()*6.28,speed:.12+r()*.12,pond:pi,kind:j%6});
    }
    for(let j=0;j<38;j++){
      const near=j<12,a=r()*6.28,rad=.56+r()*.31;let x=near?focus[0]+(r()-.5)*8:pond.center[0]+Math.cos(a)*pond.radius[0]*rad,z=near?focus[1]+(r()-.5)*12:pond.center[1]+Math.sin(a)*pond.radius[1]*rad;
      if(Math.hypot((x-pond.center[0])/pond.radius[0],(z-pond.center[1])/pond.radius[1])>.94||Math.abs(x-195)<2.4&&z>120&&z<148||pads.some(p=>Math.hypot(x-p.position.x,z-p.position.z)<1.3))continue;
      const pad=new THREE.Group();pad.position.set(x,.082,z);pad.rotation.y=r()*6.28;const radius=.5+r()*.43,leaf=new THREE.Mesh(lilyGeo,lilyMat);leaf.scale.setScalar(radius);pad.add(leaf);root.add(pad);pads.push(pad);
      if(j%3===0){const flower=bloom.clone();flower.position.set(-radius*.22,.025,-radius*.3);pad.add(flower);}
      if(j<4){const f=frogTemplate.clone();f.position.set(0,.018,0);f.scale.setScalar(1.25);pad.add(f);frogs.push(f);}
      const stalk=material('#707f47');stem(root,[[x,-1.3,z],[x+.10,-.7,z+.04],[x,.075,z]],.015,stalk);
    }
  }
  // A modest rock cascade trickles into the cove rather than enclosing the whole lake.
  const cascadeStone=new THREE.Group();for(let j=0;j<3;j++)oval(cascadeStone,[201,.2+j*.35,117+j*.65],[1.6,.5,.8],stone);root.add(merged(cascadeStone));
  const fallMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},day:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float time;uniform float day;void main(){float streak=.5+.5*sin(v.x*75.+sin(v.y*9.-time*4.));gl_FragColor=vec4(vec3(.64,.78,.74)*(.2+.8*day),(.25+streak*.28)*smoothstep(0.,.12,v.x)*(1.-smoothstep(.85,1.,v.x)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  const fall=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.3),fallMat);fall.position.set(201,.57,118.8);root.add(fall);
  const turtle=pondTurtle();turtle.position.set(201,1.43,118.3);turtle.rotation.y=.9;root.add(turtle);
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.38,.43,40),new THREE.MeshBasicMaterial({color:'#d0e2cd',transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.set(201,.08,119.5);root.add(ripple);

  // Blossom trees and red maples frame the bridge without obscuring its approaches.
  const crownMaterials={maple:gardenCrownMaterial('maple'),blossom:gardenCrownMaterial('blossom')};
  for(const p of nav.pondGarden.trees){const g=new THREE.Group();g.position.set(p.x,.1,p.z);g.rotation.y=p.angle;root.add(g);const frame=new THREE.Group();stem(frame,[[0,0,0],[.12,2.4,0],[0,4.8,0]],.20,darkWood);const pts=[];
    for(let j=0;j<6;j++){const a=j*2.4,tip=[Math.sin(a)*2.4,3.5+r()*2,Math.cos(a)*2.4];stem(frame,[[0,2.3,0],[tip[0]*.5,tip[1]-.5,tip[2]*.5],tip],.06,darkWood);for(let k=0;k<26;k++)pts.push({x:tip[0]+(r()-.5)*2,y:tip[1]+(r()-.5)*1.7,z:tip[2]+(r()-.5)*2,scale:.4+r()*.65});}g.add(merged(frame));
    const crown=new THREE.Group(),m=crownMaterials[p.kind];for(const a of [0,Math.PI/2]){const card=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.6),m);card.rotation.y=a;crown.add(card);}const group=instances(merged(crown),pts.map(p=>({...p,angle:r()*6.28,tilt:(r()-.5)*1.1})));g.add(group);blossoms.push({group,mat:m,kind:p.kind});
  }
  // Floating petals use one pooled draw call, with no per-frame allocations.
  const petalGeo=new THREE.BufferGeometry(),positions=new Float32Array(80*3);petalGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));const petals=new THREE.Points(petalGeo,new THREE.PointsMaterial({color:'#ead0d4',size:.075,transparent:true,opacity:.8,depthWrite:false}));root.add(petals);seasonal.push(petals);
  host.dataset.forestKoi=String(fish.length);host.dataset.forestLilies=String(pads.length);host.dataset.pondGarden='clear-water,koi,lilies,frogs,moss,bridge,pavilion,cascade,turtle';
  return {root,fish,pads,frogs,waters,update(dt,time){
    const winter=environment.season==='winter',day=environment.daylight;bedMat.userData.time.value=time;bedMat.userData.strength.value=(environment.wet?.35:1)*(winter?.25:1);
    for(const water of waters){const u=water.material.uniforms;u.time.value=time;u.day.value=day;u.wet.value=environment.wet?1:0;u.ice.value=winter?.32:0;u.sky.value.copy(scene.background);}
    for(const f of fish){const p=koiPose(f,time);f.root.position.set(p.x,p.y,p.z);f.root.rotation.y=p.yaw;f.tail.rotation.y=Math.sin(time*5+f.phase)*.35;f.flippers.forEach((fin,i)=>fin.rotation.z=Math.sin(time*3+f.phase+i)*.12);f.root.visible=camera.position.y>35||f.root.position.distanceTo(camera.position)<110;}
    for(const pad of pads){pad.visible=!winter;pad.position.y=.085+Math.sin(time*.9+pad.position.x)*.012;pad.rotation.z=Math.sin(time*.7+pad.position.z)*.012;}
    for(const frog of frogs)frog.scale.y=1.25+Math.sin(time*1.9+frog.parent.position.x)*.04;
    for(const b of blossoms){b.group.visible=!winter;b.mat.color.set(environment.season==='corn'?'#e6c298':'#ffffff');}
    for(const {mat,color} of snowMaterials)mat.color.set(winter?'#d4ddd4':color);
    fall.visible=!winter;fallMat.uniforms.time.value=time;fallMat.uniforms.day.value=day;ripple.visible=!winter;ripple.scale.setScalar(1+(time*.3%1)*2);ripple.material.opacity=.25*(1-time*.3%1);turtle.visible=!winter;
    petals.visible=!winter&&environment.season==='green';for(let i=0;i<80;i++){const pond=nav.woodland.ponds[i%2],a=i*2.4+time*.008,rad=.15+(i%11)/15;positions.set([pond.center[0]+Math.sin(a)*pond.radius[0]*rad,.10,pond.center[1]+Math.cos(a)*pond.radius[1]*rad],i*3);}petalGeo.attributes.position.needsUpdate=true;
  }};
}
