// Small synthesized soundscape: no audio files, nothing plays until the first user gesture.
export function createAudio(){
  let ctx,master,noise,rainGain,windGain,engine,enabled=true;
  function start(){
    if(ctx||!enabled)return ctx?.resume();
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();master=ctx.createGain();master.gain.value=.55;master.connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const loop=(type,frequency,q)=>{const src=ctx.createBufferSource();src.buffer=noise;src.loop=true;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=frequency;f.Q.value=q;const g=ctx.createGain();g.gain.value=0;src.connect(f).connect(g).connect(master);src.start();return g;};
    rainGain=loop('highpass',1400,.4);windGain=loop('lowpass',380,.7);
    // Engine: two detuned oscillators through a low-pass, pitched by vehicle speed.
    const o1=ctx.createOscillator(),o2=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    o1.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=420;g.gain.value=0;
    o1.connect(f);o2.connect(f);f.connect(g).connect(master);o1.start();o2.start();engine={o1,o2,f,g};
  }
  const now=()=>ctx.currentTime;
  function burst({duration=.2,frequency=1200,type='bandpass',q=1,gain=.5,decay=duration,delay=0}){
    if(!ctx)return;const src=ctx.createBufferSource();src.buffer=noise;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=frequency;f.Q.value=q;
    const g=ctx.createGain();const t=now()+delay;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+decay);
    src.connect(f).connect(g).connect(master);src.start(t,Math.random());src.stop(t+duration+.05);
  }
  function tone({frequency=440,end=frequency,duration=.15,type='sine',gain=.25,delay=0}){
    if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain(),t=now()+delay;o.type=type;
    o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(master);o.start(t);o.stop(t+duration+.02);
  }
  const sounds={
    slingshot:()=>{tone({frequency:220,end:90,duration:.12,type:'triangle',gain:.35});burst({duration:.08,frequency:2500,gain:.15});},
    water:()=>burst({duration:.12,frequency:3200,q:.6,gain:.12}),
    throw:()=>burst({duration:.18,frequency:700,q:.5,gain:.12}),
    fuse:()=>burst({duration:.5,frequency:5000,q:2,gain:.06,decay:.5}),
    bang:()=>{burst({duration:.5,frequency:180,type:'lowpass',gain:1.2,decay:.45});burst({duration:.12,frequency:2400,gain:.7,decay:.1});},
    clink:()=>{tone({frequency:1900,end:1700,duration:.25,type:'triangle',gain:.22});tone({frequency:2650,duration:.18,gain:.1});},
    thud:()=>{tone({frequency:140,end:60,duration:.15,gain:.4});burst({duration:.1,frequency:400,gain:.2});},
    splash:()=>burst({duration:.3,frequency:1800,q:.4,gain:.25,decay:.3}),
    puff:()=>burst({duration:.2,frequency:900,type:'lowpass',gain:.3,decay:.2}),
    flap:()=>{for(let i=0;i<6;i++)burst({duration:.05,frequency:1100,gain:.18,delay:i*.07,decay:.05});},
    chirp:()=>{tone({frequency:3200,end:4200,duration:.07,gain:.08});tone({frequency:3600,end:4600,duration:.06,gain:.07,delay:.1});},
    thunder:()=>{burst({duration:3,frequency:120,type:'lowpass',gain:1,decay:2.8,delay:.6+Math.random()*1.4});},
    door:()=>{tone({frequency:180,end:120,duration:.18,type:'square',gain:.12});},
    horn:()=>{tone({frequency:420,duration:.35,type:'square',gain:.18});tone({frequency:520,duration:.35,type:'square',gain:.12});},
    pickup:()=>{tone({frequency:660,end:990,duration:.12,gain:.2});},
  };
  return{
    start,
    get enabled(){return enabled;},
    set enabled(value){enabled=value;if(ctx)master.gain.value=value?.55:0;if(value)start();},
    play(name){if(ctx&&enabled)sounds[name]?.();},
    // Continuous layers follow the environment and vehicle every frame.
    ambience({rain=0,wind=0}){if(!ctx)return;rainGain.gain.setTargetAtTime(rain*.22,now(),.4);windGain.gain.setTargetAtTime(wind*.25,now(),.6);},
    engine(kind,speed){
      if(!ctx)return;const on=kind?1:0,t=now(),base=kind==='tractor'?38:70;
      engine.o1.frequency.setTargetAtTime(base+Math.abs(speed)*(kind==='tractor'?6:9),t,.1);engine.o2.frequency.setTargetAtTime((base+Math.abs(speed)*7)*1.01,t,.1);
      engine.f.frequency.setTargetAtTime(kind==='tractor'?300:900,t,.1);
      engine.g.gain.setTargetAtTime(on*(kind==='tractor'?.16:.045),t,.15);
    },
  };
}
