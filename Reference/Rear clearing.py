"""Ground finishes for the fire circle and its adjoining pergola gravel bed."""
import math
import random
from mathutils import Vector


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
        for side in (-.27,.27):
            for forward in (.28,-.35):
                contacts.append((seat+across*side-outward*forward,.105,.46))
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
            points.append(pos(x,y,height(x)))
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


def dress_garden_ground(group,pad,height,drain_x,terrain,local):
    """A shallow gravel spill and curled hardwood leaves, especially at the edging."""
    rng=random.Random(1060579)
    cx,cy,rx,ry=pad
    # Roof alignment and the clearing are referenced to the state ortho.
    # L1060579/583 and IMG_3337/3341 resolve the loose stone and leaves.
    def surface(e,n):
        x,y=local(e+OX,n+OY)
        on_circle=((x-cx)/rx)**2+((y-cy)/ry)**2<=1
        if on_circle:return height(x)-OZ
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
