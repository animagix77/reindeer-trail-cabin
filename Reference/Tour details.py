"""Finish the cabin shell, build the tour's living-room navigation, and light each space."""
def build_details():
    from mathutils import Vector
    details=coll('14 · Architectural details')
    nav=coll('15 · Tour navigation')
    def helper(name,points,faces):
        ob=mesh(name,points,faces,None,nav)
        ob.hide_render=True;ob.display_type='WIRE';return ob
    def navface(name,pts):return helper('WalkSurface_'+name,[point(*p) for p in pts],[tuple(range(len(pts)))])
    def rectangle(name,x0,x1,y0,y1,h):return navface(name,[(x0,y0,h),(x1,y0,h),(x1,y1,h),(x0,y1,h)])
    def blocker(name,x0,x1,y0,y1,h0,h1):
        ob=box('WalkBlock_'+name,x0,x1,y0,y1,main+h0,main+h1,None,nav)
        ob.hide_render=True;ob.display_type='WIRE'
    # Three rectangular surfaces faithfully cover the staggered appraisal outline.
    rectangle('MainFloor_west',22,41,0,26,.017)
    rectangle('MainFloor_middle',21,22,3,26,.017)
    rectangle('MainFloor_east',0,21,3,29,.017)
    rectangle('LoftLanding',.18,front,7.05,28.67,loftdeck+.01)
    # 10 open risers; a continuous navigation ramp suppresses eye-height bobbing.
    navface('LoftStair',[(sx0+.38,stair_y0,.02),(sx0+.38,stair_y1,.02),
                         (front-.10,stair_y1,loftdeck+.01),(front-.10,stair_y0,loftdeck+.01)])
    for j in range(10):
        a=j/10;b=(j+1)/10
        x0=sx0+(front-sx0)*b;x1=sx0+(front-sx0)*a
        blocker('LoftStairGuard'+str(j),x0,x1,guard-.11,guard+.11,loftdeck*a+.04,loftdeck*b+.77)
    blocker('LoftOpenEdge',front-.13,front+.08,guard+.15,28.72,loftdeck,loftdeck+.88)
    blocker('LoftEaveNorth',.18,front,6.95,7.30,loftdeck,loftdeck+1.7)
    # The roof drops toward the eaves. Follow the underside closely enough for
    # a visitor to duck with the pitch and stop before reaching the low edges.
    for i in range(43):
        ya=7.0+i*.5
        yb=ya+.5
        bottom=min(top(u,v) for u in (.18,sx0+.42) for v in (ya,yb))-.035
        blocker(f'PitchedCeiling_{i:02}',.18,sx0+.42,ya,yb,bottom,max(5.1,bottom+.05))
    # Narrow landing beside a low mattress is kept clear for turning at the top.
    blocker('LoftMattress',*loft_bed_bounds,loftdeck+.01,loftdeck+.29)
    blocker('LoftReadingLantern',.39,1.19,20.35,21.15,loftdeck+.005,loftdeck+.42)
    # Living room wall except for the swing-clear opening seen to the right of the television.
    blocker('LivingNorthA',.1,1.99,15.16,15.29,0,2.06)
    blocker('LivingNorthB',4.91,20.8,15.16,15.29,0,2.06)
    for label,x0,x1,y0,y1,h in [
      ('GableSofa',.48,3.36,18.71,25.69,.88),('CurtainSofa',7.9,13.22,25.69,28.52,.88),
      ('CoffeeChest',5.74,9.56,21.58,23.42,.52),('SideChest',14.66,16.38,26.1,27.77,.54),
      ('Curio',.54,2.0,26.92,28.25,1.80),('MediaConsole',5.31,9.93,15.34,16.5,.60),
      ('Hearth',16.62,20.89,25.0,28.75,1.08)]:
        blocker(label,x0,x1,y0,y1,.018,h)
    # Interior trim at the owner-confirmed living-room entrance to the bunk bedroom.
    for x in [2.0,4.9]:
        box('Bunk room opening · casing',x-.085,x+.085,15.24,15.36,main+.02,main+1.98,white,details)
    box('Bunk room opening · lintel',1.87,5.03,15.24,15.36,main+1.94,main+2.0,white,details)
    exterior_dir=work/'Exterior materials';interior_dir=work/'Interior materials'
    def image_node(mm,path,normal=False):
        im=bpy.data.images.load(str(path),check_existing=True);im.pack()
        if normal:im.colorspace_settings.name='Non-Color'
        n=mm.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;return n
    def setmap(m,path,normal_path,strength):
        bs=m.node_tree.nodes.get('Principled BSDF');nt=m.node_tree
        if path:
            tex=image_node(m,path);nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        n=image_node(m,normal_path,True);nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength
        nt.links.new(n.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    for mm,filename in [(shingle,'Graphite roof shingles'),(foundation,'Gray painted block')]:
        setmap(mm,exterior_dir/(filename+'.jpg'),exterior_dir/(filename+' normal.jpg'),.6)
    cedar=mat('Entry wing · blue cedar shakes','#394b5d')
    setmap(cedar,exterior_dir/'Blue cedar shingles.jpg',exterior_dir/'Blue cedar shingles normal.jpg',.54)
    def planarUV(obj,scale,roof_mode=False):
        me=obj.data;uv=me.uv_layers.active or me.uv_layers.new(name='Architectural material')
        for f in me.polygons:
            coords=[local(obj.matrix_world@me.vertices[me.loops[i].vertex_index].co) for i in f.loop_indices]
            w=max(p[0] for p in coords)-min(p[0] for p in coords)
            d=max(p[1] for p in coords)-min(p[1] for p in coords)
            for idx,(u,v,h) in zip(f.loop_indices,coords):
                uv.data[idx].uv=(u*ft/scale,v*ft/(scale*.95)) if roof_mode else ((u if w>d else v)*ft/scale,h/scale)
    for ob in list(structure.objects)+list(roof.objects)+list(inter.objects):
        if ob.type!='MESH' or not ob.data.polygons or not ob.data.materials:continue
        m=ob.data.materials[0]
        if m==shingle:planarUV(ob,1.63,True)
        elif m==foundation:planarUV(ob,1.65)
        elif m==siding and ob.name.startswith(('Exterior · wall 3','Exterior · wall 4','Exterior · wall 5','Entry gable')):
            ob.data.materials[0]=cedar;planarUV(ob,1.14)
    for material,fn in [(flank,'Living room - weathered plank'),(lining,'Loft - amber tongue and groove'),(oak,'Joinery - warm oak')]:
        setmap(material,None,interior_dir/(fn+' normal.jpg'),.35)
    for suffix in ['Storage table stained oak','Storage table edge grain']:
        mm=bpy.data.materials.get('Cabin furnishing • '+suffix)
        if mm:setmap(mm,None,interior_dir/'Coffee table - stained oak normal.jpg',.5)
    # Roof vent aligned to the existing propane flue below it.
    def tube(name,x,y,z0,z1,r,m,c):
        pts=[]
        for z in (z0,z1):
            for j in range(24):
                a=math.tau*j/24;pts.append(point(x+math.cos(a)*r/ft,y+math.sin(a)*r/ft,z))
        return mesh(name,pts,[tuple(reversed(range(24))),tuple(range(24,48))]+[(i,(i+1)%24,(i+1)%24+24,i+24) for i in range(24)],m,c,True)
    iron=mat('Vent · blued iron','#403e39',.60,.42)
    xx,yy=19.42,27.42;zr=roofZ(xx,yy,1)-main
    tube('Roof · flue flashing',xx,yy,zr-.12,zr+.08,.205,iron,roof)
    tube('Roof · flue',xx,yy,zr,zr+.59,.119,iron,roof)
    tube('Roof · chimney collar',xx,yy,zr+.50,zr+.62,.145,iron,roof)
    tube('Roof · rain cap',xx,yy,zr+.64,zr+.67,.175,iron,roof)
    # Warmth from the real entrances, fixtures and windows; render rig lights
    # do not get duplicated in the Three.js real-time lighting system.
    x0,x1,lo,hi=dining_window
    sash_x=(x0+x1)/2
    sash_h=(lo+hi)/2
    sash_light_width=min((x1-x0)*ft,hi-lo)-.12
    for name,xyz,target,power,size,color in [
        ('Kitchen window',(39.9,21.8,1.56),(32,20,1),110,1.4,(1,.96,.84)),
        ('Island pendant · sink side',(32.82,18.40,1.83),(32.82,18.40,.92),32,.65,(1,.84,.65)),
        ('Island pendant · patio side',(32.82,21.70,1.83),(32.82,21.70,.92),32,.65,(1,.84,.65)),
        ('Dining window',(sash_x,25.1,sash_h),(sash_x,19,sash_h-.24),90,sash_light_width,(1,.93,.82)),
        ('Bedroom queen',(20.2,9.7,1.68),(16,11,.8),125,1.7,(1,.96,.9)),
        ('Bedroom double',(39.8,4,1.61),(36,8.2,.8),92,1.35,(1,.94,.86)),
        ('Bedroom bunk',(1,10.4,1.66),(4,6.4,1.1),85,1.6,(.92,.97,1)),
        ('Bathroom window',(25.6,.4,1.71),(26,6,.8),44,.87,(.95,.98,1)),
        ('Foyer',(30.7,1,1.88),(24.5,4.6,1.1),56,1.2,(1,.88,.72)),
        ('Rear porch',(32,26.7,2.15),(32,32,.8),35,1.6,(1,.86,.65))]:
        area_light(name,xyz,target,power,size,color)
    return details,nav
details_extra,living_nav=build_details()
