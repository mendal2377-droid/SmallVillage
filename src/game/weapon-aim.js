import * as THREE from 'three';

// Screen coordinates are independent of the walker heading. This also handles
// portrait viewports, camera pitch, zoom and a camera inside a transformed parent.
export function weaponAimDirection(camera,point,target=new THREE.Vector3()){
  camera.updateWorldMatrix(true,false);
  return target.set(point.x,point.y,.5).unproject(camera)
    .sub(new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)).normalize();
}
