import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map();
function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');code=code.replace(/from\s*(['"])([^'"]+)\1/g,(all,q,spec)=>{if(spec.startsWith('.'))return 'from '+JSON.stringify(compile(path.resolve(path.dirname(file),spec+'.ts')));return 'from '+JSON.stringify(pathToFileURL(require.resolve(spec==='three'?'three':spec).replace('three.cjs','three.module.js')).href)});const url='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');cache.set(file,url);return url}
const T=await import(pathToFileURL(require.resolve('three').replace('three.cjs','three.module.js')).href);
const world=await import(compile('app/world.ts'));
const {surfaceRadius,moveWithCollisions,intersectsBus}=await import(compile('app/vehicle-physics.ts'));
const {groundDirection,anchorGroundTexture}=await import(compile('app/ground-mapping.ts'));
const {projectRoadPoint}=await import(compile('app/road-view.ts'));
const R=world.WORLD_RADIUS;
assert.equal(R,9);assert.ok((R/5.6)**2>2.58);
const pos=(t,lat,r=R)=>new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(r);
for(const route of world.ROAD_ROUTES)for(let i=0;i<540;i++){
 const t=i/540*Math.PI*2,lat=world.roadLatitude(t,route),n=pos(t,lat,1);
 assert.ok(world.isDryLand(t,lat),'Every road centre stays on land');
 assert.ok(Math.abs(surfaceRadius(n)-(R+.052))<1e-8,'Every route has wheel contact on its crown');
}
for(const route of [1,2]){let crossings=0;let previous=world.roadLatitude(0,route)-world.roadLatitude(0);for(let i=1;i<=2000;i++){const t=i/2000*Math.PI*2,d=world.roadLatitude(t,route)-world.roadLatitude(t);if(previous*d<0)crossings++;previous=d;}assert.equal(crossings,2,'Each branch connects at two staggered junctions');}
for(const route of world.ROAD_ROUTES){const eps=1e-5;assert.ok(Math.abs(world.roadLatitude(-eps,route)-world.roadLatitude(eps,route))<.0001);const left=(world.roadLatitude(0,route)-world.roadLatitude(-eps,route))/eps,right=(world.roadLatitude(eps,route)-world.roadLatitude(0,route))/eps;assert.ok(Math.abs(left-right)<.001,'Seam tangent stays smooth');}
for(let i=0;i<2000;i++){const t=i/2000*Math.PI*2;assert.ok(!(Math.abs(world.roadLatitude(t,1)-world.roadLatitude(t))*R<.65&&Math.abs(world.roadLatitude(t,2)-world.roadLatitude(t))*R<.65),'No repeated three-road convergence');}
const n=pos(.6,.2,1),forward=pos(.601,.2,1).sub(n).projectOnPlane(n).normalize(),right=new T.Vector3().crossVectors(forward,n);
for(const [x,z] of [[0,0],[.4,1],[2,-3],[-6,4]]){const point=groundDirection(x,z,n,forward,right).multiplyScalar(R);const local=projectRoadPoint(point,n,forward,right,R,R);assert.ok(Math.abs(local.x-x)<1e-8&&Math.abs(local.z-z)<1e-8&&Math.abs(local.y)<1e-8,'FPV matches globe coordinates');}
for(let t=0;t<6.2;t+=.1){const sea=pos(t,world.coastLatitude(t)-.1,1);assert.ok(surfaceRadius(sea)<R+world.SEA_LEVEL);const land=pos(t,world.coastLatitude(t)+.1,1);assert.ok(surfaceRadius(land)>=R);}
const normal=(x,z)=>new T.Vector3(x,R,z).normalize(),fresh=()=>({normal:normal(0,0),heading:new T.Vector3(1,0,0),speed:1.8,steering:0});
let s=fresh(),rock={normal:normal(.98,0),radius:.12};moveWithCollisions(s,0,0,1/60,[rock]);assert.ok(s.speed<0&&s.collisionImpact.speed>1);assert.ok(!intersectsBus(s,[rock]));
s=fresh();const brush={normal:normal(.55,.28),radius:.07};moveWithCollisions(s,0,0,1/60,[brush]);assert.ok(s.speed>1.4);assert.ok(!intersectsBus(s,[brush]));
for(const fps of [30,60,144]){s=fresh();for(let i=0;i<fps*2;i++){moveWithCollisions(s,1,.2,1/fps,[rock]);assert.ok(Number.isFinite(s.speed));assert.ok(Math.abs(s.normal.dot(s.heading))<1e-8)}assert.ok(!intersectsBus(s,[rock]));}
T.TextureLoader.prototype.load=function(){return new T.Texture()};
const {createRoadSurface}=await import(compile('app/road-surface.ts'));
const road=createRoadSurface(pos,world.roadLatitude);assert.equal(road.geometry.groups.length,12);assert.equal(road.geometry.attributes.position.count,3*4*540*6);for(const value of road.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
const {addWorldDetails,coastalTerrain}=await import(compile('app/world-details.ts'));
const globe=new T.Group(),details=addWorldDetails(globe,[]);assert.ok(details.fields>=10);assert.ok(details.shops>=6);assert.equal(globe.children.filter(c=>c.name==='Coastal fishing canoe').length,9);assert.ok(globe.getObjectByName('Arabian Sea'));
for(const water of [true,false]){const material=new T.MeshStandardMaterial();anchorGroundTexture(material,water);const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader,{});assert.ok(!shader.fragmentShader.includes('${'));assert.ok(shader.fragmentShader.includes('groundDistance/9.0'));assert.ok(!shader.fragmentShader.includes('WORLD_RADIUS'));}
console.log(`PASS: 2.58× surface area; 3 connected drivable routes; coast/sea elevations; FPV coordinates; collision response at 30/60/144 FPS; ${details.fields} field sites, ${details.shops} shop sites, 9 fishing boats; shader substitutions.`);

