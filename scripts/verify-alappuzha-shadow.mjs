import assert from 'node:assert/strict';
import { Object3D, Vector3 } from 'three';
import {
  createVehicleContactShadow,
  placeVehicleContactShadow,
} from '../app/alappuzha-shadow.ts';
const vehicle = new Object3D(),
  shadow = createVehicleContactShadow(3, 11);
try {
  for (const yaw of [
    0,
    0.25,
    Math.PI / 4,
    Math.PI / 2,
    2.3,
    Math.PI,
    -0.6,
    -Math.PI / 2,
    2 * Math.PI + 0.7,
  ]) {
    vehicle.position.set(4020, 0, -19300);
    vehicle.rotation.y = yaw;
    placeVehicleContactShadow(shadow, vehicle);
    shadow.updateMatrixWorld(true);
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let along = 0,
      across = 0;
    const vertices = shadow.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const vertex = new Vector3()
        .fromBufferAttribute(vertices, i)
        .applyMatrix4(shadow.matrixWorld);
      assert(Math.abs(vertex.y - 0.027) < 1e-6, 'shadow must stay flat');
      vertex.sub(vehicle.position);
      along = Math.max(along, Math.abs(vertex.dot(forward)));
      across = Math.max(across, Math.abs(vertex.dot(right)));
    }
    assert(
      Math.abs(along - 5.5) < 1e-6,
      'shadow length must follow vehicle heading',
    );
    assert(
      Math.abs(across - 1.5) < 1e-6,
      'shadow width must stay across the vehicle',
    );
  }
  console.log(
    'PASS: shadow aligned with vehicle across left/right turns and wrapped headings; stays flat and centered.',
  );
} finally {
  shadow.geometry.dispose();
  shadow.material.dispose();
}
