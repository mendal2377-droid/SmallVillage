import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildCreature} from './creatures.js';

// Playful, non-lethal toys: a slingshot, a water pistol, firecrackers and (when there is snow) snowballs.
// Things to aim at: tin cans on crates, bottles on the terrace parapet, straw targets and sparrows that
// scatter and come back. Projectiles collide with the same exported boxes and floors as the walker.
export const TOOLS=[
  {id:'hands',key:'0',label:'Hands',icon:'✋'},
  {id:'slingshot',key:'1',label:'Slingshot',icon:'Y'},
  {id:'water',key:'2',label:'Water pistol',icon:'💧'},
  {id:'firecracker',key:'3',label:'Firecrackers',icon:'🧨'},
  {id:'snowball',key:'4',label:'Snowballs',icon:'❄'},
];
const mat=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:.6,...o});
const G={
  pebble:new THREE.SphereGeometry(.035,8,6),drop:new THREE.SphereGeometry(.025,6,4),snow:new THREE.SphereGeometry(.07,10,8),
  cracker:new THREE.CylinderGeometry(.025,.025,.16,8),can:new THREE.CylinderGeometry(.034,.034,.122,12),bottle:new THREE.CylinderGeometry(.035,.04,.26,10),
  spark:new THREE.SphereGeometry(.02,4,3),bird:new THREE.ConeGeometry(.045,.16,5),wing:new THREE.PlaneGeometry(.14,.06),
};
const M={pebble:mat('#8c867c'),drop:mat('#9fd3f0',{transparent:true,opacity:.75,roughness:.1}),snow:mat('#f7fbff',{roughness:.9}),cracker:mat('#c8221c'),
  cans:[mat('#c7372e',{metalness:.6,roughness:.35}),mat('#c9ccc8',{metalness:.8,roughness:.25}),mat('#2f6fb3',{metalness:.6,roughness:.35})],
  bottle:mat('#3f7d4a',{transparent:true,opacity:.8,roughness:.15,metalness:.1}),crate:mat('#9b7448',{roughness:.85}),straw:mat('#d6b65f',{roughness:1}),
  spark:new THREE.MeshBasicMaterial({color:'#ffd27a'}),smoke:new THREE.MeshBasicMaterial({color:'#c9c6bf',transparent:true,opacity:.5,depthWrite:false}),
  bird:mat('#6b5440',{roughness:.9}),wing:mat('#544233',{side:THREE.DoubleSide,roughness:.9})};
function ringTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  for(const [r,color] of [[62,'#f3ead2'],[50,'#c8352c'],[38,'#f3ead2'],[26,'#c8352c'],[13,'#f3ead2'],[6,'#c8352c']]){x.fillStyle=color;x.beginPath();x.arc(64,64,r,0,Math.PI*2);x.fill();}
  return new THREE.CanvasTexture(c);
}
let rings;
// Scene-specific target layouts; village sets are laid out in front of each starting point.
const LAYOUT={
  house:{crates:[[3.3,.6,-Math.PI/2]],parapet:{x:-4.95,y:4.48,z:[.6,1.3,2.0,2.7,3.4]},boards:[],flocks:[[1.2,1.8,4]]},
  village:{crates:'places',boards:'places',flocks:[[-150,214,9],[-280,60,7],[-30,140,6],[-470,236,8]]},
};

