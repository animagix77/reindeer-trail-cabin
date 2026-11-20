"""Exterior carriage doors and the primary bedroom's louvered shutters, from owner photos."""
def build_carriage_doors_and_shutters():
    grain=mat('Garage · weathered timber grain','#686153')
    tex=grain.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(work/'Exterior materials'/'Weathered ties.jpg'),check_existing=True)
    tex.image.pack()
    grain.node_tree.links.new(tex.outputs['Color'],grain.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    paints=[mat('Garage · blue boards '+str(i),c) for i,c in enumerate(('#263f50','#2c4354','#304759'))]
    gap=mat('Garage · dark board joints','#152431')
    iron=mat('Garage · black iron','#25282a',.25,.49)
    shutter=mat('Shutters · dark stain','#36342e')
    deep=mat('Shutters · louver shadows','#211f1c')
    flood=mat('Garage · white flood housings','#d9d9d4',.12)
    lens=mat('Garage · opal lamp faces','#efeee4',.03,.38)

    # Use one mesh per fitting. Local a is across the facade, d points outdoors and z upwards, all in metres.
    class Fitting:
        def __init__(self,name,origin,reverse=False):
            self.name=name;self.origin=origin;self.reverse=reverse
            self.v=[];self.faces=[];self.mats=[];self.indices=[];self.uv=[]
        def face(self,corners,material,uv=None):
            if self.reverse:
                corners=corners[::-1]
                uv=uv[::-1] if uv else None
            i=len(self.v)
            self.v.extend(self.origin(*p) for p in corners)
            self.faces.append(tuple(range(i,i+len(corners))))
            if material not in self.mats:self.mats.append(material)
            self.indices.append(self.mats.index(material))
            self.uv.extend(uv or [(0,0)]*len(corners))
        def strip(self,a,z,b,h,width,d0,d1,material):
            # The mapped grain runs along the board, including the four mitered diagonal braces.
            dx,dz=b-a,h-z
            length=math.hypot(dx,dz)
            nx,nz=-dz/length*width*.5,dx/length*width*.5
            front=[(a-nx,d1,z-nz),(b-nx,d1,h-nz),(b+nx,d1,h+nz),(a+nx,d1,z+nz)]
            back=[(u,d0,v) for u,_,v in front]
            off=(a*.99+z*.61)%1
            uv=[(off,off),(off+length,off),(off+length,off+width/.55),(off,off+width/.55)]
            self.face(front,material,uv)
            self.face(back[::-1],material,uv[::-1])
            for i in range(4):
                j=(i+1)%4
                self.face([back[i],back[j],front[j],front[i]],material)
        def finish(self):
            obj=mesh(self.name,self.v,self.faces,None,structure)
            for material in self.mats:obj.data.materials.append(material)
            obj.data.polygons.foreach_set('material_index',self.indices)
            uv=obj.data.uv_layers.new(name='Board grain')
            uv.data.foreach_set('uv',[x for pair in self.uv for x in pair])
            return obj

    # Both photographed lintels meet the lower drip edge of the blue siding. The
    # photographed proportions suggest a roughly seven-foot clear door height.
    door_scale=1.08
    drip_z=2.21*door_scale
    skirt=Fitting('Garage gable · bottom siding and drip edge',lambda a,d,z:pos(-d/ft,16+a/ft,low+z),reverse=True)
    reach=12.97*ft
    zmax=main-low-.137
    section=[(.021,drip_z),(.034,drip_z+.022),(.029,drip_z+.065),(.012,zmax-.012),(.006,zmax)]
    for (d0,z0),(d1,z1) in zip(section,section[1:]):
        skirt.face([(-reach,d0,z0),(reach,d0,z0),(reach,d1,z1),(-reach,d1,z1)],siding)
    skirt.strip(-reach,drip_z-.005,reach,drip_z-.005,.021,.017,.061,trim)
    skirt.finish()
    for bay,ym in enumerate((9.4,22.1),1):
        unit=Fitting('Garage bay '+str(bay)+' · blue carriage doors',lambda a,d,z:pos(-d/ft,ym+a/ft,low+z*door_scale),reverse=True)
        half=4*ft
        unit.strip(-half,.995,half,.995,1.99,.04,.065,gap)
        for side in (-1,1):
            left=-half if side==-1 else .008
            right=-.008 if side==-1 else half
            for i in range(9):
                width=(right-left)/9
                a=left+width*(i+.5)
                unit.strip(a,.049,a,2.014,width-.003,.065,.081,paints[(bay+i*7+(side==1))%3])
                unit.strip(a-width/2+.002,.049,a-width/2+.002,2.014,.002,.08,.082,gap)
            for a in (left+.031,right-.031):
                unit.strip(a,.036,a,2.008,.062,.081,.11,grain)
            for z in (.069,1.022,1.98):
                unit.strip(left+.062,z,right-.062,z,.074,.081,.11,grain)
            outer=(left+.062 if side==-1 else right-.062)
            inner=(right-.064 if side==-1 else left+.064)
            unit.strip(outer,1.059,inner,1.937,.052,.081,.101,grain)
            unit.strip(outer,.983,inner,.112,.052,.081,.101,grain)
            for z in (1.002,1.067):
                unit.strip(side*.083,z,side*.133,z,.016,.109,.123,iron)
            unit.strip(side*.133,1.002,side*.133,1.067,.016,.118,.134,iron)
        for a in (-half-.041,half+.041):
            unit.strip(a,-.005,a,2.027,.073,.026,.13,grain)
        unit.strip(-half-.089,2.104,half+.089,2.104,.166,.027,.146,grain)
        unit.strip(-half-.1,2.196,half+.1,2.196,.02,.026,.154,iron)
        unit.finish()

    unit=Fitting('Garage · center twin floodlight',lambda a,d,z:pos(-d/ft,15.75+a/ft,low+z*door_scale))
    def cone(p0,p1,r0,r1,material,front=None):
        a,b=Vector(p0),Vector(p1);axis=(b-a).normalized()
        u=axis.cross(Vector((0,0,1))).normalized();v=axis.cross(u)
        ring=[u*math.cos(i*math.tau/20)+v*math.sin(i*math.tau/20) for i in range(20)]
        start=[a+p*r0 for p in ring];end=[b+p*r1 for p in ring]
        for i in range(20):
            j=(i+1)%20
            unit.face([start[i],start[j],end[j],end[i]],material)
        unit.face(end,front or material)
    cone((0,.024,2.18),(0,.078,2.18),.069,.069,flood)
    for s in (-1,1):
        cone((s*.019,.071,2.18),(s*.064,.128,2.18),.017,.023,flood)
        cone((s*.064,.128,2.18),(s*.106,.184,2.151),.029,.051,flood,lens)
    unit.finish()

    for edge,sign in ((11.0,-1),(16.4,1)):
        # Narrow dark paired panels in the owner's front-elevation photograph.
        center=edge+sign*.65
        unit=Fitting('Primary front window · louvered shutter',lambda a,d,z:pos(center+a/ft,3.08-d/ft,main+z))
        half=.157;sill=.82-.057;head=1.74+.072;middle=(sill+head)/2
        unit.strip(-half,middle,half,middle,head-sill,.039,.051,deep)
        for a in (-half+.015,half-.015):unit.strip(a,sill,a,head,.030,.05,.073,shutter)
        for z in (sill+.017,middle,head-.017):
            unit.strip(-half+.03,z,half-.03,z,.034,.05,.073,shutter)
        for z0,z1 in ((sill+.034,middle-.017),(middle+.017,head-.034)):
            for i in range(13):
                z=z0+i*(z1-z0)/13
                unit.face([(-half+.03,.071,z),(half-.03,.071,z),(half-.03,.052,z+.030),(-half+.03,.052,z+.030)],shutter)
        unit.finish()

build_carriage_doors_and_shutters()

def build_photo_facades(grade):
    # L1040557, L1040561, L1040569 and gallery 057 show the recessed sash,
    # stepped white drainage and number plate. Vertical offsets use the main floor.
    def photo_surface(name,filename,coords,uvs):
        material=mat(name+' · photo finish','#babbb1',0,.67)
        shader=material.node_tree.nodes.get('Principled BSDF')
        image=material.node_tree.nodes.new('ShaderNodeTexImage')
        image.image=bpy.data.images.load(str(work/'Exterior materials'/filename),check_existing=True)
        image.image.pack()
        material.node_tree.links.new(image.outputs['Color'],shader.inputs['Base Color'])
        item=mesh(name,[point(*p) for p in coords],[tuple(range(len(coords)))],material,structure)
        uv=item.data.uv_layers.new(name='Rectified owner photograph')
        uv.data.foreach_set('uv',[n for pair in uvs for n in pair])
        return item

    metal=mat('Window sash · aged white aluminum','#c4c6bd',.18,.52)
    shadow=mat('Window channel · deep gray','#454c4b',.16,.68)
    def sash(front,center,sill,head):
        wall=3 if front else 29
        wall_index=1 if front else 7
        outward=-1 if front else 1
        width=2.36
        a=center-width/2;b=center+width/2
        hole=(a,b,sill,head)
        for ob in structure.objects:
            if ob.name.startswith('Foundation · wall '+str(wall_index)+'.'):
                if max(local(v.co)[0] for v in ob.data.vertices)<a or min(local(v.co)[0] for v in ob.data.vertices)>b:continue
                hole_object(ob,[hole],(0,2))
                # Reproject the painted block onto the cut wall using its original scale.
                uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='Architectural material')
                for lp in ob.data.loops:
                    u,_,h=local(ob.data.vertices[lp.vertex_index].co)
                    uv.data[lp.index].uv=(u*ft/1.65,h/1.65)
        def moulding(suffix,x0,x1,z0,z1,d0,d1,material):
            y0,y1=sorted((wall+outward*d0/ft,wall+outward*d1/ft))
            return box(name+' · '+suffix,x0,x1,y0,y1,main+z0,main+z1,material,structure)
        name=('Front' if front else 'Rear')+' basement window'
        for x in (a,b):
            moulding('casing',x-.112,x+.112,sill-.055,head+.060,-.017,.046,trim)
        moulding('head',a+.11,b-.11,head-.028,head+.060,-.017,.046,trim)
        moulding('sill',a+.1,b-.1,sill-.067,sill+.033,-.017,.061,trim)
        for x in (a+.163,b-.163):
            moulding('sash stile',x-.054,x+.054,sill+.03,head-.028,-.041,.01,metal)
        for h in (head-.047,sill+.055):
            moulding('sash rail',a+.12,b-.12,h-.02,h+.02,-.041,.012,metal)
        left,right=a+.205,b-.205;bottom,top=sill+.067,head-.063
        # Two actual panes sampled in the source image, behind their metal channel.
        y=wall-outward*.045/ft
        corners=[(left,y,bottom),(right,y,bottom),(right,y,top),(left,y,top)]
        uv=[(0,0),(1,0),(1,1),(0,1)]
        # The photo is read from outside. Front-facing local X points right on
        # the front eave, left on the rear eave.
        if not front:corners.reverse()
        if not front:uv=[(1,1),(0,1),(0,0),(1,0)]
        photo_surface(name+' · glazing','Basement '+('front' if front else 'rear')+' sash.jpg',corners,uv)
        for x in (left-.008,right+.008):
            moulding('glazing gasket',x-.014,x+.014,bottom,top,-.045,-.021,shadow)
        mid=bottom+(top-bottom)*(.50 if front else .53)
        moulding('meeting rail',left,right,mid-.011,mid+.011,-.04,-.009,metal)
    sash(True,6.0,-1.32,-.353)
    sash(False,4.6,-1.32,-.353)

    # Rectangular gutter sections, hydraulic elbows and their stand-off clips.
    # The front lower leg follows the ground leftward in both 557 and 561.
    paint=mat('Rainwater goods · warm white','#e1e2db',.17,.51)
    def level_gutter(start,end,y,face,k):
        profile=[(-.033,.002),(.09,.002),(.095,-.02),(.079,-.038),(.073,-.07),
                 (.060,-.082),(.052,-.105),(-.030,-.105),(-.033,.002)]
        pts=[]
        for x in (start,end):
            height=pz(k,x,y)
            pts.extend(pos(x,y+face*d/ft,height+h) for d,h in profile[:-1])
        n=len(profile)-1
        faces=[tuple(range(n)),tuple(range(n,2*n))]
        faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
        return mesh('Gutter · '+('front' if face==-1 else 'rear')+' eave',pts,faces,paint,structure,True)

    level_gutter(-.68,21.92,2.20,-1,0)
    level_gutter(22.01,27.90,-.8,-1,0)
    level_gutter(34.10,41.76,-.8,-1,0)
    level_gutter(-.68,20.9,29.8,1,1)

    def downpipe(x,wall_y,eave_y,k,direction,extension=0):
        low_z=grade(x,wall_y+direction*.51)+.068
        high=pz(k,x,eave_y)-.098
        near=wall_y+direction*.28
        # Side profile and longitudinal ribs keep the familiar square elbow silhouette.
        bends=[(x,eave_y,high),(x,eave_y,high-.105),(x,near+direction*.08,high-.27),
               (x,near,high-.335),(x,near,low_z+.18),(x,near+direction*.19,low_z+.066),
               (x,near+direction*.37,low_z+.04)]
        if extension:
            bends.extend([(x+extension*.08,near+direction*.44,low_z+.032),
                          (x+extension,near+direction*.44,grade(x+extension,near+direction*.44)+.045)])
        paths=[Vector(pos(*c)) for c in bends]
        line=Vector(pos(x+.1,near,high))-Vector(pos(x,near,high))
        across=line.normalized()
        vertices=[];sections=[]
        for i,p in enumerate(paths):
            before=(p-paths[i-1]).normalized() if i else (paths[1]-p).normalized()
            after=(paths[i+1]-p).normalized() if i<len(paths)-1 else before
            run=(before+after).normalized()
            up=across.cross(run)
            if up.length<.15: up=Vector((0,0,1))
            up.normalize()
            side=run.cross(up).normalized()
            sections.append(len(vertices))
            vertices.extend(p+side*u+up*v for u,v in [(-.043,-.027),(-.037,-.034),(.037,-.034),
                        (.043,-.027),(.043,.027),(.037,.034),(-.037,.034),(-.043,.027)])
        faces=[tuple(range(8))]
        for base,nextbase in zip(sections,sections[1:]):
            faces.extend((base+i,base+(i+1)%8,nextbase+(i+1)%8,nextbase+i) for i in range(8))
        faces.append(tuple(range(sections[-1],sections[-1]+8)))
        mesh('Rainwater downspout · bent rectangular channel',vertices,faces,paint,structure,True)
        for z in (low_z+.34,(high+low_z)/2,high-.53):
            box('Downspout · retaining band',x-.151,x+.151,
                min(wall_y,near)-.12,max(wall_y,near)+.12,z-.008,z+.008,paint,structure)

    downpipe(.20,3,2.2,0,-1)
    downpipe(22.19,0,-.8,0,-1,-6.8)
    downpipe(40.71,0,-.8,0,-1)
    downpipe(.19,29,29.8,1,1)
    # L1040557 shows white skirt trim immediately above the block on both wings.
    for x0,x1,y,d in ((0,22,3,-1),(22,41,0,-1)):
        near,far=sorted((y+d*.019,y+d*.119))
        box('White trim · sill belt',x0,x1,near,far,main-.293,main-.158,trim,structure)
    box('White trim · returning sill belt',21.919,22.005,.02,2.99,main-.293,main-.158,trim,structure)

    # Chamfered timber sign to the right of the downspout, with the owner's
    # actual black "40" on varnished wood, rectified from L1040557.
    cx=23.17;cz=.51;w,h=.378,.162
    rim=[(-.43,-.5),(.43,-.5),(.50,-.28),(.50,.29),(.43,.5),(-.43,.5),(-.50,.29),(-.50,-.28)]
    pts=[(cx+u*w/ft,-.091,cz+v*h) for u,v in rim]
    bv=[point(x,-.011,z) for x,_,z in pts]+[point(*p) for p in pts]
    count=len(rim)
    mesh('Street number · bevelled timber plaque',bv,
        [tuple(range(count))]+[(i,(i+1)%count,count+(i+1)%count,count+i) for i in range(count)],wood,structure)
    photo_surface('Street number · 40','Front number plaque.jpg',pts,[(u+.5,v+.5) for u,v in rim])
