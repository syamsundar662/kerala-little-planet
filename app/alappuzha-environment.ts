import * as T from 'three';
import { solarPosition, rainAmount, type Weather } from './alappuzha-weather';
export function createEnvironment(
  scene: T.Scene,
  sun: T.DirectionalLight,
  hemi: T.HemisphereLight,
  asphalt: T.MeshStandardMaterial,
  geographicPosition: (x: number, z: number) => [number, number] = (x, z) => [
    76.3 + x / 109750,
    9.5 - z / 111320,
  ],
  mobile = false,
) {
  let weather: Weather | null = null,
    elapsed = 0,
    stormClock = 0,
    nextFlash = 8 + Math.random() * 12,
    flash = 0;
  const uniforms = {
    waterTime: { value: 0 },
    waterSky: { value: new T.Color('#bed0d9') },
    waterWind: { value: 1 },
  };
  const water = new T.MeshStandardMaterial({
    color: '#325c59',
    roughness: 0.24,
    metalness: 0.25,
  });
  water.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 waterWorld;',
      )
      .replace(
        '#include <project_vertex>',
        'waterWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 waterWorld; uniform float waterTime; uniform float waterWind; uniform vec3 waterSky;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      vec2 q=waterWorld.xz; float t=waterTime;
      float fade=1.-smoothstep(80.,500.,length(vViewPosition));
      vec3 ripple=vec3(cos(q.x*.9+q.y*.4+t*1.4)*.10+sin(q.x*2.3-q.y+t*2.)*.035,0.,sin(q.y*1.2-q.x*.3+t)*.09);
      normal=normalize(normal+mat3(viewMatrix)*ripple*waterWind*fade);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fresnel=pow(1.-abs(dot(normal,normalize(vViewPosition))),4.);
      outgoingLight=mix(outgoingLight,waterSky*.65,fresnel*.65);
      #include <opaque_fragment>`,
    );
  };
  const count = mobile ? 500 : 1800,
    vertices = new Float32Array(count * 6);
  const seeds = Array.from({ length: count }, () => [
    Math.random() * 100 - 50,
    Math.random() * 45,
    Math.random() * 100 - 50,
  ]);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(vertices, 3).setUsage(T.DynamicDrawUsage),
  );
  const rainMaterial = new T.LineBasicMaterial({
    color: '#b4cbd5',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rain = new T.LineSegments(geometry, rainMaterial);
  rain.frustumCulled = false;
  rain.name = 'Live weather rain';
  scene.add(rain);
  const moon = new T.DirectionalLight('#a8bedb', 0.16);
  scene.add(moon, moon.target);
  // Decorative moon aligned with the existing moonlight, not an astronomical ephemeris.
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 128;
  const context = moonCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(48, 42, 5, 64, 64, 59);
  gradient.addColorStop(0, '#fff9df'); gradient.addColorStop(1, '#aebed1');
  context.fillStyle = gradient;
  context.beginPath(); context.arc(64, 64, 58, 0, Math.PI * 2); context.fill();
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.4, radius = 12 + (i * 17 % 34);
    context.fillStyle = 'rgba(86,105,127,0.14)';
    context.beginPath(); context.arc(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius, 3 + i % 5, 0, Math.PI * 2); context.fill();
  }
  const moonTexture = new T.CanvasTexture(moonCanvas);
  moonTexture.colorSpace = T.SRGBColorSpace;
  const moonMaterial = new T.SpriteMaterial({map: moonTexture, transparent: true, depthWrite: false, fog: false, toneMapped: false});
  const moonDisc = new T.Sprite(moonMaterial);
  moonDisc.name = 'Night sky moon';
  moonDisc.scale.set(30, 30, 1);
  scene.add(moonDisc);
  const moonDirection = new T.Vector3(-50, 100, 60).normalize();
  const daySky = new T.Color('#bed0d9'),
    nightSky = new T.Color('#07121f'),
    overcast = new T.Color('#798990');
  const skyColor = new T.Color(),
    sunDirection = new T.Vector3();
  return {
    water,
    setWeather: (value: Weather | null) => {
      weather = value;
    },
    update(dt: number, pos: T.Vector3) {
      elapsed += dt;
      const [longitude, latitude] = geographicPosition(pos.x, pos.z);
      const solar = solarPosition(new Date(), latitude, longitude);
      const daylight = T.MathUtils.smoothstep(solar.elevation, -7, 22);
      const valid =
        weather && Date.now() - weather.observedAt < 90 * 60_000
          ? weather
          : null;
      const cover = valid?.cloud ?? 0.2,
        wet = rainAmount(valid);
      const storm = valid !== null && [95, 96, 99].includes(valid.code);
      let lightning = false;
      if (storm && dt > 0) {
        stormClock += dt;
        if (stormClock >= nextFlash) {
          lightning = true;
          flash = 0.22;
          stormClock = 0;
          nextFlash = 12 + Math.random() * 23;
        }
      } else if (!storm) {
        stormClock = 0;
        flash = 0;
      }
      flash = Math.max(0, flash - dt);
      skyColor
        .copy(nightSky)
        .lerp(daySky, daylight)
        .lerp(overcast, cover * 0.48 * daylight);
      if (scene.background instanceof T.Color) scene.background.copy(skyColor);
      const fog = scene.fog as T.Fog;
      fog.color.copy(skyColor);
      fog.near = wet > 0 ? 65 : 200;
      fog.far = mobile ? 500 : wet > 0 ? 650 : 1400;
      hemi.intensity = 0.18 + daylight * (1.25 + cover * 0.2);
      sun.intensity =
        solar.elevation > 0
          ? 3 *
            T.MathUtils.smoothstep(solar.elevation, 0, 25) *
            (1 - cover * 0.85)
          : 0;
      sun.color
        .set('#ffd1a1')
        .lerp(
          new T.Color('#fff4e3'),
          T.MathUtils.smoothstep(solar.elevation, 0, 35),
        );
      sunDirection.set(solar.x, solar.y, solar.z);
      const texel = 170 / 2048,
        x = Math.round(pos.x / texel) * texel,
        z = Math.round(pos.z / texel) * texel;
      sun.target.position.set(x, pos.y, z);
      sun.position.copy(sun.target.position).addScaledVector(sunDirection, 180);
      sun.target.updateMatrixWorld();
      moon.intensity = 0.16 * (1 - daylight);
      moon.position.set(x - 50, pos.y + 100, z + 60);
      moon.target.position.set(x, pos.y, z);
      moon.target.updateMatrixWorld();
      moonMaterial.opacity = (1 - daylight) * (1 - cover * .85);
      moonDisc.visible = moonMaterial.opacity > .02;
      moonDisc.position.copy(pos).addScaledVector(moonDirection, 1100);
      uniforms.waterTime.value = elapsed;
      uniforms.waterSky.value.copy(skyColor);
      uniforms.waterWind.value = 1 + Math.min(valid?.wind ?? 0, 50) / 40;
      water.roughness = 0.22 + wet * 0.15;
      asphalt.roughness = 0.96 - wet * 0.62;
      asphalt.color.set(wet > 0 ? '#272d30' : '#34383a');
      rain.visible = wet > 0;
      rain.position.copy(pos);
      geometry.setDrawRange(0, Math.floor(count * wet) * 2);
      if (wet > 0) {
        const drift = (valid?.wind ?? 0) * 0.06;
        seeds.forEach((s, i) => {
          const y = (s[1] - ((elapsed * 24) % 45) + 45) % 45;
          const x = ((s[0] + elapsed * drift + 50) % 100) - 50;
          vertices.set([x, y, s[2], x - drift * 0.05, y + 1.3, s[2]], i * 6);
        });
        geometry.attributes.position.needsUpdate = true;
        rainMaterial.opacity = 0.25 + daylight * 0.25;
      }
      if (flash > 0) hemi.intensity += 2.2 * (flash / 0.22);
      return {
        cover,
        daylight,
        raining: wet > 0,
        rain: wet,
        wind: valid?.wind ?? 0,
        storm,
        lightning,
        elevation: solar.elevation,
        moonVisible: moonDisc.visible,
      };
    },
    dispose() {
      geometry.dispose();
      rainMaterial.dispose();
      water.dispose();
      moonTexture.dispose();
      moonMaterial.dispose();
      scene.remove(moonDisc);
      scene.remove(rain, moon, moon.target);
    },
  };
}
