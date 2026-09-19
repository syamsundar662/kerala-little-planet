import * as T from 'three';
import { naturalMaterial } from './alappuzha-materials';

// Shared materials keep the streamed scene batchable despite richer geometry.
export function createKeralaScenery() {
  const material = (color: string) =>
    new T.MeshStandardMaterial({ color, roughness: 0.9 });
  const plaster = ['#cfc9b8', '#b8c1b4', '#cdbb9e', '#aebfbc'].map((c) =>
      naturalMaterial(c, 'plaster'),
    ),
    tile = naturalMaterial('#704332', 'roof'),
    tileLight = material('#8e5b43'),
    trim = naturalMaterial('#d4d0c2', 'plaster'),
    timber = material('#544535'),
    glass = new T.MeshStandardMaterial({
      color: '#33494e',
      roughness: 0.22,
      metalness: 0.25,
    }),
    stone = naturalMaterial('#8a877d', 'soil'),
    trunk = naturalMaterial('#625647', 'plaster'),
    green = ['#344e2e', '#48643a', '#607845'].map(material),
    dark = material('#303631'),
    awning = ['#824940', '#4c655e', '#927c55'].map(material);
  const allMaterials = [
    ...plaster,
    tile,
    tileLight,
    trim,
    timber,
    glass,
    stone,
    trunk,
    ...green,
    dark,
    ...awning,
  ];
  const box = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d);
  function builder(group: T.Group, x: number, z: number, yaw: number) {
    return (
      geometry: T.BufferGeometry,
      mat: T.Material,
      px: number,
      py: number,
      pz: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      const mesh = new T.Mesh(geometry, mat);
      mesh.rotation.set(rx, ry, rz);
      mesh.position.set(px, py, pz);
      mesh.applyMatrix4(new T.Matrix4().makeRotationY(yaw));
      mesh.position.x += x;
      mesh.position.z += z;
      group.add(mesh);
      return mesh;
    };
  }
  function building(
    group: T.Group,
    x: number,
    z: number,
    yaw: number,
    seed: number,
    detailed: boolean,
  ) {
    const add = builder(group, x, z, yaw),
      variant = Math.floor(seed * 100) % 4,
      twoStorey = variant === 2,
      h = twoStorey ? 6.4 : 3.5,
      wall = plaster[variant];
    add(box(7.4, 0.32, 8.4), stone, 0, 0.16, 0);
    add(box(7, h, 8), wall, 0, h / 2 + 0.3, 0);
    add(box(7.2, 0.18, 8.2), trim, 0, 1, 0);
    add(box(7.35, 0.2, 8.35), trim, 0, h + 0.28, 0);
    if (variant === 3) {
      add(box(7.5, 0.25, 8.5), stone, 0, h + 0.55, 0);
      for (const side of [-1, 1])
        add(box(0.17, 0.6, 8.3), wall, side * 3.6, h + 0.95, 0);
      add(
        new T.CylinderGeometry(0.75, 0.75, 1.2, 10),
        dark,
        1.8,
        h + 1.25,
        -2.4,
      );
    } else {
      const a = [-4.1, 0, -4.6],
        b = [4.1, 0, -4.6],
        c = [4.1, 0, 4.6],
        d = [-4.1, 0, 4.6],
        e = [0, 1.7, -2],
        f = [0, 1.7, 2];
      const roof = new T.BufferGeometry();
      roof.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [a, e, b, b, e, f, b, f, c, c, f, d, d, f, e, d, e, a].flat(),
          3,
        ),
      );
      roof.computeVertexNormals();
      tile.side = T.DoubleSide;
      add(roof, tile, 0, h + 0.38, 0);
      add(
        new T.CylinderGeometry(0.13, 0.13, 4.4, 8),
        tileLight,
        0,
        h + 2.08,
        0,
        Math.PI / 2,
      );
      for (const side of [-1, 1])
        add(box(0.12, 0.15, 9.2), timber, side * 4.05, h + 0.35, 0);
    }
    // Veranda, pitched lean-to roof and its columns face the actual street.
    add(box(7, 0.2, 2), stone, 0, 0.35, 4.8);
    add(
      box(7.7, 0.16, 2.7),
      variant === 1 ? awning[variant] : tile,
      0,
      3.2,
      4.7,
      0.1,
    );
    for (const side of [-1, 1]) {
      add(box(0.22, 2.8, 0.22), trim, side * 3.05, 1.8, 5.55);
      add(box(0.45, 0.18, 0.45), stone, side * 3.05, 0.55, 5.55);
    }
    add(box(1.65, 0.12, 1), stone, 0, 0.13, 6);
    add(box(1.55, 0.12, 0.65), stone, 0, 0.25, 5.75);
    add(box(1.1, 2.25, 0.1), timber, 0, 1.45, 4.07);
    add(box(0.12, 0.12, 0.12), tileLight, 0.35, 1.45, 4.15);
    for (const floor of twoStorey ? [1.9, 5] : [1.9])
      for (const side of [-1, 1]) {
        add(box(1.5, 1.5, 0.1), trim, side * 2.1, floor, 4.07);
        add(box(1.25, 1.2, 0.12), glass, side * 2.1, floor, 4.14);
        if (detailed) {
          add(box(0.07, 1.3, 0.16), timber, side * 2.1, floor, 4.18);
          add(box(1.3, 0.07, 0.16), timber, side * 2.1, floor, 4.18);
          add(box(1.7, 0.14, 0.35), trim, side * 2.1, floor - 0.77, 4.15);
        }
        add(box(0.12, 1.3, 1.6), trim, side * 3.55, floor, -1.5);
        add(box(0.14, 1.1, 1.35), glass, side * 3.62, floor, -1.5);
      }
    if (twoStorey) {
      add(box(5, 0.2, 1.5), trim, 0, 3.8, 4.7);
      for (const side of [-1, 1])
        add(box(0.12, 1, 1.5), timber, side * 2.45, 4.4, 4.7);
      add(box(5, 0.12, 0.12), timber, 0, 4.9, 5.4);
      if (detailed)
        for (let i = -2; i <= 2; i++)
          add(box(0.06, 1, 0.06), timber, i, 4.35, 5.4);
    }
    if (variant === 1) {
      add(box(4.8, 0.65, 0.15), awning[0], 0, 2.75, 4.16);
      for (let i = -2; i <= 2; i++)
        add(box(0.55, 0.13, 0.17), trim, i * 0.7, 2.75, 4.27);
      if (detailed) {
        add(box(1.4, 0.8, 0.65), timber, -2, 0.8, 5);
        add(new T.CylinderGeometry(0.25, 0.22, 0.4, 8), tileLight, -2, 1.4, 5);
      }
    }
    if (detailed) {
      for (const side of [-1, 1]) {
        add(
          new T.CylinderGeometry(0.35, 0.25, 0.5, 8),
          tile,
          side * 2.9,
          0.65,
          5.6,
        );
        add(new T.IcosahedronGeometry(0.55, 1), green[1], side * 2.9, 1.2, 5.6);
      }
      add(box(0.18, 0.65, 6), stone, -4.1, 0.35, -0.4);
      for (let i = 0; i < 5; i++) {
        const shrub = add(
          new T.IcosahedronGeometry(0.8, 2),
          green[i % 3],
          -4.15,
          0.85,
          -2.6 + i * 1.1,
        );
        shrub.scale.set(0.7, 0.8, 1);
      }
      add(new T.CylinderGeometry(0.055, 0.055, 3.7, 6), dark, 3.45, 1.85, -3.9);
    }
  }
  function palm(group: T.Group, x: number, z: number, seed: number) {
    const height = 8 + seed * 5,
      add = builder(group, x, z, seed * 6.28);
    const stem = new T.CylinderGeometry(0.16, 0.33, height, 7, 4);
    add(stem, trunk, 0.35, height / 2, 0, 0, 0, -0.055);
    const crownX = 0.35 + height * 0.025;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        vertices: number[] = [];
      for (let j = 0; j < 7; j++) {
        const t = j / 7,
          u = (j + 1) / 7;
        const point = (v: number, side: number) => {
          const r = v * 4.6,
            w = Math.sin(v * Math.PI) * 0.55 * side;
          return [
            crownX + Math.sin(angle) * r + Math.cos(angle) * w,
            height + 0.6 + Math.sin(v * Math.PI) * 0.65 - v * v * 1.7,
            Math.cos(angle) * r - Math.sin(angle) * w,
          ];
        };
        const a = point(t, -1),
          b = point(t, 1),
          c = point(u, -1),
          d = point(u, 1);
        vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(vertices, 3),
      );
      geometry.computeVertexNormals();
      green[i % 3].side = T.DoubleSide;
      add(geometry, green[i % 3], 0, 0, 0);
    }
    for (let i = 0; i < 3; i++)
      add(
        new T.IcosahedronGeometry(0.23, 1),
        timber,
        crownX + Math.sin(i * 2) * 0.3,
        height - 0.15,
        Math.cos(i * 2) * 0.3,
      );
  }
  function tree(group: T.Group, x: number, z: number, seed: number) {
    const add = builder(group, x, z, seed * 3),
      height = 5 + seed * 3;
    add(new T.CylinderGeometry(0.25, 0.55, height, 7), trunk, 0, height / 2, 0);
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      const canopy = add(
        new T.IcosahedronGeometry(2.25 + seed, 2),
        green[i % 3],
        Math.sin(angle) * 1.4,
        height + Math.sin(i) * 0.5,
        Math.cos(angle) * 1.4,
      );
      canopy.scale.y = 0.8;
    }
  }
  return {
    building,
    palm,
    tree,
    dispose: () => allMaterials.forEach((m) => m.dispose()),
  };
}

