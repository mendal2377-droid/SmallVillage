import * as THREE from 'three';

// The closed leaf in the source matches the photograph; it swings into the room on approach.
export function createHouseDoor({scene,model,mode,camera,walk,host}){
  const hinge=new THREE.Vector3(3.15,.42,-2.97);if(mode==='village')hinge.add(new THREE.Vector3(-32,0,109));
  const root=new THREE.Group();root.name='Storage door hinge';root.position.copy(hinge);scene.add(root);model.updateMatrixWorld(true);
  model.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(!materials.some(m=>m.name.includes('Photo storage door'))&&!o.name.replaceAll('_',' ').includes('Photo storage door'))return;o.visible=false;const g=o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-hinge.x,-hinge.y,-hinge.z),m=new THREE.Mesh(g,o.material);m.castShadow=m.receiveShadow=true;root.add(m);});
  let angle=0,hold=0;
  function update(dt){if(!root.children.length)return;const nearby=walk.enabled&&camera.position.y<3.4&&Math.hypot(camera.position.x-(hinge.x+.45),camera.position.z-hinge.z)<2.2;if(nearby)hold=2;else hold=Math.max(0,hold-dt);angle=THREE.MathUtils.damp(angle,hold>0?Math.PI*.48:0,7,dt);root.rotation.y=angle;
    // Opening clears the passage before movement; the closed leaf remains solid.
    walk.setDynamic('storage-door',walk.enabled&&angle<.15?{cx:hinge.x+.45,cz:hinge.z,hx:.45,hz:.04,c:1,s:0,low:.42,high:2.64}:null);host.dataset.storageDoor=angle>.15?'open':'closed';
  }
  return{root,update,get angle(){return angle;},dispose(){walk.setDynamic('storage-door',null);scene.remove(root);root.children.forEach(o=>o.geometry.dispose());}};
}
