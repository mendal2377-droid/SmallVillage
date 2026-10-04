// Original fishing rules, independent of rendering. Controls are hold/release or
// a latched reel button; there is no rapid tapping requirement.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const fish=[
  {name:'Crucian carp',size:.25,strength:.7},
  {name:'Common carp',size:.5,strength:1},
  {name:'Grass carp',size:.65,strength:1.1},
  {name:'Silver carp',size:.45,strength:.9},
  {name:'Catfish',size:.6,strength:1.2},
];
export function createFishing(random=Math.random){
  const f={phase:'rig',bait:'bread',power:0,age:0,tension:.25,distance:0,initialDistance:0,stamina:1,side:1,rodSide:0,reeling:false,holding:false,cycle:0,window:0,catch:null,reason:''};
  let held=false,latch=false,castHeld=false,clock=0,wait=0,nibbled=false;
  function phase(name){f.phase=name;f.age=0;}
  function cast(){castHeld=false;held=false;f.initialDistance=f.distance=5+f.power*10;wait=4+random()*5+(f.bait==='bread'?1:0);nibbled=false;phase('cast');}
  function hook(){const index=f.bait==='worm'?Math.min(4,Math.floor(random()*5)):Math.min(3,Math.floor(random()*4));const species=fish[index];f.catch={...species,length:Math.round((species.size*100)*( .8+random()*.7)),weight:+(species.size*species.size*(3+random()*5)).toFixed(2)};f.stamina=1;f.tension=.28;f.side=random()<.5?-1:1;f.cycle=0;clock=1.5+random()*.9;held=false;latch=false;phase('fight');}
  function act(){
    if(f.phase==='rig'){f.power=.5;cast();}
    else if(f.phase==='charge')cast();
    else if(f.phase==='bite')hook();
    else if(f.phase==='wait'||f.phase==='nibble'){f.age=Math.max(0,f.age-.8);return 'twitch';}
    else if(f.phase==='fight'){latch=!latch;}
    else if(f.phase==='miss'||f.phase==='lost'){f.reason='';f.power=0;phase('rig');}
    else if(f.phase==='caught')return 'release';
    return f.phase;
  }
  function press(){
    if(f.phase==='rig'){castHeld=true;f.power=0;phase('charge');}
    else if(f.phase==='bite')hook();
    else if(f.phase==='fight')held=true;
    else return act();
    return f.phase;
  }
  function release(){if(castHeld&&f.phase==='charge'){if(f.power<.08)f.power=.5;cast();}held=false;}
  function clear(){held=false;latch=false;castHeld=false;f.reeling=false;f.rodSide=0;if(f.phase==='charge')phase('rig');}
  function secondary(){if(f.phase==='rig')f.bait=f.bait==='bread'?'worm':'bread';else if(f.phase==='fight'){held=false;latch=false;f.tension=Math.max(.08,f.tension-.16);f.distance=Math.min(f.initialDistance+10,f.distance+.7);}}
  function update(seconds){
    // A delayed frame cannot burn the whole reaction window or snap a line
    // before the player has seen the cue. The waiting stage uses active time.
    const dt=Math.min(.25,Math.max(0,seconds));f.reeling=held||latch;f.holding=held;
    if(f.phase==='rig'||f.phase==='miss'||f.phase==='lost'||f.phase==='caught')return;
    f.age+=(['wait','nibble','cast'].includes(f.phase)?Math.max(0,seconds):dt);
    if(f.phase==='charge'){f.power=clamp(f.power+dt*.5);return;}
    if(f.phase==='cast'){if(f.age>=.8)phase('wait');return;}
    if(f.phase==='wait'||f.phase==='nibble'){
      if(!nibbled&&f.age>=wait*.45){nibbled=true;f.window=Math.max(.9,Math.min(20,seconds*1.75));phase('nibble');return;}
      if(f.phase==='nibble'){f.window-=dt;if(f.window<=0){phase('wait');wait=2.2+random()*2;}return;}
      if(f.age>=wait){f.window=Math.max(4,Math.min(20,seconds*1.75));phase('bite');return;}
    }
    if(f.phase==='bite'){f.window-=dt;if(f.window<=0){f.reason='The bite passed. Change bait or cast again.';phase('miss');}return;}
    if(f.phase!=='fight')return;
    clock-=dt;
    if(clock<=0){f.cycle=f.cycle?0:1;clock=f.cycle?2.2+random()*1.2:3.3+random()*1.5;f.side=random()<.5?-1:1;}
    const surge=Boolean(f.cycle),brace=f.rodSide===-f.side;
    f.stamina=clamp(f.stamina-dt*(surge?.022:.035));
    const strength=f.catch.strength*(.45+.55*f.stamina);
    f.tension=clamp(f.tension+dt*(surge?(f.reeling?.29*strength:-.13)-(brace?.07:0):(f.reeling?.038:-.13)),.08,1);
    if(surge)f.distance+=dt*(f.reeling?.06:brace?.14:.42)*strength;
    else if(f.reeling)f.distance-=dt*(1.45+(1-f.stamina)*.65);
    f.distance=clamp(f.distance,0,f.initialDistance+10);
    if(f.tension>=.99){f.reason='The line snapped. Ease off during the next surge.';clear();phase('lost');}
    else if(f.distance>=f.initialDistance+9.9){f.reason='The fish escaped with too much line. Reel during its rests.';clear();phase('lost');}
    else if(f.age>150){f.reason='The fish slipped free. Try a shorter cast.';clear();phase('lost');}
    else if(f.distance<=.8){clear();phase('caught');}
  }
  function view(){
    const p=f.phase,surge=f.cycle===1;
    const text={rig:`${f.bait==='bread'?'Bread · small carp':'Worm · mixed fish'}. Hold Q to choose casting distance, then release. Tap Cast for a medium throw.`,charge:'Hold to build your cast. Release Q or the button to send the float out.',cast:'The float arcs into the water…',wait:'Watch the float. Small taps are nibbles; wait for it to sink.',nibble:'A nibble… wait. The fish has not taken the hook yet.',bite:'BITE! The float sank. Tap Q / Hook now.',fight:surge?`The fish pulls ${f.side<0?'left':'right'}! Stop reeling. Give line with B; brace ${f.side<0?'right · V':'left · Z'}.`:'The fish is resting. Hold Q to reel; stop when it struggles. Tap Reel to toggle steady reeling.',caught:f.catch?`${f.catch.name} · ${f.catch.length} cm · ${f.catch.weight} kg. A fine catch! Release it to finish.`:'',miss:f.reason,lost:f.reason};
    const labels={rig:'Hold to cast · Q',charge:'Release to cast',cast:'Casting…',wait:'Twitch bait · Q',nibble:'Wait for the bite',bite:'Hook now! · Q',fight:f.reeling?'Stop reeling · Q':'Reel · hold Q',caught:'Release fish · Q',miss:'Try another cast · Q',lost:'Try another cast · Q'};
    return {description:text[p],action:labels[p],secondary:p==='rig'?`Bait: ${f.bait} · B`:p==='fight'?'Give line · B':null,progress:p==='caught'?1:p==='charge'?f.power:p==='fight'?clamp(1-f.distance/f.initialDistance):0,meter:p==='fight'?{label:'Line tension',value:f.tension,detail:`${f.distance.toFixed(1)} m to shore · ${surge?'struggling':'resting'}`,danger:f.tension>.72}:p==='charge'?{label:'Cast distance',value:f.power,detail:`${Math.round(5+f.power*10)} m`,danger:false}:null,disabled:p==='cast'||p==='nibble',brace:p==='fight'};
  }
  return {state:f,act,press,release,clear,secondary,update,view,aim(side){f.rodSide=side;}};
}
