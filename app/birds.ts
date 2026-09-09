import * as T from 'three';

export function createBirds(globe:T.Group){
 const feather=new T.MeshStandardMaterial({color:0x242d2c,roughness:.88,side:T.DoubleSide});
 const pale=new T.MeshStandardMaterial({color:0xd5d6c3,roughness:.92,side:T.DoubleSide});
 const beakMaterial=new T.MeshStandardMaterial({color:0x7d7456,roughness:.8});
 const bodyGeometry=new T.SphereGeometry(1,10,7);
 const wingGeometry=new T.BufferGeometry();wingGeometry.setAttribute('position',new T.Float32BufferAttribute([.025,0,0,-.065,0,0,-.105,.009,.105,-.14,0,.215,-.065,.018,.17,.035,.013,.075],3));wingGeometry.setIndex([0,1,2,0,2,5,5,2,4,2,3,4]);wingGeometry.computeVertexNormals();
 const tailGeometry=new T.BufferGeometry();tailGeometry.setAttribute('position',new T.Float32BufferAttribute([-.06,0,-.018,-.06,0,.018,-.15,.012,.045,-.15,.012,-.045],3));tailGeometry.setIndex([0,1,2,0,2,3]);tailGeometry.computeVertexNormals();
 const birds=Array.from({length:12},(_,i)=>{
  const bird=new T.Group();bird.name='Flying village bird '+(i+1);bird.userData.animatedChildren=true;
  const body=new T.Mesh(bodyGeometry,i%4===0?pale:feather);body.scale.set(.073,.025,.029);bird.add(body);
  const head=new T.Mesh(bodyGeometry,feather);head.scale.set(.027,.024,.023);head.position.set(.065,.012,0);bird.add(head);
  const beak=new T.Mesh(new T.ConeGeometry(.010,.038,6),beakMaterial);beak.rotation.z=-Math.PI/2;beak.position.set(.097,.009,0);bird.add(beak);
  bird.add(new T.Mesh(tailGeometry,feather));
  const wings=[-1,1].map(side=>{const wing=new T.Mesh(wingGeometry,i%4===0?pale:feather);wing.scale.z=side;bird.add(wing);return wing});
  bird.scale.setScalar(.85+(i%3)*.12);globe.add(bird);return {bird,wings};
 });
 const position=(i:number,time:number)=>{
  const flock=Math.floor(i/4),member=i%4,t=time*(.072+flock*.009)+flock*2.1+member*.055;
  const lat=.20+Math.sin(t*1.4+flock)*.28+member*.018;
  const altitude=2.35+flock*.22+Math.sin(time*.6+i)*.055;
  return new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(5.6+altitude);
 };
 const update=(time:number)=>{for(const [{bird,wings},i] of birds.map((b,i)=>[b,i] as const)){
  const p=position(i,time),up=p.clone().normalize(),forward=position(i,time+.01).sub(p).projectOnPlane(up).normalize(),right=new T.Vector3().crossVectors(forward,up).normalize();
  bird.position.copy(p);bird.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,up,right));
  const gliding=Math.sin(time*.65+i*.8)>.65;const flap=gliding?.10:Math.sin(time*9+i*1.7)*.65;
  wings[0].rotation.x=flap;wings[1].rotation.x=-flap;
 }};
 update(0);return {update};
}
