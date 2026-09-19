import * as T from 'three';
import {vehicleSpecs, type VehicleKind} from './road-vehicles';
export function createVehicleHeadlights(scene:T.Scene, mobile:boolean) {
  const rig=new T.Group(); rig.name='Vehicle headlights'; scene.add(rig);
  const material=new T.MeshBasicMaterial({color:'#fff2cc',toneMapped:false});
  const geometry=new T.SphereGeometry(.13,8,6);
  const lamps=[-1,1].map(()=>{const mesh=new T.Mesh(geometry,material);rig.add(mesh);return mesh;});
  const lights=Array.from({length:mobile?1:2},()=>{
    const light=new T.SpotLight('#fff0cc',0,85,Math.PI/7,.6,2);
    light.castShadow=false; rig.add(light,light.target); return light;
  });
  return {
    update(vehicle:T.Group,kind:VehicleKind,on:boolean,daylight:number) {
      const spec=vehicleSpecs[kind],height=kind==='bike'?.95:kind==='car'?.65:1.1;
      rig.position.copy(vehicle.position);rig.quaternion.copy(vehicle.quaternion);
      const front=spec.length+.08, spread=kind==='bike'?0:spec.width*.65;
      lamps.forEach((lamp,i)=>{lamp.visible=on&&(kind!=='bike'||i===0);lamp.position.set((i?1:-1)*spread,height,front);});
      lights.forEach((light,i)=>{
        const x=lights.length===1?0:(i?1:-1)*spread;
        light.position.set(x,height,front);
        light.target.position.set(x,.1,front+30);
        light.intensity=on?(1800+6200*(1-daylight))/lights.length:0;
      });
      rig.updateMatrixWorld(true);
    },
    dispose(){rig.removeFromParent();geometry.dispose();material.dispose();lights.forEach(l=>l.dispose());},
  };
}
