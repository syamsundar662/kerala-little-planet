import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.render.resolution_x=960;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
scene.render.fps=30
objects=[]
def material(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
skin=material('Light skin',(.78,.57,.43),.58)
shirt=material('Indigo cotton shirt',(.045,.17,.22),.9)
cloth=material('Unbleached cotton mundu',(.84,.80,.65),.96)
gold=material('Woven kasavu border',(.61,.40,.10),.58,.18)
hair=material('Black hair',(.018,.012,.009),.86)
eye=material('Warm eye whites',(.70,.67,.55),.38)
iris=material('Dark brown iris',(.03,.017,.009),.3)
leather=material('Brown leather sandals',(.08,.04,.019),.85)
buttons=material('Coconut shell buttons',(.17,.11,.065),.55)
def finish(o,name,mat,bone=None):
 o.name=name;o.data.materials.append(mat)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 objects.append((o,bone));return o
def ell(name,loc,scale,mat,bone=None,segments=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=20,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,mat,bone)
def tube(name,a,b,r1,r2,mat,bone):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r1,radius2=r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,mat,bone)
def rings(name,rows,mat,bone,pleats=0):
 v=[];f=[];N=48
 for z,rx,ry in rows:
  for i in range(N):
   a=i*math.tau/N;fold=1+pleats*math.cos(a*12);v.append((math.cos(a)*rx*fold,math.sin(a)*ry*fold,z))
 for j in range(len(rows)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 f.extend([tuple(reversed(range(N))),tuple((len(rows)-1)*N+i for i in range(N))])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);finish(o,name,mat,bone);return o
def path_mesh(name,points,radius,mat,bone):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=radius;c.bevel_resolution=3
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,pt in zip(sp.bezier_points,points):b.co=pt;b.handle_left_type=b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,mat,bone)
# Proportioned 1.72 m figure, model forward = -Y.
rings('Shirt tailored body',[(.93,.171,.111),(.96,.175,.115),(1.04,.175,.117),(1.18,.191,.12),(1.30,.202,.115),(1.35,.206,.108),(1.385,.18,.094),(1.41,.090,.071)],shirt,'Spine')
tube('Neck',(0,0,1.35),(0,0,1.49),.058,.059,skin,'Head')
ell('Face',(0,-.015,1.57),(.098,.089,.128),skin,'Head',32)
ell('Jaw',(0,-.023,1.505),(.071,.064,.052),skin,'Head')
ell('Hair base',(0,.015,1.655),(.105,.096,.073),hair,'Head',40)
for side in [-1,1]:
 ell('Ear',(side*.101,-.003,1.566),(.018,.021,.036),skin,'Head')
 ell('Cheekbone',(side*.049,-.046,1.554),(.030,.022,.026),skin,'Head')
 ell('Brow ridge',(side*.039,-.057,1.604),(.031,.018,.012),skin,'Head')
 ell('Eye',(side*.038,-.094,1.583),(.019,.006,.007),eye,'Head')
 ell('Iris',(side*.038,-.099,1.583),(.006,.0025,.006),iris,'Head',16)
 brow=ell('Eyebrow',(side*.038,-.094,1.605),(.024,.0035,.0035),hair,'Head');brow.rotation_euler.y=side*.07
 ell('Moustache',(side*.016,-.104,1.530),(.021,.0038,.0045),hair,'Head')
 ell('Sideburn',(side*.094,.014,1.606),(.008,.024,.028),hair,'Head')
ell('Nose bridge',(0,-.094,1.565),(.012,.019,.032),skin,'Head')
ell('Nose tip',(0,-.113,1.546),(.015,.012,.011),skin,'Head')
ell('Lower lip',(0,-.104,1.511),(.023,.003,.003),material('Lip',(.48,.24,.20)),'Head')
# Folded shirt collar, placket, sewn pocket and buttons.
for side in [-1,1]:
 c=ell('Folded collar',(side*.045,-.083,1.397),(.039,.014,.030),shirt,'Spine');c.rotation_euler.y=side*.5
