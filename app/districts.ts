export type District={id:string;name:string;malayalam:string;map:[number,number];landscape:string;festival:string;stops:string[];neighbors:string[];gateway:number};
// Schematic atlas positions preserve relative geography; these are not boundaries.
const rows:[string,string,string,number,number,string,string,string[],string[]][]=[
 ['thiruvananthapuram','Thiruvananthapuram','തിരുവനന്തപുരം',254,487,'Coastal roads and heritage streets','Attukal Pongala',['East Fort','Coastal approach'],['kollam']],
 ['kollam','Kollam','കൊല്ലം',225,438,'Ashtamudi waterfront and fishing villages','Chamayavilakku',['Ashtamudi','Harbour road'],['thiruvananthapuram','pathanamthitta','alappuzha']],
 ['pathanamthitta','Pathanamthitta','പത്തനംതിട്ട',257,386,'Pamba riverside and wooded inland roads','Aranmula boat race',['Aranmula','Pamba riverside'],['kollam','alappuzha','kottayam','idukki']],
 ['alappuzha','Alappuzha','ആലപ്പുഴ',190,379,'Backwaters, canal bridges and paddy fields','Nehru Trophy boat race',['Kuttanad','Canal-side village'],['kollam','pathanamthitta','kottayam','ernakulam']],
 ['kottayam','Kottayam','കോട്ടയം',231,337,'Lakeside villages and plantation roads','Manarcad Perunnal',['Kumarakom','Town bookshop'],['pathanamthitta','alappuzha','idukki','ernakulam']],
 ['idukki','Idukki','ഇടുക്കി',293,294,'Tea slopes, reservoirs and hairpin roads','Chitra Pournami',['Tea-country road','Reservoir viewpoint'],['pathanamthitta','kottayam','ernakulam','thrissur']],
 ['ernakulam','Ernakulam','എറണാകുളം',186,301,'Heritage waterfront and lively urban streets','Cochin Carnival',['Fort Kochi','Harbour streets'],['alappuzha','kottayam','idukki','thrissur']],
 ['thrissur','Thrissur','തൃശ്ശൂർ',176,243,'Town round and surrounding cultural villages','Thrissur Pooram',['Town round','Percussion courtyard'],['ernakulam','idukki','palakkad','malappuram']],
 ['palakkad','Palakkad','പാലക്കാട്',251,209,'Paddy plains and mountain-gap views','Kalpathi Ratholsavam',['Kalpathi','Paddy-field road'],['thrissur','malappuram']],
 ['malappuram','Malappuram','മലപ്പുറം',169,175,'River roads, markets and wooded routes','Kondotty Nercha',['River crossing','Market street'],['thrissur','palakkad','kozhikode','wayanad']],
 ['kozhikode','Kozhikode','കോഴിക്കോട്',113,143,'Beach approaches and working waterfronts','Revathi Pattathanam',['Beypore','Beach road'],['malappuram','wayanad','kannur']],
 ['wayanad','Wayanad','വയനാട്',176,105,'Forested plateau and agricultural valleys','Valliyoorkavu Aarattu',['Plateau road','Farm village'],['malappuram','kozhikode','kannur']],
 ['kannur','Kannur','കണ്ണൂർ',81,83,'Laterite homes, weaving and coastal roads','Theyyam / Kaliyattam',['Weaving workshop','Fort approach'],['kozhikode','wayanad','kasaragod']],
 ['kasaragod','Kasaragod','കാസർഗോഡ്',48,34,'Bekal coastline and inland villages','Kanathoor festival',['Bekal approach','Coastal village'],['kannur']],
];
export const DISTRICTS:District[]=rows.map(([id,name,malayalam,x,y,landscape,festival,stops,neighbors],i)=>({id,name,malayalam,map:[x,y],landscape,festival,stops,neighbors,gateway:(.7+i*Math.PI*2/14)%(Math.PI*2)}));
export const districtById=(id:string)=>DISTRICTS.find(d=>d.id===id);
// Presence sharding: districts sit on a ring of gateway longitudes. Spatial neighbours (for interest
// management) are the longitude-adjacent regions, NOT the road-connectivity `neighbors` graph.
const TAU=Math.PI*2;
const REGION_RING=DISTRICTS.map(d=>({id:d.id,g:d.gateway})).sort((a,b)=>a.g-b.g);
const REGION_INDEX=new Map(REGION_RING.map((r,i)=>[r.id,i]));
// Nearest district by longitude of a surface point (t = atan2(z,x)); latitude is ignored — districts are longitude bands.
export function regionAt(t:number){const x=((t%TAU)+TAU)%TAU;let best=REGION_RING[0].id,bd=Infinity;for(const r of REGION_RING){let d=Math.abs(x-r.g);if(d>TAU/2)d=TAU-d;if(d<bd){bd=d;best=r.id}}return best}
// The set of region ids a client in `id` should subscribe to: itself + the two longitude-adjacent regions (wrapping the ring).
export function regionChannels(id:string){const n=REGION_RING.length,j=REGION_INDEX.get(id)??0;return [REGION_RING[(j-1+n)%n].id,id,REGION_RING[(j+1)%n].id]}
export function gatewayAt(t:number,latitudeOffset:number){if(Math.abs(latitudeOffset)>.10)return undefined;return DISTRICTS.find(d=>Math.abs(Math.atan2(Math.sin(t-d.gateway),Math.cos(t-d.gateway)))<.085)}
