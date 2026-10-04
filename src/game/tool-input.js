// A click fires in free-look mode; dragging still turns the camera. Right mouse,
// P, or the visible trigger button supports holding/charging without ambiguity.
export function bindToolInput({canvas,button,toys,allowed,locked=()=>document.pointerLockElement===canvas,startAudio=()=>{},win=window,doc=document}){
  let tap=null,source=null;
  const cancel=()=>{tap=null;source=null;toys.cancelHold();};
  const begin=(kind,e)=>{if(!allowed()||source)return;tap=null;source={kind,id:e?.pointerId,button:e?.button};startAudio();toys.hold(true);};
  const end=kind=>{if(source?.kind!==kind)return;source=null;if(allowed())toys.hold(false);else toys.cancelHold();};
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType&&e.pointerType!=='mouse'||!allowed())return;
    if(e.button===2||e.button===0&&locked()){e.preventDefault();begin('mouse',e);}
    else if(e.button===0)tap={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  win.addEventListener('pointermove',e=>{if(tap&&e.pointerId===tap.id&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>5)tap=null;});
  win.addEventListener('pointerup',e=>{
    if(tap&&e.pointerId===tap.id){tap=null;if(allowed()){startAudio();toys.fire();}}
    if(source&&e.pointerId===source.id&&(source.kind==='button'||e.button===source.button))end(source.kind);
  });
  win.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{tap=null;});
  button.addEventListener('pointerdown',e=>{if(!allowed())return;e.preventDefault();button.setPointerCapture?.(e.pointerId);begin('button',e);});
  button.addEventListener('lostpointercapture',()=>{if(source?.kind==='button')cancel();});
  // Keyboard/screen-reader activation of the trigger is a single shot.
  button.addEventListener('click',e=>{if(e.detail===0&&allowed()){startAudio();toys.fire();}});
  win.addEventListener('keydown',e=>{if(e.code!=='KeyP'||e.repeat||e.target.closest?.('input,textarea,select'))return;e.preventDefault();begin('key');});
  win.addEventListener('keyup',e=>{if(e.code==='KeyP')end('key');});
  win.addEventListener('blur',cancel);doc.addEventListener('visibilitychange',cancel);doc.addEventListener('pointerlockchange',cancel);
  return {cancel};
}
