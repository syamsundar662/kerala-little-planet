import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const map=compile(fs.readFileSync('app/alappuzha-map.ts','utf8'));
const {loadWorldArea,areaBoxes}=await import(compile(fs.readFileSync('app/world-area.ts','utf8').replace("'./alappuzha-map'",JSON.stringify(map))));
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>originalFetch(new URL(url,'http://localhost:3002'),{...options,headers:{'User-Agent':'LittleKeralaLocalTest/1.0 (http://localhost:3002)','Referer':'http://localhost:3002/'}});
try{
 if(process.argv.includes('--direct')){
  const response=await originalFetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LittleKerala/1.0'},body:new URLSearchParams({data:process.argv.includes('--full') ? '[out:json][timeout:20][maxsize:33554432];('+areaBoxes([-.1276,51.5072]).map(b=>`way[highway](${b.join(',')});way[building](${b.join(',')});way[natural=water](${b.join(',')});way[waterway](${b.join(',')});`).join('')+');out geom;' : '[out:json][timeout:15];way[highway](51.506,-0.129,51.508,-0.126);out geom;'}).toString(),signal:AbortSignal.timeout(25000)});
  const body=await response.text();console.log('Direct provider',response.status,body.length,body.slice(0,80));
 }else{
 const {data}=await loadWorldArea([-.1276,51.5072],new AbortController().signal);
 console.log(JSON.stringify({roads:data.roads.length,buildings:data.buildings.length,stops:data.stops.length,origin:data.origin}));
 }
}catch(error){console.error(error.message,String(error.cause??''));process.exitCode=1;}
