import * as T from 'three';

// Avatar-local dimensions: villagers are .34 units tall before world scaling.
export function createRainUmbrella(avatar:T.Group, colour=0x234b48) {
  const group=new T.Group();group.name='Rain umbrella';group.visible=false;avatar.add(group);
  const fabric=new T.MeshStandardMaterial({color:colour,roughness:.85,side:T.DoubleSide});
  const metal=new T.MeshStandardMaterial({color:0x393b38,metalness:.55,roughness:.35});
  const canopy=new T.Mesh(new T.SphereGeometry(.14,16,6,0,Math.PI*2,0,Math.PI/2),fabric);
  canopy.scale.y=.3;canopy.castShadow=true;group.add(canopy);
  const pole=new T.Mesh(new T.CylinderGeometry(.0015,.0015,1,6),metal);group.add(pole);
  const tip=new T.Mesh(new T.SphereGeometry(.003,6,4),metal);group.add(tip);
  const points:T.Vector3[]=[];
  for(let rib=0;rib<8;rib++)for(let segment=0;segment<6;segment++){
    const phi=rib*Math.PI/4;
    for(const n of [segment,segment+1]){const theta=n/6*Math.PI/2;points.push(new T.Vector3(Math.cos(phi)*Math.sin(theta)*.14,Math.cos(theta)*.042-.0006,Math.sin(phi)*Math.sin(theta)*.14))}
  }
  const ribs=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xa3aba3}));group.add(ribs);
  let arm:T.Object3D|undefined,forearm:T.Object3D|undefined;
  const yAxis=new T.Vector3(0,1,0),direction=new T.Vector3(),origin=new T.Vector3(),target=new T.Vector3();
  const worldQ=new T.Quaternion(),parentQ=new T.Quaternion();
  function aim(bone:T.Object3D,localDirection:T.Vector3){
    avatar.getWorldQuaternion(worldQ);direction.copy(localDirection).applyQuaternion(worldQ).normalize();
    bone.parent!.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert()).multiply(worldQ.setFromUnitVectors(yAxis,direction));
    bone.updateWorldMatrix(false,true);
  }
  return {
    group,
    update(raining:boolean){
      group.visible=raining;if(!raining)return;
      arm??=avatar.getObjectByName('RightArm');forearm??=avatar.getObjectByName('RightForeArm');
      // Override just the carrying arm after the walk animation; the legs keep walking.
      if(arm&&forearm){
        aim(arm,target.set(.15,-1,0));aim(forearm,target.set(1,.35,0));
        origin.set(0,.225,0);forearm.localToWorld(origin);avatar.worldToLocal(origin);
      }else origin.set(.06,.22,.045);
      canopy.position.set(origin.x,.40,origin.z);ribs.position.copy(canopy.position);
      tip.position.set(origin.x,.445,origin.z);
      const top=.442,length=Math.max(.01,top-origin.y);
      pole.position.set(origin.x,origin.y+length/2,origin.z);pole.scale.y=length;
    },
  };
}
