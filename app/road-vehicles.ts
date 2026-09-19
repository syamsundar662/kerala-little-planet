import * as T from 'three';
export type VehicleKind = 'bus' | 'car' | 'bike' | 'lorry';
export const vehicleSpecs = {
  bus: { speed: 24, wheelbase: 6, length: 5.7, width: 1.8 },
  car: { speed: 34, wheelbase: 2.8, length: 2.6, width: 1.4 },
  bike: { speed: 29, wheelbase: 1.45, length: 1.3, width: 0.65 },
  lorry: { speed: 20, wheelbase: 4.5, length: 4.6, width: 1.7 },
};
export function createRoadVehicle(kind: 'car' | 'bike' | 'lorry') {
  const group = new T.Group();
  group.name = kind;
  group.userData.kind = kind;
  const paint = new T.MeshStandardMaterial({
      color:
        kind === 'car' ? '#457c85' : kind === 'bike' ? '#972d2b' : '#ce8041',
      roughness: 0.4,
      metalness: 0.2,
    }),
    dark = new T.MeshStandardMaterial({ color: '#24282a', roughness: 0.85 }),
    glass = new T.MeshStandardMaterial({
      color: '#24404c',
      roughness: 0.2,
      metalness: 0.35,
    }),
    metal = new T.MeshStandardMaterial({
      color: '#aab1b4',
      roughness: 0.4,
      metalness: 0.65,
    }),
    lamp = new T.MeshStandardMaterial({
      color: '#f4e6ba',
      emissive: '#d9cda8',
      emissiveIntensity: 0.25,
    });
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m = paint,
  ) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const wheels: T.Group[] = [];
  const wheel = (x: number, z: number, r: number, w: number) => {
    const pivot = new T.Group();
    pivot.position.set(x, r, z);
    const tire = new T.Mesh(new T.CylinderGeometry(r, r, w, 16), dark);
    tire.rotation.z = Math.PI / 2;
    pivot.add(tire);
    const hub = new T.Mesh(
      new T.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 12),
      metal,
    );
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);
    group.add(pivot);
    wheels.push(pivot);
  };
  if (kind === 'bike') {
    wheel(0, -0.8, 0.34, 0.15);
    wheel(0, 0.8, 0.34, 0.15);
    box(0.22, 0.2, 1.5, 0, 0.48, 0, dark);
    box(0.48, 0.3, 0.6, 0, 0.88, 0.2);
    box(0.43, 0.14, 0.7, 0, 0.88, -0.4, dark);
    box(0.08, 0.64, 0.08, -0.12, 0.64, 0.72, metal);
    box(0.08, 0.64, 0.08, 0.12, 0.64, 0.72, metal);
    box(0.8, 0.06, 0.08, 0, 1.18, 0.65, metal);
    box(0.3, 0.2, 0.12, 0, 1.02, 0.86, lamp);
    box(
      0.2,
      0.12,
      0.09,
      0,
      0.74,
      -1.05,
      new T.MeshStandardMaterial({ color: '#a42321' }),
    );
    // Lightweight seated rider, so riding never looks like an empty motorcycle.
    const rider = new T.Group();
    rider.name = 'Rider';
    rider.visible = false;
    group.add(rider);
    group.userData.rider = rider;
    const torso = new T.Mesh(
      new T.BoxGeometry(0.45, 0.55, 0.25),
      new T.MeshStandardMaterial({ color: '#315666' }),
    );
    torso.position.set(0, 1.25, -0.15);
    torso.rotation.x = 0.18;
    rider.add(torso);
    const helmet = new T.Mesh(new T.SphereGeometry(0.19, 12, 8), dark);
    helmet.position.set(0, 1.67, -0.03);
    rider.add(helmet);
    for (const side of [-1, 1]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.15, 0.55, 0.2), dark);
      leg.position.set(side * 0.29, 0.7, -0.1);
      rider.add(leg);
      const arm = new T.Mesh(
        new T.BoxGeometry(0.12, 0.12, 0.55),
        torso.material,
      );
      arm.position.set(side * 0.29, 1.25, 0.24);
      rider.add(arm);
    }
  } else if (kind === 'lorry') {
    box(2.4, 0.3, 8, 0, 0.85, 0, dark);
    box(2.4, 1.35, 2.1, 0, 1.6, 2.7);
    box(2.2, 1, 1.85, 0, 2.7, 2.65, glass);
    box(2.4, 0.15, 2.1, 0, 3.27, 2.7);
    box(2.4, 0.3, 5.2, 0, 1.1, -1.05, metal);
    box(0.12, 1.45, 5.2, -1.16, 1.9, -1.05);
    box(0.12, 1.45, 5.2, 1.16, 1.9, -1.05);
    box(2.4, 1.45, 0.12, 0, 1.9, -3.65);
    box(2.4, 1.45, 0.12, 0, 1.9, 1.5);
    for (const x of [-1.16, 1.16])
      for (const z of [2.65, -1.8, -2.85]) wheel(x, z, 0.53, 0.28);
    box(2.55, 0.22, 0.2, 0, 0.8, 3.8, metal);
    for (const x of [-0.8, 0.8]) box(0.4, 0.25, 0.08, x, 1.4, 3.8, lamp);
  } else {
    box(1.85, 0.65, 4.1, 0, 0.75, 0);
    box(1.6, 0.65, 2, 0, 1.4, -0.2, glass);
    box(1.7, 0.12, 2.1, 0, 1.78, -0.2);
    box(1.85, 0.15, 1.1, 0, 1.1, 1.4);
    for (const x of [-0.9, 0.9])
      for (const z of [-1.3, 1.3]) wheel(x, z, 0.34, 0.22);
    for (const x of [-0.62, 0.62]) {
      box(0.4, 0.2, 0.08, x, 0.92, 2.08, lamp);
      box(
        0.38,
        0.18,
        0.08,
        x,
        0.9,
        -2.08,
        new T.MeshStandardMaterial({ color: '#992b28' }),
      );
    }
  }
  group.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.userData.roll = (travel: number) => {
    for (const wheel of wheels)
      wheel.rotation.x += travel / (kind === 'lorry' ? 0.53 : 0.34);
  };
  return group;
}
