# Anatomy from the MakeHuman CC0 hm08 mesh; locally authored clothing and rig.
import bpy, math, os, json
from mathutils import Vector,Quaternion
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Reuse only material/mesh utilities, not the old primitive-built character.
helper=open(os.path.join(ROOT,'scripts','build-kerala-character.py')).read().split('# Proportioned')[0]
exec(helper)
scene.cycles.samples=64
DATA=os.path.join(ROOT,'assets','characters','makehuman');SYS=os.path.join(DATA,'system')
def read_obj(path):
 vs=[];uv=[];faces=[];groups=[];group=''
 for line in open(path):
  a=line.split()
  if not a:continue
  if a[0]=='v':vs.append(Vector(tuple(map(float,a[1:4]))))
  elif a[0]=='vt':uv.append(tuple(map(float,a[1:3])))
  elif a[0]=='g':group=a[1]
  elif a[0]=='f':faces.append([(int(p.split('/')[0])-1,int(p.split('/')[1])-1 if '/' in p and p.split('/')[1] else 0) for p in a[1:]]);groups.append(group)
 return vs,uv,faces,groups
base,uv,faces,groups=read_obj(os.path.join(DATA,'base.obj'));shaped=[v.copy() for v in base]
for name,weight in [('caucasian-male-young.target',.65),('asian-male-young.target',.35),('universal-male-young-averagemuscle-averageweight.target',1)]:
 for line in open(os.path.join(DATA,name)):
  a=line.split()
  if len(a)==4 and not line.startswith('#'):shaped[int(a[0])]+=Vector(tuple(map(float,a[1:])))*weight
body_ids=set(v for f,g in zip(faces,groups) if g=='body' for v,t in f)
bottom=min(shaped[i].y for i in body_ids);scale=1.75/(max(shaped[i].y for i in body_ids)-bottom)
def convert(v):return Vector((v.x*scale,-v.z*scale,(v.y-bottom)*scale))
raw=[convert(v) for v in shaped]
def joint(name):
 ids=set(v for f,g in zip(faces,groups) if g=='joint-'+name for v,t in f)
 return sum((raw[i] for i in ids),Vector())/len(ids)
segments={};desired={};parents={}
def segment(name,a,b,parent=None,end=None,start=None):
 segments[name]=(Vector(a),Vector(b));desired[name]=(Vector(start if start is not None else a),Vector(end if end is not None else b));parents[name]=parent
pelvis=joint('pelvis');neck=joint('neck');chest=Vector((0,.02,1.16))
segment('Hips',pelvis,chest);segment('Spine',chest,neck,'Hips');segment('Head',neck,joint('head-2'),'Spine')
for tag,label,side in [('l','Left',1),('r','Right',-1)]:
 sh=joint(tag+'-shoulder');el=joint(tag+'-elbow');hand=joint(tag+'-hand');hip=joint(tag+'-upper-leg');knee=joint(tag+'-knee');ankle=joint(tag+'-ankle')
 de=Vector((side*.25,-.025,1.16));dh=Vector((side*.27,-.03,.925));dk=Vector((side*.11,-.022,knee.z));da=Vector((side*.115,-.016,ankle.z))
 segment(label+'Arm',sh,el,'Spine',de);segment(label+'ForeArm',el,hand,label+'Arm',dh,de)
 segment(label+'UpLeg',hip,knee,'Hips',dk);segment(label+'Leg',knee,ankle,label+'UpLeg',da,dk);segment(label+'Foot',ankle,ankle+Vector((0,-.15,-.04)),label+'Leg',da+Vector((0,-.15,-.04)),da)
def dist(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-(a+d*t)).length
rotations={name:(b-a).rotation_difference(desired[name][1]-desired[name][0]) for name,(a,b) in segments.items()}
def weights(p):
 if p.z>1.48:return [('Head',1)]
 if abs(p.x)>.26 and p.z>.74:names=[k for k in segments if ('Left' if p.x>0 else 'Right') in k and 'Arm' in k]
 elif p.z<.94:names=['Hips']+[k for k in segments if any(x in k for x in ['UpLeg','Leg','Foot'])]
 else:names=['Hips','Spine','Head']+[k for k in segments if 'Arm' in k]
 ranking=sorted([(dist(p,*segments[k]),k) for k in names])[:3];w=[1/max(.008,d)**5 for d,k in ranking];total=sum(w);return [(ranking[i][1],x/total) for i,x in enumerate(w)]
def repose(p):
 out=Vector()
 for name,w in weights(p):out+=(desired[name][0]+rotations[name]@(p-segments[name][0]))*w
 return out
