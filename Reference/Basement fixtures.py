"""Downstairs powder room and laundry, in the local frame of Remaining interior.py.

IMG_4398 establishes the WC opposite a compact sink cabinet. The owner's
marked photo and later installation photos show the enclosed corner, open
paneled door, graphite combination washer/dryer and freestanding shelving.
"""
def build_basement_fixtures():
    from math import pi, sin, cos

    slab_z = base + .025
    wall_top = base + 2.46
    paint = material('Powder room | warm white eggshell', '#dddeda', rough=.81)
    trim_white = material('Powder room | white satin casing', '#ebece7', rough=.52)
    vitreous = material('Powder room | glazed china', '#f2f1e9', rough=.20)
    resin = material('Powder room | molded seat', '#e4e5dd', rough=.36)
    chrome = material('Basement | polished chrome', '#c3cdce', metal=.84, rough=.18)
    rubber = material('Basement | rubber gaskets', '#282a29', rough=.83)
    tub_water = material('Powder room | water in trap', '#889a8f', metal=.25, rough=.12)
    graphite = material('Laundry | graphite enamel', '#69635e', metal=.45, rough=.30)
    brushed = material('Laundry | brushed nickel', '#a49f98', metal=.74, rough=.25)
    dark_glass = material('Laundry | smoked porthole glass', '#424642', metal=.20, rough=.12)
    glass_shader = dark_glass.node_tree.nodes.get('Principled BSDF')
    glass_shader.inputs['Alpha'].default_value = .61
    if hasattr(dark_glass, 'surface_render_method'):
        dark_glass.surface_render_method = 'BLENDED'
    drum_steel = material('Laundry | drum stainless', '#858782', metal=.70, rough=.38)
    control = material('Laundry | display glass', '#222728', metal=.20, rough=.19)
    blue = material('Laundry | blue detergent bottle', '#3587ad', rough=.35)

    def strip(builder, rings, materials, smooth=True):
        """Join ordered rings of metric points into molded or pressed surfaces."""
        rows = [[builder.vert(p) for p in ring] for ring in rings]
        for row, following, surface in zip(rows, rows[1:], materials):
            for j in range(len(row)):
                k = (j + 1) % len(row)
                builder.face([row[j], row[k], following[k], following[j]], surface, smooth=smooth)
        return rows

    def oval(cx, cy, z, rx, ry, count=48):
        return [(cx + rx*cos(2*pi*j/count), cy + ry*sin(2*pi*j/count), z) for j in range(count)]

    # The rear foundation and plant-room partition form two sides of the bath.
    # Build only the two new returns shown in the owner's red outline.
    front,back = 30.55,35.55
    south,north = 20.17,25.76
    jamb_low,jamb_high = 21.63,24.43
    head = slab_z + 2.015
    walls = group('Basement powder room | enclosure, trim and open door')
    for name,x0,x1,y0,y1 in [
        ('Side',front-.10,back,south-.10,south+.10),
        ('FrontR',front-.10,front+.10,south+.10,jamb_low),
        ('FrontL',front-.10,front+.10,jamb_high,north),
    ]:
        bx(walls,x0,x1,y0,y1,base+.013,wall_top,paint)
        collider('BasementPowder'+name,x0,x1,y0,y1,base+.013,wall_top)
    bx(walls,front-.10,front+.10,jamb_low,jamb_high,head,wall_top,paint)
    for edge in (south-.145,south+.10):
        bx(walls,front-.10,back,edge,edge+.045,slab_z,slab_z+.074,trim_white)
    for y0,y1 in ((south-.10,jamb_low-.16),(jamb_high+.16,north)):
        for x0 in (front-.145,front+.10):
            bx(walls,x0,x0+.045,y0,y1,slab_z,slab_z+.074,trim_white)
    for y0,y1 in ((jamb_low-.16,jamb_low),(jamb_high,jamb_high+.16)):
        bx(walls,front-.14,front+.14,y0,y1,slab_z,head+.057,trim_white)
    bx(walls,front-.14,front+.14,jamb_low,jamb_high,head,head+.057,trim_white)
    # The white six-panel door projects toward the viewer left of the opening.
    # Keep the leaf on the approach side of the hinge and out of the WC aisle.
    hinge_x,hinge_y = front-.14,jamb_high-.04
    end_x = hinge_x-2.71
    bx(walls,end_x,hinge_x,hinge_y-.065,hinge_y+.065,slab_z+.018,head-.018,trim_white)
    for x0,x1 in ((end_x+.20,end_x+1.30),(end_x+1.43,hinge_x-.20)):
        for z0,z1 in ((.20,.78),(.94,1.52),(1.64,1.83)):
            for yr in (hinge_y-.073,hinge_y+.065):
                bx(walls,x0,x1,yr,yr+.008,slab_z+z0,slab_z+z1,paint)
    for z in (.25,.98,1.77):
        cyl(walls,hinge_x,hinge_y+.075,slab_z+z,slab_z+z+.08,.007,chrome,12)
    for side in (-1,1):
        line(walls,(end_x+.25,hinge_y+side*.063,slab_z+.93),
                   (end_x+.25,hinge_y+side*.174,slab_z+.93),.020,chrome,16)
        line(walls,(end_x+.25,hinge_y+side*.14,slab_z+.93),
                   (end_x+.25,hinge_y+side*.21,slab_z+.93),.026,chrome,20)
    collider('BasementPowderOpenDoor',end_x,hinge_x,hinge_y-.065,hinge_y+.065,slab_z,head)
    light_x,light_y=33.15,22.86
    cyl(walls,light_x,light_y,wall_top-.030,wall_top-.005,.150,brushed,48)
    finish(walls)
    # The finished-room boards run straight through the bath doorway.
    bath_floor=flat('WalkSurface_BasementBathroomFloor',front+.10,back,south+.10,north,slab_z+.004,empty)
    bath_floor.hide_render=True
    bath_floor.display_type='WIRE'
    diffuser=group('BasementLamp_Bathroom',(light_x,light_y,wall_top-.047))
    shade=material('Powder room | opal ceiling diffuser','#fff4dd',rough=.42)
    shader=shade.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value=(1,.84,.65,1)
    shader.inputs['Emission Strength'].default_value=1.0
    diffuser.beam((0,0,-.017),(0,0,.017),.134,shade,48,.144)
    finish(diffuser)

    # Local metric frame: +X points out from the cistern toward the vanity.
    wc = group('Basement powder room | dual-flush toilet with raised seat',(34.27,25.56,slab_z+.001),yaw=-90)
    wc.cube((.097,0,.570),(.190,.379,.368),vitreous,8)
    wc.cube((.099,0,.756),(.199,.39,.034),vitreous,8)
    wc.beam((.102,0,.770),(.102,0,.777),.0255,chrome,32)
    wc.beam((.102,0,.777),(.102,0,.779),.020,brushed,32)
    wc.beam((.093,-.017,.7794),(.110,.017,.7794),.0009,rubber,6)
    bowl = [
        (.309,0,.193,.145),(.298,.055,.201,.151),(.295,.123,.182,.127),
        (.303,.225,.170,.126),(.328,.282,.217,.165),(.349,.357,.239,.178),
        (.354,.395,.240,.178),(.355,.404,.228,.165),(.355,.399,.199,.138),
        (.352,.368,.184,.124),(.342,.322,.151,.103),(.314,.258,.091,.075),
        (.292,.236,.057,.048),(.286,.217,.036,.032),
    ]
    bowl_rows = strip(wc,[oval(x,0,z,rx,ry) for x,z,rx,ry in bowl],[vitreous]*(len(bowl)-1))
    wc.face(bowl_rows[0][::-1],vitreous)
    wc.face(bowl_rows[-1],tub_water)
    wc.beam((.219,-.131,.406),(.219,.131,.406),.011,chrome,16)
    # Actual aperture and four stand-offs are visible in the reference photo.
    def upright_ring(radius_h,radius_w,depth):
        ring=[]
        for j in range(48):
            t=2*pi*j/48
            up=.205+radius_h*cos(t)
            ring.append((.221-.065*up+depth,radius_w*sin(t),.415+up))
        return list(reversed(ring))
    outlines = [(.201,.172,.000),(.204,.174,.010),(.202,.172,.021),
                (.152,.118,.021),(.150,.116,.010),(.152,.118,.000),(.201,.172,.000)]
    strip(wc,[upright_ring(*p) for p in outlines],[resin]*(len(outlines)-1))
    for z,y in ((.476,-.096),(.476,.096),(.687,-.139),(.687,.139)):
        x=.242-.065*(z-.415)
        wc.cube((x,y,z),(.011,.012,.034),trim_white,4)
    wc.beam((.008,-.150,.147),(.059,-.150,.147),.010,chrome,12)
    wc.beam((.013,-.150,.147),(.018,-.150,.147),.026,chrome,16)
    wc.tube([(.055,-.15,.147),(.082,-.157,.137),(.115,-.160,.165),(.118,-.158,.375)],.006,brushed,8)
    finish(wc)
    collider('BasementPowderToilet',33.62,34.92,23.60,25.56,slab_z,slab_z+.78)

    # The top is an annulus around a real recessed basin. The cabinet has
    # only side panels at bowl height, so looking down reveals the drain.
    vx,vy=33.44,20.99
    sink=group('Basement powder room | vanity, molded basin and chrome mixer',(vx,vy,slab_z+.001),yaw=-90)
    sink.cube((.008,0,.054),(.358,.769,.102),trim_white)
    sink.cube((.006,0,.110),(.397,.796,.024),paint)
    for y in (-.400,.400):
        sink.cube((.005,y,.454),(.428,.018,.702),trim_white)
    sink.cube((-.200,0,.412),(.023,.812,.642),trim_white)
    for y in (-.203,.203):
        sink.cube((-.216,y,.433),(.022,.393,.619),paint)
        for yy in (y-.176,y+.176):
            sink.cube((-.232,yy,.433),(.014,.040,.619),trim_white)
        for z in (.148,.718):
            sink.cube((-.232,y,z),(.014,.316,.049),trim_white)
    for y in (-.043,.043):
        sink.beam((-.230,y,.626),(-.247,y,.626),.007,chrome,12)
        sink.beam((-.247,y,.626),(-.254,y,.626),.013,chrome,16)
    def countertop_edge(z):
        ring=[]
        for j in range(48):
            t=2*pi*j/48
            c,s=cos(t),sin(t)
            scale=1/max(abs(c),abs(s))
            ring.append((-.005+.229*c*scale,.430*s*scale,z))
        return ring
    basin = [countertop_edge(.786),countertop_edge(.817),oval(-.040,0,.817,.155,.241),
             oval(-.040,0,.811,.146,.231),oval(-.041,0,.764,.121,.183),
             oval(-.015,0,.713,.058,.068),oval(-.002,0,.707,.018,.020)]
    sink_rows=strip(sink,basin,[vitreous]*(len(basin)-1))
    sink.face(sink_rows[-1],chrome)
    sink.beam((-.002,0,.706),(-.002,0,.710),.018,chrome,24)
    sink.cube((.214,0,.847),(.019,.861,.065),vitreous,8)
    sink.cube((.156,0,.821),(.074,.181,.011),chrome,6)
    sink.tube([(.155,0,.822),(.155,0,.889),(.146,0,.928),(.127,0,.948),
               (.095,0,.957),(.061,0,.950),(.034,0,.931),(.030,0,.917)],.0108,chrome,14)
    for s in (-1,1):
        sink.beam((.154,s*.067,.823),(.154,s*.067,.857),.016,chrome,16)
        sink.beam((.153,s*.067,.854),(.126,s*.101,.859),.008,chrome,12)
        sink.beam((.248,s*.070,.495),(.186,s*.070,.495),.008,chrome,12)
        sink.beam((.186,s*.070,.495),(.186,s*.070,.515),.011,brass2,12)
        sink.tube([(.186,s*.070,.515),(.163,s*.070,.535),
                   (.140,s*.087,.634),(.155,s*.067,.809)],.0055,brushed,8)
    waste=[(-.002,0,.707),(-.002,0,.539),(.004,0,.501),(.025,0,.479),
           (.056,0,.478),(.079,0,.497),(.086,0,.531),(.098,0,.555),(.248,0,.555)]
    sink.tube(waste,.018,trim_white,14)
    for x,z in ((-.002,.555),(.086,.532)):
        sink.beam((x,0,z-.009),(x,0,z+.009),.025,trim_white,12)
    # Photo includes the outlet on the right above the backsplash.
    sink.cube((.214,.261,1.132),(.010,.071,.112),trim_white)
    for z in (1.107,1.153):
        for y in (.253,.270):
            sink.cube((.207,y,z),(.004,.002,.012),rubber)
    finish(sink)
    collider('BasementPowderVanity',32.01,34.87,20.25,21.77,slab_z,slab_z+.858)

    # Recess the graphite machine behind the face of the powder room.
    # The appliance front looks across the common room towards local -X.
    wx,wy=34.02,18.55
    machine=group('Basement laundry | graphite front-loading wash and dry combo',(wx,wy,slab_z),yaw=-90)
    for x in (-.287,.287):
        for y in (-.310,.310):
            machine.beam((x,y,0),(x,y,.031),.029,rubber,12)
    machine.cube((0,0,.520),(.688,.742,.980),graphite,24)
    # Separate front skin and bottom service flap retain the square fascia.
    machine.cube((0,-.371,.525),(.681,.016,.964),graphite)
    machine.cube((-.214,-.382,.116),(.168,.007,.116),rubber)
    machine.cube((-.214,-.386,.116),(.163,.005,.111),graphite)
    machine.cube((-.214,-.389,.164),(.021,.003,.005),rubber)
    def door_ring(radius,y):
        return [(radius*cos(2*pi*j/64),y,.580+radius*sin(2*pi*j/64)) for j in range(64)]
    # Pressed metal drum, rubber bellows, slender bezel and convex smoked glass.
    rings = [(.299,-.381),(.306,-.388),(.307,-.400),(.299,-.411),(.291,-.413),
             (.254,-.401),(.244,-.392),(.221,-.388),(.189,-.391),(.163,-.393)]
    strip(machine,[door_ring(*r) for r in rings],[brushed,brushed,brushed,control,control,rubber,rubber,drum_steel,drum_steel])
    drum_rows=strip(machine,[door_ring(.164,-.393),door_ring(.038,-.396)],[drum_steel])
    machine.face(drum_rows[-1],drum_steel)
    for j in range(3):
        t=(j+.15)*2*pi/3
        machine.beam((.12*cos(t),-.397,.58+.12*sin(t)),(.20*cos(t+.16),-.397,.58+.20*sin(t+.16)),.011,brushed,10)
    for j in range(32):
        a=2*pi*j/32
        machine.beam((.153*cos(a),-.398,.580+.153*sin(a)),(.153*cos(a),-.399,.580+.153*sin(a)),.0029,control,6)
    lens=strip(machine,[door_ring(.291,-.412),door_ring(.258,-.424),door_ring(.122,-.433),door_ring(.018,-.435)],[dark_glass]*3)
    machine.face(lens[-1],dark_glass)
    # Lens back sees the front skin through its tinted surface; all drum parts
    # sit ahead of that skin to keep the reveal visible in the web renderer.
    machine.cube((-.220,-.381,.946),(.211,.005,.097),rubber)
    machine.cube((-.220,-.385,.946),(.207,.005,.093),graphite)
    machine.cube((-.219,-.390,.932),(.136,.006,.020),control)
    machine.cube((-.219,-.394,.941),(.126,.003,.004),brushed)
    machine.beam((0,-.380,.946),(0,-.405,.946),.045,brushed,36)
    machine.beam((0,-.405,.946),(0,-.408,.946),.039,control,36)
    for x in (-.074,.077):
        machine.beam((x,-.380,.946),(x,-.384,.946),.0115,brushed,18)
    machine.cube((.211,-.383,.947),(.173,.006,.045),control)
    # Small color badge and fine silver inlay under the detergent drawer.
    machine.cube((-.304,-.383,.855),(.025,.003,.043),blue)
    machine.cube((-.304,-.385,.846),(.020,.002,.010),trim_white)
    finish(machine)

    collider('BasementLaundryCombo',wx-1.44,wx+1.23,wy-1.14,wy+1.14,slab_z,slab_z+1.015)

    bottles=group('Basement laundry | detergent on washer',(wx+.42,wy+.60,slab_z+1.012))
    for x,y,height,body in ((0,0,.22,blue),(.079,-.086,.16,trim_white)):
        bottles.cube((x,y,height/2),(.084,.065,height),body,6)
        bottles.beam((x+.012,y,height-.012),(x+.012,y,height+.015),.021,body,16,.016)
        bottles.beam((x+.012,y,height+.015),(x+.012,y,height+.031),.019,trim_white,16)
        bottles.cube((x-.042,y,height*.52),(.002,.043,height*.42),trim_white,4)
    finish(bottles)

    # Separate shelving has four black molded trays and the conspicuous
    # yellow ends in the finished room photo. Leave its open bays visible.
    rack_x,rack_y=34.75,15.40
    rack=group('Basement laundry | black and yellow storage shelves',(rack_x,rack_y,slab_z))
    rack_black=material('Laundry shelf | charcoal resin','#272a29',rough=.59)
    rack_yellow=material('Laundry shelf | ochre yellow ends','#e5ad27',rough=.48)
    for x in (-.192,.192):
        for y in (-.453,.453):
            rack.cube((x,y,.825),(.040,.043,1.65),rack_black)
            rack.cube((x,y,.024),(.058,.061,.048),rack_black)
    for z in (.10,.60,1.10,1.60):
        rack.cube((0,0,z+.022),(.447,.967,.044),rack_black)
        for side in (-1,1):
            rack.cube((side*.214,0,z-.004),(.022,.971,.049),rack_black)
            rack.cube((0,side*.478,z+.003),(.451,.025,.060),rack_yellow)
        for i in range(9):
            rack.cube((0,-.39+i*.0975,z+.045),(.402,.014,.004),rack_black)
    finish(rack)
    collider('BasementLaundryShelf',34.00,35.50,13.78,17.02,slab_z,slab_z+1.65)

    # The plumbing system ends at these three rough-in centers in the new wall.
    hookups=group('Basement laundry | washer supply and drain box',(35.50,19.30,slab_z),yaw=-90)
    hookups.cube((0,0,1.258),(.221,.035,.189),trim_white)
    hookups.cube((0,-.021,1.254),(.187,.012,.155),sinkgrey)
    for x,cap in ((-.060,blue),(.060,plaidA)):
        hookups.beam((x,-.026,1.212),(x,-.026,1.282),.009,brass2,12)
        hookups.beam((x,-.027,1.253),(x,-.065,1.253),.011,brass2,12)
        hookups.cube((x,-.035,1.285),(.038,.011,.007),cap)
        hookups.beam((x,-.065,1.253),(x,-.078,1.251),.014,brushed,8)
        inlet=.18 if x<0 else .28
        hookups.tube([(x,-.075,1.251),(x,-.088,1.209),
                      (x+.02,-.063,1.044),(inlet-.10,-.048,.76),
                      (inlet-.032,-.046,.71),(inlet,-.060,.73),
                      (inlet,-.081,.82)],.008,rubber,9)
        hookups.beam((inlet,-.077,.82),(inlet,-.084,.82),.014,brushed,12)
    hookups.beam((0,-.029,1.191),(0,-.029,1.207),.021,trim_white,16)
    hookups.tube([(0,-.029,1.202),(0,-.030,1.275),(.020,-.050,1.307),
                  (.053,-.078,1.289),(.09,-.077,1.240),(.216,-.064,1.045),
                  (.310,-.043,.805),(.347,-.045,.625),(.355,-.081,.61)],.014,rubber,12)
    finish(hookups)

build_basement_fixtures()
