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


def driveway_edge_details(group, land, helper, blocker, tube):
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
    vertices=[];faces=[];tints=[]
    colors=['#a69a87','#8c8274','#a8907e','#938b7e','#ac9c89']
    stones=[mat('Driveway edging · fieldstone '+str(i+1),c,rough=.96) for i,c in enumerate(colors)]
    # Flat, irregular fieldstones set end to end across part of the drive.
    ends=[-24.2,-21.65,-19.85,-17.4,-14.1,-11.85,-9.5,-7.25,-5.90]
    for j,(a,b) in enumerate(zip(ends,ends[1:])):
        x=(a+b)/2;y=32.42+.25*math.sin(j*.64);long=(b-a)*.495;wide=rng.uniform(.48,.7)
        h=rng.uniform(.12,.205)
        contour=[(-.97,-.51),(-.70,-1),(.47,-.92),(.92,-.51),(1,.48),(.41,.96),(-.51,.81),(-1,.41)]
        ring=[(x+u*long,y+v*wide) for u,v in contour]
        start=len(vertices);n=len(ring);z=ground(x,y)
        vertices.extend(pos(u,v,z-.09) for u,v in ring)
        vertices.extend(pos(u,v,z+h*rng.uniform(.48,.79)) for u,v in ring)
        vertices.extend(pos(x+(u-x)*rng.uniform(.64,.85),y+(v-y)*.76,z+h*rng.uniform(.85,1.0)) for u,v in ring)
        for row in (0,1):
            for i in range(n):
                l=start+row*n+i;m=start+row*n+(i+1)%n
                faces.append((l,m,m+n,l+n));tints.append((j+int(i==1))%len(stones))
        lid=tuple(range(start+2*n,start+3*n))
        faces.append(lid);tints.append(j%len(stones))
        blocker('DriveEndStone%02d'%j,pos(a+.06,y,z-.05),pos(b-.06,y,z-.05),wide*1.65*ft,h+.05)
    border=mesh('Driveway end · rough stone edging',vertices,faces,stones[0],group)
    for m in stones[1:]:border.data.materials.append(m)
    for f,idx in zip(border.data.polygons,tints):f.material_index=idx
    orange=mat('Driveway markers · faded orange','#d46e56',rough=.76)
    white=mat('Driveway markers · pale reflective tips','#d4d1bf',metal=.08,rough=.56)
    for x in (-23.9,-17.65,-6.05):
        y=32.98;z=ground(x,y)
        for lo,hi,m in ((-.025,.69,orange),(.69,.80,white),(.80,.88,orange)):
            tube(m,pos(x,y,z+lo),pos(x,y,z+hi),.007,.007,8)
