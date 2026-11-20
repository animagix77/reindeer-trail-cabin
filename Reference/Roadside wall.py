"""Roadside masonry from owner photos, the street view and the 2025 state orthophoto."""
import random

# The aerial and street-facing view locate the gate in plan. Bay spacing and
# cap heights are scaled from the oblique street and owner photographs.
roadside_piers=(18.10,24.65,34.9,44.95,54.30)
gate_left, gate_right=roadside_piers[:2]

def roadside_line(x):
    return -19.97-.012*x+.18*math.sin(x*.065)

def retained_bank(x,y):
    """A shallow retained bank on the lot side, feathering out at the gate."""
    offset=y-roadside_line(x)
    if offset<0 or offset>5.5:
        return 0.
    span=min(x-gate_right,roadside_piers[-1]-x)
    inset=max(0.,min(1.,span/2.0))
    return .30*inset*min(1.,offset/.75)*max(0.,1-abs(offset-1.3)/4.2)

def build_roadside_wall(group,ground,blocker,material,normal_file):
    rng=random.Random(5547)
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.94
    texture=material.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image=bpy.data.images.load(str(normal_file),check_existing=True)
    texture.image.colorspace_settings.name='Non-Color'
    texture.image.pack()
    relief=material.node_tree.nodes.new('ShaderNodeNormalMap')
    relief.inputs['Strength'].default_value=.68
    material.node_tree.links.new(texture.outputs['Color'],relief.inputs['Color'])
    material.node_tree.links.new(relief.outputs['Normal'],bsdf.inputs['Normal'])
    mortar=mat('Roadside masonry · recessed pointing','#656157',rough=.98)
    vertices, faces, coords, face_mats=[],[],[],[]
    def ashlar(x0,x1,ywidth,bottom,top,cap=False,core=False):
        # Non-planar battered faces and clipped corners keep the pilasters and
        # individual units distinct in silhouette. Paving coordinates are in feet.
        depth=ywidth/2
        chamfer=min(.085,(x1-x0)*.115,ywidth*.10)
        outline=[(x0+chamfer,-depth),(x1-chamfer,-depth),(x1,-depth+chamfer),
                 (x1,depth-chamfer),(x1-chamfer,depth),(x0+chamfer,depth),
                 (x0,depth-chamfer),(x0,-depth+chamfer)]
        points=[]
        for x,y in outline:
            x+=rng.uniform(-chamfer*.18,chamfer*.18)
            y+=rng.uniform(-.013,.013)
            zlo,zhi=bottom(x),top(x)
            blemish=rng.uniform(-.005,.005)
            points.append((x,y,zlo,zhi+blemish))
        base=len(vertices)
        # Upper and lower bevels catch light at the rough bed and head joints.
        for r in range(4):
            for x,y,lo,hi in points:
                bevel=min(.012,(hi-lo)*.19)
                xx=x+((x1+x0)/2-x)*(.028 if r in (0,3) else 0)
                yy=y*(.95 if r in (0,3) else 1.)
                vertices.append(pos(xx,roadside_line(xx)+yy,(lo,lo+bevel,hi-bevel,hi)[r]))
        offset=rng.uniform(.027,.24)
        flipped=rng.choice((-1,1))
        def emit(indices,top_face=False,side=0):
            ids=tuple(base+i for i in indices)
            faces.append(ids)
            face_mats.append(int(core))
            uvs=[]
            us,vs=[],[]
            for i in indices:
                x,y,lo,hi=points[i%8]
                h=(lo,lo+.012,hi-.012,hi)[i//8]
                # Both physical axes stay in meters so blocks and posts have similar grain.
                us.append((x if top_face or side in (0,4) else y)*ft)
                vs.append(y*ft if top_face else h)
            minu,minv=min(us),min(vs)
            for u,v in zip(us,vs):
                u=(u-minu)/max(.64,(max(us)-minu)*1.36)
                v=(v-minv)/max(.59,(max(vs)-minv)*1.36)
                uu=offset+u*.87 if flipped==1 else 1-offset-u*.87
                moss_tile=.5 if cap and top_face else 0
                uvs.append((moss_tile+.5*uu,offset+v*.87))
            coords.append(uvs)
        emit(list(reversed(range(8))),True)
        for r in range(3):
            for k in range(8):
                j=(k+1)%8
                emit([r*8+k,r*8+j,(r+1)*8+j,(r+1)*8+k],False,k)
        emit(list(range(24,32)),True)
    def ground_z(x):
        return ground(x,roadside_line(x)-.58)
    pier_heights=dict(zip(roadside_piers,(1.53,1.50,1.17,.96,.74)))
    for k,x in enumerate(roadside_piers):
        z=ground_z(x)
        height=pier_heights[x]
        jamb=x in (gate_left,gate_right)
        width=1.53 if jamb else 1.04
        layers=4 if height>1.20 else 3
        footing=z-.19
        for row in range(layers):
            low=footing+(height-.07+z-footing)*row/layers
            high=footing+(height-.07+z-footing)*(row+1)/layers
            # Vary face width by course, the older square piers show soft shoulders.
            half=width*.5+rng.uniform(-.025,.025)
            ashlar(x-half,x+half,width,lambda _,h=low:h,lambda _,h=high:h)
        if jamb:
            ashlar(x-width*.54,x+width*.54,width*1.08,lambda _:z+height-.072,lambda _:z+height,cap=True)
        else:
            # The wall rises to angular gabled coping, without a free-standing post.
            for l,r in ((x-width*.52,x),(x,x+width*.52)):
                ashlar(l,r,width*1.08,lambda _:z+height-.072,
                       lambda xx:z+height+.075*(1-abs(xx-x)/(width*.52)),cap=True)
        blocker('RoadPier%02d'%k,pos(x-width/2,roadside_line(x),z-.04),
                pos(x+width/2,roadside_line(x),z-.04),width*ft,height+.04)
    for k,(left,right) in enumerate(zip(roadside_piers,roadside_piers[1:])):
        if left==gate_left:
            continue
        a=left+(.71 if left==gate_right else .49)
        b=right-.49
        start_z,end_z=ground_z(a),ground_z(b)
        span=b-a
        def base_at(x):
            return start_z+(end_z-start_z)*(x-a)/span-.18
        def crest(x):
            t=max(0.,min(1.,(x-a)/span))
            straight=pier_heights[left]*(1-t)+pier_heights[right]*t
            recess=.265*min(1.,max(0.,x-a)/1.65,max(0.,b-x)/1.65)
            return base_at(x)+straight+.175-recess
        # Continuous inset mortar eliminates pinholes through open stone joints.
        divisions=max(3,round(span/1.35))
        for i in range(divisions):
            x0=a+span*i/divisions
            x1=a+span*(i+1)/divisions
            ashlar(x0-.012,x1+.012,.87,base_at,lambda x:crest(x)-.065,core=True)
        courses=4 if left==gate_right else 3
        for row in range(courses):
            cuts=[a]
            x=a+(rng.uniform(1.42,2.25) if row%2==0 else rng.uniform(.70,1.19))
            while x<b-.56:
                cuts.append(x)
                x+=rng.uniform(1.46,2.38)
            cuts.append(b)
            def bed(x,index):
                h=(crest(x)-.071)-base_at(x)
                return base_at(x)+h*index/courses
            for x0,x1 in zip(cuts,cuts[1:]):
                ashlar(x0+.013,x1-.013,1.02+rng.uniform(-.024,.026),
                       lambda x:bed(x,row)+.0025,lambda x:bed(x,row+1)-.0025)
        for i in range(divisions):
            x0=a+span*i/divisions;x1=a+span*(i+1)/divisions
            ashlar(x0+.007,x1-.007,1.10,lambda x:crest(x)-.069,crest,cap=True)
        blocker('RoadWallBay%02d'%k,pos(a,roadside_line(a),base_at(a)),
                pos(b,roadside_line(b),base_at(b)),.325,max(pier_heights[left],pier_heights[right])+.20)
    ob=mesh('Front yard · old roadside retaining wall and gate piers',vertices,faces,material,group)
    ob.data.materials.append(mortar)
    uv=ob.data.uv_layers.new(name='Weathered stone and mossy coping')
    for poly,values,idx in zip(ob.data.polygons,coords,face_mats):
        poly.material_index=idx
        for loop,coord in zip(poly.loop_indices,values):
            uv.data[loop].uv=coord
    ob['basis']='Owner and street photographs show square gate piers, coursed ashlar and mossy pointed coping. The 2025 six-inch orthophoto constrains the opening. Heights and bays are estimated.'
    return ob
