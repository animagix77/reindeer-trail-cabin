# The owner places the grill on the cabin side, right of the steps when looking
# toward the landing from the deck. IMG_3953 shows a four-burner Nexgrill with
# a fifth control on the covered right shelf. Absolute dimensions are inferred.
def build_deck_barbecue():
    # The hinged dial and rolled cover sweep 0.573 m behind the grate center.
    # Keep that full sweep inside the short guard while the steps stay to the left.
    centre_x, centre_y = 38.49, 28.82
    enamel = mat('Grill · porcelain enamel', '#252b2b', .34, .24)
    iron = mat('Grill · cast firebox', '#383b39', .42, .49)
    steel = mat('Grill · brushed stainless', '#bec2bf', .64, .37)
    rubber = mat('Grill · black rubber', '#282926', .02, .66)
    dial = mat('Grill · thermometer face', '#e3e3cf', .06, .46)
    marker = mat('Grill · temperature needle', '#a13e30', .05, .4)

    def place(width, depth, height):
        return Vector(pos(centre_x + depth / ft, centre_y + width / ft, dp + height))

    def extrusion(label, left, right, profile, material):
        count = len(profile)
        vertices = [place(u,d,h) for u in (left,right) for d,h in profile]
        faces = [tuple(range(count)), tuple(range(count,2*count))]
        faces.extend((i,(i+1)%count,count+(i+1)%count,count+i) for i in range(count))
        return mesh(label,vertices,faces,material,deck,True)

    def box(label,left,right,front,back,base,top,material):
        return extrusion(label,left,right,[(front,base),(back,base),(back,top),(front,top)],material)

    def rod(label,start,end,radius,material,sides=20):
        a,b=place(*start),place(*end)
        axis=(b-a).normalized()
        cross=axis.cross(Vector((0,0,1)) if abs(axis.z)<.9 else Vector((1,0,0))).normalized()
        normal=axis.cross(cross)
        verts=[origin+radius*(cross*math.cos(math.tau*i/sides)+normal*math.sin(math.tau*i/sides))
               for origin in (a,b) for i in range(sides)]
        faces=[tuple(range(sides)),tuple(range(sides,2*sides))]
        faces.extend((i,(i+1)%sides,sides+(i+1)%sides,sides+i) for i in range(sides))
        return mesh('Barbecue · '+label,verts,faces,material,deck,True)

    def finish_from_photo(name, file, vertices, faces, uv, metal, rough, transparent=False):
        material=mat(name+' · photographed finish','#a9a9a9',metal,rough)
        shader=material.node_tree.nodes.get('Principled BSDF')
        tex=material.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(work/'Exterior materials'/file),check_existing=True)
        tex.image.pack()
        material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        if transparent:
            material.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
        obj=mesh('Barbecue · '+name,vertices,faces,material,deck)
        layer=obj.data.uv_layers.new(name='Owner photo detail')
        for loop in obj.data.loops:
            layer.data[loop.index].uv=uv[loop.vertex_index]

    # Brushed steel, with a short upright skirt below the rolled cover.
    # An open firebox and folded lid share a real hinge with the walkthrough.
    front,back=-.240,.233
    box('Barbecue · heat tray',-.345,.345,front,back,.685,.698,iron)
    for wall_depth in (front,back-.009):
        box('Barbecue · firebox rim',-.345,.345,wall_depth,wall_depth+.009,.698,.879,iron)
    for wall_x in (-.345,.336):
        box('Barbecue · firebox cheek',wall_x,wall_x+.009,front,back,.698,.879,iron)
    for i in range(26):
        u=-.312+i*.025
        rod('seasoned iron grate',(u,-.218,.873),(u,.210,.873),.0048,iron,10)
    for dbar in (-.204,0,.198):
        rod('grate crossbar',(-.325,dbar,.866),(.325,dbar,.866),.005,iron,10)
    for u in (-.24,-.08,.08,.24):
        extrusion('Barbecue · burner heat tent',u-.047,u+.047,[(-.20,.798),(.19,.798),(.19,.806),(-.20,.806)],iron)
    def anchor(label,coordinates):
        obj=bpy.data.objects.new(label,None)
        deck.objects.link(obj)
        obj.location=place(*coordinates)
        obj.empty_display_size=.035
        return obj
    anchor('GrillSurface',(0,0,.879))
    anchor('GrillWidthAxis',(1,0,.879))
    hinge=anchor('GrillLidHinge',(0,.228,.880))
    before=set(deck.objects)
    outer=[(-.248,.870),(-.248,.932)]
    outer += [(-.006+.242*math.cos(theta),.932+.254*math.sin(theta))
              for theta in [math.pi*(1-i/32) for i in range(1,33)]]
    outer.append((.236,.870))
    inner=[(d*.976,.932+(h-.932)*.975-.002) for d,h in reversed(outer)]
    extrusion('Barbecue · brushed stainless roll hood',-.326,.326,outer+inner,steel)
    hood=outer
    for sign in (-1,1):
        extrusion('Barbecue · formed hood end',sign*.326,sign*.349,hood,steel)
        rod('handle socket',(sign*.276,-.246,.915),(sign*.276,-.261,.915),.021,iron)
        rod('handle return',(sign*.276,-.254,.915),(sign*.276,-.305,.919),.012,steel)
    rod('rolled stainless handle',(-.278,-.305,.919),(.278,-.305,.919),.013,steel)
    # The top-mounted dial and embossed badge sit tangent to the arched cover.
    theta=2.17
    d=-.006+.242*math.cos(theta);h=.932+.254*math.sin(theta)
    rod('dial rim',(0,d,h),(0,d-.008,h+.013),.037,steel,32)
    rod('dial glass',(0,d-.008,h+.013),(0,d-.009,h+.015),.030,iron,32)
    rod('dial indicator',(-.012,d-.011,h+.010),(.007,d-.007,h+.023),.0018,marker,8)
    verts=[];uv=[];faces=[]
    for i in range(6):
        theta=2.62-.205*i/5
        d=-.006+.243*math.cos(theta);h=.932+.255*math.sin(theta)
        verts.extend([place(.112,d,h),place(-.112,d,h)]);uv.extend([(0,i/5),(1,i/5)])
        if i:faces.append((2*i-2,2*i-1,2*i+1,2*i))
    finish_from_photo('embossed Nexgrill badge','Nexgrill embossed badge.png',verts,faces,uv,.42,.48,True)

    # Mesh vertices are authored in world coordinates. Keep them in place at
    # rest while exposing the hinge axis to renderers that animate the lid.
    bpy.context.view_layer.update()
    inverse=hinge.matrix_world.inverted()
    for part in set(deck.objects)-before:
        part.parent=hinge
        part.matrix_parent_inverse=inverse

    box('Barbecue · black control fascia',-.349,.349,-.252,-.205,.688,.868,enamel)
    corners=[place(.347,-.2529,.688),place(-.347,-.2529,.688),place(-.347,-.2529,.867),place(.347,-.2529,.867)]
    finish_from_photo('burner control markings','Nexgrill control markings.jpg',corners,[(0,1,2,3)],[(0,0),(1,0),(1,1),(0,1)],.14,.56)
    for sign in (-1,1):
        # Both black shelves have a full-depth front valance. The right one
        # houses the side burner and has a distinct recessed rectangular lid.
        box('Barbecue · folded shelf',sign*.349,sign*.699,-.252,.229,.845,.866,enamel)
        box('Barbecue · shelf valance',sign*.349,sign*.699,-.252,-.226,.687,.850,enamel)
        box('Barbecue · shelf end',sign*.675,sign*.699,-.25,.223,.73,.852,enamel)
    box('Barbecue · burner cover recess',-.671,-.384,-.18,.17,.865,.870,rubber)
    box('Barbecue · right side burner lid',-.667,-.388,-.175,.166,.870,.874,iron)
    box('Barbecue · burner lid finger recess',-.559,-.504,-.178,-.16,.873,.875,rubber)
    for u in (.251,.087,-.079,-.239,-.522):
        rod('burner knob bright ring',(u,-.254,.766),(u,-.266,.766),.035,steel,24)
        rod('black burner knob',(u,-.266,.766),(u,-.291,.766),.028,rubber,24)
        box('Barbecue · dial index',u-.002,u+.002,-.292,-.29,.780,.791,dial)
    rod('electronic ignition switch',(.326,-.255,.721),(.326,-.273,.721),.011,steel)

    # Two plain front panels, fixed feet on the left, and two larger wheels on
    # a shared axle on the right. IMG_3953 is taken looking toward the short rail.
    box('Barbecue · black steel cabinet',-.306,.306,-.161,.192,.171,.713,iron)
    for z0,z1 in ((.174,.382),(.385,.697)):
        box('Barbecue · cart front panel',-.282,.282,-.178,-.161,z0,z1,enamel)
    for u in (-.302,.302):
        for dep in (-.164,.17):
            box('Barbecue · square trolley leg',u-.024,u+.024,dep-.022,dep+.022,.061 if u<0 else .015,.704,iron)
            if u>0:
                box('Barbecue · rubber foot',u-.029,u+.029,dep-.026,dep+.026,0,.025,rubber)
            else:
                rod('trolley wheel',(u+.002,dep,.074),(u-.047,dep,.074),.072,rubber,28)
                rod('wheel hub',(u-.047,dep,.074),(u-.050,dep,.074),.030,iron,20)
    brass=mat('Grill · side-burner brass fitting','#928055',.65,.4)
    rod('side burner feed',(-.559,-.04,.705),(-.559,-.04,.615),.009,brass)
    # IMG_7626 and IMG_7627 show the silver exchange cylinder resting on the
    # deck on the cabin side, directly below the fifth control.
    tank=mat('Grill · silver propane bottle','#b6b9b3',.28,.53)
    tank_label=mat('Grill · blue bottle sleeve','#244f83',.1,.62)
    tank_x=-.567;tank_depth=-.022
    bottle=[(.105,.006),(.105,.035),(.080,.037),(.111,.05),(.141,.089),
            (.146,.116),(.146,.304),(.14,.328),(.119,.353),(.084,.372),(.052,.378)]
    verts=[];faces=[]
    for ring,(radius,h) in enumerate(bottle):
        for j in range(32):
            a=j*math.tau/32
            verts.append(place(tank_x+radius*math.cos(a),tank_depth+radius*math.sin(a),h))
        if ring:
            faces.extend(((ring-1)*32+j,(ring-1)*32+(j+1)%32,ring*32+(j+1)%32,ring*32+j) for j in range(32))
    vessel=mesh('Barbecue · exchange cylinder',verts,faces,tank,deck,True)
    vessel.data.materials.append(tank_label)
    for j in range(32):
        if 17<=j<=24:vessel.data.polygons[5*32+j].material_index=1
    rod('valve connection',(tank_x,tank_depth,.367),(tank_x,tank_depth,.417),.017,brass)
    for s in (-1,1):
        box('Barbecue · bottle collar post',tank_x+s*.075-.006,tank_x+s*.075+.006,tank_depth-.025,tank_depth+.04,.357,.465,tank)
    handle=[]
    for j in range(17):
        a=math.pi*j/16
        handle.append((tank_x+.076*math.cos(a),tank_depth+.061*math.sin(a),.46))
    for a,b in zip(handle,handle[1:]):rod('bottle handguard',a,b,.008,tank,8)
    hose=[(-.559,-.04,.615),(-.545,-.044,.546),(-.482,-.05,.482),(-.454,-.052,.443),(-.475,-.043,.420),(tank_x,tank_depth,.407)]
    for a,b in zip(hose,hose[1:]):rod('side burner hose',a,b,.006,rubber,10)
    obstacle=box('WalkBlock_DeckBarbecue',-.699,.699,-.319,.238,0,1.19,None)
    obstacle.display_type='WIRE'
    obstacle.hide_render=True
    # The narrow strip behind the firebox is occupied by the swinging hood
    # when cooking. Its collision width ends at the hood cheeks, before the shelves.
    swept=box('WalkBlock_GrillHoodTravel',-.351,.351,.232,.579,0,1.46,None)
    swept.display_type='WIRE'
    swept.hide_render=True

build_deck_barbecue()
