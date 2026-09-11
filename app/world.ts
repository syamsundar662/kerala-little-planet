// One scale shared by terrain, driving, water and the road-level projection.
export const WORLD_RADIUS=9;
export const ROAD_SEGMENTS=540;
export const ROAD_DASHES=132;
export const ROAD_ROUTES=[0,1,2] as const;
// Authored, unevenly spaced bends replace three synchronized sine-wave loops.
// Periodic Hermite interpolation keeps the joins and the globe seam smooth.
const ROAD_KNOTS=[0,.43,1.06,1.72,2.18,2.93,3.37,4.12,4.64,5.23,5.81];
const MAIN=[.16,.08,.23,.30,.17,.24,.03,-.06,.09,.26,.22];
const BRANCH_NORTH=[.38,.51,.35,.42,.61,.46,.15,-.15,-.11,.27,.44];
const BRANCH_SOUTH=[-.35,-.21,-.44,-.58,-.28,.18,-.25,-.23,-.46,-.29,-.43];
function windingCurve(t:number,values:number[]){
 const tau=Math.PI*2,n=ROAD_KNOTS.length,x=((t%tau)+tau)%tau;
 let i=n-1;for(let k=0;k<n-1;k++)if(x<ROAD_KNOTS[k+1]){i=k;break;}
 const j=(i+1)%n,prev=(i+n-1)%n,next=(i+2)%n;
 const a=ROAD_KNOTS[i],b=j===0?tau:ROAD_KNOTS[j];
 const before=i===0?ROAD_KNOTS[prev]-tau:ROAD_KNOTS[prev];
 const after=next<=i?ROAD_KNOTS[next]+tau:ROAD_KNOTS[next];
 const u=(x-a)/(b-a),u2=u*u,u3=u2*u;
 const m0=(values[j]-values[prev])/(b-before),m1=(values[next]-values[i])/(after-a);
 return (2*u3-3*u2+1)*values[i]+(u3-2*u2+u)*(b-a)*m0+(-2*u3+3*u2)*values[j]+(u3-u2)*(b-a)*m1;
}
export function roadLatitude(t:number,route=0){
 return windingCurve(t,MAIN)+(route===1?windingCurve(t,BRANCH_NORTH):route===2?windingCurve(t,BRANCH_SOUTH):0);
}
// Clear markings where another road joins, using the actual route separation.
export function roadJunction(t:number,route:number){return ROAD_ROUTES.some(other=>other!==route&&Math.abs(roadLatitude(t,route)-roadLatitude(t,other))*WORLD_RADIUS<.78);}
export function roadOffset(t:number,lat:number){return Math.min(...ROAD_ROUTES.map(route=>Math.abs(lat-roadLatitude(t,route))*WORLD_RADIUS));}
export function coastLatitude(t:number){return -.90+.10*Math.sin(t*3)+.045*Math.cos(t*7);}
export function terrainElevation(t:number,lat:number){const d=(lat-coastLatitude(t))*WORLD_RADIUS;const s=Math.max(0,Math.min(1,(d+.9)/.9));return -.36*(1-s*s*(3-2*s));}
export const SEA_LEVEL=-.075;
export function isDryLand(t:number,lat:number,margin=.14){return lat>coastLatitude(t)+margin;}
export const COAST_GLSL=`
 float coastLatitude(float t){return -.90+.10*sin(t*3.0)+.045*cos(t*7.0);}
 float terrainElevation(float t,float lat){float d=(lat-coastLatitude(t))*${WORLD_RADIUS.toFixed(1)};float s=clamp((d+.9)/.9,0.0,1.0);return -.36*(1.0-s*s*(3.0-2.0*s));}
`;