coords=[repose(p) for p in raw]
def mesh_obj(name,vertices,fs,uvs,mat,bone=None,source_positions=None):
 used=sorted(set(i for face in fs for i,t in face));remap={i:k for k,i in enumerate(used)}
 me=bpy.data.meshes.new(name);me.from_pydata([vertices[i] for i in used],[],[[remap[i] for i,t in face] for face in fs]);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 layer=me.uv_layers.new(name='UVMap')
 for poly,face in zip(me.polygons,fs):
  poly.use_smooth=True
  for li,(_,ti) in zip(poly.loop_indices,face):layer.data[li].uv=uvs[ti] if uvs else (0,0)
 if bone:objects.append((o,bone))
 else:
  for k in segments:o.vertex_groups.new(name=k)
  for i,orig in enumerate(used):
   for k,w in weights(source_positions[orig] if source_positions is not None else raw[orig]):o.vertex_groups[k].add([i],w,'REPLACE')
  objects.append((o,'Weighted'))
 return o
skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.7,.47,.35,1)
texpath=os.path.join(SYS,'skins','young_caucasian_male','young_lightskinned_male_diffuse.png')
if os.path.exists(texpath):
 image=bpy.data.images.load(texpath);image.scale(2048,2048);image.filepath_raw=os.path.join(DATA,'skin-web.jpg');image.file_format='JPEG';image.save();image=bpy.data.images.load(image.filepath_raw);image.pack();tex=skin.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;skin.node_tree.links.new(tex.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
p=skin.node_tree.nodes.get('Principled BSDF');p.inputs['Subsurface Weight'].default_value=.10;p.inputs['Roughness'].default_value=.48
noise=skin.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=420;bump=skin.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.0005;skin.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);skin.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
# Mask anatomy fully hidden beneath the clothes to prevent clipping and save triangles.
body_faces=[f for f,g in zip(faces,groups) if g=='body']
visible=[];shirtfaces=[]
for f in body_faces:
 c=sum((raw[i] for i,t in f),Vector())/len(f);dominant=max(weights(c),key=lambda x:x[1])[0]
 shirt_area=.955<c.z<1.50 and dominant not in ['LeftForeArm','RightForeArm','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'] and not(c.z>1.465 and abs(c.x)<.061)
 if shirt_area:shirtfaces.append(f)
 if c.z>1.44 or c.z<.18 or (dominant in ['LeftForeArm','RightForeArm'] and c.z<1.27):visible.append(f)
body=mesh_obj('Anatomical head hands and feet',coords,visible,uv,skin)
sub=body.modifiers.new('Facial subdivision','SUBSURF');sub.levels=1;bpy.context.view_layer.objects.active=body;body.select_set(True);bpy.ops.object.modifier_apply(modifier=sub.name)
# Tailored shirt shell uses the same anatomy and rest-pose skin weights.
shirtcoords=[]
for p in coords:
 q=p.copy();q.y*=1.12;q.x*=1.09;shirtcoords.append(q)
shirtbody=mesh_obj('Fitted woven cotton shirt',shirtcoords,shirtfaces,uv,shirt)
import bmesh
bm=bmesh.new();bm.from_mesh(shirtbody.data)
for v in bm.verts:
 if v.is_boundary and v.co.z<1.05:v.co.z=.96
for k in range(5):
 updates={}
 for v in bm.verts:
  if v.is_boundary:
   neighbors=[e.other_vert(v) for e in v.link_edges if e.is_boundary]
   if neighbors:updates[v]=v.co.lerp(sum((n.co for n in neighbors),Vector())/len(neighbors),.45)
 for v,pos in updates.items():v.co=pos
bm.to_mesh(shirtbody.data);bm.free()
sub=shirtbody.modifiers.new('Soft cloth surface','SUBSURF');sub.levels=2;bpy.context.view_layer.objects.active=shirtbody;bpy.ops.object.modifier_apply(modifier=sub.name)
solid=shirtbody.modifiers.new('Cotton seam thickness','SOLIDIFY');solid.thickness=.003;bpy.ops.object.modifier_apply(modifier=solid.name)
# Proxy assets preserve their authored topology and are fitted with MakeHuman barycentric references.
def proxy(folder,name,mat,bone='Head'):
 path=os.path.join(SYS,folder,name+'.mhclo');vs,uvs,fs,gs=read_obj(os.path.join(SYS,folder,name+'.obj'));mapping=[];reading=False
 for line in open(path):
  a=line.split()
  if not a or line.startswith('#'):continue
  if a[0]=='verts':reading=True;continue
  if reading:
   try:
    if len(a)==1:mapping.append(shaped[int(a[0])].copy())
    elif len(a)>=9:mapping.append(sum((shaped[int(a[k])]*float(a[k+3]) for k in range(3)),Vector())+Vector(tuple(map(float,a[6:9]))))
    else:break
   except ValueError:break
 if len(mapping)!=len(vs):raise RuntimeError('Incomplete proxy mapping '+name+str((len(mapping),len(vs))))
 return mesh_obj(name,[convert(v) for v in mapping],fs,uvs,mat,bone)
