"""Bundle Mapzen Terrarium DEM as a 50 m elevation grid; no runtime tile service."""
import json, math, pathlib, urllib.request, io, datetime, concurrent.futures, struct
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'public/maps/alappuzha.json').read_text())
points=[p for road in data['roads'] for p in road['points']]
step=50
xmin=math.floor((min(p[0] for p in points)-76.3)*109750/step)*step-2500
xmax=math.ceil((max(p[0] for p in points)-76.3)*109750/step)*step+2500
zmin=math.floor((9.5-max(p[1] for p in points))*111320/step)*step-2500
zmax=math.ceil((9.5-min(p[1] for p in points))*111320/step)*step+2500
width=int((xmax-xmin)/step)+1;height=int((zmax-zmin)/step)+1
zoom=12;n=2**zoom
px=lambda lon:(lon+180)/360*n*256-.5
py=lambda lat:(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256-.5
xs=[px(76.3+(xmin+i*step)/109750) for i in range(width)]
ys=[py(9.5-(zmin+j*step)/111320) for j in range(height)]
keys=[(x,y) for x in range(int(min(xs))//256,int(max(xs)+1)//256+1) for y in range(int(min(ys))//256,int(max(ys)+1)//256+1)]
cache=pathlib.Path('/tmp/alappuzha-dem-tiles');cache.mkdir(exist_ok=True)
def fetch(key):
 x,y=key;path=cache/f'{zoom}-{x}-{y}.png'
 if not path.exists():
  url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png'
  with urllib.request.urlopen(url,timeout=45) as response: payload=response.read()
  Image.open(io.BytesIO(payload)).verify();path.write_bytes(payload)
 return key,Image.open(path).convert('RGB')
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: tiles=dict(pool.map(fetch,keys))
def sample(x,y):
 r,g,b=tiles[(x//256,y//256)].getpixel((x%256,y%256));return r*256+g+b/256-32768
values=[]
for y in ys:
 iy=math.floor(y);fy=y-iy
 for x in xs:
  ix=math.floor(x);fx=x-ix
  h=(sample(ix,iy)*(1-fx)+sample(ix+1,iy)*fx)*(1-fy)+(sample(ix,iy+1)*(1-fx)+sample(ix+1,iy+1)*fx)*fy
  if not math.isfinite(h) or h < -500 or h>9000: raise ValueError('Invalid elevation')
  values.append(round(h,2))
output={'source':'Mapzen Terrain Tiles / AWS Open Data; SRTM and other open elevation sources','sourceUrl':'https://registry.opendata.aws/terrain-tiles/','attribution':'https://github.com/tilezen/joerd/blob/master/docs/attribution.md','downloadedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'zoom':zoom,'step':step,'x':xmin,'z':zmin,'width':width,'height':height,'encoding':'int16-le-decimeters'}
(root/'public/maps/terrain/alappuzha-dem.bin').write_bytes(struct.pack('<'+'h'*len(values),*(round(v*10) for v in values)))
(root/'public/maps/terrain/alappuzha-dem.json').write_text(json.dumps(output,separators=(',',':')))
print(json.dumps({'tiles':len(tiles),'width':width,'height':height,'min':min(values),'max':max(values),'samples':len(values)}))