for z in [1.32,1.23,1.14,1.05]:ell('Shirt button',(0,-.122,z),(.007,.003,.007),buttons,'Spine',12)
rings('Mundu with vertical cotton folds',[(.18,.19,.145),(.40,.18,.135),(.65,.17,.12),(.91,.18,.12),(.99,.177,.117)],cloth,'Mundu',.05)
rings('Gold hem',[(.20,.191,.146),(.235,.19,.145)],gold,'Mundu',.05)
rings('Thin gold hem piping',[(.25,.19,.145),(.256,.19,.145)],gold,'Mundu',.05)
rings('Folded waist band',[(.95,.190,.130),(.995,.188,.128)],cloth,'Hips')
# Front overlap seam follows the wrapped cloth.
tube('Mundu overlap piping',(.06,-.144,.23),(.06,-.144,.97),.004,.004,gold,'Mundu')
for side,label in [(-1,'Left'),(1,'Right')]:
 shoulder=(side*.195,0,1.34);elbow=(side*.27,-.005,1.12);wrist=(side*.27,-.014,.94)
 ell(label+' rounded shoulder',(side*.19,0,1.33),(.087,.090,.070),shirt,label+'Arm')
 tube(label+' short sleeve',(side*.201,0,1.335),(side*.245,0,1.20),.083,.061,shirt,label+'Arm')
 tube(label+' upper arm',shoulder,elbow,.060,.047,skin,label+'Arm')
 ell(label+' elbow',elbow,(.048,.049,.052),skin,label+'ForeArm')
 tube(label+' forearm',elbow,wrist,.047,.031,skin,label+'ForeArm')
 ell(label+' palm',(side*.27,-.016,.895),(.037,.027,.058),skin,label+'ForeArm')
 for finger in range(4):ell(label+' finger',(side*(.248+finger*.015),-.021,.865),(.008,.012,.027),skin,label+'ForeArm',12)
 ell(label+' thumb',(side*.238,-.038,.91),(.014,.017,.032),skin,label+'ForeArm',12)
 tube(label+' shin',(side*.093,0,.51),(side*.093,0,.10),.046,.030,skin,label+'Leg')
 ell(label+' foot',(side*.093,-.053,.070),(.049,.104,.043),skin,label+'Foot')
 ell(label+' sandal sole',(side*.093,-.058,.034),(.055,.114,.020),leather,label+'Foot')
 tube(label+' sandal strap',(side*.093-.042,-.050,.095),(side*.093+.042,-.050,.095),.012,.012,leather,label+'Foot')
# Sculpted eyelid rims and ear folds rather than exposed sphere eyes.
for side in [-1,1]:
 x=side*.038
 path_mesh('Upper eyelid',[(x-.019,-.093,1.583),(x-.008,-.099,1.589),(x+.008,-.099,1.589),(x+.019,-.093,1.583)],.0024,skin,'Head')
 path_mesh('Lower eyelid',[(x-.019,-.093,1.583),(x,-.099,1.577),(x+.019,-.093,1.583)],.002,skin,'Head')
 path_mesh('Ear helix',[(side*.108,-.021,1.54),(side*.116,-.02,1.566),(side*.108,-.018,1.589)],.005,skin,'Head')
 ell('Ear concha',(side*.111,-.021,1.565),(.005,.003,.012),material('Ear inner '+str(side),(.53,.30,.22)),'Head')
 ell('Nostril',(side*.009,-.120,1.543),(.004,.002,.002),iris,'Head',16)
# Side-parted hair locks sweep from forehead over the crown.
for i in range(52):
 az=i*math.tau/52
 points=[]
 for k in range(9):
  theta=.16+k/8*(1.82 if math.sin(az)<0 else 2.12)
  turn=az+.28*math.sin(theta)
  points.append((.108*math.sin(theta)*math.cos(turn),.015+.099*math.sin(theta)*math.sin(turn),1.655+.077*math.cos(theta)))
 path_mesh('Full swept hair lock',points,.0029,hair,'Head')
