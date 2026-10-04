// A click fires in free-look mode; dragging still turns the camera. Right mouse,
// P, or the visible trigger button supports holding/charging without ambiguity.
export function bindToolInput({canvas,button,toys,allowed,locked=()=>document.pointerLockElement===canvas,startAudio=()=>{},onAim=()=>{},win=window,doc=document}){
  let tap=null,source=null;
  const center=()=>{toys.setAim?.(0,0);onAim(0,0);};
  const aim=e=>{
    if(locked()||e.pointerType==='touch'||e.pointerType==='pen'){center();return;}
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const x=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));
    const y=Math.max(-1,Math.min(1,1-(e.clientY-r.top)/r.height*2));
    toys.setAim?.(x,y);onAim(x,y);
  };
  const cancel=()=>{tap=null;source=null;toys.cancelHold();center();};
  const begin=(kind,e)=>{if(!allowed()||source)return;tap=null;source={kind,id:e?.pointerId,button:e?.button};startAudio();toys.hold(true);};
  const end=kind=>{if(source?.kind!==kind)return;source=null;if(allowed())toys.hold(false);else toys.cancelHold();};
  canvas.addEventListener('pointerdown',e=>{
    if(allowed())aim(e);
    if(e.pointerType&&e.pointerType!=='mouse'||!allowed())return;
    if(e.button===2||e.button===0&&locked()){e.preventDefault();begin('mouse',e);}
    else if(e.button===0)tap={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('pointermove',e=>{if(allowed())aim(e);});
  win.addEventListener('pointermove',e=>{
    if(source?.kind==='mouse'&&e.pointerId===source.id&&allowed())aim(e);
    if(tap&&e.pointerId===tap.id&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>5)tap=null;
  });
  win.addEventListener('pointerup',e=>{
    if(tap&&e.pointerId===tap.id){tap=null;if(allowed()){aim(e);startAudio();toys.fire();}}
    if(source?.kind==='mouse'&&e.pointerId===source.id&&allowed())aim(e);
    if(source&&e.pointerId===source.id&&(source.kind==='button'||e.button===source.button))end(source.kind);
  });
  win.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{tap=null;});
  button.addEventListener('pointerdown',e=>{if(!allowed())return;if(e.pointerType!=='mouse'||locked())center();e.preventDefault();button.setPointerCapture?.(e.pointerId);begin('button',e);});
  button.addEventListener('lostpointercapture',()=>{if(source?.kind==='button')cancel();});
  // Keyboard/screen-reader activation of the trigger is a single shot.
  button.addEventListener('click',e=>{if(e.detail===0&&allowed()){startAudio();toys.fire();}});
  win.addEventListener('keydown',e=>{if(e.code!=='KeyP'||e.repeat||e.target.closest?.('input,textarea,select'))return;e.preventDefault();begin('key');});
  win.addEventListener('keyup',e=>{if(e.code==='KeyP')end('key');});
  win.addEventListener('blur',cancel);doc.addEventListener('visibilitychange',cancel);doc.addEventListener('pointerlockchange',cancel);
  win.addEventListener('resize',center);
  return {cancel};
}