// ---- District scenery: 14 landmarks, every district represented, nothing on the road ----
const sceneryCtx={fillRect(){},strokeRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},arc(){},fill(){},stroke(){},closePath(){}};
global.document={createElement:(tag)=>tag==='canvas'?{width:0,height:0,getContext:()=>sceneryCtx}:{}};
const {createDistrictScenery}=await import(compile('app/district-scenery.ts'));
const {DISTRICTS}=await import(compile('app/districts.ts'));
const sceneryGlobe=new T.Group(),sceneryObstacles=[],sceneryLatitude=t=>world.roadLatitude(t);
const scenery=createDistrictScenery(sceneryGlobe,sceneryObstacles,sceneryLatitude);
scenery.update(1234);
const landmarkGroups=sceneryGlobe.children.filter(c=>c.userData&&c.userData.landmark===true);
assert.equal(landmarkGroups.length,14,'Every district contributes exactly one authored landmark group');
assert.equal(scenery.landmarks,14,'Reported landmark total matches the placed groups');
const placedIds=new Set(sceneryGlobe.children.filter(c=>c.userData&&c.userData.districtId).map(c=>c.userData.districtId));
for(const d of DISTRICTS)assert.ok(placedIds.has(d.id),`District ${d.id} has at least one scenery group`);
for(const o of sceneryObstacles){const n=o.normal;const t=Math.atan2(n.z,n.x),lat=Math.asin(T.MathUtils.clamp(n.y,-1,1)),off=world.roadOffset(t,lat);assert.ok(off>.55,`Scenery obstacle sits ${off.toFixed(3)} off the road (needs >0.55)`);}
for(const d of DISTRICTS){const groups=sceneryGlobe.children.filter(c=>c.userData&&c.userData.districtId===d.id);const landmark=groups.find(c=>c.userData.landmark===true);console.log(`  ${d.id}: ${landmark?landmark.name:'(none)'} — ${groups.length} groups`);}
// ---- Every shadow-casting scenery structure must clear the drivable asphalt (±.515) + shoulder (±.62) ----
// The centre-only obstacle rule above misses wide structures whose walls/roofs reach the road even when
// their pushed centre stays clear. So for every district group we bound each shadow-casting mesh, project
// its box corners to the sphere and require roadOffset>=.66 at each. Note kit.finish() merges every group
// per-material and hard-sets castShadow=true on all batches, so the receiveShadow-only ground decals
// (kit.path strips, water slabs, paddy/ring-road planes) also report castShadow===true. Those are flat,
// ground-hugging planes, so we exempt any castShadow mesh whose 8 box corners lie in one thin radial shell
// at ground level; every remaining structure (walls, roofs, hulls, kept homes) must clear the road.
const STRUCT_CLEAR=.66,DECAL_THICK=.05,GROUND_R=R+.06;
const sampleOff=v=>{const n=v.clone().normalize();return world.roadOffset(Math.atan2(n.z,n.x),Math.asin(T.MathUtils.clamp(n.y,-1,1)));};
const structureOffenders=[];
for(const grp of sceneryGlobe.children){
 if(!(grp.userData&&grp.userData.districtId))continue;
 grp.updateWorldMatrix(true,true);
 let meshIx=0;
 grp.traverse(o=>{
  if(!(o instanceof T.Mesh)||o.castShadow!==true)return;
  const gi=meshIx++;
  const geo=o.geometry;if(!geo.boundingBox)geo.computeBoundingBox();const bb=geo.boundingBox;
  const at=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld);
  // Flatness is measured from the ACTUAL vertices, not the box corners: a kit.path strip hugs the
  // sphere (every vertex at radius R+.004), but its long axis-aligned box has corners that curve far
  // off the surface and would look thick. A ground-hugging decal keeps every vertex in one thin radial
  // shell at ground level, so exempt it (kit.path strips, water slabs, paddy/ring-road planes).
  const pa=geo.attributes.position,pv=new T.Vector3();let rMin=Infinity,rMax=0;
  for(let i=0;i<pa.count;i++){const r=pv.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld).length();if(r<rMin)rMin=r;if(r>rMax)rMax=r;}
  if(rMax-rMin<DECAL_THICK&&rMin<GROUND_R)return; // flat ground decal — exempt
  const xs=[bb.min.x,bb.max.x],ys=[bb.min.y,bb.max.y],zs=[bb.min.z,bb.max.z];
  let mn=Infinity;
  for(const x of xs)for(const z of zs)for(const y of ys)mn=Math.min(mn,sampleOff(at(x,y,z)));
  mn=Math.min(mn,sampleOff(at((bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2)));
  if(mn<STRUCT_CLEAR)structureOffenders.push(`${grp.name}/${gi}: ${mn.toFixed(3)}`);
 });
}
if(structureOffenders.length)console.error('Scenery structures within '+STRUCT_CLEAR+' of a route centre:\n  '+structureOffenders.join('\n  '));
assert.equal(structureOffenders.length,0,`Every shadow-casting scenery structure clears roadOffset>=${STRUCT_CLEAR}`);
scenery.dispose();
assert.equal(sceneryGlobe.children.filter(c=>c.userData&&c.userData.districtId).length,0,'dispose() removes every scenery group from the globe');
console.log(`PASS: ${landmarkGroups.length} district landmarks; all ${DISTRICTS.length} districts represented; ${sceneryObstacles.length} scenery obstacles clear of every route; dispose empties the globe.`);
