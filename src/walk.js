import * as THREE from 'three';

// A grounded camera with a small circular footprint. Axis separation lets it slide along walls.
export function createWalkController(camera, canvas, onChange) {
  let enabled=false, paused=false, nav, boxes=[], yaw=0, pitch=0, drag=null;
  const eyeHeight=1.65, maxStep=.26;
  const keys=new Set(), touches=new Set();
  const radius=.16;
  function clearInput(){keys.clear();touches.clear();drag=null;}
  function look(dx,dy){yaw-=dx*.0025;pitch=THREE.MathUtils.clamp(pitch-dy*.0025,-1.35,1.35);camera.rotation.set(pitch,yaw,0,'YXZ');}
  function floorAt(x,z){
    const feet=camera.position.y-eyeHeight;
    const candidates=[nav.ground ?? .2];
    for(const surface of nav.surfaces||[]){
      const [x0,z0,x1,z1]=surface.rect;
      if(x<x0||x>x1||z<z0||z>z1)continue;
      const t=surface.axis==='x'?(x-x0)/(x1-x0):(z-z0)/(z1-z0);
      candidates.push(surface.height+(surface.rise||0)*t);
    }
    // Only take a reachable surface; never drop through an upper floor or jump up a storey.
    return candidates.filter(h=>Math.abs(h-feet)<=maxStep).sort((a,b)=>b-a)[0];
  }
  function blocked(x,z,height){
    const [xmin,zmin,xmax,zmax]=nav.bounds;
    if(x<xmin+radius||x>xmax-radius||z<zmin+radius||z>zmax-radius)return true;
    return boxes.some(({cx,cz,hx,hz,c,s,low,high})=>{
      if(high<=height+.04||low>=height+eyeHeight+.08)return false;
      const localX=c*(x-cx)-s*(z-cz),localZ=s*(x-cx)+c*(z-cz);
      const dx=Math.max(0,Math.abs(localX)-hx),dz=Math.max(0,Math.abs(localZ)-hz);
      return dx*dx+dz*dz<radius*radius;
    });
  }
  function move(dx,dz){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
    for(let i=0;i<steps;i++){
      for(const [ax,az] of [[dx/steps,0],[0,dz/steps]]){
        const x=camera.position.x+ax,z=camera.position.z+az,height=floorAt(x,z);
        if(height!==undefined&&!blocked(x,z,height))camera.position.set(x,height+eyeHeight,z);
      }
    }
  }
  const codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown',e=>{
    if(!enabled||paused||e.target.closest?.('input,textarea,select'))return;
    if(codes.includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='Escape'){clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',clearInput);
  document.addEventListener('visibilitychange',clearInput);
  document.addEventListener('pointerlockchange',clearInput);
  canvas.addEventListener('pointerdown',e=>{
    if(!enabled||paused)return;
    canvas.focus({preventScroll:true});
    if(e.pointerType==='mouse' && !document.pointerLockElement){
      try{canvas.requestPointerLock?.()?.catch(()=>{});}catch{}
    }
    if(!document.pointerLockElement){drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{canvas.setPointerCapture(e.pointerId);}catch{/* Pointer lock can acquire the mouse before pointer capture completes. */}}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!enabled||paused||document.pointerLockElement===canvas||drag?.id!==e.pointerId)return;
    look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>drag=null);
  window.addEventListener('pointerup',()=>drag=null);
  document.addEventListener('mousemove',e=>{if(enabled&&!paused&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
  return {
    get enabled(){return enabled;},
    enter(data){nav=data;boxes=nav.boxes.map(([cx,cz,hx,hz,a,low=-100,high=100])=>({cx,cz,hx,hz,c:Math.cos(a),s:Math.sin(a),low,high}));enabled=true;paused=false;clearInput();yaw=0;pitch=0;camera.position.fromArray(nav.spawn);camera.rotation.set(0,0,0,'YXZ');camera.fov=70;camera.near=.05;camera.updateProjectionMatrix();canvas.focus({preventScroll:true});onChange(true);},
    exit(){enabled=false;clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();onChange(false);},
    pause(value){paused=value;if(value){clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();}},
    input(direction,pressed){if(!enabled||paused)return;if(pressed)touches.add(direction);else touches.delete(direction);},
    reset(){if(enabled)this.enter(nav);},
    update(dt){
      if(!enabled||paused)return;
      let forward=Number(keys.has('KeyW')||keys.has('ArrowUp')||touches.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||touches.has('back'));
      let strafe=Number(keys.has('KeyD')||keys.has('ArrowRight')||touches.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touches.has('left'));
      const length=Math.hypot(forward,strafe);
      if(!length)return;
      const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.8:2)*Math.min(dt,.1)/length;
      move((strafe*Math.cos(yaw)-forward*Math.sin(yaw))*speed,(-forward*Math.cos(yaw)-strafe*Math.sin(yaw))*speed);
    }
  };
}
