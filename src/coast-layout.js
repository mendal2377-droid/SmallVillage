// A fictional extension of the village, inspired by the supplied Point Lookout view.
// Rendering, walking and planting share this shoreline rather than approximating it with boxes.
export const COAST={start:300,minZ:-205,maxZ:335,seaEnd:2200,trail:[[300,128],[344,128],[393,132],[444,151],[476,160]],spawn:[476,1.75,160]};
export function shoreX(z){return 468+25*Math.sin(z*.007)+9*Math.sin(z*.025)+50*Math.exp(-(((z-245)/48)**2));}
export function inCoastWater(nav,x,z,margin=0){return Boolean(nav?.coast&&x>shoreX(z)-margin);}
export function extendCoastNavigation(source){
  const nav=structuredClone(source);nav.coast=COAST;nav.bounds[2]=700;
  nav.places.coast={spawn:COAST.spawn,yaw:-2.2,pitch:-.10};
  const trail=[...COAST.trail];
  for(let z=132;z>=-165;z-=24)trail.push([shoreX(z)-48,z]);
  nav.coastTrail=trail;
  for(let i=1;i<trail.length;i++){const [x,z]=trail[i-1],[a,b]=trail[i];nav.roads.push([(x+a)/2,(z+b)/2,Math.hypot(a-x,b-z)/2+1.5,1.8,-Math.atan2(b-z,a-x)]);}
  // Rocky headland: decorative rocks are solid, the beach and connector stay level and clear.
  nav.coastRocks=[];
  for(let i=0;i<14;i++){const z=216+i*5,x=shoreX(z)-8+(i%3)*5,s=2.5+(i%4)*.7;nav.coastRocks.push({x,z,s});nav.boxes.push([x,z,s,s,0,.1,s*1.8]);}
  return nav;
}