# Flat folded collar, breast pocket, stitching and fine placket.
for side in [-1,1]:
 verts=[(side*.009,-.082,1.414),(side*.071,-.074,1.403),(side*.065,-.111,1.35),(side*.018,-.119,1.381)]
 me=bpy.data.meshes.new('Collar pattern');me.from_pydata(verts,[],[(0,1,2,3)]);ob=bpy.data.objects.new('Pointed cotton collar',me);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);finish(ob,ob.name,shirt,'Spine');mod=ob.modifiers.new('Fold thickness','SOLIDIFY');mod.thickness=.004;bpy.ops.object.modifier_apply(modifier=mod.name)
path_mesh('Button placket',[(0,-.119,1.015),(0,-.123,1.16),(0,-.117,1.34)],.003,shirt,'Spine')
path_mesh('Breast pocket stitching',[(-.135,-.103,1.285),(-.132,-.111,1.216),(-.088,-.119,1.207),(-.051,-.122,1.217),(-.052,-.12,1.285)],.002,shirt,'Spine')
path_mesh('Pocket opening',[(-.135,-.103,1.285),(-.052,-.12,1.285)],.004,shirt,'Spine')
# Fuse overlapping skin volumes into continuous surfaces before skinning.
# This removes primitive intersections from the face, hands and elbows.
for bn in ['Head','LeftSkin','RightSkin','Shirt']:
 def match(o,b):
  if bn=='Shirt':return o.data.materials[0]==shirt and any(k in o.name for k in ['tailored body','rounded shoulder','short sleeve'])
  if bn=='Head':return b=='Head' and o.data.materials[0]==skin and 'eyelid' not in o.name.lower()
  side=bn.replace('Skin','');return b in [side+'Arm',side+'ForeArm'] and o.data.materials[0]==skin
 selected=[o for o,b in objects if match(o,b)]
 if not selected:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.select_set(True)
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();joined=bpy.context.object
 objects=[(o,b) for o,b in objects if o not in selected];objects.append((joined,bn))
 rem=joined.modifiers.new('Continuous sculpt surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.003 if bn=='Shirt' else .0022;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
 sm=joined.modifiers.new('Relax anatomy','SMOOTH');sm.factor=.6;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=joined.modifiers.new('Game mesh reduction','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
 # Voxel remesh can retain invalid old material indices; these are single-material surfaces.
 for poly in joined.data.polygons:poly.material_index=0;poly.use_smooth=True
for o,b in objects:
 if 'Folded collar' in o.name:o.hide_render=True
objects=[(o,b) for o,b in objects if not o.hide_render]
for o in list(bpy.data.objects):
 if o.hide_render:bpy.data.objects.remove(o,do_unlink=True)
# Independent deforming skeleton and portable, in-place animation clips.
bpy.ops.object.select_all(action='DESELECT');arm=bpy.data.armatures.new('Kerala human skeleton');rig=bpy.data.objects.new('Hari - Kerala villager',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=arm.edit_bones[parent]
bone('Hips',(0,0,.94),(0,0,1.03));bone('Spine',(0,0,1.03),(0,0,1.40),'Hips');bone('Head',(0,0,1.40),(0,0,1.70),'Spine')
for side,label in [(-1,'Left'),(1,'Right')]:
 bone(label+'Arm',(side*.195,0,1.34),(side*.27,-.005,1.12),'Spine');bone(label+'ForeArm',(side*.27,-.005,1.12),(side*.27,-.014,.88),label+'Arm')
 bone(label+'UpLeg',(side*.093,0,.94),(side*.093,0,.51),'Hips');bone(label+'Leg',(side*.093,0,.51),(side*.093,0,.10),label+'UpLeg');bone(label+'Foot',(side*.093,0,.10),(side*.093,-.12,.06),label+'Leg')
bpy.ops.object.mode_set(mode='OBJECT')
for o,bn in objects:
 if bn in ['LeftSkin','RightSkin','Shirt']:
  names=['Spine','LeftArm','RightArm'] if bn=='Shirt' else [bn.replace('Skin','Arm'),bn.replace('Skin','ForeArm')]
  groups={k:o.vertex_groups.new(name=k) for k in names}
  for v in o.data.vertices:
   p=o.matrix_world@v.co
   if bn=='Shirt':
    w=max(0,min(1,(abs(p.x)-.145)/.095));target='LeftArm' if p.x<0 else 'RightArm';groups['Spine'].add([v.index],1-w,'REPLACE');groups[target].add([v.index],w,'REPLACE')
   else:
    w=max(0,min(1,(1.16-p.z)/.08));groups[names[0]].add([v.index],1-w,'REPLACE');groups[names[1]].add([v.index],w,'REPLACE')
 elif bn=='Mundu':
  groups={k:o.vertex_groups.new(name=k) for k in ['Hips','LeftUpLeg','RightUpLeg']}
  for v in o.data.vertices:
   p=o.matrix_world@v.co;w=max(0,min(.7,(.96-p.z)/.8));side='LeftUpLeg' if p.x<0 else 'RightUpLeg';groups['Hips'].add([v.index],1-w,'REPLACE');groups[side].add([v.index],w,'REPLACE')
 else:o.vertex_groups.new(name=bn).add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Skin deformation','ARMATURE');mod.object=rig;o.parent=rig
rig.animation_data_create()
for action_name,duration in [('Walk',30),('Idle',90)]:
 action=bpy.data.actions.new(action_name);rig.animation_data.action=action
 for f in range(1,duration+2):
  phase=(f-1)/duration*math.tau
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
  if action_name=='Walk':
   for side,label in [(1,'Left'),(-1,'Right')]:
    stride=math.sin(phase)*side
    rig.pose.bones[label+'UpLeg'].rotation_euler.x=.26*stride
    rig.pose.bones[label+'Leg'].rotation_euler.x=-.24*max(0,-stride)
    rig.pose.bones[label+'Foot'].rotation_euler.x=-.07*stride
    rig.pose.bones[label+'Arm'].rotation_euler.x=-.20*stride
    rig.pose.bones[label+'ForeArm'].rotation_euler.x=-.10-.05*stride
   rig.pose.bones['Hips'].location.y=.009*(1-math.cos(phase*2))
   rig.pose.bones['Spine'].rotation_euler.y=.025*math.sin(phase)
  else:
   rig.pose.bones['Spine'].rotation_euler.x=.012*math.sin(phase)
   rig.pose.bones['Head'].rotation_euler.y=.035*math.sin(phase)
  for b in rig.pose.bones:
   b.keyframe_insert('rotation_euler',frame=f,group=b.name);b.keyframe_insert('location',frame=f,group=b.name)
 track=rig.animation_data.nla_tracks.new();track.name=action_name;strip=track.strips.new(action_name,1,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o,_ in objects:o.select_set(True)
rig.select_set(False);bpy.context.view_layer.objects.active=objects[0][0];bpy.ops.object.join();merged=bpy.context.object;web=merged.modifiers.new('Web detail budget','DECIMATE');web.ratio=.22;web.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=web.name);rig.select_set(True)
out=os.path.join(ROOT,'public','kerala-villager.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
# Studio setup is saved in Blender, excluded from the browser asset.
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('Studio green',(.035,.08,.07)))
for name,loc,power,size in [('Key',(-3,-4,5),450,4),('Fill',(3,-2,3),230,3),('Rim',(0,3,4),500,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.3,-4.5,2.2));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.05;scene.camera=camera
scene.render.filepath=os.path.join(ROOT,'assets','characters','kerala-villager-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','characters','kerala-villager.blend'))
bpy.ops.render.render(write_still=True)
print('CHARACTER_EXPORTED',out)
