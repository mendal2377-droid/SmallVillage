import * as THREE from 'three';

const noise=`float phash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(phash(i),phash(i+vec2(1,0)),f.x),mix(phash(i+vec2(0,1)),phash(i+1.),f.x),f.y);}
float caustic(vec2 p,float t){p+=vec2(sin(p.y*1.3+t*.5),cos(p.x*1.1-t*.4))*.38;vec2 i=floor(p),f=fract(p);float a=9.,b=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=.5+.42*sin(t*.6+6.2831*vec2(phash(i+g),phash(i+g+13.)));float d=length(g+o-f);if(d<a){b=a;a=d;}else b=min(b,d);}return 1.-smoothstep(.015,.105,b-a);}`;

export function pondBedMaterial(){
  const mat=new THREE.MeshStandardMaterial({color:'#67776b',roughness:.92});
  mat.userData.time={value:0};mat.userData.strength={value:1};
  mat.onBeforeCompile=s=>{
    s.uniforms.pondTime=mat.userData.time;s.uniforms.pondStrength=mat.userData.strength;
    s.vertexShader='varying vec3 pondPosition;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\npondPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    s.fragmentShader='varying vec3 pondPosition;uniform float pondTime;uniform float pondStrength;\n'+noise+'\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 q=pondPosition.xz*18.;vec2 cell=floor(q);float grain=phash(cell);
      vec2 jitter=vec2(phash(cell+7.),phash(cell+17.))*.32-.16;
      float pebble=1.-smoothstep(.25+grain*.08,.48,length(fract(q)-.5-jitter));
      diffuseColor.rgb*=mix(.62,1.22,grain)*(.8+.20*pebble);
      float c=caustic(pondPosition.xz*2.6,pondTime);
      diffuseColor.rgb+=vec3(.32,.37,.22)*c*pondStrength;
    `);
  };mat.customProgramCacheKey=()=> 'forest-gravel-caustics-v1';return mat;
}

export function pondWaterMaterial(){return new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
  uniforms:{...THREE.UniformsLib.fog,time:{value:0},day:{value:1},wet:{value:0},ice:{value:0},sky:{value:new THREE.Color('#a6c5c9')}},
  vertexShader:`varying vec3 p;varying vec3 eye;
    #include <fog_pars_vertex>
    void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;eye=cameraPosition-w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader:`uniform float time;uniform float day;uniform float wet;uniform float ice;uniform vec3 sky;varying vec3 p;varying vec3 eye;
    #include <fog_pars_fragment>
    ${noise}
    void main(){vec2 q=p.xz;
      vec3 n=normalize(vec3(sin(q.x*2.2+q.y*.7+time*.8)*.026,1.,cos(q.y*2.8-q.x*.8+time)*.026));
      float fresnel=pow(1.-abs(dot(normalize(eye),n)),3.);
      float cloud=pnoise(q*.06+vec2(time*.004));
      vec3 reflection=mix(sky*.48,sky,cloud);
      float glint=pow(max(dot(reflect(-normalize(vec3(-.4,.8,.2)),n),normalize(eye)),0.),160.);
      vec3 water=mix(vec3(.08,.24,.20),reflection,fresnel*.9)+glint*.38;
      float ring=sin(length(mod(q,1.9)-.95)*34.-time*8.)*wet*.025;
      water+=ring;water=mix(water,vec3(.55,.66,.65),ice);
      gl_FragColor=vec4(water*(.16+.84*day),mix(.12+fresnel*.53,.6,ice));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`
});}

export function koiMaterial(kind){
  const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.3,metalness:.06});
  const palettes=[['#f4eee0','#c74722','#202d2c'],['#edeee5','#d75427','#edeee5'],['#e8bd59','#c98529','#e8bd59'],['#e9ece5','#e9ece5','#e9ece5'],['#cd6937','#233630','#cd6937'],['#eee8de','#233630','#eee8de']];
  const palette=palettes[kind%palettes.length].map(c=>new THREE.Color(c));
  mat.onBeforeCompile=s=>{
    s.uniforms.koiBase={value:palette[0]};s.uniforms.koiRed={value:palette[1]};s.uniforms.koiInk={value:palette[2]};
    s.vertexShader='varying vec3 koiP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nkoiP=position;');
    s.fragmentShader='varying vec3 koiP;uniform vec3 koiBase;uniform vec3 koiRed;uniform vec3 koiInk;\n'+noise+'\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float coatPatch=pnoise(koiP.xz*vec2(11.,5.)+${kind.toFixed(1)});
      float dark=pnoise(koiP.zy*vec2(9.,16.)+${(kind+7).toFixed(1)});
      vec3 coat=mix(koiBase,koiRed,smoothstep(.47,.55,coatPatch));
      coat=mix(coat,koiInk,smoothstep(.62,.7,dark));
      float scales=sin(koiP.z*95.+sin(koiP.x*60.)*2.)*sin(koiP.x*85.);
      diffuseColor.rgb*=coat*(.97+scales*.03);
    `);
  };mat.customProgramCacheKey=()=>`koi-coat-${kind}`;return mat;
}
