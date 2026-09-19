import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const map=compile(fs.readFileSync('app/alappuzha-map.ts','utf8'));
const {nearestLocationTown,locationError}=await import(compile(fs.readFileSync('app/location-utils.ts','utf8').replace("'./alappuzha-map'",JSON.stringify(map))));
const {stops}=await import(map);
for(const [index,stop] of stops.entries()){const result=nearestLocationTown(stop.geo);assert.equal(result.town,index);assert.equal(result.km,0);}
assert.equal(nearestLocationTown([181,0]),null);
assert.equal(nearestLocationTown([0,91]),null);
assert.equal(nearestLocationTown([NaN,0]),null);
assert.ok(nearestLocationTown([-0.1276,51.5072]).km>7000);
assert.match(locationError(1),/denied/);assert.match(locationError(2),/unavailable/);assert.match(locationError(3),/too long/);
console.log('PASS: nearest towns, invalid coordinates, distant locations, error messages.');
