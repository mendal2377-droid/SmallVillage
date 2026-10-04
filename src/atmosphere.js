import * as THREE from 'three';
import {seeded,material,oval,stem,merged,instances} from './organic.js';
import {createPlantingMask} from './planting.js';
import {canopyGeometry,paintedMaterial} from './painted.js';

export function createVillageAtmosphere({scene,camera,environment,nav,metadata,host}){
  const root=new THREE.Group();root.name='Illustrated village atmosphere';scene.add(root);
  const r=seeded(482),mask=createPlantingMask(nav),forest=[],lights=[],chimneys=[],bankGroups=[];
  const forestColours=['#b1cbb9','#c0d1a3','#cad6b8','#83b3a7'];
  // Irregular lobed crowns and layered evergreens provide distinct silhouettes at the horizon.
  function treeTemplate(kind){const g=new THREE.Group(),bark=material(kind===2?'#a4aa91':'#756e53'),leafMat=paintedMaterial('foliage',forestColours[kind]);
    bark.userData.forestBark=true;stem(g,[[0,0,0],[.12,4.5,0],[-.08,8,0]],.19,bark);
    for(let j=0;j<5;j++){const a=j*2.4,reach=kind===1?1.3:2.1,y=5+r()*3,x=Math.sin(a)*reach,z=Math.cos(a)*reach;stem(g,[[0,3.6,0],[x*.6,y-.7,z*.6],[x,y,z]],.065,bark);}
    g.add(new THREE.Mesh(canopyGeometry(kind,r),leafMat));
    return merged(g);
  }
  const [x0,z0,x1,z1]=nav.bounds,placements=[[],[],[],[]];
  for(let edge=0;edge<4;edge++)for(let row=0;row<3;row++){const len=edge%2?z1-z0:x1-x0;for(let d=0;d<len;d+=7+r()*7){let x,z;if(row>0&&Math.sin(d*.037+edge)*Math.cos(d*.015)>.36)continue;
    if(edge===0){x=x0+d;z=z0-20-row*22-r()*42;}else if(edge===1){x=x1+24+row*22+r()*42;z=z0+d;}else if(edge===2){x=x0+d;z=z1+22+row*22+r()*42;}else{x=x0-22-row*22-r()*42;z=z0+d;}
    // Keep the avenues' continuation visually open, even outside the walkable boundary.
    if(mask.onRoad(x,z,4)||mask.inWater(x,z,8))continue;const kind=Math.floor(r()*4),p={x,z,y:-.25,angle:r()*6.28,scale:1.1+r()*1.3,tint:new THREE.Color().setHSL(.23+r()*.10,.18,.70+r()*.24)};placements[kind].push(p);forest.push({...p,kind});
  }}
  const forestRoot=new THREE.Group();forestRoot.name='Mixed distant woodland';root.add(forestRoot);placements.forEach((pts,i)=>forestRoot.add(instances(treeTemplate(i),pts)));
  const bankMat=material('#9bb777'),grassMat=material('#749952');
  function bankStrip(points,width){const verts=[],indices=[];for(let j=0;j<points.length;j++){const [x,z,nx,nz]=points[j];for(const [dist,y] of [[0,.025],[width*.4,.16],[width,.10]])verts.push(x+nx*dist,y,z+nz*dist);if(j){const k=j*3;indices.push(k-3,k-2,k,k-2,k+1,k,k-2,k-1,k+1,k-1,k+2,k+1);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();const m=new THREE.Mesh(geo,bankMat);m.receiveShadow=true;root.add(m);bankGroups.push(m);
  }
  const grassTemplate=new THREE.Group();for(let j=0;j<5;j++){const a=j*2.4;stem(grassTemplate,[[0,0,0],[Math.sin(a)*.08,.18+r()*.15,Math.cos(a)*.08],[Math.sin(a)*.17,.25+r()*.18,Math.cos(a)*.17]],.007,grassMat);}const grassPts=[];
  for(const water of nav.waterZones){let runs=[];const width=water.shape==='ellipse'?2.8:1.8;
    if(water.shape==='ellipse'){const [x,z]=water.center,[rx,rz]=water.radius;const pts=[];for(let j=0;j<=120;j++){const a=j/120*6.283185,px=x+Math.cos(a)*rx,pz=z+Math.sin(a)*rz;const nx=Math.cos(a),nz=Math.sin(a);pts.push([px,pz,nx,nz]);}runs=[pts];}
    else{const [a,b,c,d]=water.rect;if(c-a>d-b)for(const [z,nz] of [[b,-1],[d,1]]){const pts=[];for(let x=a;x<c;x+=2)pts.push([x,z,0,nz]);pts.push([c,z,0,nz]);runs.push(pts);}else for(const [x,nx] of [[a,-1],[c,1]]){const pts=[];for(let z=b;z<d;z+=2)pts.push([x,z,nx,0]);pts.push([x,d,nx,0]);runs.push(pts);}}
    for(const pts of runs){let segment=[];for(const p of pts){const [x,z,nx,nz]=p,safe=!mask.onRoad(x,z,width+.6)&&!mask.inBuilding(x+nx*width*.6,z+nz*width*.6,.2);if(!safe){if(segment.length>1)bankStrip(segment,width);segment=[];continue;}segment.push(p);
      for(let k=0;k<4;k++){const off=.6+r()*width,px=x+nx*off+(r()-.5)*.6,pz=z+nz*off+(r()-.5)*.6;if(mask.land(px,pz,.25))grassPts.push({x:px,z:pz,y:.15,angle:r()*6.28,scale:.5+r()*.9});}}
      if(segment.length>1)bankStrip(segment,width);
    }
  }
  const grass=instances(merged(grassTemplate),grassPts);root.add(grass);
  // Window boxes come from Blender; warm panels are smaller than the glass to preserve frames.
  const litMat=new THREE.MeshBasicMaterial({color:'#ffd28c',transparent:true,opacity:.95});
  for(const w of metadata.windows||[]){const [x,y,z]=w.centre,group=Math.floor(x/18)*19+Math.floor(z/20)*7,phase=Math.abs(group)%13;
    if(!w.house&&phase%3===0)continue;const [sx,sy,sz]=w.size,g=new THREE.Mesh(new THREE.BoxGeometry(sx<.15?sx+.035:sx*.82,sy*.82,sz<.15?sz+.035:sz*.82),litMat);g.position.set(x,y,z);g.visible=false;root.add(g);lights.push({g,house:w.house,phase});
  }
  function radialTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff1bbdd');gradient.addColorStop(.35,'#f7c27866');gradient.addColorStop(1,'#f7c27800');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
  const glow=radialTexture(),pools=[],bulbs=[];
  function lamp(x,y,z,ground=.105,scale=3.2){const bulb=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:'#ffe0a1'}));bulb.position.set(x,y,z);root.add(bulb);bulbs.push(bulb);
    const hood=new THREE.Mesh(new THREE.ConeGeometry(.14,.13,8),material('#586656'));hood.position.set(x,y+.10,z);root.add(hood);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(scale,scale*1.3),new THREE.MeshBasicMaterial({map:glow,color:'#ffd39b',transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));pool.rotation.x=-Math.PI/2;pool.position.set(x,ground,z+.3);root.add(pool);pools.push(pool);
  }
  lamp(-29.2,2.9,108.3,.21,8);lamp(-35.6,2.8,110.8,.21,5);lamp(-31.8,6.5,104.5,3.755,4);
  const roofs=nav.shelters.filter(s=>s.roof>3&&s.roof<8&&s.rect[2]-s.rect[0]>7&&s.rect[3]-s.rect[1]>5);
  const selected=roofs.filter((s,i)=>i%11===2||s.rect[0]>-70&&s.rect[2]<-45&&s.rect[1]>95&&s.rect[3]<125).slice(0,28);
  for(const [i,s] of selected.entries()){const [a,b,c,d]=s.rect,x=a+(c-a)*.65,z=b+(d-b)*.5,y=s.roof+.05;
    const chimney=new THREE.Mesh(new THREE.BoxGeometry(.42,.65,.42),material('#b2a28c'));chimney.position.set(x,y+.28,z);root.add(chimney);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.54,.08,.54),material('#736d5d'));cap.position.set(x,y+.62,z);root.add(cap);
    const sprites=[];for(let j=0;j<7;j++){const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:'#eee8d6',transparent:true,opacity:0,depthWrite:false}));root.add(puff);sprites.push(puff);}
    chimneys.push({x,y:y+.67,z,phase:i*9.7,sprites});
    // A courtyard light outside each selected neighbour, clipped if a road/water occupies it.
    const lx=(a+c)/2,lz=d+1.1;if(mask.land(lx,lz,.2))lamp(lx,2.7,lz,.115,5);
  }
  const practicals=[new THREE.PointLight('#ffd08c',0,15,2),new THREE.PointLight('#ffd79d',0,10,2)];practicals[0].position.set(-30,3.0,109);practicals[1].position.set(-31,6,104);practicals.forEach(l=>{l.visible=false;root.add(l);});
  host.dataset.forestTrees=String(forest.length);host.dataset.forestKinds='broadleaf,poplar,pale-trunk,evergreen';host.dataset.grassBanks=String(bankGroups.length);host.dataset.chimneys=String(chimneys.length);
  function update(dt,time){const night=1-THREE.MathUtils.smoothstep(environment.daylight,.05,.55),winter=environment.season==='winter';let lit=0,smoking=0;
    forestRoot.children.forEach((g,i)=>g.children.forEach(m=>{if(m.material.userData.forestBark)return;m.visible=!winter||i===3;m.material.color.set(environment.season==='corn'&&i!==3?'#d2b688':forestColours[i]);}));
    grass.visible=!winter;bankMat.color.set(winter?'#cfdbcf':environment.season==='corn'?'#b5ad78':'#9bb777');
    for(const w of lights){w.g.visible=night>.02&&(w.house||environment.hour<23.4||w.phase%4===1);if(w.g.visible)lit++;}litMat.opacity=night*.94;
    pools.forEach(p=>{p.visible=night>.02;p.material.opacity=night*.5;});bulbs.forEach(b=>b.visible=night>.02);
    practicals.forEach((l,i)=>{l.visible=night>.02&&l.position.distanceTo(camera.position)<38;l.intensity=l.visible?night*(i?12:22):0;});
    for(const c of chimneys){const cycle=((time+c.phase)%105),on=cycle<38&&!['storm','rain'].includes(environment.weather);if(on)smoking++;
      for(let j=0;j<c.sprites.length;j++){const puff=c.sprites[j],age=((time*.14+j/7+c.phase*.013)%1);puff.visible=on&&(camera.position.y>50||Math.hypot(c.x-camera.position.x,c.z-camera.position.z)<250);if(!puff.visible)continue;puff.position.set(c.x+age*2+Math.sin(time*.6+j)*age*.35,c.y+age*4,c.z+Math.sin(age*4+c.phase)*age*.55);puff.scale.setScalar(.35+age*1.65);puff.material.opacity=Math.sin(age*Math.PI)*.25*(.35+.65*environment.daylight);}
    }
    host.dataset.litWindows=String(lit);host.dataset.yardLights=String(night>.02?bulbs.length:0);host.dataset.smokingHouses=String(smoking);
  }
  return {root,forest,lights,chimneys,bankGroups,practicals,update};
}