# Detailed textured eyes fitted into the anatomical sockets.
eyemat=material('Brown eyes',(.75,.71,.65),.22)
eyeimage=os.path.join(SYS,'eyes','materials','brown_eye.png')
if os.path.exists(eyeimage):
 tex=eyemat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(eyeimage);tex.image.pack();eyemat.node_tree.links.new(tex.outputs['Color'],eyemat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
if os.path.exists(os.path.join(SYS,'eyes/low-poly/low-poly.obj')):proxy('eyes/low-poly','low-poly',eyemat)
else:
 for side in ['l','r']:
  center=joint(side+'-eye');ell('Eye white',center,(.012,.012,.012),eye,'Head',32);ell('Iris',center+Vector((0,-.011,0)),(.0055,.0015,.0055),iris,'Head',24)
hairmat=material('Textured short black hair',(.025,.018,.013),.72)
hi=os.path.join(SYS,'hair','short02','short02_diffuse.png')
if os.path.exists(hi):
 tex=hairmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(hi);tex.image.scale(1024,1024);tex.image.pack();pr=hairmat.node_tree.nodes.get('Principled BSDF');import numpy as np;pixels=np.empty(len(tex.image.pixels),dtype=np.float32);tex.image.pixels.foreach_get(pixels);pixels=pixels.reshape((-1,4));pixels[:,:3]*=np.array([.10,.075,.055]);tex.image.pixels.foreach_set(pixels.ravel());tex.image.update();tex.image.pack();hairmat.node_tree.links.new(tex.outputs['Color'],pr.inputs['Base Color']);hairmat.node_tree.links.new(tex.outputs['Alpha'],pr.inputs['Alpha']);hairmat.surface_render_method='DITHERED'
proxy('hair/short02','short02',hairmat)
# New garment proportions follow the adult anatomical body.
rings('Mundu cotton',[(.15,.215,.145),(.3,.205,.145),(.52,.19,.14),(.73,.184,.132),(.97,.177,.125)],cloth,'Mundu',.025)
rings('Kasavu hem',[(.175,.216,.146),(.209,.213,.146)],gold,'Mundu',.025)
rings('Waist fold',[(.94,.182,.13),(.977,.18,.128)],cloth,'Hips')
# Flat collar and shirt front details.
for side in [-1,1]:
 verts=[(side*.015,-.079,1.458),(side*.070,-.069,1.444),(side*.066,-.12,1.385),(side*.018,-.12,1.414)]
 me=bpy.data.meshes.new('Cotton collar');me.from_pydata(verts,[],[(0,1,2,3)]);o=bpy.data.objects.new('Shirt collar',me);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);finish(o,o.name,shirt,'Spine');sol=o.modifiers.new('Collar thickness','SOLIDIFY');sol.thickness=.003;bpy.ops.object.modifier_apply(modifier=sol.name)
for z in [1.36,1.27,1.18,1.09,1.0]:ell('Shell shirt button',(0,-.146,z),(.004,.002,.004),buttons,'Spine',12)
for side,label in [(1,'Left'),(-1,'Right')]:
 ell('Leather sandal',(side*.115,-.070,.022),(.054,.124,.017),leather,label+'Foot')
 tube('Sandal strap',(side*.115-.046,-.060,.058),(side*.115+.046,-.060,.058),.008,.008,leather,label+'Foot')
# Custom armature derived from the base mesh joint landmarks.
bpy.ops.object.select_all(action='DESELECT');arm=bpy.data.armatures.new('Anatomical Kerala rig');rig=bpy.data.objects.new('Kerala villager - anatomical',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b) in desired.items():
 bone=arm.edit_bones.new(name);bone.head=a;bone.tail=b
 if parents[name]:bone.parent=arm.edit_bones[parents[name]]
bpy.ops.object.mode_set(mode='OBJECT')
for o,bn in objects:
 if bn=='Mundu':
  gs={k:o.vertex_groups.new(name=k) for k in ['Hips','LeftUpLeg','RightUpLeg']}
  for v in o.data.vertices:
   p=o.matrix_world@v.co;w=max(0,min(.6,(.95-p.z)/.85));gs['Hips'].add([v.index],1-w,'REPLACE');gs['LeftUpLeg' if p.x>0 else 'RightUpLeg'].add([v.index],w,'REPLACE')
 elif bn!='Weighted':o.vertex_groups.new(name=bn).add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Deform','ARMATURE');mod.object=rig;o.parent=rig
# Reuse the in-place walk/idle authoring and export pipeline only.
tail=open(os.path.join(ROOT,'scripts','build-kerala-character.py')).read().split('rig.animation_data_create()')[1]
tail='rig.animation_data_create()'+tail
tail=tail.replace("web.ratio=.22","web.ratio=.30")
tail=tail.replace("scene.cycles.samples=32","scene.cycles.samples=64")
tail=tail.replace('kerala-villager.glb','kerala-villager-realistic.glb').replace('kerala-villager.blend','kerala-villager-realistic.blend').replace('kerala-villager-preview.png','kerala-villager-realistic-preview.png')
exec(tail)
camera.location=(.40,-1.30,1.73);camera.rotation_euler=(Vector((0,-.04,1.61))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.42
scene.render.filepath=os.path.join(ROOT,'assets','characters','kerala-villager-realistic-face.png');bpy.ops.render.render(write_still=True)
