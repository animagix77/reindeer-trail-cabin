"""Ground finishes for the fire circle and its adjoining pergola gravel bed."""
import math
import random
from mathutils import Vector


# Small, soft banks between the photographed gathering areas. Centres and radii
# use local plan feet; amplitudes are metres added to the surveyed elevation.
# The long bank behind the swings and scallops along the downhill side are
# outside the stocked wood, paths, parking pads and fire-circle footprint.
woodland_banks=(
    (-34,10,5,18,.19),(-30,43,9,11,.15),(-9,55,13,9,.22),
    (6,69,10,9,.16),(29,76,19,7,.21),(53,60,7.6,12,.24),
    (55,17,5.6,14,.17),(48,-4,4.5,7,.12))


def woodland_relief(x,y):
    from mathutils.noise import noise
    height=0.
    for index,(cx,cy,rx,ry,amplitude) in enumerate(woodland_banks):
        u=(x-cx)/rx;v=(y-cy)/ry
        edge=1-u*u-v*v
        if edge<=0:continue
        # A rounded shoulder and adjacent shallow wash fade to zero slope at
        # the rim. Two scales of coherent noise give each bank its own crest.
        phase=index*1.7
        along=u+.28*v+.18*math.sin(3*v+phase)
        ridge=math.exp(-5*(along+.16)**2)
        hollow=math.exp(-16*(along-.48)**2)
        undulation=noise(Vector((x*.13,y*.13,3.17)))
        fine=noise(Vector((x*.48,y*.48,9.54)))
        height+=amplitude*edge**2*(ridge-.85*hollow+.65*undulation+.20*fine)
    return height


def gravel_ripple(rad,angle):
    # Several low ridges where aggregate collects inside the steel edging.
    # The furniture bed and the edging stay at their established grades.
    if not .70<rad<1:return 0.
    along=.50+.50*math.cos(3*angle+.76*math.sin(2*angle+.41))
    across=math.sin(math.pi*(rad-.70)/.30)**2
    return across*(.004+.019*along**2)*(.78+.22*math.sin(7*angle+15*rad))


