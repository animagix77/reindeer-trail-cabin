import bpy,bmesh,math,json,csv,sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
bpy.ops.wm.read_factory_settings(use_empty=True)
work=Path(__file__).resolve().parent
out=Path(sys.argv[-1]).resolve() if '--' in sys.argv else work.parent
out.mkdir(parents=True,exist_ok=True)
D=json.loads((work/'model-geometry.json').read_text())
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
OX,OY,OZ=516338.,4612439.,365.
scene['CRS']='NAD83 / UTM Zone 18N (EPSG:26918); vertical NAVD88, meters'
scene['origin_E_N_Z_m']=[OX,OY,OZ]
scene['model_status']='Existing conditions study · approximate alignment · November 2026'
scene['source_summary']='2024 appraisal, county parcel and road, 2025 NY orthophoto, USGS elevation and lidar, 2025 Sentinel-2 neighborhood vegetation, and owner photography. See README.md.'
def coll(name):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
site=coll('01 · Site and boundary')
structure=coll('02 · Cabin envelope')
deck=coll('03 · Decks and entries')
roof=coll('04 · Roof surfaces')
inter=coll('05 · Main floor and openings')
ref=coll('06 · Survey references | use Outliner to inspect')
rig=coll('07 · Presentation')
def mat(name,hexcolor,metal=0,rough=.8):
 h=hexcolor.lstrip('#'); sr=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 lin=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in sr]
 m=bpy.data.materials.new(name);m.use_nodes=True; m.diffuse_color=(*lin,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*lin,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
siding=mat('Midnight blue siding','#324857'); foundation=mat('Painted block','#697478'); shingle=mat('Asphalt shingle','#494e53'); trim=mat('Painted fascia and joinery','#e6e8e2'); wood=mat('Timber','#ac8251'); timber=mat('Deck boards','#9b714e'); floor=mat('Floor study','#bc9f78'); glass=mat('Window glass','#536d78',.18,.24);door=mat('Doors','#38434b'); soil=mat('Section earth','#786b55');gold=mat('Mapped property edge','#ffd980');street=mat('Road reference','#ded6ac')
def mesh(name,vs,fs,m,c,closed=False):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
 o=bpy.data.objects.new(name,me);c.objects.link(o)
 if m:me.materials.append(m)
 if closed:
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 return o
def curve(name,pts,rad,m,c):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=rad;cu.bevel_resolution=2
 s=cu.splines.new('POLY');s.points.add(len(pts)-1)
 for k,co in zip(s.points,pts):k.co=(*co,1)
 o=bpy.data.objects.new(name,cu);c.objects.link(o);cu.materials.append(m);return o
def rel(e,n,z):return (e-OX,n-OY,z-OZ)
xmin,ymin,xmax,ymax=D['bounds'];nx=xmax-xmin+1;ny=ymax-ymin+1
def terrainZ(e,n):
 xx=max(0,min(nx-1.000001,e-xmin));yy=max(0,min(ny-1.000001,n-ymin));i=int(xx);j=int(yy);u=xx-i;v=yy-j;g=D['grid']
 return (1-v)*((1-u)*g[j][i]+u*g[j][i+1])+v*((1-u)*g[j+1][i]+u*g[j+1][i+1])
vs=[rel(xmin+i,ymin+j,D['grid'][j][i]) for j in range(ny) for i in range(nx)]
faces=[(j*nx+i,j*nx+i+1,(j+1)*nx+i+1,(j+1)*nx+i) for j in range(ny-1) for i in range(nx-1)]
aerial=mat('2025 NY state aerial photograph','#939381')
im=bpy.data.images.load(str(work/D['aerial'])); tex=aerial.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;aerial.node_tree.links.new(tex.outputs['Color'],aerial.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);im.pack()
ground=mesh('Terrain · 1 m USGS grid with 2025 aerial',vs,faces,aerial,site)
uv=ground.data.uv_layers.new(name='Map east north')
for lp in ground.data.loops:
 idx=lp.vertex_index; uv.data[lp.index].uv=((idx%nx)/(nx-1),(idx//nx)/(ny-1))
for f in ground.data.polygons:f.use_smooth=True
edge=[i for i in range(nx)]+[j*nx+nx-1 for j in range(1,ny)]+[(ny-1)*nx+i for i in range(nx-2,-1,-1)]+[j*nx for j in range(ny-2,0,-1)]
top=[vs[i] for i in edge];bot=min(p[2] for p in vs)-.65;L=len(edge)
mesh('Site section · context beyond lot',top+[(x,y,bot) for x,y,z in top],[(i,(i+1)%L,(i+1)%L+L,i+L) for i in range(L)],soil,site)
curve('Tax parcel · approximate mapped edge',[rel(e,n,z+.09) for e,n,z in D['boundary']],.068,gold,site)
# Use appraisal sketch/page 20 coordinates, feet, front at y=0; x increases toward the west.
ft=.3048; theta=math.radians(5.4);co=math.cos(theta);si=math.sin(theta)
def eastnorth(x,y):return (516342.65+ft*(-co*x-si*y),4612447.5+ft*(si*x-co*y))
def pos(x,y,z):return rel(*eastnorth(x,y),z)
planes=D['planes']['clusters'];oE,oN=D['planes']['origin']
def pz(k,x,y):
 e,n=eastnorth(x,y);a,b,c=planes[k]['params'];return a*(e-oE)+b*(n-oN)+c
def ridge(x,k):
 delta=pz(0,x,0)-pz(k,x,0);slope=pz(0,x,1)-pz(k,x,1)-delta
 return -delta/slope
def roofZ(x,y,k):return min(pz(0,x,y),pz(k,x,y))
def entry_rake_z(x):
 return pz(0,x,-.8)+.96*(1-abs(x-31.0)/3.1)
# The kitchen has its own symmetrical interior gable within the wider outer
# roof. The range, the gable crest and the photographs taken along the room
# establish this axis. Heights and timber sizes are photographic estimates.
kitchen_eave_y=12.49
kitchen_ridge_y=19.18
kitchen_vault_pitch=math.tan(math.radians(22))*ft
def kitchen_vault_z(y):
 return 3.045-abs(y-kitchen_ridge_y)*kitchen_vault_pitch
def cooking_tie_underside():
 return 2.57
def box(name,x0,x1,y0,y1,z0,z1,m,c):
 ring=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
 return mesh(name,[pos(x,y,z) for z in (z0,z1) for x,y in ring],[(3,2,1,0),(4,5,6,7)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)],m,c,True)
poly=[(0,3),(22,3),(22,0),(41,0),(41,26),(21,26),(21,29),(0,29)]
def slab(name,bound,zlow,zhigh,m,c):
 L=len(bound);return mesh(name,[pos(x,y,z) for z in (zlow,zhigh) for x,y in bound],[tuple(reversed(range(L))),tuple(range(L,2*L))]+[(i,(i+1)%L,(i+1)%L+L,i+L) for i in range(L)],m,c,True)
main=367.88; low=365.16
slab('Appraisal main floor · 1063 ft²',poly,main-.16,main,floor,inter)
slab('Basement reference floor · vertical placement estimated',poly,low-.13,low,foundation,structure)
# Exterior wall strips follow the actual fitted roof, including both stepped gables.
for i,((ax,ay),(bx,by)) in enumerate(zip(poly,poly[1:]+poly[:1])):
 cuts=[0,1]
 if ax!=bx and min(ax,bx)<21<max(ax,bx):cuts.append((21-ax)/(bx-ax))
 k=1 if (ax+bx)/2<=21 else 2
 if ay!=by:
  ry=ridge(ax,k)
  if min(ay,by)<ry<max(ay,by):cuts.append((ry-ay)/(by-ay))
 for j,(a,b) in enumerate(zip(sorted(cuts),sorted(cuts)[1:])):
  x0,y0=ax+a*(bx-ax),ay+a*(by-ay);x1,y1=ax+b*(bx-ax),ay+b*(by-ay);k=1 if (x0+x1)/2<=21 else 2
  for nm,za,zb0,zb1,material in [('Foundation',low-.7,main-.17,main-.17,foundation),('Exterior',main-.17,roofZ(x0,y0,k)-.045,roofZ(x1,y1,k)-.045,siding)]:
   mesh(f'{nm} · wall {i+1}.{j+1}',[pos(x0,y0,za),pos(x1,y1,za),pos(x1,y1,zb1),pos(x0,y0,zb0)],[(0,1,2,3)],material,structure)
# Both wings share the lidar north pitch. Subdivide at north and south outline steps.
for i,(xa,xb,ya,yb,k) in enumerate([(-.8,21,2.2,29.8,1),(21,22,2.2,26.8,2),(22,41.8,-.8,26.8,2)]):
 for side in ('North','South'):
  yz=lambda x: (ya,ridge(x,k)) if side=='North' else (ridge(x,k),yb)
  a,b=yz(xa);c,d=yz(xb)
  corners=[(xa,a),(xb,c),(xb,d),(xa,b)];key=0 if side=='North' else k
  pts=[pos(x,y,pz(key,x,y)) for x,y in corners]
  mesh(f'Roof · {side} wing {i+1}',pts,[(0,1,2,3)],shingle,roof)
  # Fascia along exposed eaves
  eaves=(pts[0],pts[1]) if side=='North' else (pts[2],pts[3])
  curve(f'Roof fascia · {side} {i+1}',eaves,.047,trim,roof)
  for x in ([xa] if i==0 else [xb] if i==2 else []):
   a,b=yz(x);curve(f'Roof gable trim · {side} {i+1}',[pos(x,a,pz(key,x,a)),pos(x,b,pz(key,x,b))],.05,trim,roof)
# Close the short change in level along the south roof planes.
x=21
ar=ridge(x,1);br=ridge(x,2)
for a,b in zip(sorted([ar,br,26.8]), sorted([ar,br,26.8])[1:]):
 mesh('Roof · wing seam', [pos(x,a,roofZ(x,a,1)),pos(x,b,roofZ(x,b,1)),pos(x,b,roofZ(x,b,2)),pos(x,a,roofZ(x,a,2))],[(0,1,2,3)],shingle,roof)
def timberline(name,p,q,r=.044,m=wood,c=deck):
 return curve(name,[pos(*p),pos(*q)],r,m,c)
def post(name,x,y,z0,z1,w=.36):box(name,x-w/2,x+w/2,y-w/2,y+w/2,z0,z1,wood,deck)
def platform(name,x1,x2,y1,y2,z):
 box(name,x1,x2,y1,y2,z-.20,z,timber,deck)
 for x in (x1+.27,x2-.27):
  for y in (y1+.27,y2-.27):post(name+' · support',x,y,min(terrainZ(*eastnorth(x,y))-.15,z-.5),z)
dp=main-.085
platform('Rear covered deck · appraisal 18 × 10 ft',23,41,26,36,dp)
exec(compile((work/'Porch and garden.py').read_text(),'Porch and garden.py','exec'),globals())
v=[pos(x,y,dp+h) for x,y,h in [(22.4,25.6,2.64),(41.6,25.6,2.64),(41.6,36.6,2.27),(22.4,36.6,2.27)]]
mesh('Roof · covered deck canopy',v,[(0,1,2,3)],shingle,roof)
platform('Front landing · appraisal 4 × 5 ft',29,33,-5,0,dp)
zground=terrainZ(*eastnorth(31,-10))
nsteps=max(2,round((dp-zground)/.175))
for i in range(nsteps):
 z=dp-(i+1)*(dp-zground)/(nsteps+1);box('Entry stair · photo-based',29,33,-6-i,-5-i,z-.15,z,timber,deck)
for x in (29,33):timberline('Front stair handrail',(x,-4.8,dp+.9),(x,-5-nsteps,zground+.91))
# Front door and photo-based glazed units with simplified white casing and sash.
def win(name,fac,u,w,z,h):
 if fac=='front east': y=3;side=-1;kind='y'
 elif fac=='front west':y=0;side=-1;kind='y'
 elif fac=='garage end':y=0;side=-1;kind='x'
 elif fac=='rear east':y=29;side=1;kind='y'
 else:y=26;side=1;kind='y'
 def panel(tag,width,base,high,dep,th,m,offset=0):
  a,b=sorted((y+side*dep,y+side*(dep+th)))
  limits=(u+offset-width/2,u+offset+width/2,a,b) if kind=='y' else (a,b,u+offset-width/2,u+offset+width/2)
  box(name+' · '+tag,*limits,base,base+high,m,inter)
 panel('trim',w+.45,z-.075,h+.15,.025,.12,trim);panel('glass',w,z,h,.15,.055,glass)
 panel('horizontal sash',w,z+h*.49,.036,.21,.025,trim)
 if w>=3.8:panel('vertical sash',.14,z,h,.21,.025,trim)
win('Paired front windows','front east',11.0,5.4,main+.82,.92)
win('Front foyer window','front west',25.6,2.6,main+.72,1.07)
win('Front west window','front west',37.4,2.8,main+.70,1.10)
win('East gable windows A','garage end',9.4,5.4,main+.83,.90)
win('East gable windows B','garage end',22.1,5.4,main+.83,.90)
win('Rear living area windows','rear east',10.4,7.0,main+.8,1.02)
win('Rear porch glazed opening','rear west',32,6.0,main+.03,1.97)
box('Front entry surround',29.35,32.65,-.17,0,main,main+2.1,trim,inter)
box('Front entry door',29.54,32.46,-.22,-.17,main,main+2.04,door,inter)
exec(compile((work/'Garage doors and shutters.py').read_text(),'Garage doors and shutters.py','exec'),globals())
# Non-rendering architecture references, to support refinement without inventing partitions.
for label,x,y in [('Living room',10,22),('Bath',4,16),('Bedroom 1 | sketch label',5.8,8),('Bedroom 2 | sketch label',16.8,8),('Dining',25,21),('Kitchen',35.5,20.5),('Bedroom 3 | sketch label',35.2,11),('Foyer',30,2.6)]:
 ob=bpy.data.objects.new(label,None);ref.objects.link(ob);ob.empty_display_type='PLAIN_AXES';ob.empty_display_size=.15;ob.location=pos(x,y,main+.1);ob.show_name=True;ob['basis']='Approximate room-label position from 2024 appraisal sketch; partition lines unrecorded.'
rr=curve('2010 county-sourced mapped building footprint',[rel(e,n,z+.12) for e,n,z in D['historic']],.033,street,ref)
streetline=curve('E Reindeer Trail · county centerline',[rel(e,n,z+.08) for e,n,z in D['road']],.037,street,ref)
with open(work/'lidar-parcel.csv') as f:
 pts=list(csv.DictReader(f))
for cl,title in [(1,'Unclassified surface returns'),(2,'Ground returns')]:
 vert=[rel(float(p['east_m']),float(p['north_m']),float(p['navd88_m'])) for p in pts if int(p['class'])==cl]
 o=mesh('LiDAR · '+title,vert,[],None,ref);o.display_type='WIRE'
ref.hide_render=True;ref.hide_viewport=True
# Raised, unclassified returns are displayed as samples, not individual reconstructed trees.
canopy=coll('08 · Tree canopy | lidar samples | optional')
leaf=mat('Sampled canopy · spruce','#526d51')
samples=[p for p in pts if int(p['class'])==1 and float(p['above_1m_dem_m'])>6.5]
v=[];faces=[]
for p in samples:
 x,y,z=rel(float(p['east_m']),float(p['north_m']),float(p['navd88_m']))
 r=.105; i=len(v);v.extend([(x+r,y,z),(x,y+r,z),(x-r,y,z),(x,y-r,z),(x,y,z+r),(x,y,z-r)])
 for j in range(4):faces.extend([(i+j,i+(j+1)%4,i+4),(i+(j+1)%4,i+j,i+5)])
can=mesh('Canopy · unclassified lidar more than 6.5 m above ground',v,faces,leaf,canopy)
can['basis']='Leaf-off airborne laser sample. Tall unclassified returns plausibly include branches; tree species, trunks, and current canopy unverified.'
canopy.hide_render=True;canopy.hide_viewport=True
# Model the visible lap siding as a single mesh of slender boards with a bevelled bottom lip.
sidinglight=mat('Blue lap siding','#384f5e')
boards=[];bf=[]
for side,x0,y0,x1,y1 in [('front',.16,3,21.85,3),('rear',.16,29,20.85,29),('gable',0,3.16,0,28.84)]:
 dx=x1-x0;dy=y1-y0;ln=math.hypot(dx,dy)
 ox,oy=(0,-.04) if side=='front' else (0,.04) if side=='rear' else (-.04,0)
 for j in range(30):
  z=main-.14+j*.163
  segments=1 if side!='gable' else 30
  for h in range(segments):
   t0=h/segments;t1=(h+1)/segments;xA=x0+dx*t0;yA=y0+dy*t0;xB=x0+dx*t1;yB=y0+dy*t1
   if z+.09>min(roofZ(xA,yA,1),roofZ(xB,yB,1))-.07:continue
   i=len(boards);boards.extend([pos(xA+ox,yA+oy,z),pos(xB+ox,yB+oy,z),pos(xB+ox*.3,yB+oy*.3,z+.038),pos(xA+ox*.3,yA+oy*.3,z+.038)]);bf.append((i,i+1,i+2,i+3))
mesh('Blue lap siding · garage wing',boards,bf,sidinglight,structure)
exec(compile((work/'Living room and loft.py').read_text(),'Living room and loft.py','exec'),globals())
# Guest route and private Blender reference layers are built independently.
exec(compile((work/'Tour details.py').read_text(),'Tour details.py','exec'),globals())
exec(compile((work/'Remaining interior.py').read_text(),'Remaining interior.py','exec'),globals())
exec(compile((work/'Front entry junction.py').read_text(),'Front entry junction.py','exec'),globals())
exec(compile((work/'Media details.py').read_text(),'Media details.py','exec'),globals())
exec(compile((work/'Roadside wall.py').read_text(),'Roadside wall.py','exec'),globals())
exec(compile((work/'Front yard paving.py').read_text(),'Front yard paving.py','exec'),globals())
exec(compile((work/'Exterior site.py').read_text(),'Exterior site.py','exec'),globals())
exec(compile((work/'Deck barbecue.py').read_text(),'Deck barbecue.py','exec'),globals())
exec(compile((work/'Surrounding woods.py').read_text(),'Surrounding woods.py','exec'),globals())
# Default viewpoint: north-east corner, showing the front entry and downhill garage.
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
cdata=bpy.data.cameras.new('Aerial camera');cam=bpy.data.objects.new('Overview',cdata);rig.objects.link(cam);cam.location=(38,53,47);aim(cam,(0,.6,1));cdata.type='ORTHO';cdata.ortho_scale=68;scene.camera=cam
world=bpy.data.worlds.new('Overcast daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.80,.87,.95,1);world.node_tree.nodes['Background'].inputs[1].default_value=.9;scene.world=world
ld=bpy.data.lights.new('Sun','SUN');ld.energy=2.6;ld.angle=.15;light=bpy.data.objects.new('Site daylight',ld);rig.objects.link(light);light.rotation_euler=(.52,-.6,-.25)
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  sp=area.spaces.active; sp.region_3d.view_rotation=cam.rotation_euler.to_quaternion();sp.region_3d.view_distance=53;sp.region_3d.view_location=(0,.6,1);sp.overlay.show_floor=False;sp.shading.color_type='MATERIAL';sp.shading.light='STUDIO'
scene.render.engine='CYCLES';scene.cycles.transparent_max_bounces=96;scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=1050;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';bpy.context.preferences.filepaths.save_version=0
# Browser entry points and editable photography cameras share the same placements.
def tour_markers(key,eye,target):
 for prefix,coords in [('TourEye_',eye),('TourLook_',target)]:
  marker=bpy.data.objects.new(prefix+key,None)
  details_extra.objects.link(marker)
  marker.location=point(*coords)
  marker.empty_display_type='PLAIN_AXES'
  marker.empty_display_size=.06
for key,name,eye,target,lens in [
 ('living','Living room · toward the sofa and loft',(19.90,19.56,1.52),(6.80,27.04,1.52),20),
 ('','Living room · storage table',(16.4,24.85,1.05),(5.7,23.6,.73),23),
 ('entry','Front entry · from the road approach',(31,-22.0,terrainZ(*eastnorth(31,-22.0))-main+1.59),(31,0,1.08),23),
 ('tree','Christmas tree · beside the loft stairs',(25.35,20.16,1.55),(18.50,16.96,.94),23),
 ('vault','Kitchen vault · from the living room',(13.35,22.25,1.59),(40.3,20.80,1.66),24),
 ('kitchen','Kitchen · counter runs',(30.05,24.58,1.59),(38.7,18.55,1.25),18),
 ('kitchenwork','Kitchen · island work face',(36.50,16.78,1.45),(33.40,20.25,.69),22),
 ('','Kitchen · across the island to the patio',(31.62,11.52,1.59),(31.28,25.75,1.13),19),
 ('master','Master and bath · two barn doors',(28.40,18.65,1.52),(21.1,14.38,1.20),14.7),
 ('bath','Bathroom · from the open barn door',(27.48,12.30,1.59),(25.65,.45,1.17),19),
 ('primary','Master bedroom · window side',(19.75,6.13,1.59),(15.25,13.86,1.24),18),
 ('hall','Front hall · looking toward the bathroom',(28.32,18.65,1.47),(27.15,8.70,1.14),19),
 ('frontbed','Front bedroom · at entrance',(36.95,2.25,1.59),(37.18,10.50,1.01),18),
 ('bunk','Bunk room · from living room',(3.55,17.36,1.59),(4.20,5.6,1.03),21),
 ('hearth','Propane furnace · from the living room',(12.1,23.8,1.51),(19.98,26.7,.63),24),
 ('cook','Grilling at the open grate',(35.55,28.82,1.52),(38.55,28.82,.83),25),
 ('grill','Deck barbecue · at the garden steps',(33.7,29.85,1.51),(40.44,31.25,.57),22),
 ('porch','Covered porch · toward the garden',(36.10,27.61,1.53),(25.2,34.7,1.13),20),
 ('','Fire pit and rear deck',(28.2,66.9,.53),(25.8,49.2,-.25),24.3)]:
 if key:tour_markers(key,eye,target)
 make_view(name,eye,target,lens)
# Keep the editable viewport clear when opening the file in Blender.
route_helpers=[o for o in bpy.context.scene.objects if o.name.startswith(('WalkSurface_','WalkBlock_','WalkSpawn_'))]
volume_material=mat('Navigation volume · invisible','#ffffff')
volume_material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=0
volume_material.surface_render_method='BLENDED'
for o in route_helpers:
 if o.type=='MESH':
  o.data.materials.clear()
  o.data.materials.append(volume_material)
 o.hide_set(True)
# Use paths relative to the distribution even when building in a separate output
# directory. Packed image records otherwise retain the creator's full file paths.
for image in bpy.data.images:
 if not image.packed_files or not image.filepath:continue
 source_path=Path(bpy.path.abspath(image.filepath))
 if source_path.is_relative_to(work):
  portable_path='//Reference/'+source_path.relative_to(work).as_posix()
 else:
  portable_path='//Packed/'+source_path.name
 image.filepath_raw=portable_path
 for packed in image.packed_files:packed.filepath=portable_path
# Blender's default Shading workspace stores the user's home in its file
# browser. Clear the full previous string before setting the portable folder.
for screen in bpy.data.screens:
 for area in screen.areas:
  for space in area.spaces:
   if space.type=='FILE_BROWSER' and space.params:
    space.params.directory=b'.'*len(space.params.directory)
    space.params.directory=b'//'
scene.render.filepath='//'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Reindeer Trail.blend'),relative_remap=False)
# Exclude references and lighting from GLB; curves converted by exporter.
for o in route_helpers:o.hide_set(False)
for ob in bpy.context.selected_objects:ob.select_set(False)
canopy.hide_viewport=False;canopy.hide_render=False
for col in (site,structure,deck,roof,inter,canopy,room,fitout,site_extra,details_extra,living_nav,rooms_extra,context_extra):
 for obj in col.all_objects:obj.select_set(True)
# Blender's tangent generator accepts triangles and quads. Triangulate larger
# faces for export after saving the editable Blender file with its original faces.
import bmesh
export_meshes={obj.data for obj in bpy.context.selected_objects if obj.type=='MESH'}
for data in export_meshes:
 if not data.uv_layers or not any(p.loop_total>4 for p in data.polygons):continue
 bm=bmesh.new()
 bm.from_mesh(data)
 bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4],ngon_method='EAR_CLIP')
 bm.to_mesh(data)
 bm.free()
 data.update()
bpy.ops.export_scene.gltf(filepath=str(out/'Reindeer Trail.glb'),export_format='GLB',use_selection=True,export_yup=True,export_tangents=True,export_extras=False)
canopy.hide_render=True;canopy.hide_viewport=True
if '--geometry-only' in sys.argv: sys.exit(0)
context_extra.hide_render=True
scene.render.filepath=str(out/'Site overview.jpg');scene.render.image_settings.file_format='JPEG'
bpy.ops.render.render(write_still=True)

cam.location=(17,20,11);aim(cam,(-1.8,4.4,3.1));cdata.ortho_scale=23.5;scene.render.filepath=str(out/'Cabin exterior.jpg');bpy.ops.render.render(write_still=True)

context_extra.hide_render=False
scene.cycles.samples=32
scene.render.resolution_x=1100;scene.render.resolution_y=760
for view,label in [(living_view,'Living room'),(loft_view,'Sleeping loft')]:
 scene.camera=view;scene.render.filepath=str(out/(label+'.jpg'));bpy.ops.render.render(write_still=True)