export function createToys({scene,camera,walk,audio,onEvent=()=>{}}){
  let tool='hands',projectiles=[],cans=[],boards=[],birds=[],sparks=[],cooldown=0,holding=false,shake=0,sceneName,recoil=0;
  let draw=0;
  const flashLight=new THREE.PointLight('#ffcf80',0,14,1.6);flashLight.visible=false;scene.add(flashLight);
  const props=new THREE.Group();scene.add(props);
  const view=new THREE.Group();camera.add(view);view.position.set(.26,-.24,-.5);view.scale.setScalar(.8);
  const models={
    slingshot(){const g=new THREE.Group(),wood=mat('#81603c');const fork=new THREE.CatmullRomCurve3([new THREE.Vector3(-.07,.12,0),new THREE.Vector3(-.042,.04,.01),new THREE.Vector3(0,-.015,.015),new THREE.Vector3(.042,.04,.01),new THREE.Vector3(.07,.12,0)]);g.add(new THREE.Mesh(new THREE.TubeGeometry(fork,20,.015,10,false),wood));const handle=new THREE.Mesh(new THREE.CapsuleGeometry(.020,.13,6,10),wood);handle.position.y=-.09;g.add(handle);
      for(let j=0;j<10;j++){const wrap=new THREE.Mesh(new THREE.TorusGeometry(.022,.003,5,12),mat('#493d2c'));wrap.rotation.x=Math.PI/2;wrap.position.y=-.045-j*.012;g.add(wrap);}
      g.userData.bands=[];for(const s of [-1,1]){const band=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,1,8),mat('#caac62',{roughness:.85}));g.add(band);g.userData.bands.push({band,from:new THREE.Vector3(s*.07,.12,0)});}const pouch=new THREE.Mesh(new RoundedBoxGeometry(.04,.024,.018,2,.003),mat('#4b3524'));g.add(pouch);g.userData.pouch=pouch;return g;},
    water(){const g=new THREE.Group();const body=new THREE.Mesh(new RoundedBoxGeometry(.06,.085,.22,3,.012),mat('#e99c39',{roughness:.35}));g.add(body);
      const tank=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.09,12),mat('#58c1d6',{transparent:true,opacity:.7,roughness:.1}));tank.position.set(0,.07,.02);g.add(tank);
      const grip=new THREE.Mesh(new THREE.BoxGeometry(.04,.1,.04),mat('#1f8fa3'));grip.position.set(0,-.07,.06);grip.rotation.x=.3;g.add(grip);
      const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.06,8),mat('#ffd34a'));nozzle.rotation.x=Math.PI/2;nozzle.position.z=-.12;g.add(nozzle);return g;},
    firecracker(){const g=new THREE.Group();for(const [x,y] of [[0,0],[.04,.01],[-.04,.01]]){const c=new THREE.Group();const body=new THREE.Mesh(G.cracker,M.cracker);c.add(body);for(const h of [-.055,.055]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.013,12),mat('#e2b961'));ring.position.y=h;c.add(ring);}const wick=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.045,6),mat('#524b30'));wick.position.set(0,.096,0);wick.rotation.z=.2;c.add(wick);c.position.set(x,y,0);c.rotation.x=.4;g.add(c);}return g;},
    snowball(){return new THREE.Mesh(G.snow,M.snow);},
    hands(){return new THREE.Group();},
  };
  const viewModels=Object.fromEntries(Object.entries(models).map(([k,f])=>{const m=f();m.visible=false;view.add(m);return [k,m];}));
  const snowy=()=>onEvent('query-snow');
  function available(id){return id!=='snowball'||snowy();}
  function select(id){
    if(!TOOLS.some(t=>t.id===id))return;
    if(!available(id)){onEvent('notice','Snowballs need snow on the ground. Try winter or snowfall.');return;}
    holding=false;draw=0;tool=id;for(const [k,m] of Object.entries(viewModels))m.visible=k===id;audio.play('pickup');onEvent('tool',id);
  }
  function groundBelow(x,z,y){
    const nav=walk.nav;let h=nav.ground??.2;
    for(const s of nav.surfaces||[]){const [x0,z0,x1,z1]=s.rect;if(x<x0||x>x1||z<z0||z>z1)continue;const t=(z-z0)/(z1-z0);const v=s.height+(s.rise||0)*t;if(v<=y+.05&&v>h)h=v;}
    for(const c of crates())if(Math.abs(x-c.x)<c.hx&&Math.abs(z-c.z)<c.hz&&c.top<=y+.05&&c.top>h)h=c.top;
    return h;
  }
  let crateList=[];const crates=()=>crateList;
  function clearProps(){props.clear();cans=[];boards=[];birds=[];crateList=[];projectiles.forEach(p=>scene.remove(p.mesh));projectiles=[];for(let i=0;i<8;i++)walk.setDynamic('crate-'+i,null);}
  function addCrate(x,z,yaw=0){
    const y=walk.floorAt(x,z,walk.nav.ground??.2,.6)??(walk.nav.ground??.2),size=[.62,.5,.62];
    const m=new THREE.Mesh(new THREE.BoxGeometry(...size),M.crate);m.position.set(x,y+size[1]/2,z);m.rotation.y=yaw;props.add(m);
    const c={x,z,hx:.31,hz:.31,top:y+size[1]};crateList.push(c);
    walk.setDynamic('crate-'+(crateList.length-1),{cx:x,cz:z,hx:.31,hz:.31,c:1,s:0,low:y,high:c.top});
    // A 3-2-1 pyramid of mixed tins, built across the line of sight of someone facing along yaw.
    let i=0;for(const [row,n] of [[0,3],[1,2],[2,1]])for(let k=0;k<n;k++){
      const o=(k-(n-1)/2)*.075,py=c.top+.061+row*.123;addCan(G.can,M.cans[i++%3],x+Math.cos(yaw)*o,py,z-Math.sin(yaw)*o);
    }
  }
  function addCan(geo,material,x,y,z){
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);props.add(m);
    cans.push({m,home:m.position.clone(),vel:new THREE.Vector3(),spin:new THREE.Vector3(),rest:true,down:false,h:geo.parameters.height/2,r:geo.parameters.radiusTop||.034});
  }
  function addBoard(x,z,yaw){
    rings??=ringTexture();
    const y=walk.floorAt(x,z,walk.nav.ground??.2,.6)??.2;
    const bale=new THREE.Mesh(new THREE.BoxGeometry(1.1,.75,.5),M.straw);bale.position.set(x,y+.375,z);bale.rotation.y=yaw;props.add(bale);
    const face=new THREE.Mesh(new THREE.CircleGeometry(.42,32),new THREE.MeshStandardMaterial({map:rings,roughness:.9}));
    const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    face.position.set(x,y+1.2,z).addScaledVector(fwd,-.18);face.rotation.y=yaw+Math.PI;props.add(face);
    const stand=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.08),M.straw);stand.position.set(x,y+1.2,z).addScaledVector(fwd,-.13);stand.rotation.y=yaw;props.add(stand);
    walk.setDynamic('board-'+boards.length,{cx:x,cz:z,hx:.55,hz:.25,c:Math.cos(yaw),s:Math.sin(yaw),low:y,high:y+1.65});
    boards.push({center:face.position.clone(),normal:fwd.clone().negate(),radius:.42});
  }
  function addFlock(x,z,n){
    for(let i=0;i<n;i++){
      const creature=buildCreature('bird',i),g=creature.g,wings=creature.wings;
      const home=new THREE.Vector3(x+(Math.random()-.5)*4,0,z+(Math.random()-.5)*4);
      const y=walk.floorAt(home.x,home.z,walk.nav.ground??.2,.6);if(y===undefined||walk.solidAt(home.x,home.z,y+.02,y+.3,.1))continue;
      home.y=y;g.position.copy(home);props.add(g);
      birds.push({g,wings,home,state:'peck',t:Math.random()*3,vel:new THREE.Vector3(),heading:Math.random()*6.28});
    }
  }
  function frontOf(spawn,yaw,distance,side=0){
    return [spawn[0]-Math.sin(yaw)*distance+Math.cos(yaw)*side,spawn[2]-Math.cos(yaw)*distance-Math.sin(yaw)*side];
  }
  function clearSpot(x,z){
    // Nearest standable point that also leaves room for a crate.
    for(let r=0;r<10;r+=.75)for(let a=0;a<Math.PI*2;a+=Math.PI/5){
      const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,h=walk.floorAt(px,pz,walk.nav.ground??.2,.6);
      if(h!==undefined&&!walk.solidAt(px,pz,h+.05,h+1.8,.7))return [px,pz];
    }
  }
  function spawn(name){
    sceneName=name;clearProps();const layout=LAYOUT[name];if(!layout||!walk.nav)return;
    if(layout.crates==='places'){
      for(const [place,p] of Object.entries(walk.nav.places||{})){
        if(place==='forest')continue;
        const yaw=p.yaw||0,a=clearSpot(...frontOf(p.spawn,yaw,7,-2.2));if(a)addCrate(...a,yaw);
        const b=clearSpot(...frontOf(p.spawn,yaw,13,2.5));if(b)addBoard(...b,yaw);
      }
    }else{
      for(const [x,z,yaw] of layout.crates)addCrate(x,z,yaw);
      for(const z of layout.parapet.z)addCan(G.bottle,M.bottle,layout.parapet.x,layout.parapet.y+.13,z);
    }
    for(const [x,z,n] of layout.flocks)addFlock(x,z,n);
    onEvent('targets',{total:cans.length});
  }
  function emit(kind){
    const dir=new THREE.Vector3();camera.getWorldDirection(dir);
    const origin=camera.position.clone().addScaledVector(dir,.35).add(new THREE.Vector3(0,-.08,0));
    const spec={slingshot:{speed:30,up:.02,geo:G.pebble,m:M.pebble,life:5},water:{speed:13,up:.05,geo:G.drop,m:M.drop,life:2},firecracker:{speed:11,up:.22,geo:G.cracker,m:M.cracker,life:6,fuse:1.6},snowball:{speed:17,up:.08,geo:G.snow,m:M.snow,life:5}}[kind];
    const v=dir.clone().add(new THREE.Vector3(0,spec.up,0)).normalize().multiplyScalar(kind==='slingshot'&&holding?18+draw*18:spec.speed);
    if(kind==='water')v.add(new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.4,(Math.random()-.5)*.6));
    const mesh=new THREE.Mesh(spec.geo,spec.m);mesh.position.copy(origin);scene.add(mesh);
    projectiles.push({kind,mesh,vel:v,life:spec.life,fuse:spec.fuse,bounces:0,still:false});
    recoil=kind==='water'?.25:1;
  }
  function fire(){
    if(tool==='hands'||cooldown>0||walk.paused)return;
    if(tool==='snowball'&&!snowy()){select('hands');return;}
    emit(tool);cooldown={slingshot:.45,water:.06,firecracker:.9,snowball:.5}[tool];
    audio.play({slingshot:'slingshot',water:'water',firecracker:'fuse',snowball:'throw'}[tool]);
  }
  function scare(point,radius,why){
    let n=0;for(const b of birds){if(b.state!=='fly'&&b.g.position.distanceTo(point)<radius){fly(b,point);n++;}}
    if(n){audio.play('flap');onEvent('birds',{count:n,why});}
  }
  function fly(b,from){
    b.state='fly';b.t=6+Math.random()*6;const away=b.g.position.clone().sub(from).setY(0).normalize();
    if(!away.lengthSq())away.set(Math.random()-.5,0,Math.random()-.5).normalize();
    b.vel.copy(away).multiplyScalar(5+Math.random()*3).setY(3+Math.random()*2);
  }
  function knock(c,impulse){
    if(c.rest){c.rest=false;}
    c.vel.add(impulse);c.spin.set((Math.random()-.5)*20,(Math.random()-.5)*10,(Math.random()-.5)*20);
    if(!c.down){c.down=true;audio.play('clink');onEvent('can',{down:cans.filter(k=>k.down).length,total:cans.length});}
  }
  function bang(at){
    audio.play('bang');flashLight.position.copy(at);flashLight.intensity=60;flashLight.visible=true;
    for(let i=0;i<26;i++){const m=new THREE.Mesh(G.spark,M.spark);m.position.copy(at);scene.add(m);sparks.push({m,vel:new THREE.Vector3(Math.random()-.5,Math.random()*.9,Math.random()-.5).multiplyScalar(7),life:.5+Math.random()*.3});}
    for(let i=0;i<5;i++){const m=new THREE.Mesh(G.snow,M.smoke.clone());m.position.copy(at);m.scale.setScalar(2);scene.add(m);sparks.push({m,vel:new THREE.Vector3(Math.random()-.5,.8,Math.random()-.5),life:1.6,smoke:true});}
    for(const c of cans){const d=c.m.position.distanceTo(at);if(d<3)knock(c,c.m.position.clone().sub(at).normalize().multiplyScalar((3-d)*3).add(new THREE.Vector3(0,2.5,0)));}
    scare(at,16,'bang');const d=camera.position.distanceTo(at);if(d<7)shake=Math.max(shake,(7-d)/7*.12);
    onEvent('bang',{distance:d});
  }
  function burstAt(at,kind){
    const color=kind==='snowball'?'#ffffff':kind==='water'?'#bfe6ff':'#9c958a',count=kind==='water'?3:8;
    for(let i=0;i<count;i++){const m=new THREE.Mesh(G.spark,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));m.position.copy(at);scene.add(m);sparks.push({m,vel:new THREE.Vector3(Math.random()-.5,Math.random(),Math.random()-.5).multiplyScalar(kind==='snowball'?3:1.6),life:.4});}
    if(kind==='snowball')audio.play('puff');else if(kind==='slingshot')audio.play('thud');
  }
  function hitTargets(p,from,to){
    const r=p.kind==='snowball'?.08:.05;
    for(const c of cans){
      if(c.m.position.distanceTo(to)<c.r+r+.03){
        const force=p.kind==='water'?.35:p.kind==='firecracker'?1.5:p.vel.length()*.15;
        knock(c,p.vel.clone().normalize().multiplyScalar(force).add(new THREE.Vector3(0,force*.4,0)));return 'can';
      }
    }
    for(const b of boards){
      // Segment crossing the target face plane.
      const a=from.clone().sub(b.center).dot(b.normal),z=to.clone().sub(b.center).dot(b.normal);
      if(a>0&&z<=0){const hit=from.clone().lerp(to,a/(a-z));const d=hit.distanceTo(b.center);if(d<b.radius){const score=d<.06?10:d<.13?8:d<.25?5:2;onEvent('ring',{score});audio.play('thud');p.mesh.position.copy(hit);return 'board';}}
    }
    for(const bird of birds)if(bird.state!=='fly'&&bird.g.position.distanceTo(to)<.35){fly(bird,from);audio.play('flap');onEvent('birds',{count:1,why:'near'});return 'bird';}
    return null;
  }
  function stepProjectile(p,dt){
    if(p.still){p.life-=dt;return;}
    const n=Math.max(1,Math.ceil(p.vel.length()*dt/.12));
    for(let i=0;i<n;i++){
      const h=dt/n,from=p.mesh.position.clone();
      p.vel.y-=9.8*h*(p.kind==='water'?.8:1);
      const to=from.clone().addScaledVector(p.vel,h);
      const target=p.kind==='firecracker'?null:hitTargets(p,from,to);
      if(target){if(p.kind!=='slingshot'||target!=='board')burstAt(to,p.kind);p.life=0;scare(to,2.5,'hit');return;}
      const r=.04,ground=groundBelow(to.x,to.z,from.y);
      if(to.y<=ground+r||walk.solidAt(to.x,to.z,to.y-r,to.y+r,r)){
        const wall=to.y>ground+r;
        if(p.kind==='water'||p.kind==='snowball'){burstAt(wall?from:to.setY(ground+.02),p.kind);p.life=0;if(p.kind==='snowball')scare(to,3,'hit');return;}
        // Pebbles and firecrackers bounce, then roll to a stop.
        if(wall){const xHit=walk.solidAt(to.x,from.z,to.y-r,to.y+r,r);if(xHit)p.vel.x*=-.35;else p.vel.z*=-.35;p.vel.y*=.6;}
        else{to.y=ground+r;p.vel.y=Math.abs(p.vel.y)*.3;p.vel.x*=.6;p.vel.z*=.6;}
        if(p.kind==='slingshot'&&p.bounces++===0){audio.play('thud');scare(to,3,'hit');}
        if(p.vel.length()<.4&&!wall){p.still=true;p.vel.set(0,0,0);p.mesh.position.copy(to);if(p.kind==='slingshot')p.life=Math.min(p.life,3);return;}
        if(wall){p.mesh.position.copy(from);continue;}
      }
      p.mesh.position.copy(to);
      if(p.kind==='firecracker')p.mesh.rotation.x+=h*14;
    }
    p.life-=dt;
  }
  function updateCan(c,dt){
    if(c.rest)return;
    c.vel.y-=9.8*dt;c.m.position.addScaledVector(c.vel,dt);
    c.m.rotation.x+=c.spin.x*dt;c.m.rotation.y+=c.spin.y*dt;c.m.rotation.z+=c.spin.z*dt;
    const p=c.m.position,ground=groundBelow(p.x,p.z,p.y)+c.r;
    if(walk.solidAt(p.x,p.z,p.y-.03,p.y+.03,.04)){c.vel.x*=-.4;c.vel.z*=-.4;}
    if(p.y<=ground){p.y=ground;c.vel.y=Math.abs(c.vel.y)*.25;c.vel.x*=.7;c.vel.z*=.7;c.spin.multiplyScalar(.6);
      // Settle lying on its side.
      if(c.vel.length()<.25){c.rest=true;c.vel.set(0,0,0);c.m.rotation.set(Math.PI/2,c.m.rotation.y,0);}
    }
  }
  function updateBird(b,dt,time){
    const p=b.g.position;b.t-=dt;
    if(b.state==='fly'){
      p.addScaledVector(b.vel,dt);b.vel.y=Math.max(b.vel.y-1.5*dt,b.t>3?.5:-1.5);
      for(const w of b.wings)w.rotation.z=Math.sin(time*40)*.9*(w.position.x>0?1:-1);
      b.g.rotation.y=Math.atan2(-b.vel.x,-b.vel.z);
      // Circle back to the flock's patch and land.
      if(b.t<3){const back=b.home.clone().sub(p);back.y=0;b.vel.x=THREE.MathUtils.damp(b.vel.x,back.x*.8,1.5,dt);b.vel.z=THREE.MathUtils.damp(b.vel.z,back.z*.8,1.5,dt);}
      if(b.t<0&&p.y<=b.home.y+.05){p.y=b.home.y;b.state='peck';b.t=1+Math.random()*3;for(const w of b.wings)w.rotation.z=0;}
      else if(b.t<0)b.vel.y=-1.2;
      return;
    }
    // Hop and peck; a person running close by startles them.
    const near=camera.position.distanceTo(p);if(near<2.2||(near<4.5&&walk.axis().fast&&(walk.axis().forward||walk.axis().strafe))){fly(b,camera.position);audio.play('flap');return;}
    if(b.t<0){b.heading+=(Math.random()-.5)*2;const nx=p.x-Math.sin(b.heading)*.25,nz=p.z-Math.cos(b.heading)*.25;
      if(nx-b.home.x<2.5&&nx-b.home.x>-2.5&&nz-b.home.z<2.5&&nz-b.home.z>-2.5&&!walk.solidAt(nx,nz,p.y+.02,p.y+.3,.08)){p.x=nx;p.z=nz;}
      b.g.rotation.y=b.heading;b.t=.4+Math.random()*1.8;if(near<14&&Math.random()<.2)audio.play('chirp');}
    b.g.rotation.x=b.t%1<.15?.12:0;
  }
  function resetTargets(){for(const c of cans){c.m.position.copy(c.home);c.m.rotation.set(0,0,0);c.vel.set(0,0,0);c.rest=true;c.down=false;}onEvent('can',{down:0,total:cans.length});}
  return {
    TOOLS,get tool(){return tool;},select,fire,spawn,resetTargets,available,
    hold(value){if(tool==='slingshot'){if(value){holding=true;draw=0;}else if(holding){fire();holding=false;draw=0;}}else{holding=value;if(value)fire();}},
    get stats(){return {cans:cans.length,down:cans.filter(c=>c.down).length,birds:birds.length,flying:birds.filter(b=>b.state==='fly').length,projectiles:projectiles.length};},
    setVisible(value){view.visible=value;},get shake(){return shake;},get projectiles(){return projectiles;},
    update(dt,time){
      cooldown=Math.max(0,cooldown-dt);if(holding&&tool==='water')fire();
      if(holding&&tool==='slingshot')draw=Math.min(1,draw+dt*1.6);
      const sling=viewModels.slingshot,to=new THREE.Vector3(0,.115,.025+draw*.12);sling.userData.pouch.position.copy(to);for(const {band,from} of sling.userData.bands){const d=to.clone().sub(from);band.position.copy(from).addScaledVector(d,.5);band.scale.y=d.length();band.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
      recoil=Math.max(0,recoil-dt*6);view.position.set(.26,-.24+Math.sin(time*2)*.004,-.5+recoil*.05);view.rotation.x=recoil*.25;
      for(const p of projectiles){
        stepProjectile(p,dt);
        if(p.kind==='firecracker'&&p.fuse!==undefined){p.fuse-=dt;if(Math.random()<.6){const s=new THREE.Mesh(G.spark,M.spark);s.position.copy(p.mesh.position);scene.add(s);sparks.push({m:s,vel:new THREE.Vector3((Math.random()-.5),1,(Math.random()-.5)),life:.15});}
          if(p.fuse<=0){bang(p.mesh.position.clone());p.life=0;}}
      }
      projectiles=projectiles.filter(p=>{if(p.life>0)return true;scene.remove(p.mesh);return false;});
      // A soaked firecracker fizzles out.
      for(const p of projectiles)if(p.kind==='firecracker'&&projectiles.some(q=>q.kind==='water'&&q.mesh.position.distanceTo(p.mesh.position)<.25)){p.fuse=undefined;p.life=Math.min(p.life,2);audio.play('splash');onEvent('notice','Fizzle! The water put the fuse out.');}
      for(const c of cans)updateCan(c,dt);
      for(const b of birds)updateBird(b,dt,time);
      sparks=sparks.filter(s=>{s.life-=dt;s.vel.y-=(s.smoke?-.2:9.8)*dt;s.m.position.addScaledVector(s.vel,dt);if(s.smoke){s.m.scale.multiplyScalar(1+dt*.8);s.m.material.opacity=Math.max(0,s.life*.3);}if(s.life<=0){scene.remove(s.m);if(s.smoke||s.m.material!==M.spark)s.m.material.dispose();}return s.life>0;});
      flashLight.intensity=Math.max(0,flashLight.intensity-dt*240);flashLight.visible=flashLight.intensity>0;
      shake=Math.max(0,shake-dt*.4);
      // After a full knock-down the cans quietly reset.
      if(cans.length&&cans.every(c=>c.down&&c.rest)){this._resetIn??=6;this._resetIn-=dt;if(this._resetIn<=0){this._resetIn=undefined;resetTargets();onEvent('notice','The tins have been stacked up again.');}}
    },
    clear:clearProps,
  };
}
