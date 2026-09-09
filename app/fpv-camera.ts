import { Euler, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
// Blender coach coordinates converted to glTF (Y up), at the right-hand driver seat.
export const DRIVER_EYE = new Vector3(3.95 * .17, 2.58 * .17, .72 * .17);
export function positionDriverCamera(camera:PerspectiveCamera,bus:Object3D,yaw=0,pitch=0){
 bus.updateWorldMatrix(true,false);
 const pose=bus.userData.suspensionPose;const bodyRotation=new Quaternion();if(pose)bodyRotation.setFromEuler(new Euler(-pose.roll,0,pose.pitch,'ZYX'));const eye=DRIVER_EYE.clone().applyQuaternion(bodyRotation);if(pose)eye.y+=pose.height;camera.position.copy(bus.localToWorld(eye));
 const orientation=bus.getWorldQuaternion(new Quaternion()).multiply(bodyRotation);
 camera.up.set(0,1,0).applyQuaternion(orientation);
 const direction=new Vector3(Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),-Math.cos(pitch)*Math.sin(yaw)).applyQuaternion(orientation);
 camera.lookAt(camera.position.clone().add(direction));
}
