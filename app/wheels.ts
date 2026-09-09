import * as T from 'three';

export function createWheelRoll(model:T.Object3D,radius=.51*.17){
 const wheels:{object:T.Object3D;rest:T.Quaternion;pivot:T.Group;front:boolean;restY:number;radius:number}[]=[];
 const axles:T.Object3D[]=[];model.traverse(object=>{if(/^(Front|Rear)[ _]wheel[ _]axle/i.test(object.name))axles.push(object)});
 model.updateWorldMatrix(true,true);
 const carrierParent=model.parent??model;
 for(const object of axles){
  const bounds=new T.Box3().setFromObject(object),center=bounds.getCenter(new T.Vector3());carrierParent.worldToLocal(center);
  // Keep wheel carriers separate from the sprung coach body.
  const pivot=new T.Group();pivot.name=/^Front/i.test(object.name)?'Front tire steering pivot':'Rear suspension carrier';pivot.position.copy(center);carrierParent.add(pivot);pivot.updateWorldMatrix(true,false);pivot.attach(object);
  wheels.push({object,rest:object.quaternion.clone(),pivot,front:/^Front/i.test(object.name),restY:center.y,radius:.51*.17});
 }
 let angle=0,steering=0;const spin=new T.Quaternion(),axis=new T.Vector3(0,0,1);
 return {count:wheels.length,supports:wheels.map(w=>({x:w.pivot.position.x,z:w.pivot.position.z,y:w.restY,radius:w.radius})),setSuspension(heights:number[]){wheels.forEach((w,i)=>{w.pivot.position.y=heights[i]})},setSteering(radians:number,dt:number,matchPhysics=false){
  if(!Number.isFinite(radians)||!Number.isFinite(dt))return;
  steering=matchPhysics?T.MathUtils.clamp(radians,-.48,.48):T.MathUtils.damp(steering,T.MathUtils.clamp(radians,-.48,.48),10,Math.max(0,Math.min(dt,.05)));
  for(const {pivot,front} of wheels)if(front)pivot.rotation.y=steering;
 },advance(distance:number){
  if(!Number.isFinite(distance))return;
  // +X is forward; a wheel turning toward +X rotates clockwise around +Z.
  angle=(angle-distance/radius)%(Math.PI*2);spin.setFromAxisAngle(axis,angle);
  for(const {object,rest} of wheels)object.quaternion.copy(rest).multiply(spin);
 }};
}