export function createAlappuzhaSky(scene: T.Scene, mobile = false) {
  const cloudCount = mobile ? 12 : 28;
  const clouds = new T.Group();
  clouds.name = 'Drifting clouds';
  scene.add(clouds);
  const cloudMaterial = new T.MeshBasicMaterial({
    color: '#e2e5e5',
    fog: false,
  });
  const cloudGeometry = new T.IcosahedronGeometry(1, 2);
  const cloudMesh = new T.InstancedMesh(
    cloudGeometry,
    cloudMaterial,
    cloudCount * 5,
  );
  cloudMesh.frustumCulled = false;
  clouds.add(cloudMesh);
  const transform = new T.Object3D();
  let index = 0;
  for (let i = 0; i < cloudCount; i++) {
    const a = i * 2.39996,
      r = 220 + (i % 7) * 105;
    for (let j = 0; j < 5; j++) {
      transform.position.set(
        Math.sin(a) * r + j * 16,
        115 + (i % 5) * 20 + Math.sin(j) * 5,
        Math.cos(a) * r,
      );
      transform.scale.set(25 + (i % 3) * 7, 7 + (j % 3) * 3, 15 + (j % 2) * 7);
      transform.updateMatrix();
      cloudMesh.setMatrixAt(index++, transform.matrix);
    }
  }
  const birds = new T.Group();
  birds.name = 'Flying birds';
  scene.add(birds);
  const birdMat = new T.MeshBasicMaterial({
    color: '#334c48',
    side: T.DoubleSide,
  });
  const wingGeometry = new T.BufferGeometry();
  wingGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute([0, 0, 0, 1.3, 0, 0.25, 0.45, 0, -0.35], 3),
  );
  wingGeometry.computeVertexNormals();
  const flock = Array.from({ length: mobile ? 5 : 14 }, (_, i) => {
    const bird = new T.Group(),
      left = new T.Mesh(wingGeometry, birdMat),
      right = new T.Mesh(wingGeometry, birdMat);
    right.scale.x = -1;
    bird.add(left, right);
    birds.add(bird);
    return { bird, left, right, phase: i * 1.7 };
  });
  let elapsed = 0;
  return {
    update(dt: number, position: T.Vector3, cover = 0.3, daylight = 1) {
      cloudMesh.count = Math.round(cloudCount * cover) * 5;
      cloudMaterial.color
        .set(cover > 0.7 ? '#929da5' : '#e2e5e5')
        .multiplyScalar(0.12 + daylight * 0.88);
      birds.visible = daylight > 0.3 && cover < 0.95;
      elapsed += dt;
      clouds.position.set(
        position.x + Math.sin(elapsed * 0.006) * 60,
        0,
        position.z,
      );
      birds.position.set(position.x, 0, position.z);
      flock.forEach(({ bird, left, right, phase }, i) => {
        const angle = elapsed * 0.055 + phase,
          r = 65 + i * 8;
        bird.position.set(
          Math.sin(angle) * r,
          26 + (i % 5) * 5 + Math.sin(elapsed * 0.6 + phase) * 2,
          Math.cos(angle) * r,
        );
        bird.rotation.y = angle + Math.PI / 2;
        const flap = Math.sin(elapsed * 5 + phase) * 0.45;
        left.rotation.z = flap;
        right.rotation.z = -flap;
      });
    },
    dispose() {
      scene.remove(clouds, birds);
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      wingGeometry.dispose();
      birdMat.dispose();
    },
  };
}