def garden_gravel(group, gravel, pad, height, drain_x, center, surrounds):
    """Give the two gravel beds one continuous metric projection and contact tones."""
    cx,cy,rx,ry=pad
    contacts=[]
    for degree in (25,107,194,269):
        angle=math.radians(degree)
        outward=Vector((math.cos(angle),math.sin(angle),0))
        across=Vector((outward.y,-outward.x,0))
        seat=center+outward*1.62
        contacts.append((seat,.32,.22))
        for side in (-1,1):
            for half_width,forward in ((.274,.222),(.243,-.504)):
                contacts.append((seat+across*(side*half_width)-outward*forward,.105,.46))
    for x,y,radius,strength in surrounds:
        contacts.append((Vector(pos(x,y,height(x))),radius,strength))

    # Broad penumbrae sit beneath the furniture; smaller footprints attach the
    # feet to the aggregate when only sky or string lights illuminate the yard.
    def make(name,points,faces):
        obj=mesh(name,points,faces,gravel,group)
        geo=obj.data
        uv=geo.uv_layers.new(name='Gravel photograph in metres')
        for loop in geo.loops:
            p=geo.vertices[loop.vertex_index].co
            # This rectangular source photograph is foreshortened. Its stone
            # widths register when 1.48 m of columns spans 0.40 m of rows.
            uv.data[loop.index].uv=(p.x/1.48,p.y/.40)
        colors=geo.color_attributes.new(name='Ground contact',type='BYTE_COLOR',domain='POINT')
        for vertex,item in zip(geo.vertices,colors.data):
            p=vertex.co
            r=math.hypot(p.x-center.x,p.y-center.y)
            shade=.38*math.exp(-((r-.624)/.15)**2)
            for q,sigma,amount in contacts:
                d=(q.x-p.x)**2+(q.y-p.y)**2
                if d<9*sigma*sigma:shade+=amount*math.exp(-d/(2*sigma*sigma))
            value=1-min(.68,shade)
            item.color=(value,value,value,1)
        return obj

    tex=next(n for n in gravel.node_tree.nodes if n.type=='TEX_IMAGE')
    color=gravel.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name='Ground contact'
    multiply=gravel.node_tree.nodes.new('ShaderNodeMix')
    multiply.data_type='RGBA';multiply.blend_type='MULTIPLY'
    multiply.inputs[0].default_value=1
    links=gravel.node_tree.links
    sockets={s.identifier:s for s in multiply.inputs}
    links.new(tex.outputs['Color'],sockets['A_Color'])
    links.new(color.outputs['Color'],sockets['B_Color'])
    links.new(next(s for s in multiply.outputs if s.type=='RGBA'),gravel.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

    # Align the outer ring with the 66-segment edging, with enough interior
    # samples to resolve soft shadows beneath the individual feet.
    sectors,rings=132,32
    points=[pos(cx,cy,height(cx))]
    faces=[]
    for row in range(1,rings+1):
        first=len(points)
        for col in range(sectors):
            a=math.tau*col/sectors
            # Intermediate points lie on the actual edging chord.
            rad=row/rings*(math.cos(math.pi/66) if col%2 else 1)
            x=cx+rx*rad*math.cos(a);y=cy+ry*rad*math.sin(a)
            points.append(pos(x,y,height(x)+gravel_ripple(rad,a)))
            i=first+col;j=first+(col+1)%sectors
            faces.append((0,i,j) if row==1 else (i-sectors,i,j,j-sectors))
    make('Rear gravel fire circle',points,faces)

    points=[];faces=[]
    cols,rows=10,64
    for row in range(rows+1):
        yy=45.35+18.3*row/rows
        edge=cx+rx*math.sqrt(1-((yy-cy)/ry)**2)-.035
        for col in range(cols+1):
            xx=edge+(drain_x-edge)*col/cols
            points.append(pos(xx,yy,height(xx)-.008))
            if row and col:
                k=len(points)-1
                faces.append((k-cols-2,k-cols-1,k,k-1))
    make('Pergola · gravel shoulder beside the fire circle',points,faces)


def dress_garden_ground(group,pad,height,drain_x,terrain,local,land,helper,garden_offset):
    """A shallow gravel spill and curled hardwood leaves, especially at the edging."""
    rng=random.Random(1060579)
    cx,cy,rx,ry=pad
    # Roof alignment and the clearing are referenced to the state ortho.
    # L1060579/583 and IMG_3337/3341 resolve the loose stone and leaves.
    def surface(e,n):
        x,y=local(e+OX,n+OY)
        u,v=(x-cx)/rx,(y-cy)/ry
        rad=math.hypot(u,v)
        if rad<=1:return height(x)-OZ+gravel_ripple(rad,math.atan2(v,u))
        if 45.35<=y<=63.65:
            edge=cx+rx*math.sqrt(1-((y-cy)/ry)**2)-.035
            if edge<=x<=drain_x:return height(x)-OZ-.008
        p,_,_,_=terrain.ray_cast((e,n,height(x)-OZ+1.5),(0,0,-1),3.0)
        return p.z if p is not None else None

    # All fragments share one opaque material/draw per kind. Point colors
    # vary along the lobes and pebble facets, independent of time of day.
    def colored(name,verts,faces,colors):
        finish=mat(name,'#ffffff',rough=.97)
        tint=finish.node_tree.nodes.new('ShaderNodeVertexColor');tint.layer_name='Natural tones'
        finish.node_tree.links.new(tint.outputs['Color'],finish.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        obj=mesh(name,verts,faces,finish,group)
        for face in obj.data.polygons:face.use_smooth=True
        attr=obj.data.color_attributes.new(name=tint.layer_name,type='BYTE_COLOR',domain='POINT')
        for item,rgb in zip(attr.data,colors):item.color_srgb=(*rgb,1)
        return obj

    stone_verts=[];stone_faces=[];stone_colors=[]
    pebble_tones=[(.53,.49,.43),(.41,.39,.37),(.72,.67,.57),(.37,.34,.31),(.59,.56,.53),(.50,.42,.34)]
    def pebble(e,n,z,r):
        start=len(stone_verts)
        length=r*rng.uniform(1.00,1.55);width=r*rng.uniform(.66,1.02)
        turn=rng.uniform(0,math.tau);c,s=math.cos(turn),math.sin(turn)
        palette=rng.choice(pebble_tones)
        sides=6;cap=r*rng.uniform(.43,.71)
        for ring,(spread,rise) in enumerate(((1,-.001),(.64,cap))):
            for j in range(sides):
                phase=math.tau*(j+.19*ring)/sides
                a=length*spread*math.cos(phase)*rng.uniform(.84,1.12)
                b=width*spread*math.sin(phase)*rng.uniform(.84,1.12)
                stone_verts.append((e+c*a-s*b,n+s*a+c*b,z+rise))
                tone=rng.uniform(.87,.97) if not ring else rng.uniform(.96,1.08)
                stone_colors.append(tuple(k*tone for k in palette))
        for j in range(sides):
            k=(j+1)%sides
            stone_faces.append((start+j,start+k,start+sides+k,start+sides+j))
        stone_faces.append(tuple(start+sides+j for j in range(sides)))

    for i in range(950):
        a=rng.uniform(0,math.tau)
        rad=math.sqrt(rng.random()) if i<570 else 1+rng.gauss(.015,.044)
        x=cx+rx*rad*math.cos(a);y=cy+ry*rad*math.sin(a)
        e,n,_=pos(x,y,height(x));z=surface(e,n)
        if z is not None:pebble(e,n,z,rng.uniform(.009,.023))
    # The low fieldstones beside the lip in the autumn and spring photographs.
    for phase in (.38,1.78,2.93,3.88,4.71,5.23):
        for _ in range(rng.randint(2,4)):
            a=phase+rng.uniform(-.075,.075);rad=rng.uniform(1.01,1.09)
            x=cx+rx*rad*math.cos(a);y=cy+ry*rad*math.sin(a)
            e,n,_=pos(x,y,height(x));z=surface(e,n)
            if z is not None:pebble(e,n,z,rng.uniform(.039,.089))
    colored('Garden · loose river gravel and margin stones',stone_verts,stone_faces,stone_colors)

    leaf_verts=[];leaf_faces=[];leaf_colors=[]
    leaf_tones=[(.55,.32,.14),(.41,.23,.13),(.67,.46,.21),(.49,.34,.19),(.59,.25,.12),(.62,.48,.27)]
    for i in range(560):
        # The outer bank traps leaves in uneven drifts. A few blow onto the pad.
        a=rng.uniform(0,math.tau)
        if i<365:a=rng.choice((.84,1.45,2.72,3.41,4.52,5.65))+rng.gauss(0,.13)
        rad=1+rng.gauss(.022,.045) if i<500 else rng.uniform(.30,.96)
        x=cx+rx*rad*math.cos(a);y=cy+ry*rad*math.sin(a)
        e,n,_=pos(x,y,height(x))
        if surface(e,n) is None:continue
        l=rng.uniform(.050,.101);w=l*rng.uniform(.32,.52)
        turn=rng.uniform(0,math.tau);c,s=math.cos(turn),math.sin(turn)
        color=rng.choice(leaf_tones);curl=rng.uniform(.003,.011)
        start=len(leaf_verts)
        for u,v in [(0,0),(-.39,-.28),(-.16,-.77),(-.08,-.49),(.12,-1),(.17,-.38),(.60,0),
                    (.19,.40),(.10,.93),(-.09,.52),(-.18,.76),(-.39,.26),(-.46,0)]:
            px=e+u*l*c-v*w*s;py=n+u*l*s+v*w*c
            z=surface(px,py)
            lift=(.45+abs(v)*.55)*curl if u or v else curl*1.2
            leaf_verts.append((px,py,(z if z is not None else height(x)-OZ)+.003+lift))
            value=rng.uniform(.85,.98) if v<0 else rng.uniform(1.01,1.13)
            leaf_colors.append(tuple(k*value for k in color))
        for j in range(12):leaf_faces.append((start,start+1+j,start+1+(j+1)%12))
    colored('Garden · fallen oak and maple leaves',leaf_verts,leaf_faces,leaf_colors)

    # Loose crushed chips are sparse on the front treads and gather in small
    # pockets on the gravel paths. Sample their actual rendered triangles so
    # the stone follows each grade change, including the timber stair checks.
    stone_verts=[];stone_faces=[];stone_colors=[]
    # Larger chips concentrate where raking and foot traffic push gravel
    # outwards. Keep the centre, seats and slotted pergola drain clear.
    for _ in range(36):
        angle=rng.uniform(0,math.tau)
        rad=rng.uniform(.81,.975)
        for _ in range(rng.randint(4,13)):
            a=angle+rng.gauss(0,.036);r=rad+rng.gauss(0,.015)
            e,n,_=pos(cx+rx*r*math.cos(a),cy+ry*r*math.sin(a),height(cx))
            z=surface(e,n)
            if z is not None:pebble(e,n,z-.002,rng.uniform(.012,.035))
    for path in list(group.objects):
        if not path.name.startswith(('Front walk · gravel terraces','Rear garden path','Driveway steps · crushed stone infill')):continue
        geo=path.data;geo.calc_loop_triangles()
        for tri in geo.loop_triangles:
            a,b,c=(geo.vertices[i].co for i in tri.vertices)
            normal=(b-a).cross(c-a)
            if abs(normal.z)<.86*normal.length:continue
            mean=(a+b+c)/3
            fan=.5+.5*math.sin(mean.x*2.2+math.sin(mean.y*3.7))*math.cos(mean.y*2.8)
            count=int(.5*abs(normal.z)*(5+30*fan**2)+rng.random())
            for j in range(count):
                u,v=rng.random(),rng.random()
                if u+v>1:u=1-u;v=1-v
                p=a+(b-a)*u+(c-a)*v
                pebble(p.x,p.y,p.z-.002,rng.uniform(.008,.025))
    colored('Garden · loose chips on graded paths',stone_verts,stone_faces,stone_colors)

    # Fieldstone bounds come from the dry woodland banks, not the level area
    # made for the chairs. Sink angular cobbles in irregular groups, with a
    # tail of finer fragments spilling away from each partly buried slab.
    from mathutils.bvhtree import BVHTree
    parcel=group.objects['WalkSurface_ParcelGround'].data
    walkable=BVHTree.FromPolygons([v.co for v in parcel.vertices],[p.vertices[:] for p in parcel.polygons])
    rock_verts=[];rock_faces=[];rock_colors=[];support_verts=[];support_faces=[]
    occupied=[]
    palettes=((.40,.41,.40),(.49,.48,.44),(.43,.39,.35),(.56,.54,.48),(.38,.40,.43))
    patches=[(-33.4,-3,4,6),(-35,18,4,9),(-24,41,7,6),(-8,53,8,6),
             (8,65,5,7),(23,72,8,4),(38,74,7,5),(51,60,5,8),
             (54,28,4,7),(48,0,4,6),(45.5,-10,2.4,3.3),(7,-1.0,2.8,1.7),
             (15.2,46.1,2,3.4),(31.9,40.6,3.3,1.6)]

    def fieldstone(x,y,rad,bearing):
        if math.hypot((x-cx)/rx,(y-cy)/ry)<1.08 or (29<x<44 and 44<y<65):return
        if 33<x<58 and 32<y<50 and garden_offset(x,y)[0]<1.84+rad/ft:return
        e,n=eastnorth(x,y)
        center,normal,face_index,_=terrain.ray_cast((e-OX,n-OY,65),(0,0,-1),110)
        if center is None or normal.z<.59 or land.data.polygons[face_index].material_index!=0:return
        if any((center.x-px)**2+(center.y-py)**2 < (.84*(rad+radius))**2 for px,py,radius in occupied):return
        occupied.append((center.x,center.y,rad))
        # Each rounded slab has bedding faces, a chipped shoulder and a crown.
        # Slip the upper bed a little sideways and tint exposed facets.
        size=8 if rad>.15 else 6
        width=rad*rng.uniform(.50,.83)
        cap=rad*rng.uniform(.43,.69)
        anisotropy=rng.uniform(.74,1.05)
        ct,st=math.cos(bearing),math.sin(bearing)
        outline=[]
        for j in range(size):
            t=(j+rng.uniform(-.14,.14))*math.tau/size
            jitter=rng.uniform(.80,1.12)
            # Soft square cross-sections give broken stones some flatter faces.
            a=math.cos(t);b=math.sin(t)
            a=math.copysign(abs(a)**anisotropy,a)*rad*jitter
            b=math.copysign(abs(b)**anisotropy,b)*width*jitter
            outline.append((ct*a-st*b,st*a+ct*b))
        base_color=rng.choice(palettes);lichen=rng.uniform(0,.55)
        slope_x=-normal.x/normal.z;slope_y=-normal.y/normal.z
        rings=[];pts=[];tones=[]
        for band,(extent,elevation) in enumerate(((.83,-.48),(1.,.12),(.77,.80),(.48,.94))):
            ring=[]
            for j,(dx,dy) in enumerate(outline):
                drift=.09*band/3
                xx=extent*dx+drift*rad*ct;yy=extent*dy+drift*rad*st
                z=center.z+slope_x*xx+slope_y*yy+cap*(elevation+rng.uniform(-.07,.07))
                ring.append(len(pts));pts.append((center.x+xx,center.y+yy,z))
                shade=(.66,.84,1.,1.06)[band]*rng.uniform(.92,1.08)
                moss=lichen*max(0,math.cos(j*math.tau/size+.6)) if band>=2 else 0.
                tones.append(tuple(shade*(v*(1-moss)+m*moss) for v,m in zip(base_color,(.43,.46,.32))))
            rings.append(ring)
        crown=len(pts);pts.append((center.x,center.y,center.z+cap*1.06));tones.append(base_color)
        faces=[]
        for lower,upper in zip(rings,rings[1:]):
            for j in range(size):
                k=(j+1)%size;faces.append((lower[j],lower[k],upper[k],upper[j]))
        faces.extend((rings[-1][j],rings[-1][(j+1)%size],crown) for j in range(size))
        first=len(rock_verts);rock_verts.extend(pts);rock_colors.extend(tones)
        rock_faces.extend(tuple(first+i for i in f) for f in faces)
        # Feet can step onto the crown of the larger embedded rocks. Only add
        # supports on the parcel; background geometry cannot extend walkability.
        if cap>.075 and all(walkable.ray_cast((pts[i][0],pts[i][1],65),(0,0,-1),110)[0] is not None for i in rings[1]):
            first=len(support_verts);support_verts.extend(pts)
            support_faces.extend(tuple(first+i for i in f) for f in faces[size:])

    for px,py,rx,ry in patches:
        bearing=rng.uniform(0,math.tau)
        for cluster in range(7):
            angle=rng.uniform(0,math.tau);offset=math.sqrt(rng.random())
            x=px+rx*offset*math.cos(angle);y=py+ry*offset*math.sin(angle)
            radius=rng.uniform(.17,.37) if cluster<3 else rng.uniform(.07,.16)
            fieldstone(x,y,radius,bearing+rng.uniform(-.38,.38))
            for j in range(13):
                # Fines sort into the hollows between larger stones.
                t=rng.uniform(0,math.tau);d=rng.uniform(1.1,3.7)*radius/ft
                fieldstone(x+math.cos(t)*d,y+math.sin(t)*d,rng.uniform(.018,.095),bearing+rng.uniform(-1.2,1.2))
    colored('Garden · bank fieldstone and scattered cobbles',rock_verts,rock_faces,rock_colors)
    if support_faces:
        helper('WalkSurface_WoodlandFieldstone',support_verts,support_faces)
