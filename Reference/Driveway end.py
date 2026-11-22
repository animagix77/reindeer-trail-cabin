"""Gravel clearing, marker stones and stored rowboat at the far end of the drive."""
import numpy as np


def finish_driveway_clearing(land, local_xy):
    # Bake a spatial blend of the existing photographic finishes. The gravel
    # thins to weeds and forest litter without adding coplanar ground meshes.
    x0,x1,y0,y1=-36.,1.,27.,81.
    width,height=720,1024
    x=x0+(np.arange(width)+.5)*(x1-x0)/width
    y=y0+(np.arange(height)[:,None]+.5)*(y1-y0)/height
    e=4.65+ft*(-co*x-si*y)
    n=8.50+ft*(si*x-co*y)

    def sample(file, scale):
        image=bpy.data.images[file]
        w,h=image.size
        pixels=np.empty(w*h*4,dtype=np.float32)
        image.pixels.foreach_get(pixels)
        ix=(np.floor(e*w/scale).astype(int))%w
        iy=(np.floor(n*h/scale).astype(int))%h
        return pixels.reshape((h,w,4))[iy,ix,:3]

    def blend(a,b,mask):
        return a+(b-a)*mask[:,:,None]

    def smooth(v):
        u=np.clip(v,0,1)
        return u*u*(3-2*u)

    leaf=sample('Woodland leaf litter.jpg',2.4)
    gravel=sample('Packed gravel.jpg',1.65)*.34+sample('Garden pea gravel.jpg',1.55)*.66
    weeds=sample('Lawn.jpg',2.05)
    variation=np.sin(x*.81+y*.39)*.60+np.sin(x*.31-y*.54)*.45+np.cos(x*1.20-y*.81)*.24
    center=-14.0-.15*(y-32)
    span=np.interp(y,[27,33,40,50,61,70,78,81],[9,14,13.6,12.3,11.8,9.3,4,0])
    edge=span-np.abs(x-center)+variation
    coverage=smooth(edge/4)*smooth((y-y0)/3)*smooth((79-y)/5)
    grass=smooth(.08+(y-33)*.014+variation*.38+np.sin(x*3.1+y*2.2)*.15)
    patch=blend(leaf,blend(gravel,weeds,.87*grass),coverage)
    rgba=np.ones((height,width,4),dtype=np.float32)
    rgba[:,:,:3]=patch
    atlas=bpy.data.images.new('Driveway shoulder · gravel to woodland',width,height,alpha=False)
    atlas.pixels.foreach_set(rgba.ravel())
    atlas.pack()
    material=mat('Driveway end · gravel and low groundcover','#ffffff',rough=.95)
    photo=material.node_tree.nodes.new('ShaderNodeTexImage')
    photo.image=atlas
    material.node_tree.links.new(photo.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    land.data.materials.append(material)
    index=len(land.data.materials)-1
    uv=land.data.uv_layers.active.data
    for face in land.data.polygons:
        if face.material_index not in (0,1,2):continue
        coords=[local_xy(land.data.vertices[i].co.x+OX,land.data.vertices[i].co.y+OY) for i in face.vertices]
        if not all(x0<=x<=x1 and y0<=y<=y1 for x,y in coords):continue
        face.material_index=index
        for loop,(x,y) in zip(face.loop_indices,coords):
            uv[loop].uv=((x-x0)/(x1-x0),(y-y0)/(y1-y0))


def driveway_edge_details(group, land, helper, tube):
    # In the owner's view the camera points south-southeast from the asphalt.
    # Fit the boat to the modeled ground near that sightline's parcel crossing.
    from mathutils.bvhtree import BVHTree
    terrain=BVHTree.FromPolygons([v.co for v in land.data.vertices],
                                 [tuple(f.vertices) for f in land.data.polygons])
    def ground(x,y):
        e,n=eastnorth(x,y)
        p=terrain.ray_cast((e-OX,n-OY,60),(0,0,-1),100)[0]
        return p.z+OZ

    ox,oy=-18.7,74.
    def plan(u,v):
        return ox+u-.065*v,oy+.065*u+v

    # Station offsets and full gunwale widths in feet, narrow bow to transom.
    stations=[(-5.8,.04),(-5.35,.65),(-4.60,1.28),(-3.45,1.80),
              (-1.9,2.12),(0,2.20),(2.35,2.13),(4.12,1.97),(5.8,1.77)]
    rim=[(u,w) for u,w in stations]+[(u,-w) for u,w in reversed(stations)]
    samples=np.array([[u*ft,v*ft,1] for u,v in rim])
    ground_z=np.array([ground(*plan(u,v)) for u,v in rim])
    slope_u,slope_v,elevation=np.linalg.lstsq(samples,ground_z,rcond=None)[0]
    # Several rim contacts carry the hull on the irregular verge.
    elevation+=np.quantile(ground_z-samples@[slope_u,slope_v,elevation],.82)-.012
    def hull(u,v,h):
        x,y=plan(u,v)
        return pos(x,y,elevation+ft*(slope_u*u+slope_v*v)+h)

    alloy=mat('Rowboat · oxidized aluminum','#b1b4ac',.52,.57)
    band=mat('Rowboat · faded red sheer stripe','#9a5d59',.12,.75)
    edge_metal=mat('Rowboat · rolled gunwale and keel','#828881',.46,.54)
    vertices=[];faces=[];finish_indices=[]
    for u,w in stations:
        t=(u+5.8)/11.6
        depth=.37+.088*math.sin(t*math.pi)-.23*math.exp(-t*8)
        # A raked transom, shallow V bottom and pressed strakes break the
        # silhouette. The bead and faded stripe follow the sheer up to the bow.
        side=[(1,.005),(1.013,.024),(.998,.041),(.985,.074),(.968,.108),
              (.954,.12),(.89,depth*.48),(.902,depth*.52),(.883,depth*.54),
              (.72,depth*.77),(.738,depth*.80),(.707,depth*.82),(.33,depth*.94)]
        profile=[(r*w,h) for r,h in side]+[(0,depth+.012)]+[(-r*w,h) for r,h in reversed(side)]
        rake=.60*t**5-.86*(1-t)**3
        vertices.extend(hull(u-rake*h/depth,v,h) for v,h in profile)
    size=len(profile)
    for j in range(len(stations)-1):
        for i in range(size-1):
            a=j*size+i
            faces.append((a,a+size,a+size+1,a+1))
            k=min(i,size-2-i)
            finish_indices.append(2 if k<2 else 1 if k==3 else 0)
    faces.extend([tuple(range(size)),tuple(reversed(range(len(vertices)-size,len(vertices))))])
    finish_indices.extend((0,0))
    boat=mesh('Driveway edge · overturned aluminum rowboat',vertices,faces,alloy,group)
    boat.data.materials.append(band);boat.data.materials.append(edge_metal)
    for f,idx in zip(boat.data.polygons,finish_indices):
        f.material_index=idx
    # The outer skin must face up in both the open-air render and glTF.
    if sum(f.normal.z for f in boat.data.polygons)<0:boat.data.flip_normals()
    for i in range(len(stations)-1):
        a=i*size+size//2;b=a+size
        tube(edge_metal,vertices[a],vertices[b],.014,.014,8)
    footprint=[Vector(hull(u,v,-.045)) for u,v in rim]
    count=len(footprint)
    helper('WalkBlock_OverturnedBoat',footprint+[p+Vector((0,0,.43)) for p in footprint],
           [tuple(reversed(range(count))),tuple(range(count,count*2))]+
           [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)])

    rng=random.Random(20250614)
    # Weathered bedding planes and broken edges taken from the owner's driveway.
    stone=mat('Driveway edging · split fieldstone','#b19d90',rough=.94)
    image=stone.node_tree.nodes.new('ShaderNodeTexImage')
    image.image=bpy.data.images.load(str(work/'Exterior materials'/'Driveway fieldstone.jpg'),check_existing=True)
    image.image.pack()
    surface=stone.node_tree.nodes.get('Principled BSDF')
    stone.node_tree.links.new(image.outputs['Color'],surface.inputs['Base Color'])
    vertices=[]; faces=[]; stone_uv=[]
    def slab(x,y,long,wide,base,height,variant,skew=0):
        # The top follows the shallow pitch of each stone, but the cleavage
        # face reaches a separate, angular lip and intermittent chipped corners.
        outline=[(-.98,-.46),(-.77,-.91),(-.17,-1),(.23,-.80),(.73,-.89),
                 (1,-.43),(.93,.49),(.48,.95),(-.32,.88),(-.85,.70)]
        footprint=[(u*rng.uniform(.93,1.02),v*rng.uniform(.86,1.04)) for u,v in outline]
        first=len(vertices); coords=[]
        def add(u,v,h):
            coords.append((u,v,h))
            px,py=x+long*u+skew*v,y+wide*v
            vertices.append(pos(px,py,ground(px,py)+base+height*h))
        for layer in range(3):
            for i,(u,v) in enumerate(footprint):
                if layer==0: size,h=rng.uniform(.86,.98),-.15
                elif layer==1: size,h=rng.uniform(.96,1.02),rng.uniform(.55,.84)
                else: size,h=(rng.uniform(.63,.74) if i in (3,7) else rng.uniform(.88,.98)),rng.uniform(.85,1)
                add(u*size,v*size,h)
        n=len(footprint)
        add(.04,.13,1.01)
        center=3*n
        def face(ids,side=False,use_x=True):
            faces.append(tuple(first+i for i in ids))
            texcoords=[]
            for i in ids:
                u,v,h=coords[i]
                s=(u if use_x else v)*.46+.50
                t=(1-max(0,min(h,1))) if side else .50-v*.46
                texcoords.append(((256*int(side)+4.5+247*s)/512,1-(variant*64+4.5+55*t)/256))
            stone_uv.append(texcoords)
        for i in range(n):
            j=(i+1)%n
            use_x=abs(footprint[j][0]-footprint[i][0])*long>abs(footprint[j][1]-footprint[i][1])*wide
            face((i,j,j+n,i+n),True,use_x)
            face((i+n,j+n,j+2*n,i+2*n),True,use_x)
            face((2*n+i,2*n+j,center))
    # Six main slabs, the second and fifth in layers, with the few loose chips
    # resting against them as in the photograph. Lateral coordinates are feet.
    slabs=[(-23.43,32.42,.73,.43,-.025,.108,0,.07),
           (-21.06,32.39,1.73,.60,-.030,.117,2,-.04),
           (-21.17,32.45,1.67,.63,.069,.130,0,.08),
           (-18.87,32.49,.57,.59,-.024,.133,1,-.04),
           (-15.70,32.53,2.68,.71,-.037,.166,1,.09),
           (-11.20,32.39,1.84,.67,-.029,.125,2,-.05),
           (-11.28,32.43,1.67,.59,.065,.158,2,.11),
           (-7.99,32.30,1.66,.59,-.029,.122,3,-.16),
           (-6.08,32.25,.25,.40,-.030,.102,3,-.06),
           (-18.99,32.59,.36,.32,.085,.102,1,-.08),
           (-9.55,32.46,.43,.47,.076,.199,0,-.10),
           (-8.99,32.50,.33,.39,.081,.104,3,.09),
           (-22.87,31.96,.32,.23,-.025,.065,1,.07)]
    for spec in slabs:slab(*spec)
    border=mesh('Driveway end · rough stone edging',vertices,faces,stone,group)
    uvs=border.data.uv_layers.new(name='Stone tops and split faces')
    for poly,coords in zip(border.data.polygons,stone_uv):
        for loop,uv in zip(poly.loop_indices,coords):uvs.data[loop].uv=uv
    # Step onto the actual tops and chipped shoulders. Between rocks, the
    # underlying driveway or gravel supplies the walking surface.
    border.data.calc_loop_triangles()
    tops=[tuple(tri.vertices) for tri in border.data.loop_triangles if tri.normal.z>0]
    helper('WalkSurface_DrivewayFieldstone',vertices,tops)
    orange=mat('Driveway markers · faded orange','#d46e56',rough=.76)
    white=mat('Driveway markers · pale reflective tips','#d4d1bf',metal=.08,rough=.56)
    for x in (-23.9,-17.65,-6.05):
        y=32.98;z=ground(x,y)
        for lo,hi,m in ((-.025,.69,orange),(.69,.80,white),(.80,.88,orange)):
            tube(m,pos(x,y,z+lo),pos(x,y,z+hi),.007,.007,8)
