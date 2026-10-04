import * as THREE from 'three';
import {seeded,material,stem,merged,instances} from './organic.js';
import {canopyGeometry,paintedMaterial,paintGround} from './painted.js';
import {createPlantingMask} from './planting.js';
import {createForestPonds} from './forest-pond.js';

export function createWoodland({scene,camera,nav,environment,host}){
  const root=new THREE.Group();root.name='Painted woodland and flower walks';scene.add(root);
  const r=seeded(654),mask=createPlantingMask(nav),woodland=nav.woodland,canopies=[],flowers=[],points=[];
  // The two lake holes are also used by the walking controller; all banks remain solid land.
  const [a,b,c,d]=woodland.rect,shape=new THREE.Shape();shape.moveTo(a,b);shape.lineTo(c,b);shape.lineTo(c,d);shape.lineTo(a,d);shape.closePath();
  for(const pond of woodland.ponds){const hole=new THREE.Path();hole.absellipse(...pond.center,...pond.radius,0,Math.PI*2,true);shape.holes.push(hole);}
  const groundMat=material('#dce2c3');paintGround(groundMat);const groundArtwork=groundMat.map,ground=new THREE.Mesh(new THREE.ShapeGeometry(shape,64),groundMat);ground.rotation.x=Math.PI/2;ground.position.y=.105;ground.receiveShadow=true;root.add(ground);
  const pathMat=material('#cebd8c');
  // Joined ribbons are flush with the world ground, without slab ends or raised joints.
  const verts=[],indices=[];
  woodland.trail.forEach(([x,z],i)=>{const before=woodland.trail[Math.max(0,i-1)],after=woodland.trail[Math.min(woodland.trail.length-1,i+1)],dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1;for(const side of [-1,1])verts.push(x-dz/len*1.45*side,.115,z+dx/len*1.45*side);if(i){const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1);}});
  const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));pathGeo.setIndex(indices);pathGeo.computeVertexNormals();const path=new THREE.Mesh(pathGeo,pathMat);path.material.side=THREE.DoubleSide;path.receiveShadow=true;root.add(path);
  for(let i=1;i<nav.pondGarden.branch.length;i++){const [x,z]=nav.pondGarden.branch[i-1],[a,b]=nav.pondGarden.branch[i];if(x===195&&a===195)continue;const dx=a-x,dz=b-z,geo=new THREE.PlaneGeometry(Math.hypot(dx,dz),2.9);geo.rotateX(-Math.PI/2);const link=new THREE.Mesh(geo,pathMat);link.rotation.y=-Math.atan2(dz,dx);link.position.set((x+a)/2,.116,(z+b)/2);link.receiveShadow=true;root.add(link);}
  const ponds=createForestPonds({parent:root,scene,camera,nav,environment,host});
  const colours=['#c4d3b1','#cfddab','#bad2c9','#82afa0','#b7cc9c'];
  for(let kind=0;kind<5;kind++){
    const frame=new THREE.Group(),bark=material(kind===2?'#c4c4a8':'#756c52');
    stem(frame,[[0,0,0],[.14,4.5,.09],[-.13,8.5,0]],.23,bark);
    for(let j=0;j<5;j++){const angle=j*2.4,reach=kind===1?1.2:2.6;stem(frame,[[.05,3.4,0],[Math.sin(angle)*reach*.6,5.6,Math.cos(angle)*reach*.6],[Math.sin(angle)*reach,7.0+r()*2,Math.cos(angle)*reach]],.065,bark);}
    const leafMat=paintedMaterial('foliage',colours[kind]);leafMat.userData.evergreen=kind===3;
    const canopy=new THREE.Mesh(canopyGeometry(kind,r),leafMat);frame.add(canopy);
    const template=merged(frame),pts=nav.woodlandTrees.filter(p=>p.kind===kind);
    const group=instances(template,pts);root.add(group);canopies.push({group,mat:leafMat,colour:colours[kind],kind});
  }
  const flowerMat=paintedMaterial('meadow','#ffffff');
  const p1=new THREE.PlaneGeometry(.95,.8);p1.translate(0,.4,0);const p2=p1.clone();p2.rotateY(Math.PI/2);
  const template=new THREE.Group();template.add(new THREE.Mesh(p1,flowerMat),new THREE.Mesh(p2,flowerMat));
  function ribbon(road,density=1){const [x,z,hx,hz,angle]=road,c=Math.cos(angle),s=Math.sin(angle),longX=hx>hz,len=2*Math.max(hx,hz),edge=Math.min(hx,hz);
    for(let v=-len/2;v<len/2;v+=.85/density)for(const side of [-1,1])for(let layer=0;layer<3;layer++){
      const off=side*(edge+.55+layer*.75+r()*.3),lx=longX?v:off,lz=longX?off:v,px=x+c*lx+s*lz,pz=z-s*lx+c*lz;
      if(!mask.land(px,pz,.25)||r()<.12)continue;
      points.push({x:px,z:pz,y:.11,angle:r()*6.28,scale:.55+r()*.65});
    }
  }
  for(const road of nav.flowerTrails)ribbon(road);
  // Roadside meadows follow the actual paving footprints and do not invade roads or bridges.
  for(const road of nav.roads.filter(p=>Math.max(p[2],p[3])>20&&Math.min(p[2],p[3])<4))ribbon(road,.65);
  // Additional sheltered glades and pond-side patches break up the uniform farmland rhythm.
  for(const pond of woodland.ponds)for(let i=0;i<900;i++){const t=r()*6.28,off=3+r()*8,x=pond.center[0]+Math.cos(t)*(pond.radius[0]+off),z=pond.center[1]+Math.sin(t)*(pond.radius[1]+off);if(mask.land(x,z,.35))points.push({x,z,y:.11,angle:r()*6.28,scale:.65+r()*.8});}
  // Spatial chunks keep the full overview lush and first-person rendering affordable.
  const chunks=new Map();for(const p of points){const key=`${Math.floor(p.x/32)},${Math.floor(p.z/32)}`;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
  const flowerTemplate=merged(template);for(const pts of chunks.values()){const group=instances(flowerTemplate,pts);group.children.forEach(m=>m.castShadow=false);root.add(group);flowers.push({group,x:pts[0].x,z:pts[0].z});}
  // Low foliage comes from the stem/grass portion of the original meadow texture.
  // UVs select that portion on the 3D cards; the generated source image stays untouched.
  const undergrowthMat=paintedMaterial('meadow','#d1dfb9'),undergrowth=new THREE.Group(),grassCard=new THREE.PlaneGeometry(.7,.3);grassCard.translate(0,.15,0);
  const uv=grassCard.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*.35);
  for(const angle of [0,Math.PI/2]){const g=grassCard.clone();g.rotateY(angle);undergrowth.add(new THREE.Mesh(g,undergrowthMat));}
  const grassPoints=[];for(let i=0;i<11000;i++){const x=a+r()*(c-a),z=b+r()*(d-b);if(mask.land(x,z,.25))grassPoints.push({x,z,y:.11,scale:.7+r()*.9,angle:r()*6.28});}
  const grassGroups=new Map();for(const p of grassPoints){const key=`${Math.floor(p.x/32)},${Math.floor(p.z/32)}`;if(!grassGroups.has(key))grassGroups.set(key,[]);grassGroups.get(key).push(p);}
  const lowTemplate=merged(undergrowth);for(const pts of grassGroups.values()){const group=instances(lowTemplate,pts);group.children.forEach(m=>m.castShadow=false);root.add(group);flowers.push({group,x:pts[0].x,z:pts[0].z});}
  const motesGeo=new THREE.BufferGeometry(),motesPos=new Float32Array(90*3),phases=Array.from({length:90},()=>r()*6.28);motesGeo.setAttribute('position',new THREE.BufferAttribute(motesPos,3));
  const motes=new THREE.Points(motesGeo,new THREE.PointsMaterial({color:'#f9dda1',size:.055,transparent:true,opacity:.45,depthWrite:false}));motes.frustumCulled=false;root.add(motes);
  host.dataset.woodlandTrees=String(nav.woodlandTrees.length);host.dataset.woodlandPonds=String(woodland.ponds.length);host.dataset.flowerClumps=String(points.length);host.dataset.generatedArt='foliage,meadow,ground';let lastSeason;
  return {root,points,canopies,ponds,update(dt,time){ponds.update(dt,time);const winter=environment.season==='winter',autumn=environment.season==='corn';groundMat.color.set(winter?'#d7ddca':autumn?'#d9cfaa':'#dce2c3');if(lastSeason!==environment.season){groundMat.map=winter?null:groundArtwork;groundMat.needsUpdate=true;lastSeason=environment.season;}pathMat.color.set(winter?'#d6d4c1':'#cebd8c');
    for(const f of flowers)f.group.visible=!winter&&(camera.position.y>50||Math.hypot(camera.position.x-f.x,camera.position.z-f.z)<125);
    flowerMat.color.set(autumn?'#c8b697':'#ffffff');
    for(const {group,mat,colour,kind} of canopies){mat.color.set(autumn&&kind!==3?'#d7b984':colour);for(const m of group.children)if(m.material===mat)m.visible=!winter||kind===3;}
    motes.visible=!winter&&!environment.wet&&camera.position.y<30;const night=environment.daylight<.15;motes.material.opacity=night&&environment.season==='summer'?.8:.3;motes.material.size=night?.075:.04;
    for(let i=0;i<90;i++){const p=phases[i];motesPos.set([camera.position.x+Math.sin(p*10+time*.04)*12,.35+(Math.sin(time*.18+p)+1)*1.6,camera.position.z+Math.cos(p*8+time*.06)*12],i*3);}motesGeo.attributes.position.needsUpdate=true;
  }};
}
