import * as T from 'three';
export type TimeOfDay='morning'|'noon'|'evening'|'night';
export const LIGHTING={
 morning:{color:0xffe2be,sky:0xd6e2e8,ground:0xa39b88,intensity:2.7,hemi:2.0,ambient:.55,exposure:1.12,background:.90,position:[12,7,8],fog:0x294d4e},
 noon:{color:0xffffff,sky:0xe3edf4,ground:0xa0aca0,intensity:3.2,hemi:2.1,ambient:.55,exposure:1.08,background:1,position:[-8,20,9],fog:0x1a4140},
 evening:{color:0xffbc86,sky:0xb4bfcd,ground:0x786753,intensity:2.2,hemi:1.45,ambient:.38,exposure:1.15,background:.65,position:[-15,4,-7],fog:0x343d42},
 night:{color:0xb9d5ff,sky:0x60799f,ground:0x344858,intensity:.65,hemi:.85,ambient:.23,exposure:1.05,background:.10,position:[7,15,-10],fog:0x08131e}
} as const;
export function lightingAtHour(hour:number){
 const h=((hour%24)+24)%24,keys:[number,TimeOfDay][]=[[0,'night'],[5,'night'],[7,'morning'],[12,'noon'],[17,'evening'],[20,'night'],[24,'night']];
 const i=keys.findIndex((key,index)=>index<keys.length-1&&h>=key[0]&&h<keys[index+1][0]);const [start,a]=keys[i],[end,b]=keys[i+1],t=T.MathUtils.smoothstep(h,start,end),left=LIGHTING[a],right=LIGHTING[b];
 const mix=(key:'intensity'|'hemi'|'ambient'|'exposure'|'background')=>T.MathUtils.lerp(left[key],right[key],t);
 const color=(key:'color'|'sky'|'ground'|'fog')=>new T.Color(left[key]).lerp(new T.Color(right[key]),t).getHex();
 return {color:color('color'),sky:color('sky'),ground:color('ground'),fog:color('fog'),intensity:mix('intensity'),hemi:mix('hemi'),ambient:mix('ambient'),exposure:mix('exposure'),background:mix('background'),position:left.position.map((v,j)=>T.MathUtils.lerp(v,right.position[j],t)) as [number,number,number],moon:T.MathUtils.lerp(a==='night'?1:0,b==='night'?1:0,t),headlights:T.MathUtils.lerp(a==='night'?3:a==='evening'?.7:0,b==='night'?3:b==='evening'?.7:0,t)};
}
export function createDayLighting(scene:T.Scene,camera:T.PerspectiveCamera,renderer:T.WebGLRenderer,sun:T.DirectionalLight,hemi:T.HemisphereLight,ambient:T.AmbientLight,bus:T.Group){
 let hour=12;let targetLighting=lightingAtHour(hour);
 const glowMaterials:T.MeshStandardMaterial[]=[],porchLights:T.PointLight[]=[];
 scene.traverse(o=>{if(o instanceof T.PointLight&&o.name==='Night porch light')porchLights.push(o);if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('Night ')&&!glowMaterials.includes(m))glowMaterials.push(m)}});
 const headlightMaterials:T.MeshStandardMaterial[]=[];
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
 ctx.clearRect(0,0,256,256);const gradient=ctx.createRadialGradient(105,90,5,128,128,116);gradient.addColorStop(0,'#fffde6');gradient.addColorStop(.8,'#d6dce0');gradient.addColorStop(1,'#788898');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(128,128,114,0,Math.PI*2);ctx.fill();ctx.save();ctx.clip();for(let i=0;i<36;i++){ctx.fillStyle='rgba(95,111,126,0.15)';ctx.beginPath();ctx.ellipse(35+(i*67)%190,32+(i*43)%190,4+(i%6)*2,3+(i%5)*2,.4,0,Math.PI*2);ctx.fill()}ctx.restore();
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const moon=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));moon.name='Night moon';moon.visible=true;scene.add(moon);
 const lamps:T.SpotLight[]=[];
 for(const side of [-1,1]){const lamp=new T.SpotLight(0xffe4b3,0,8,.48,.60,1.5);lamp.position.set(.91,.20,side*.14);lamp.target.position.set(5,-.02,side*.20);bus.add(lamp,lamp.target);lamps.push(lamp)}
 const update=(dt:number)=>{const preset=targetLighting,blend=1-Math.exp(-Math.min(dt,.05)*3);sun.color.lerp(new T.Color(preset.color),blend);sun.intensity=T.MathUtils.lerp(sun.intensity,preset.intensity,blend);sun.position.lerp(new T.Vector3(...preset.position),blend);hemi.color.lerp(new T.Color(preset.sky),blend);hemi.groundColor.lerp(new T.Color(preset.ground),blend);hemi.intensity=T.MathUtils.lerp(hemi.intensity,preset.hemi,blend);ambient.intensity=T.MathUtils.lerp(ambient.intensity,preset.ambient,blend);renderer.toneMappingExposure=T.MathUtils.lerp(renderer.toneMappingExposure,preset.exposure,blend);scene.backgroundIntensity=T.MathUtils.lerp(scene.backgroundIntensity,preset.background,blend);if(scene.fog instanceof T.Fog)scene.fog.color.lerp(new T.Color(preset.fog),blend);
  moon.material.opacity=T.MathUtils.lerp(moon.material.opacity,preset.moon,blend);const halfHeight=Math.tan(T.MathUtils.degToRad(camera.fov/2))*60;camera.updateMatrixWorld();moon.position.copy(camera.localToWorld(new T.Vector3(halfHeight*camera.aspect*.63,halfHeight*.65,-60)));moon.scale.setScalar(halfHeight*.17);
  // The moon sprite is a distant sky marker; use its camera-relative ray
  // for the directional light as well, including while orbiting the globe.
  if(preset.moon>0){const moonDirection=moon.position.clone().sub(camera.getWorldPosition(new T.Vector3())).normalize();const daylightDirection=new T.Vector3(...preset.position).normalize();sun.position.copy(daylightDirection.lerp(moonDirection,preset.moon).normalize().multiplyScalar(24));}

  const amount=preset.headlights/3;for(const m of glowMaterials)m.emissiveIntensity=T.MathUtils.lerp(m.emissiveIntensity,amount*1.6,blend);const nearbyPorches=new Set([...porchLights].sort((a,b)=>(a.parent?.position.distanceToSquared(bus.position)??Infinity)-(b.parent?.position.distanceToSquared(bus.position)??Infinity)).slice(0,4));for(const light of porchLights){light.intensity=T.MathUtils.lerp(light.intensity,amount*.55,blend);light.visible=nearbyPorches.has(light);}for(const m of headlightMaterials)m.emissiveIntensity=T.MathUtils.lerp(m.emissiveIntensity,amount*4,blend);
  for(const [index,lamp] of lamps.entries()){const pose=bus.userData.suspensionPose;if(pose){const rotation=new T.Euler(-pose.roll,0,pose.pitch,'ZYX');lamp.position.set(.91,.20,index===0?-.14:.14).applyEuler(rotation);lamp.position.y+=pose.height;lamp.target.position.set(5,-.02,index===0?-.20:.20).applyEuler(rotation);lamp.target.position.y+=pose.height;}lamp.intensity=T.MathUtils.lerp(lamp.intensity,preset.headlights,blend);lamp.visible=true;}
 };
 return {registerBus(model:T.Object3D){model.traverse(o=>{if(o instanceof T.Mesh&&/^Headlamp[ _]optical[ _]glass/i.test(o.name)){const material=new T.MeshStandardMaterial({name:'Headlight glow',color:0xf6ead5,emissive:0xffe3ac,emissiveIntensity:0,roughness:.16});o.material=material;headlightMaterials.push(material)}})},nightAmount(){return T.MathUtils.clamp(lamps[0].intensity/3,0,1)},set(value:TimeOfDay){hour={morning:7,noon:12,evening:17,night:22}[value];targetLighting=lightingAtHour(hour)},setHour(value:number){if(Number.isFinite(value)){hour=((value%24)+24)%24;targetLighting=lightingAtHour(hour)}},update,dispose(){scene.remove(moon);texture.dispose();moon.material.dispose();for(const lamp of lamps){bus.remove(lamp,lamp.target);lamp.dispose()}}};
}
