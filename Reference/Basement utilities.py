"""Basement service equipment. Coordinates in each assembly are metres from the inside of the service wall.

The appraisal shows a tall blue vessel, a separate gray storage heater, and a gray
panel with a left-hinged schedule door. The owner confirms two pressure vessels.
The inspection records copper distribution, a PE well line, PVC waste, a 40 gal
electric heater and 100 A service. The pipe routes, dimensions and individual
fittings below are a visual reconstruction.
"""
def build_basement_utilities():
    import math
    from mathutils import Vector

    wall_x = 40.78
    slab = low - main
    floor_finish = .028
    tank_x = (39.64 - wall_x) * ft
    tank_stations = (14.3, 17.5)
    heater_station = 20.85
    panel_station = 6.9
    blue = material('Well tank · cobalt enamel', '#28599a', .25, .31)
    foot = material('Well tank · dark blue base', '#2f465e', .23, .51)
    copper = material('Water line · aged copper', '#ac7050', .66, .48)
    sleeve = material('Pipe fittings · soldered copper', '#be8564', .61, .42)
    polymer = material('Well supply · black polyethylene', '#303434', .02, .56)
    heater_gray = material('Water heater · gray enamel', '#a9aaa8', .33, .40)
    panel_gray = material('Service panel · gray baked finish', '#828b8b', .35, .43)
    shadow = material('Service equipment · dark reveals', '#313839', .19, .57)
    lever_blue = material('Well isolation · blue handle', '#346888', .15, .43)
    lever_red = material('Hot line · muted red', '#ae584a', .10, .48)
    label_yellow = material('Heater · muted yellow tag', '#d7b45c', .03, .64)
    pvc = material('Plumbing · light gray PVC', '#d8d8cb', .05, .62)
    directory = material('Panel · faded off-white schedule', '#dad8c8', .01, .80)

    def asset(name, station):
        return group('Basement | ' + name, (wall_x, station, slab + floor_finish))

    def pipe(builder, points, radius, finish_mat, bend=.035, sides=10):
        """Sweep a continuous tube through eased corners with shared, smooth rings."""
        points = [Vector(p) for p in points]
        centers = [points[0]]
        for a, b, c in zip(points, points[1:], points[2:]):
            incoming, outgoing = a-b, c-b
            trim = min(bend, incoming.length * .4, outgoing.length * .4)
            start, end = b + incoming.normalized()*trim, b + outgoing.normalized()*trim
            for step in range(5):
                t = step/4
                centers.append(start*(1-t)**2 + b*(2*t*(1-t)) + end*t*t)
        centers.append(points[-1])
        previous = None
        rings = []
        for i, p in enumerate(centers):
            direction = (centers[min(i+1,len(centers)-1)] - centers[max(0,i-1)]).normalized()
            if previous is None:
                ref = Vector((0,0,1)) if abs(direction.z)<.9 else Vector((0,1,0))
                radial = direction.cross(ref).normalized()
            else:
                radial = (previous - direction * previous.dot(direction)).normalized()
            previous = radial
            other = direction.cross(radial)
            ring = [builder.vert(p + radius*(radial*math.cos(math.tau*j/sides)
                          + other*math.sin(math.tau*j/sides))) for j in range(sides)]
            if rings:
                for j in range(sides):
                    k = (j+1)%sides
                    builder.face((rings[-1][j], rings[-1][k], ring[k], ring[j]), finish_mat, smooth=True)
            rings.append(ring)
        builder.face(rings[0][::-1], finish_mat)
        builder.face(rings[-1], finish_mat)

    def vessel(builder, cx, profile, finish_mat, sides=40):
        """Spin the measured-looking shoulders and rolled lower edges as one smooth skin."""
        rings = []
        for height, radius in profile:
            ring = [builder.vert((cx+radius*math.cos(math.tau*j/sides),
                                  radius*math.sin(math.tau*j/sides), height)) for j in range(sides)]
            if rings:
                for j in range(sides):
                    k = (j+1)%sides
                    builder.face((rings[-1][j], rings[-1][k], ring[k], ring[j]), finish_mat, smooth=True)
            rings.append(ring)
        builder.face(rings[0][::-1], finish_mat)
        builder.face(rings[-1], finish_mat)

    def port(builder, x, y, z, length, radius, finish_mat, sides=12):
        # All front fittings face the visitor in the service aisle.
        builder.beam((x,y,z),(x-length,y,z),radius,finish_mat,sides)

    for index, station in enumerate(tank_stations, 1):
        tank = asset('well pressure tank %d' % index, station)
        vessel(tank, tank_x, [(0,.208),(.013,.221),(.101,.219),(.120,.203)], foot)
        vessel(tank, tank_x, [(.105,.168),(.124,.190),(.159,.221),(.211,.248),
             (.266,.257),(1.105,.257),(1.160,.253),(1.219,.238),
             (1.275,.207),(1.324,.155),(1.352,.095),(1.363,.029)], blue)
        vessel(tank, tank_x, [(.655,.257),(.658,.259),(.663,.260),(.668,.257)], blue)
        tank.beam((tank_x,0,1.363),(tank_x,0,1.377),.012,brass2,12)
        tank.beam((tank_x,0,1.375),(tank_x,0,1.389),.011,polymer,12)
        # Under-shell water fitting and hex union leading out to the shared manifold.
        port(tank,tank_x,0,.083,.227,.020,brass2)
        port(tank,tank_x-.221,0,.083,.038,.027,brass2,6)
        port(tank,tank_x-.255,0,.083,.023,.019,sleeve)
        finish(tank)
        collider('basement_pressure_tank_%d'%index, 38.75,40.54,station-.86,station+.86,
                 slab+.02,slab+1.40)

    heater = asset('40 gallon electric water heater', heater_station)
    vessel(heater,tank_x,[(0,.231),(.020,.251),(.032,.256),(.052,.251),
            (1.340,.251),(1.355,.257),(1.373,.251),(1.390,.220),(1.395,.060)],heater_gray)
    vessel(heater,tank_x,[(.036,.251),(.038,.253),(.043,.253),(.045,.251)],steel)
    # The paired element covers, lower drain and rolled jacket rims read from the aisle.
    for height in (.36,1.054):
        heater.cube((tank_x-.247,0,height),(.027,.123,.184),shadow)
        heater.cube((tank_x-.263,0,height),(.014,.119,.180),heater_gray)
        port(heater,tank_x-.269,0,height+.076,.004,.0044,steel,8)
    port(heater,tank_x-.239,0,.111,.077,.012,brass2)
    port(heater,tank_x-.301,0,.111,.026,.017,brass2,6)
    pipe(heater,[(tank_x-.312,0,.111),(tank_x-.339,0,.111),(tank_x-.353,0,.081)],
                .011,brass2,.014)
    # A curved, unlettered yellow service sticker on the jacket matches the appraisal photo.
    def curved_tag(offset,z,width,height,finish_mat):
        strip = []
        for i in range(7):
            angle = math.pi + offset + width/.252*(i/6-.5)
            x,y = tank_x + .2525*math.cos(angle), .2525*math.sin(angle)
            strip.append((heater.vert((x,y,z)),heater.vert((x,y,z+height))))
            if i:
                heater.face((strip[i-1][0],strip[i][0],strip[i][1],strip[i-1][1]),finish_mat)
    curved_tag(.66,.76,.091,.165,label_yellow)
    # Temperature/pressure relief with side lever and a downturned discharge.
    side_z=1.275
    heater.beam((tank_x,-.222,side_z),(tank_x,-.304,side_z),.017,brass2,10)
    heater.beam((tank_x,-.273,side_z),(tank_x,-.303,side_z),.022,brass2,6)
    heater.cube((tank_x,-.296,side_z+.021),(.015,.060,.008),steel,euler=(.26,0,0))
    pipe(heater,[(tank_x,-.298,side_z),(tank_x,-.327,side_z),(tank_x,-.327,.093)],.012,copper)
    for y,tag in ((-.103,lever_red),(.103,lever_blue)):
        heater.beam((tank_x,y,1.376),(tank_x,y,1.407),.032,tag,22)
        heater.beam((tank_x,y,1.401),(tank_x,y,1.448),.017,brass2,6)
        heater.beam((tank_x,y,1.443),(tank_x,y,1.469),.015,sleeve)
    # A short flexible metallic whip reaches the storage heater's top wiring cover.
    cable_y=.038
    heater.cube((tank_x+.125,cable_y,1.396),(.094,.075,.018),panel_gray)
    heater.beam((tank_x+.125,cable_y,1.402),(tank_x+.125,cable_y,1.430),.015,steel,6)
    pipe(heater,[(tank_x+.125,cable_y,1.420),(tank_x+.125,cable_y,1.493),
                 (-.095,cable_y,1.525),(-.055,cable_y+.083,1.598),
                 (-.055,cable_y+.083,1.68)],.011,steel,.042)
    heater.cube((-.032,cable_y+.083,1.724),(.062,.086,.093),panel_gray)
    heater.cube((-.065,cable_y+.083,1.724),(.005,.084,.091),heater_gray)
    heater.beam((-.031,cable_y+.083,1.766),(-.031,cable_y+.083,2.418),.010,panel_gray,10)
    finish(heater)
    collider('basement_hot_water_tank',38.75,40.52,heater_station-1.12,heater_station+.86,
             slab+.02,slab+1.49)

    # A single coordinate system keeps the physical pipe endpoints coincident across assets.
    water = asset('well manifold, gauge and distribution pipes', 10)
    def sy(plan_y):
        return (plan_y-10)*ft
    def sx(plan_x):
        return (plan_x-wall_x)*ft
    mx = -.6245
    my0,my1=sy(12.33),sy(18.62)
    cold_x, hot_x = -.079, -.155
    cold_z, hot_z = 2.073, 2.16
    well_y=sy(12.40)
    water.beam((mx,my0,.083),(mx,my1,.083),.0175,copper,12)
    for station in tank_stations:
        y=sy(station)
        water.beam((mx,y-.037,.083),(mx,y+.037,.083),.022,brass2,12)
        water.beam((tank_x-.24,y,.083),(mx,y,.083),.016,sleeve,10)
    pipe(water,[(.008,well_y,.75),(-.069,well_y,.75),(-.069,well_y,.152),
                (-.069,well_y,.083),(mx,well_y,.083)],.020,polymer,.067,12)
    # Wall sleeve, inlet clamp bands and brass transition fittings.
    port(water,.001,well_y,.75,.025,.033,shadow)
    for x in (-.363,-.394):
        water.beam((x,well_y,.083),(x+.010,well_y,.083),.023,steel,12)
    water.beam((-.414,well_y,.083),(-.489,well_y,.083),.026,brass2,6)
    pipe(water,[(mx,my1,.083),(cold_x,my1,.083),(cold_x,my1,cold_z),
                (cold_x,sy(25.18),cold_z)],.0135,copper,.040,12)
    # Brass shutoff and the blue lever are oriented parallel to the ascending line.
    water.beam((cold_x,my1,.43),(cold_x,my1,.55),.024,brass2,8)
    port(water,cold_x,my1,.486,.046,.010,brass2)
    water.cube((cold_x-.048,my1,.547),(.010,.019,.139),lever_blue)
    # Gauge and rectangular pressure-switch cover share a brass riser off the manifold.
    gauge_y=sy(15.88)
    pipe(water,[(mx,gauge_y,.083),(mx,gauge_y,.322),(mx+.12,gauge_y,.322),
                (mx+.12,gauge_y,.532)],.013,brass2)
    gx,gz=mx+.109,.587
    water.beam((gx+.01,gauge_y,.516),(gx+.01,gauge_y,.549),.016,brass2,6)
    port(water,gx+.033,gauge_y,gz,.048,.055,steel,32)
    port(water,gx-.014,gauge_y,gz,.003,.049,directory,32)
    for i in range(13):
        a=math.radians(226-i*22)
        def on_dial(radius):
            return (gx-.018,gauge_y+radius*math.cos(a),gz+radius*math.sin(a))
        water.beam(on_dial(.033 if i%3==0 else .039),on_dial(.044),.00125,shadow,5)
    water.beam((gx-.020,gauge_y-.006,gz-.008),(gx-.020,gauge_y+.017,gz+.032),.002,shadow,6)
    port(water,gx-.019,gauge_y,gz,.0028,.0046,brass2)
    switch_y=gauge_y+.125
    water.beam((mx+.12,gauge_y,.390),(mx+.12,switch_y,.390),.010,brass2)
    water.beam((mx+.12,switch_y,.390),(mx+.12,switch_y,.440),.013,brass2,6)
    water.cube((mx+.12,switch_y,.441),(.089,.079,.013),shadow)
    water.cube((mx+.12,switch_y,.479),(.085,.076,.070),heater_gray)
    pipe(water,[(mx+.15,switch_y,.464),(mx+.20,switch_y,.464),(-.047,switch_y,.314),
                (-.047,switch_y,1.76),(0,switch_y,1.76)],.0076,shadow,.067)
    water.cube((-.022,switch_y,1.766),(.045,.082,.085),panel_gray)
    collider('basement_low_pressure_manifold',38.67,39.03,12.28,18.68,slab+.025,slab+.67)

    hy=sy(heater_station)
    pipe(water,[(tank_x,hy+.103,1.452),(tank_x,hy+.103,1.583),
                (cold_x,hy+.103,1.583),(cold_x,hy+.103,cold_z)],.0135,copper,.040)
    pipe(water,[(tank_x,hy-.103,1.452),(tank_x,hy-.103,1.679),
                (hot_x,hy-.103,1.679),(hot_x,hy-.103,hot_z),(hot_x,sy(25.18),hot_z)],.0135,copper,.040)
    # Twin stubs meet the washer's recessed box below the overhead pair.
    washer_box_x = 31.27
    for xp, x, height in ((washer_box_x+.060/ft,cold_x,cold_z),(washer_box_x-.060/ft,hot_x,hot_z)):
        y=sy(25.18)
        pipe(water,[(x,y,height),(sx(xp),y,height),(sx(xp),y,1.305-floor_finish)],.011,copper,.035)
        water.beam((sx(xp),y,1.32),(sx(xp),y,1.35),.014,sleeve)
    # Saddle brackets and couplings anchor the overhead pipework to the masonry wall.
    for station, height, x in ((19.55,cold_z,cold_x),(22.85,cold_z,cold_x),
                              (22.85,hot_z,hot_x),(24.6,cold_z,cold_x),(24.6,hot_z,hot_x)):
        y=sy(station)
        water.beam((x,y-.012,height),(x,y+.012,height),.017,steel,12)
        water.beam((x+.008,y,height),(-.006,y,height),.004,steel,6)
        water.cube((-.006,y,height),(.012,.038,.045),panel_gray)
    # These drops are inside the lavatory wall and terminate at the fixture's stops.
    lav_x=sx(36.24)
    pipe(water,[(cold_x,sy(18.64),cold_z),(lav_x,sy(18.64),cold_z),
                (lav_x,sy(18.64),.50)],.010,copper)
    pipe(water,[(hot_x,hy-.103,hot_z),(hot_x,sy(18.18),hot_z),
                (lav_x,sy(18.18),hot_z),(lav_x,sy(18.18),.50)],.010,copper)
    finish(water)

    drain=asset('laundry standpipe, trap and PVC waste',10)
    dy=sy(25.18)
    dx=sx(washer_box_x)
    # Offset the bend below the washer box, then pitch the horizontal run toward the wall.
    trap_radius=.063
    trap_bottom=.275
    pts=[(dx,dy,1.235),(dx,dy,trap_bottom+trap_radius)]
    for step in range(1,13):
        angle=math.pi+step*math.pi/12
        pts.append((dx+trap_radius+trap_radius*math.cos(angle),dy,
                    trap_bottom+trap_radius+trap_radius*math.sin(angle)))
    pts += [(dx+2*trap_radius,dy,.408),(dx+.22,dy,.408),(-.092,dy,.382),
            (-.092,sy(24.46),.376),(.010,sy(24.46),.376)]
    pipe(drain,pts,.025,pvc,.024,14)
    for x in (dx+.32,dx+.92,-.19):
        elevation=.408-.026*min(1,max(0,(x-dx-.22)/(-.092-dx-.22)))
        drain.beam((x-.018,dy,elevation),(x+.018,dy,elevation),.029,pvc,14)
    finish(drain)

    panel=asset('electrical panel, open schedule door and protected breakers',panel_station)
    # The photographed front has two opposed columns, a steel face and a hinged left door.
    # Use a blank schedule grid. The homeowner's actual directory stays private.
    plane=-.115
    cz=1.46
    panel.cube((-.015,0,cz),(.032,.503,.775),shadow)
    panel.cube((-.064,0,cz),(.098,.472,.754),panel_gray)
    panel.cube((plane,0,cz),(.016,.470,.753),panel_gray)
    panel.cube((plane-.009,0,cz+.010),(.008,.292,.608),shadow)
    panel.cube((plane-.015,0,cz+.010),(.011,.283,.600),panel_gray)
    for y in (-.201,.201):
        for z in (cz-.338,cz+.338):
            port(panel,plane-.006,y,z,.006,.0061,steel,10)
    # A master handle above two rows of molded breakers. No exposed terminals.
    panel.cube((plane-.024,0,cz+.238),(.017,.100,.042),shadow)
    panel.cube((plane-.036,0,cz+.239),(.013,.064,.010),rail)
    for side in (-1,1):
        y=side*.052
        for row in range(10):
            z=cz+.177-row*.048
            panel.cube((plane-.023,y,z),(.019,.077,.046),rail)
            panel.cube((plane-.035,y-side*.015,z+.001),(.018,.025,.013),shadow,euler=(0,0,side*.19))
            panel.cube((plane-.0445,y-side*.016,z+.002),(.002,.009,.003),heater_gray)
            panel.cube((plane-.022,side*.116,z),(.002,.036,.038),directory)
        # Two visibly paired handles among the branch positions.
        panel.cube((plane-.045,y-side*.015,cz+.153),(.009,.017,.055),shadow)
    hinge_x,hinge_y=plane-.019,.230
    door_angle=math.radians(148)
    # With the door swung back, visitors see its lightly printed inner schedule.
    across=Vector((-math.sin(door_angle),-math.cos(door_angle),0))
    normal=Vector((math.cos(door_angle),-math.sin(door_angle),0))
    door_origin=Vector((hinge_x,hinge_y,cz))
    def on_leaf(distance,height,depth=0):
        return door_origin+across*distance+normal*depth+Vector((0,0,height))
    def leaf_face(u0,u1,h0,h1,depth,finish_mat):
        # Positive depth is the inside of the open door, facing into the aisle.
        points=[on_leaf(u0,h0,depth),on_leaf(u0,h1,depth),on_leaf(u1,h1,depth),on_leaf(u1,h0,depth)]
        panel.face([panel.vert(p) for p in points],finish_mat)
    # A folded sheet with four closed edges.
    panel.cube(on_leaf(.217,0),(.009,.434,.697),panel_gray,euler=(0,0,-door_angle))
    for distance in (.014,.421):
        panel.cube(on_leaf(distance,0,.010),(.013,.010,.666),panel_gray,euler=(0,0,-door_angle))
    for z in (-.332,.332):
        panel.cube(on_leaf(.217,z,.010),(.013,.405,.009),panel_gray,euler=(0,0,-door_angle))
    leaf_face(.075,.318,-.241,.256,.006,directory)
    for i in range(14):
        z=.214-i*.032
        leaf_face(.083,.311,z,z+.0016,.0065,heater_gray)
    leaf_face(.192,.194,-.226,.214,.0065,heater_gray)
    for z in (-.228,.228):
        panel.beam((hinge_x,hinge_y,cz+z-.037),(hinge_x,hinge_y,cz+z+.037),.0075,steel,12)
    panel.cube(on_leaf(.379,-.061,.011),(.023,.034,.023),shadow,euler=(0,0,-door_angle))
    for y in (-.114,.0,.12):
        panel.beam((-.064,y,cz+.36),(-.064,y,cz+.399),.022,steel,12)
    electrical=asset('service conduits and supports',panel_station)
    for i, y in enumerate((-.115,0,.12)):
        height=2.27+i*.041
        exit_y=-(.34+i*.09)
        pipe(electrical,[(-.064,y,cz+.389),(-.064,y,height),(-.064,exit_y,height),
                         (-.064,exit_y,2.421)],.012 if i!=1 else .017,panel_gray,.054,12)
        electrical.cube((-.030,y,2.075),(.060,.025,.018),panel_gray)
        electrical.beam((-.064,y,2.065),(-.064,y,2.085),.019,steel,12)
    finish(panel)
    finish(electrical)
    collider('basement_electric_panel',40.30,40.78,panel_station-.79,panel_station+.77,
             slab+1.10,slab+1.88)
    # Two short hulls follow the swung door in plan so the walk aisle stays clear.
    for i in range(2):
        a,b=on_leaf(i*.217,0),on_leaf((i+1)*.217,0)
        collider('basement_panel_leaf_%d'%i,wall_x+min(a.x,b.x)/ft-.022,
                 wall_x+max(a.x,b.x)/ft+.022,panel_station+min(a.y,b.y)/ft-.022,
                 panel_station+max(a.y,b.y)/ft+.022,slab+1.13,slab+1.84)

build_basement_utilities()
