import { sweepVehicle, type VehicleBody } from './vehicle-collision';
import { createVehicleHeadlights } from './vehicle-headlights';
import { mapPlayers, type MapPlayer } from './world-map-players';
import {getSupabase,isWorldMultiplayerConfigured} from './realtime';
import {createWorldPresence,type LiveStatus} from './world-presence';
import {createWorldPlayers} from './world-players';
import {createWorldVoice, type WorldVoiceState} from './world-voice';
import {
  createRoadVehicle,
  vehicleSpecs,
  type VehicleKind,
} from './road-vehicles';
import { createRoadClearance, sceneryFootprint, overlapsRoad } from './road-clearance';
import { createMappedBuildings } from './mapped-buildings';
import {
  createTerrain,
  drapeTerrainGeometry,
  type TerrainData,
} from './alappuzha-terrain';
import { createEnvironment } from './alappuzha-environment';
import { createStreetLights } from './street-lights';
import { createWorldNameLabel } from './world-name-label';
import * as T from 'three';
import { createDrivingAudio } from './driving-audio';
import { naturalMaterial } from './alappuzha-materials';
import { createKeralaScenery, createAlappuzhaSky } from './alappuzha-scenery';
import {
  createVehicleContactShadow,
  placeVehicleContactShadow,
} from './alappuzha-shadow';
import {
  roadRibbonGeometry,
  dashIntervals,
  configureGroundLayers,
} from './alappuzha-road-mesh';
import { createAvatar } from './player-avatar';
import { createRainUmbrella } from './rain-umbrella';
import { createWheelRoll } from './wheels';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  type MapData,
  type Point,
  mapProjection,
  unprojectPoint,
  stops as defaultStops,
  distance,
} from './alappuzha-map';
export type WorldHud = {
  mode: 'walk' | 'drive';
  liveStatus: LiveStatus;
  livePlayers: number;
  headlights: boolean;
  mapPlayers: MapPlayer[];
  vehicle: VehicleKind;
  canEnter: boolean;
  speed: number;
  road: string;
  offroad: boolean;
  position: Point;
  heading: number;
  path: Point[];
  roads: Point[][];
};
type Segment = {
  a: Point;
  b: Point;
  width: number;
  name: string;
  kind: string;
  offset?: number;
};
export function createAlappuzhaWorld(
  host: HTMLElement,
  data: MapData,
  onHud: (h: WorldHud) => void,
  terrainData: TerrainData,
  playerName = 'Explorer',
  onVoice: (state: WorldVoiceState) => void = () => {},
) {
  const project = mapProjection(data);
  let stops = data.stops ?? defaultStops;
  const terrain = createTerrain(terrainData);
  const elevation = terrain.sample;
  const scene = new T.Scene();
  scene.background = new T.Color('#bed0d9');
  scene.fog = new T.Fog('#c5d1cc', 240, 1400);
  const mobile = matchMedia('(pointer: coarse), (max-width: 760px)').matches;
  const radius = mobile ? 1 : 2;
  const renderer = new T.WebGLRenderer({
    antialias: !mobile,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor('#bed0d9');
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.dataset.quality = mobile ? 'mobile' : 'desktop';
  host.appendChild(renderer.domElement);
  const camera = new T.PerspectiveCamera(
    58,
    host.clientWidth / host.clientHeight,
    0.5,
    1600,
  );
  const hemi = new T.HemisphereLight('#dce6ee', '#54503e', 1.3);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff1dc', 3);
  sun.position.set(150, 250, 80);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -85,
    right: 85,
    top: 85,
    bottom: -85,
    near: 1,
    far: 400,
  });
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.09;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const mat = (color: string) => new T.MeshLambertMaterial({ color });
  const grass = naturalMaterial('#65734b', 'grass'),
    asphalt = naturalMaterial('#34383a', 'asphalt'),
    shoulder = naturalMaterial('#82735e', 'soil'),
    stripe = new T.MeshStandardMaterial({ color: '#d7d4c4', roughness: 0.9 });
  // Flat map layers are composited before buildings and vehicles. They must
  // not compete with the terrain's depth buffer: at grazing angles even a
  // polygon offset cannot reliably separate kilometer-wide, coplanar meshes.
  const environment = createEnvironment(
    scene,
    sun,
    hemi,
    asphalt,
    (x, z) => unprojectPoint(data, [x / 1000, z / 1000]),
    mobile,
  );
  const water = environment.water;
  const groundLayers = configureGroundLayers(water, shoulder, asphalt, stripe);
  // Terrain supplies depth; lifted road faces match its triangles exactly.
  // Keep surface layers from writing depth so intersections remain deterministic.
  for (const material of groundLayers.keys()) {
    material.depthTest = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -4;
  }
  const scenery = createKeralaScenery();
  const sky = createAlappuzhaSky(scene, mobile);
  // Keep ground triangles local instead of stretching two triangles 140 km.
  const groundGeometry = terrain.geometry;
  const ground = new T.Mesh(groundGeometry, grass);
  ground.renderOrder = -100;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadIndex = new Map<string, Segment[]>(),
    waterIndex = new Map<string, typeof data.water>();
  const cell = 500;
  const mappedBuildings = createMappedBuildings();
  const clearance = createRoadClearance();
  const buildingIndex = new Map<string, NonNullable<MapData['buildings']>>();
  const meter = (p: Point): Point => {
    const v = project(p);
    return [v[0] * 1000, v[1] * 1000];
  };
  const indexMap = () => {
    roadIndex.clear();
    waterIndex.clear();
    buildingIndex.clear();
    clearance.clear();
    for (const building of data.buildings ?? []) {
      const p = project(building.points[0]);
      const key = `${Math.floor((p[0] * 1000) / cell)},${Math.floor((p[1] * 1000) / cell)}`;
      if (!buildingIndex.has(key)) buildingIndex.set(key, []);
      buildingIndex.get(key)!.push(building);
    }
    for (const r of data.roads) {
      const width = /motorway|trunk/.test(r.kind)
        ? 13
        : /primary|secondary/.test(r.kind)
          ? 9
          : /tertiary/.test(r.kind)
            ? 7
            : 5;
      let roadOffset = 0;
      for (let i = 1; i < r.points.length; i++) {
        const a = meter(r.points[i - 1]),
          b = meter(r.points[i]);
        if (distance(a, b) < 0.05) continue;
        const seg = {
          a,
          b,
          width,
          name:
            r.name ||
            (/primary|trunk/.test(r.kind) ? 'Main road' : 'Local road'),
          kind: r.kind,
          offset: roadOffset,
        };
        clearance.add(seg);
        roadOffset += distance(a, b);
        const keys = new Set([
          `${Math.floor(a[0] / cell)},${Math.floor(a[1] / cell)}`,
          `${Math.floor(b[0] / cell)},${Math.floor(b[1] / cell)}`,
          `${Math.floor((a[0] + b[0]) / 2 / cell)},${Math.floor((a[1] + b[1]) / 2 / cell)}`,
        ]);
        for (const key of keys) {
          if (!roadIndex.has(key)) roadIndex.set(key, []);
          roadIndex.get(key)!.push(seg);
        }
      }
    }
    for (const w of data.water) {
      const keys = new Set(
        w.points.map((p) => {
          const v = meter(p);
          return `${Math.floor(v[0] / cell)},${Math.floor(v[1] / cell)}`;
        }),
      );
      for (const key of keys) {
        if (!waterIndex.has(key)) waterIndex.set(key, []);
        waterIndex.get(key)!.push(w);
      }
    }
  };
  indexMap();
  let heading = 0,
    speed = 0,
    steering = 0,
    disposed = false,
    view = 0,
    paused = false;
  const pos = new T.Vector3();
  const safe = new T.Vector3();
  let safeHeading = 0,
    inVehicle = false,
    cameraYaw = 0,
    orbitYaw = 0;
  const keys = new Set<string>();
  let stickX = 0,
    stickY = 0,
    stickUsed = false;
  let localSegments: Segment[] = [];
  const chunks = new Map<string, T.Group>();
  const streetLights = createStreetLights(scene, mobile);
  const driverName = createWorldNameLabel(scene, playerName);
  driverName.setVisible(false);
  let lastCell = '';
  const obstacles: { x: number; z: number; radius: number }[] = [];
  const avatar = createAvatar({
    name: playerName,
    gender: 0,
    outfit: 0,
    label: false,
  });
  avatar.group.scale.setScalar(1.8 / 0.34);
  scene.add(avatar.group);
  const playerUmbrella = createRainUmbrella(avatar.group);
  const pedestrians = Array.from({ length: mobile ? 3 : 6 }, (_, i) => {
    const avatar = createAvatar({
      name: `Local ${i + 1}`,
      gender: 0,
      outfit: i,
      label: false,
    });
    avatar.group.scale.setScalar((1.65 + i * 0.025) / 0.34);
    scene.add(avatar.group);
    return {
      avatar,
      umbrella: createRainUmbrella(
        avatar.group,
        [0x234b48, 0x853a37, 0x263750, 0x695331, 0x463450, 0x343b39][i],
      ),
      a: [0, 0] as Point,
      b: [0, 0] as Point,
      t: i / 6,
      direction: 1,
    };
  });
  const audio = createDrivingAudio();
  const sessionId=globalThis.crypto?.randomUUID?.()??`session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const voice = createWorldVoice({ id: sessionId, send: (to, message) => presence?.sendVoice(to, message), onState: onVoice });
  const presence=isWorldMultiplayerConfigured()?createWorldPresence(getSupabase(),sessionId,playerName,(from, message) => voice.handleSignal(from, message)):undefined;
  let lastVoiceUpdate = 0;
  const bus = new T.Group();
  scene.add(bus);
  const livePlayers=createWorldPlayers(scene,project,elevation,bus);
  const body = new T.Mesh(new T.BoxGeometry(2.5, 2.5, 10), mat('#b9332e'));
  body.position.y = 2;
  bus.add(body);
  const glass = new T.Mesh(new T.BoxGeometry(2.55, 0.9, 8.8), mat('#304e57'));
  glass.position.y = 2.6;
  bus.add(glass);
  const band = new T.Mesh(new T.BoxGeometry(2.6, 0.3, 10.1), mat('#e3c88a'));
  band.position.y = 1.7;
  bus.add(band);
  let busWheels: ReturnType<typeof createWheelRoll> | undefined;
  const tires: T.Mesh[] = [];
  for (const x of [-1.25, 1.25])
    for (const z of [-3.2, 3.2]) {
      const tire = new T.Mesh(
        new T.CylinderGeometry(0.55, 0.55, 0.3, 12),
        mat('#293132'),
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.6, z);
      bus.add(tire);
      tires.push(tire);
    }
  new GLTFLoader().load(
    '/ksrtc.glb',
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => m.dispose(),
            );
          }
        });
        return;
      }
      const model = gltf.scene;
      model.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          if (materials.some((m) => m.transparent)) o.castShadow = false;
        }
      });
      const box = new T.Box3().setFromObject(model),
        size = box.getSize(new T.Vector3());
      model.scale.setScalar(10.4 / Math.max(size.x, size.z));
      const bounds = new T.Box3().setFromObject(model),
        center = bounds.getCenter(new T.Vector3());
      model.position.set(-center.x, -bounds.min.y, -center.z);
      const pivot = new T.Group();
      pivot.rotation.y = -Math.PI / 2;
      pivot.add(model);
      bus.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      bus.clear();
      bus.add(pivot);
      bus.userData.loaded=true;
      tires.length = 0;
      busWheels = createWheelRoll(model, 0.51 * model.scale.x);
    },
    undefined,
    () => {},
  );
  bus.userData.kind = 'bus';
  const car = createRoadVehicle('car'),
    bike = createRoadVehicle('bike'),
    lorry = createRoadVehicle('lorry');
  const vehicles = [bus, car, bike, lorry];
  scene.add(car, bike, lorry);
  const kindOf = (object: T.Group) => object.userData.kind as VehicleKind;
  const specOf = (object: T.Group) => vehicleSpecs[kindOf(object)];
  const headlights = createVehicleHeadlights(scene, mobile);
  let headlightsOn = true;
  let vehicle = bus;
  const nearestVehicle = () =>
    vehicles.filter((v) => v.userData.available !== false).reduce(
      (best, item) =>
        pos.distanceTo(item.position) < pos.distanceTo(best.position)
          ? item
          : best,
      vehicles.find((v) => v.userData.available !== false) ?? bus,
    );
  const shadow = createVehicleContactShadow(3, 11);
  shadow.visible = false;
  scene.add(shadow);
  const ribbon = (
    segments: Segment[],
    widthExtra: number,
    y: number,
    material: T.Material,
  ) => {
    const subdivided = segments.flatMap((s) => {
      const n = Math.max(1, Math.ceil(distance(s.a, s.b) / 8));
      return Array.from({ length: n }, (_, i) => ({
        ...s,
        a: [
          T.MathUtils.lerp(s.a[0], s.b[0], i / n),
          T.MathUtils.lerp(s.a[1], s.b[1], i / n),
        ] as Point,
        b: [
          T.MathUtils.lerp(s.a[0], s.b[0], (i + 1) / n),
          T.MathUtils.lerp(s.a[1], s.b[1], (i + 1) / n),
        ] as Point,
      }));
    });
    const geo = roadRibbonGeometry(
      subdivided,
      widthExtra,
      y,
      material === asphalt || material === shoulder,
    );
    drapeTerrainGeometry(geo, elevation);
    const mesh = new T.Mesh(geo, material);
    mesh.material.side = T.DoubleSide;
    return mesh;
  };
  const spawn = (index: number) => {
    const point = project(stops[index].geo);
    let best: Segment | undefined,
      dist = Infinity;
    for (const segments of roadIndex.values())
      for (const s of segments) {
        if (!data.origin && !/primary|secondary|tertiary/.test(s.kind))
          continue;
        const d = distance([s.a[0] / 1000, s.a[1] / 1000], point);
        if (d < dist) {
          dist = d;
          best = s;
        }
      }
    if (best) {
      pos.set(best.a[0], elevation(...best.a), best.a[1]);
      heading = Math.atan2(best.b[0] - best.a[0], best.b[1] - best.a[1]);
    }
    speed = 0;
    steering = 0;
    safe.copy(pos);
    safeHeading = heading;
    camera.position.set(
      pos.x - Math.sin(heading) * 22,
      pos.y + 12,
      pos.z - Math.cos(heading) * 22,
    );
    lastCell = '';
    // Park the complete footprint beyond the shoulder, never on the centreline.
    const origin = pos.clone();
    const parked: T.Group[] = [];
    const nearbyRoads = [...new Set([...roadIndex.values()].flat())]
      .filter((road) => Math.hypot(road.a[0] - origin.x, road.a[1] - origin.z) < 1500);
    const polygonsTouch = (a: Point[], b: Point[]) =>
      a.some((p, i) => overlapsRoad(b, { a: p, b: a[(i + 1) % a.length], width: 0 }, 0)) ||
      b.some((p, i) => overlapsRoad(a, { a: p, b: b[(i + 1) % b.length], width: 0 }, 0));
    const buildings = (data.buildings ?? []).filter((b) => {
      const p = meter(b.points[0]);
      return Math.hypot(p[0] - origin.x, p[1] - origin.z) < 1700;
    }).map((b) => b.points.map(meter));
    const waters = [...new Set([...waterIndex.values()].flat())].map((w) => ({
      area: w.area, points: w.points.map(meter),
    }));
    for (const [object, offset] of [[bus, 0], [car, 20], [bike, -14], [lorry, 40]] as const) {
      const spec = specOf(object);
      const targetX = origin.x + Math.sin(heading) * offset;
      const targetZ = origin.z + Math.cos(heading) * offset;
      let chosen: { x: number; z: number; yaw: number } | undefined;
      let bestDistance = Infinity;
      for (const road of nearbyRoads) {
        const dx = road.b[0] - road.a[0], dz = road.b[1] - road.a[1];
        const length = Math.hypot(dx, dz);
        if (length < 0.01) continue;
        const ux = dx / length, uz = dz / length;
        const along = T.MathUtils.clamp((targetX - road.a[0]) * ux + (targetZ - road.a[1]) * uz, 0, length);
        for (const shift of [0, -12, 12, -24, 24])
          for (const side of [1, -1]) {
            const t = T.MathUtils.clamp(along + shift, 0, length);
            const lateral = road.width / 2 + spec.width + 2;
            const x = road.a[0] + ux * t + uz * lateral * side;
            const z = road.a[1] + uz * t - ux * lateral * side;
            const score = Math.hypot(x - targetX, z - targetZ);
            if (score >= bestDistance || parked.some((v) =>
              Math.hypot(x - v.position.x, z - v.position.z) < spec.length + specOf(v).length + 3)) continue;
            const footprint: Point[] = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([w,l]) => [
              x + uz * spec.width * w + ux * spec.length * l,
              z - ux * spec.width * w + uz * spec.length * l,
            ]);
            if (clearance.blocked(footprint) || buildings.some((b) => polygonsTouch(footprint, b))) continue;
            if (waters.some((w) => w.area ? polygonsTouch(footprint, w.points) :
              w.points.slice(1).some((p,i) => overlapsRoad(footprint, {a:w.points[i], b:p, width:5})))) continue;
            chosen = { x, z, yaw: Math.atan2(ux, uz) };
            bestDistance = score;
          }
      }
      // Areas without a safe parking spot omit that vehicle rather than blocking a lane.
      object.userData.available = !!chosen;
      if (!chosen) continue;
      object.position.set(chosen.x, elevation(chosen.x, chosen.z), chosen.z);
      object.rotation.set(0, chosen.yaw, 0);
      parked.push(object);
    }
    vehicle = parked[0] ?? bus;
    inVehicle = false;
    if (parked.length) {
      heading = vehicle.rotation.y;
      pos.copy(vehicle.position);
      pos.x += Math.cos(heading) * (specOf(vehicle).width + 1.2);
      pos.z -= Math.sin(heading) * (specOf(vehicle).width + 1.2);
      pos.y = elevation(pos.x, pos.z);
    }
    cameraYaw = heading;
    orbitYaw = 0;
  };
  const disposeGroup = (g: T.Group) => {
    g.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        if (o.userData.ownMaterial) (o.material as T.Material).dispose();
      }
    });
    scene.remove(g);
  };
  const buildChunk = (key: string) => {
    const group = new T.Group();
    const segments = (roadIndex.get(key) || []).filter(
      (s) =>
        `${Math.floor((s.a[0] + s.b[0]) / 2 / cell)},${Math.floor((s.a[1] + s.b[1]) / 2 / cell)}` ===
        key,
    );
    group.add(
      ribbon(segments, 2, 0.01, shoulder),
      ribbon(segments, 0, 0.045, asphalt),
    );
    const dash: Segment[] = [];
    for (const s of segments) {
      if (s.width < 7) continue;
      const length = distance(s.a, s.b);
      for (const [start, end] of dashIntervals(length, s.offset ?? 0)) {
        const a = start / length,
          b = end / length;
        dash.push({
          a: [
            T.MathUtils.lerp(s.a[0], s.b[0], a),
            T.MathUtils.lerp(s.a[1], s.b[1], a),
          ],
          b: [
            T.MathUtils.lerp(s.a[0], s.b[0], b),
            T.MathUtils.lerp(s.a[1], s.b[1], b),
          ],
          width: 0.13,
          name: '',
          kind: '',
        });
      }
    }
    group.add(ribbon(dash, 0, 0.07, stripe));
    for (const w of waterIndex.get(key) || []) {
      if (w.area && w.points.length > 3) {
        const shape = new T.Shape(
          w.points.map((p) => {
            const v = meter(p);
            return new T.Vector2(v[0], -v[1]);
          }),
        );
        const mesh = new T.Mesh(new T.ShapeGeometry(shape), water);
        mesh.rotation.x = -Math.PI / 2;
        // A single mapped water body uses one local water level, not sloping waves.
        const heights = w.points
          .map((p) => elevation(...meter(p)))
          .sort((a, b) => a - b);
        mesh.position.y = heights[Math.floor(heights.length / 2)] - 0.015;
        group.add(mesh);
      } else {
        const lines = w.points.slice(1).map((p, i) => ({
          a: meter(w.points[i]),
          b: meter(p),
          width: 5,
          name: '',
          kind: '',
        }));
        group.add(ribbon(lines, 0, -0.01, water));
      }
    }
    // Worldwide building footprints are only meshed for the visible chunk.
    if (data.origin)
      for (const building of buildingIndex.get(key) ?? []) {
        const points = building.points.map(meter);
        if (clearance.blocked(points)) continue;
        mappedBuildings.add(group, building, points, elevation(...points[0]));
      }
    // Lightweight scenery suggests Kerala; road coordinates remain untouched.
    let count = 0;
    const scenerySites: Point[] = [];
    for (let i = 0; !data.origin && i < segments.length; i += 2) {
      const s = segments[i];
      if (++count > (mobile ? 35 : 110)) break;
      const len = distance(s.a, s.b);
      if (len < 9) continue;
      const seed = Math.abs(Math.sin(s.a[0] * 0.13 + s.a[1] * 0.07));
      const dx = (s.b[0] - s.a[0]) / len,
        dz = (s.b[1] - s.a[1]) / len,
        side = (i / 2) % 2 ? 1 : -1;
      const x = s.a[0] - dz * (s.width / 2 + 10 + seed * 4) * side,
        z = s.a[1] + dx * (s.width / 2 + 10 + seed * 4) * side;
      const facing = Math.atan2(s.a[0] - x, s.a[1] - z);
      if (clearance.blocked(sceneryFootprint(x, z, facing, seed > 0.35)))
        continue;
      if (vehicles.some((v) => v.userData.available !== false && Math.hypot(x - v.position.x, z - v.position.z) < specOf(v).length + 9)) continue;
      if (scenerySites.some((p) => distance(p, [x, z]) < 15)) continue;
      scenerySites.push([x, z]);
      const firstChild = group.children.length;
      if (seed > 0.35) {
        scenery.building(
          group,
          x,
          z,
          facing,
          seed,
          !mobile && Math.hypot(x - pos.x, z - pos.z) < 450,
        );
        group.userData.obstacles ??= [];
        group.userData.obstacles.push({ x, z, radius: 6.8 });
      } else {
        if (seed > 0.15) scenery.palm(group, x, z, seed * 3);
        else scenery.tree(group, x, z, seed * 6);
        group.userData.obstacles ??= [];
        group.userData.obstacles.push({ x, z, radius: 0.6 });
      }
      const base = elevation(x, z);
      for (const child of group.children.slice(firstChild))
        child.position.y += base;
    }
    group.updateMatrixWorld(true);
    const buckets = new Map<T.Material, T.BufferGeometry[]>();
    for (const child of group.children.slice()) {
      if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
      const geometry = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      geometry.deleteAttribute('uv');
      geometry.applyMatrix4(child.matrixWorld);
      if (!buckets.has(child.material)) buckets.set(child.material, []);
      buckets.get(child.material)!.push(geometry);
      child.geometry.dispose();
      group.remove(child);
    }
    for (const [material, geometries] of buckets) {
      const merged = mergeGeometries(geometries);
      if (merged) {
        const mesh = new T.Mesh(merged, material);
        mesh.renderOrder = groundLayers.get(material) ?? 0;
        mesh.castShadow = !groundLayers.has(material);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      geometries.forEach((g) => g.dispose());
    }
    streetLights.addChunk(group, segments, elevation, clearance.blocked);
    scene.add(group);
    chunks.set(key, group);
  };
  let chunkQueue: string[] = [];
  const dirtyChunks = new Set<string>();
  const buildPendingChunks = () => {
    // At most two nearby chunks per frame; large areas never build all at once.
    const started = performance.now();
    for (
      let count = 0;
      chunkQueue.length && count < (mobile ? 1 : 2);
      count++
    ) {
      const key = chunkQueue.shift()!;
      if (!chunks.has(key) || dirtyChunks.has(key)) {
        const old = chunks.get(key);
        buildChunk(key);
        if (old) disposeGroup(old);
        dirtyChunks.delete(key);
      }
      if (performance.now() - started > 5) break;
    }
    obstacles.length = 0;
    for (const group of chunks.values())
      obstacles.push(...(group.userData.obstacles || []));
  };
  const stream = () => {
    const cx = Math.floor(pos.x / cell),
      cz = Math.floor(pos.z / cell),
      key = `${cx},${cz}`;
    if (key === lastCell) {
      buildPendingChunks();
      return;
    }
    lastCell = key;
    terrain.update((cx + 0.5) * cell, (cz + 0.5) * cell);
    const wanted = new Set<string>();
    for (let x = cx - radius; x <= cx + radius; x++)
      for (let z = cz - radius; z <= cz + radius; z++) {
        const k = `${x},${z}`;
        wanted.add(k);
        // The queue below prioritizes the player’s current chunk.
      }
    chunkQueue = [...wanted]
      .filter((k) => !chunks.has(k) || dirtyChunks.has(k))
      .sort((a, b) => {
        const [ax, az] = a.split(',').map(Number),
          [bx, bz] = b.split(',').map(Number);
        return Math.hypot(ax - cx, az - cz) - Math.hypot(bx - cx, bz - cz);
      });
    buildPendingChunks();
    for (const [k, g] of chunks)
      if (!wanted.has(k)) {
        disposeGroup(g);
        chunks.delete(k);
        dirtyChunks.delete(k);
      }
    localSegments = [
      ...new Set([...wanted].flatMap((k) => roadIndex.get(k) || [])),
    ];
    const pedestrianRoads = localSegments.filter(
      (s) => distance(s.a, [pos.x, pos.z]) < 200 && distance(s.a, s.b) > 25,
    );
    pedestrians.forEach((p, i) => {
      const s = pedestrianRoads[(i * 3) % Math.max(1, pedestrianRoads.length)];
      if (!s) return;
      const length = distance(s.a, s.b),
        nx = (-(s.b[1] - s.a[1]) / length) * (s.width / 2 + 1.5),
        nz = ((s.b[0] - s.a[0]) / length) * (s.width / 2 + 1.5);
      p.a = [s.a[0] + nx, s.a[1] + nz];
      p.b = [s.b[0] + nx, s.b[1] + nz];
    });
    obstacles.length = 0;
    for (const g of chunks.values())
      obstacles.push(...(g.userData.obstacles || []));
  };
  const closest = () => {
    let best = Infinity,
      road: Segment | undefined,
      px = 0,
      pz = 0;
    for (const s of localSegments) {
      const dx = s.b[0] - s.a[0],
        dz = s.b[1] - s.a[1],
        t = T.MathUtils.clamp(
          ((pos.x - s.a[0]) * dx + (pos.z - s.a[1]) * dz) / (dx * dx + dz * dz),
          0,
          1,
        ),
        x = s.a[0] + dx * t,
        z = s.a[1] + dz * t,
        d = Math.hypot(pos.x - x, pos.z - z);
      if (d < best) {
        best = d;
        road = s;
        px = x;
        pz = z;
      }
    }
    return { distance: best, road, x: px, z: pz };
  };
  // Recovery and dismounts must never place the walker inside a collider.
  const clearWalkingPosition = (center: T.Vector3, yaw: number) => {
    for (const radius of [4, 7, 10, 15, 22]) {
      for (const angle of [
        0,
        Math.PI,
        Math.PI / 2,
        -Math.PI / 2,
        Math.PI / 4,
        -Math.PI / 4,
      ]) {
        const candidate = new T.Vector3(
          center.x + Math.cos(yaw + angle) * radius,
          0,
          center.z - Math.sin(yaw + angle) * radius,
        );
        const blockedByVehicle = vehicles.some((parked) => {
          if (parked.userData.available === false) return false;
          const dx = candidate.x - parked.position.x,
            dz = candidate.z - parked.position.z;
          const along =
            dx * Math.sin(parked.rotation.y) + dz * Math.cos(parked.rotation.y);
          const across =
            dx * Math.cos(parked.rotation.y) - dz * Math.sin(parked.rotation.y);
          return (
            Math.abs(along) < specOf(parked).length + 0.3 &&
            Math.abs(across) < specOf(parked).width + 0.2
          );
        });
        if (
          !blockedByVehicle &&
          obstacles.every(
            (o) =>
              Math.hypot(candidate.x - o.x, candidate.z - o.z) > o.radius + 0.8,
          )
        )
          return candidate;
      }
    }
    return null;
  };
  const recover = () => {
    if (paused) return;
    const destination = inVehicle
      ? safe
      : clearWalkingPosition(safe, safeHeading);
    if (!destination) return;
    pos.copy(destination);
    heading = safeHeading;
    pos.y = elevation(pos.x, pos.z);
    cameraYaw = heading;
    orbitYaw = 0;
    steering = 0;
    speed = 0;
    keys.clear();
  };
  const enterExit = () => {
    if (paused) return;
    if (inVehicle) {
      if (Math.abs(speed) > 2) return;
      const destination = clearWalkingPosition(vehicle.position, heading);
      if (!destination) return;
      inVehicle = false;
      pos.copy(destination);
      pos.y = elevation(pos.x, pos.z);
      cameraYaw = heading;
    } else if (nearestVehicle().userData.available !== false && pos.distanceTo(nearestVehicle().position) < 9) {
      inVehicle = true;
      vehicle = nearestVehicle();
      pos.copy(vehicle.position);
      heading = vehicle.rotation.y;
      orbitYaw = 0;
    }
    speed = 0;
    steering = 0;
    keys.clear();
  };
  let zoom = 1;
  const pointers = new Map<number, { x: number; y: number }>();
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const changeZoom = (factor: number) => {
    zoom = T.MathUtils.clamp(zoom * factor, 0.55, 2.5);
  };
  renderer.domElement.style.touchAction = 'none';
  const pointerDown = (e: PointerEvent) => {
    if (paused || e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const pointerMove = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous || paused) return;
    const before = pinchDistance();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size > 1) {
      const after = pinchDistance();
      if (before > 0 && after > 0) changeZoom(before / after);
      return;
    }
    const dx = (e.clientX - previous.x) * 0.006;
    if (inVehicle) orbitYaw -= dx;
    else cameraYaw -= dx;
  };
  const pointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
  };
  const wheel = (e: WheelEvent) => {
    if (paused) return;
    e.preventDefault();
    const delta =
      e.deltaY *
      (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.clientHeight : 1);
    changeZoom(Math.exp(T.MathUtils.clamp(delta * 0.001, -1, 1)));
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  renderer.domElement.addEventListener('pointercancel', pointerUp);
  renderer.domElement.addEventListener('lostpointercapture', pointerUp);
  renderer.domElement.addEventListener('wheel', wheel, { passive: false });
  const down = (e: KeyboardEvent) => {
    if (paused) return;
    if (
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLInputElement
    )
      return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
        e.code,
      )
    )
      e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) {
      if (e.code === 'KeyC') view = (view + 1) % 3;
      if (e.code === 'KeyR') recover();
      if (e.code === 'KeyF') enterExit();
      if (e.code === 'KeyL' && inVehicle) headlightsOn = !headlightsOn;
      if (e.code === 'KeyH' && inVehicle) audio.horn();
    }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const clear = () => {
    stickX = 0;
    stickY = 0;
    keys.clear();
    pointers.clear();
    voice.hold(false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  const resize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  spawn(0);
  stream();
  let frame = 0,
    last = 0,
    lastHud = 0;
  const targetCam = new T.Vector3(),
    look = new T.Vector3();
  const tick = (time: number) => {
    if (disposed) return;
    if (document.hidden || (mobile && last && time - last < 32)) {
      frame = requestAnimationFrame(tick);
      if (document.hidden) last = 0;
      return;
    }
    const dt = Math.min(last ? (time - last) / 1000 : 0, 0.04);
    last = time;
    stream();
    const near = closest(),
      offroad = near.distance > (near.road?.width || 5) / 2 + 1;
    const throttle =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
          (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) || stickY,
      turn =
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
          (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) || -stickX;
    const vehicleObstacles: VehicleBody[] = vehicles
      .filter(v=>v.userData.available!==false && (!inVehicle || v!==vehicle))
      .map(v=>({x:v.position.x,z:v.position.z,yaw:v.rotation.y,...specOf(v)}));
    for (const peer of presence?.peers.values() ?? []) {
      if (!peer.packet.vehicle || performance.now()-peer.receivedAt>15000) continue;
      const p=project([peer.packet.lon,peer.packet.lat]);
      if(Math.hypot(p[0]*1000-pos.x,p[1]*1000-pos.z)>80) continue;
      vehicleObstacles.push({x:p[0]*1000,z:p[1]*1000,yaw:peer.packet.heading,...vehicleSpecs[peer.packet.vehicle]});
    }
    vehicleObstacles.push(...livePlayers.colliders());
    if (!paused && !document.hidden) {
      const oldWalk = pos.clone();
      if (!inVehicle) {
        const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
        const movement = new T.Vector3(
          Math.sin(cameraYaw) * throttle + Math.cos(cameraYaw) * turn,
          0,
          Math.cos(cameraYaw) * throttle - Math.sin(cameraYaw) * turn,
        );
        if (movement.lengthSq()) {
          const strength = Math.min(1, movement.length());
          movement.normalize().multiplyScalar(strength);
          heading = Math.atan2(movement.x, movement.z);
          pos.addScaledVector(movement, dt * (run ? 6 : 2.8));
        }
        speed = movement.lengthSq() ? (run ? 6 : 2.8) : 0;
        for (const parked of vehicles) {
          if (parked.userData.available === false) continue;
          const vx = pos.x - parked.position.x,
            vz = pos.z - parked.position.z,
            along =
              vx * Math.sin(parked.rotation.y) +
              vz * Math.cos(parked.rotation.y),
            across =
              vx * Math.cos(parked.rotation.y) -
              vz * Math.sin(parked.rotation.y);
          if (
            Math.abs(along) < specOf(parked).length &&
            Math.abs(across) < specOf(parked).width
          ) {
            pos.copy(oldWalk);
            speed = 0;
          }
        }
        const walkingBody={x:oldWalk.x,z:oldWalk.z,yaw:0,length:.35,width:.35};
        const walkingCollision=sweepVehicle(walkingBody,{...walkingBody,x:pos.x,z:pos.z},vehicleObstacles);
        if(walkingCollision.hit){pos.x=walkingCollision.body.x;pos.z=walkingCollision.body.z;speed=0;}
        for (const o of obstacles)
          if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.radius + 0.45) {
            pos.copy(oldWalk);
            speed = 0;
            break;
          }
      } else {
        const brake =
          keys.has('Space') || (mobile && stickUsed && throttle === 0);
        const target = brake
          ? 0
          : throttle *
            (throttle > 0 ? (offroad ? 5 : specOf(vehicle).speed) : 6);
        speed = T.MathUtils.damp(
          speed,
          target,
          brake ? 5 : throttle * speed < 0 ? 3 : throttle ? 0.7 : 1.1,
          dt,
        );
        // Short-wheelbase cars need gentler input, especially at road speed.
        const steeringLimit =
          vehicle === bus ? 0.5 : 0.34 / (1 + Math.abs(speed) * 0.12);
        const steeringResponse = vehicle === bus ? 6 : turn === 0 ? 8 : 4;
        steering = T.MathUtils.damp(
          steering,
          turn * steeringLimit,
          steeringResponse,
          dt,
        );
        heading +=
          ((speed * Math.tan(steering)) / specOf(vehicle).wheelbase) * dt;
        const oldX = pos.x,
          oldZ = pos.z,
          oldHeading = vehicle.rotation.y;
        pos.x += Math.sin(heading) * speed * dt;
        pos.z += Math.cos(heading) * speed * dt;
        for (const o of obstacles)
          if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.radius + 2) {
            pos.x = oldX;
            pos.z = oldZ;
            audio.crash(speed);
            speed = -speed * 0.1;
            break;
          }
        const body = {x:oldX,z:oldZ,yaw:oldHeading,...specOf(vehicle)};
        const collision = sweepVehicle(body, {...body,x:pos.x,z:pos.z,yaw:heading}, vehicleObstacles);
        pos.x=collision.body.x;pos.z=collision.body.z;heading=collision.body.yaw;
        if(collision.hit){audio.crash(speed);speed=0;}
        if (vehicle === bus) {
          // Use resolved travel: collisions and pauses must not spin stationary tyres.
          const travel =
            (pos.x - oldX) * Math.sin(heading) +
            (pos.z - oldZ) * Math.cos(heading);
          busWheels?.advance(travel);
          busWheels?.setSteering(steering, dt, true);
          for (const tire of tires) tire.rotateY(-travel / 0.55);
        }
        if (vehicle !== bus)
          vehicle.userData.roll?.(
            (pos.x - oldX) * Math.sin(heading) +
              (pos.z - oldZ) * Math.cos(heading),
          );
        if (!offroad && Math.abs(speed) > 1) {
          safe.set(near.x, 0, near.z);
          safeHeading = heading;
        }
      }
    }
    pos.y = elevation(pos.x, pos.z);
    if (inVehicle) {
      vehicle.position.copy(pos);
      vehicle.rotation.y = heading;
    }
    for (const parked of vehicles) {
      const h = parked.rotation.y,
        halfLength = specOf(parked).wheelbase / 2;
      const front = elevation(
        parked.position.x + Math.sin(h) * halfLength,
        parked.position.z + Math.cos(h) * halfLength,
      );
      const back = elevation(
        parked.position.x - Math.sin(h) * halfLength,
        parked.position.z - Math.cos(h) * halfLength,
      );
      parked.rotation.order = 'YXZ';
      parked.rotation.x = -Math.atan2(front - back, halfLength * 2);
    }
    bike.userData.rider.visible = inVehicle && vehicle === bike;
    bike.rotation.z =
      inVehicle && vehicle === bike
        ? -steering * Math.min(Math.abs(speed) / 12, 1) * 0.45
        : 0;
    avatar.group.visible = !inVehicle;
    driverName.setVisible(inVehicle);
    driverName.update(pos, inVehicle ? kindOf(vehicle) : null);
    renderer.domElement.dataset.driverName = inVehicle ? playerName : '';
    avatar.group.position.copy(pos);
    avatar.group.rotation.y = heading - Math.PI / 2;
    avatar.update(paused ? 0 : dt, !inVehicle && Math.abs(speed) > 0.1);
    placeVehicleContactShadow(shadow, bus);
    const forward = new T.Vector3(Math.sin(heading), 0, Math.cos(heading));
    if (!inVehicle) {
      const walkForward = new T.Vector3(
        Math.sin(cameraYaw),
        0,
        Math.cos(cameraYaw),
      );
      targetCam.copy(pos).addScaledVector(walkForward, -7);
      targetCam.y = pos.y + 3.3;
      look.copy(pos).addScaledVector(walkForward, 4);
      look.y = pos.y + 1.6;
    } else if (view === 0) {
      targetCam
        .copy(pos)
        .addScaledVector(
          new T.Vector3(
            Math.sin(heading + orbitYaw),
            0,
            Math.cos(heading + orbitYaw),
          ),
          vehicle === bike ? -8 : vehicle === car ? -12 : -18,
        );
      targetCam.y =
        pos.y + (vehicle === bike ? 3.4 : vehicle === car ? 4.5 : 6.8);
      look.copy(pos).addScaledVector(forward, 12);
      look.y = pos.y + 2;
    } else if (view === 1) {
      targetCam
        .copy(pos)
        .addScaledVector(
          forward,
          vehicle === bike
            ? 0.5
            : vehicle === car
              ? 0.6
              : vehicle === lorry
                ? 2.7
                : 4.5,
        );
      targetCam.y =
        pos.y +
        (vehicle === bike
          ? 1.6
          : vehicle === car
            ? 1.5
            : vehicle === lorry
              ? 2.8
              : 3.4);
      look.copy(pos).addScaledVector(forward, 60);
      look.y = pos.y + 3;
    } else {
      targetCam.set(pos.x - 25, pos.y + 65, pos.z - 30);
      look.copy(pos);
    }
    const insideView = inVehicle && view === 1;
    if (!insideView) targetCam.sub(look).multiplyScalar(zoom).add(look);
    const nextFov = insideView ? T.MathUtils.clamp(58 * zoom, 32, 90) : 58;
    if (camera.fov !== nextFov) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    targetCam.y = Math.max(
      targetCam.y,
      elevation(targetCam.x, targetCam.z) + 1.2,
    );
    camera.position.lerp(targetCam, view === 1 ? 1 : 1 - Math.exp(-dt * 6));
    // Keep parked vehicles out of the chase camera's sightline, including
    // the smoothed camera position during switches between vehicles.
    if (!insideView) {
      const anchor = pos.clone().add(new T.Vector3(0, 2, 0));
      for (const parked of vehicles) {
        if (parked.userData.available === false || (inVehicle && parked === vehicle)) continue;
        const spec = specOf(parked);
        const height = parked === bus || parked === lorry ? 4 : 2;
        const inverseYaw = new T.Matrix4().makeRotationY(-parked.rotation.y);
        const localStart = anchor.clone().sub(parked.position).applyMatrix4(inverseYaw);
        const localEnd = camera.position.clone().sub(parked.position).applyMatrix4(inverseYaw);
        const direction = localEnd.clone().sub(localStart);
        const length = direction.length();
        const hit = new T.Ray(localStart, direction.normalize()).intersectBox(
          new T.Box3(new T.Vector3(-spec.width - 0.3, -0.3, -spec.length - 0.3),
            new T.Vector3(spec.width + 0.3, height, spec.length + 0.3)),
          new T.Vector3(),
        );
        if (hit && hit.distanceTo(localStart) < length) {
          const clearDistance = Math.max(0, hit.distanceTo(localStart) - 0.5);
          const endpoint = camera.position.clone();
          camera.position.copy(anchor).lerp(endpoint, clearDistance / (length || 1));
        }
      }
    }
    camera.lookAt(look);
    bus.visible = bus.userData.available !== false && (vehicle !== bus || !inVehicle || view !== 1);
    for (const object of [car, bike, lorry])
      object.visible = object.userData.available !== false && (vehicle !== object || !inVehicle || view !== 1);
    for (const p of pedestrians) {
      const length = distance(p.a, p.b) || 1;
      if (!paused && !document.hidden) {
        p.t += ((dt * 1.1) / length) * p.direction;
        if (p.t > 1) {
          p.t = 1;
          p.direction = -1;
        }
        if (p.t < 0) {
          p.t = 0;
          p.direction = 1;
        }
      }
      p.avatar.group.position.set(
        T.MathUtils.lerp(p.a[0], p.b[0], p.t),
        0,
        T.MathUtils.lerp(p.a[1], p.b[1], p.t),
      );
      p.avatar.group.position.y = elevation(
        p.avatar.group.position.x,
        p.avatar.group.position.z,
      );
      p.avatar.group.rotation.y =
        Math.atan2(
          (p.b[0] - p.a[0]) * p.direction,
          (p.b[1] - p.a[1]) * p.direction,
        ) -
        Math.PI / 2;
      p.avatar.update(paused ? 0 : dt, true);
    }
    const atmosphere = environment.update(
      paused || document.hidden ? 0 : dt,
      pos,
    );
    headlights.update(vehicle,kindOf(vehicle),inVehicle && headlightsOn,atmosphere.daylight);
    renderer.domElement.dataset.headlights = String(inVehicle && headlightsOn);
    playerUmbrella.update(atmosphere.raining && !inVehicle);
    renderer.domElement.dataset.streetLights = String(streetLights.update(dt, pos, atmosphere.daylight, chunks.values()));
    renderer.domElement.dataset.moonVisible = String(atmosphere.moonVisible);
    for (const p of pedestrians) p.umbrella.update(atmosphere.raining);
    sky.update(
      paused || document.hidden ? 0 : dt,
      pos,
      atmosphere.cover,
      atmosphere.daylight,
    );
    renderer.domElement.dataset.elevation = pos.y.toFixed(2);
    renderer.domElement.dataset.raining = String(atmosphere.raining);
    renderer.domElement.dataset.sunElevation = atmosphere.elevation.toFixed(2);
    audio.update({
      active: inVehicle && !paused && !document.hidden,
      bus: vehicle === bus || vehicle === lorry,
      speed,
      throttle: throttle !== 0,
      braking: keys.has('Space'),
      rain: atmosphere.rain,
      wind: atmosphere.wind,
      daylight: atmosphere.daylight,
      storm: atmosphere.storm,
      lightning: atmosphere.lightning,
      inside: inVehicle && view === 1,
    });
    const geo=unprojectPoint(data,[pos.x/1000,pos.z/1000]);
    presence?.update({lon:geo[0],lat:geo[1],heading,speed:paused||document.hidden?0:speed,vehicle:inVehicle?kindOf(vehicle):null});
    if (performance.now() - lastVoiceUpdate > 200) {
      lastVoiceUpdate = performance.now();
      voice.updateNearby(presence?.status === 'online' ? [...presence.peers].map(([id, peer]) => {
        const point = project([peer.packet.lon, peer.packet.lat]);
        return { id, name: peer.packet.name, distance: Math.hypot(point[0] * 1000 - pos.x, point[1] * 1000 - pos.z) };
      }) : []);
    }
    livePlayers.update(presence?.peers??new Map(),pos,paused?0:dt,atmosphere.raining);
    renderer.domElement.dataset.livePlayers=String(presence?.status==='online'?presence.peers.size+1:0);
    renderer.domElement.dataset.liveStatus=presence?.status??'unconfigured';
    renderer.render(scene, camera);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(
      renderer.info.render.triangles,
    );
    if (time - lastHud > (mobile || paused ? 250 : 100)) {
      lastHud = time;
      onHud({
        mapPlayers: presence ? mapPlayers(presence.peers, presence.status, project, performance.now()) : [],
        headlights: headlightsOn,
        mode: inVehicle ? 'drive' : 'walk',
        liveStatus: presence?.status??'unconfigured',
        livePlayers: presence?.status==='online'?presence.peers.size+1:0,
        vehicle: kindOf(inVehicle ? vehicle : nearestVehicle()),
        canEnter: inVehicle
          ? Math.abs(speed) < 2
          : nearestVehicle().userData.available !== false && pos.distanceTo(nearestVehicle().position) < 9,
        speed: Math.round(Math.abs(speed) * 3.6),
        road: near.road?.name || 'Off road',
        offroad,
        position: [pos.x, pos.z],
        heading,
        path: [],
        roads: localSegments
          .filter((s) => distance(s.a, [pos.x, pos.z]) < 750)
          .map((s) => [s.a, s.b]),
      });
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    voice,
    updateMap: (next: MapData) => {
      if (
        disposed ||
        !data.origin ||
        !next.origin ||
        next.origin[0] !== data.origin[0] ||
        next.origin[1] !== data.origin[1]
      )
        return;
      // Keep all actor, camera and physics state. Only refresh map indices.
      data = next;
      stops = next.stops ?? defaultStops;
      indexMap();
      for (const key of chunks.keys()) dirtyChunks.add(key);
      lastCell = '';
    },
    chooseVehicle: (kind: VehicleKind) => {
      if (paused || Math.abs(speed) > 2) return false;
      const chosen = vehicles.find((v) => kindOf(v) === kind && v.userData.available !== false);
      if (!chosen) return false;
      // A garage choice takes the player to this parked vehicle; it does not stack models.
      vehicle = chosen;
      inVehicle = true;
      pos.copy(chosen.position);
      heading = chosen.rotation.y;
      speed = 0;
      steering = 0;
      orbitYaw = 0;
      clear();
      lastCell = '';
      safe.copy(pos);
      safeHeading = heading;
      return true;
    },
    setWeather: environment.setWeather,
    joystick: (x: number, y: number) => {
      stickUsed = true;
      stickX = paused || !Number.isFinite(x) ? 0 : T.MathUtils.clamp(x, -1, 1);
      stickY = paused || !Number.isFinite(y) ? 0 : T.MathUtils.clamp(y, -1, 1);
    },
    input: (key: string, pressed: boolean) => {
      if (pressed && !paused) keys.add(key);
      else keys.delete(key);
    },
    headlights: () => { headlightsOn = !headlightsOn; return headlightsOn; },
    mute: (value: boolean) => audio.mute(value),
    horn: () => {
      if (inVehicle && !paused) audio.horn();
    },
    camera: () => {
      view = (view + 1) % 3;
    },
    recover,
    travel: (index: number) => {
      clear();
      spawn(index);
    },
    enterExit,
    pause: () => {
      paused = !paused;
      voice.suspend(paused);
      audio.pause(paused);
      clear();
      return paused;
    },
    dispose: () => {
      disposed = true;
      voice.dispose();
      presence?.dispose();
      livePlayers.dispose();
      driverName.dispose();
      headlights.dispose();
      audio.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('lostpointercapture', pointerUp);
      renderer.domElement.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      scene.traverse((o) => {
        if (o instanceof T.InstancedMesh) o.dispose();
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        for (const value of Object.values(m))
          if (value instanceof T.Texture) value.dispose();
        m.dispose();
      });
      mappedBuildings.dispose();
      scenery.dispose();
      sky.dispose();
      environment.dispose();
      streetLights.dispose();
      avatar.dispose();
      pedestrians.forEach((p) => p.avatar.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
