import { Mesh, MeshBasicMaterial, PlaneGeometry, type Object3D } from 'three';

export function createVehicleContactShadow(width: number, length: number) {
  // Bake the plane into the ground. Runtime rotation then uses the same world
  // Y axis and sign as the vehicle, rather than rotating a tilted local Z axis.
  const geometry = new PlaneGeometry(width, length);
  geometry.rotateX(-Math.PI / 2);
  return new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: '#243a30',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
}

export function placeVehicleContactShadow(shadow: Object3D, vehicle: Object3D) {
  shadow.position.set(vehicle.position.x, 0.027, vehicle.position.z);
  shadow.rotation.set(0, vehicle.rotation.y, 0);
}
