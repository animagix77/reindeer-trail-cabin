"""Basement service equipment. Coordinates in each assembly are metres from the inside of the service wall.

The owner's utility-room photo shows a cobalt pressure tank in front of an
olive-gray tank, a white cartridge filter and insulated pipework. The laundry
photos place the recessed gray panel in the finished room outside that doorway.
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
    filter_station = 11.95
    blue = material('Well tank · cobalt enamel', '#205597', .32, .24)
    foot = material('Well tank · dark blue base', '#2f465e', .23, .51)
    olive = material('Well tank · olive-gray composite', '#727160', .04, .49)
    foam = material('Well lines · black foam insulation', '#252725', 0, .91)
    pex = material('Well lines · blue tubing', '#397aaf', .04, .47)
    cartridge = material('Well filter · warm white housing', '#e9e7d7', .04, .43)
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

    def jacket_label(builder, radius, offset, z, width, height, finish_mat):
        # A small equipment label follows the curvature of the tank.
        strip = []
        for i in range(7):
            angle = math.pi + offset + width/radius*(i/6-.5)
            x,y = tank_x + radius*math.cos(angle), radius*math.sin(angle)
            strip.append((builder.vert((x,y,z)),builder.vert((x,y,z+height))))
            if i:
                builder.face((strip[i-1][0],strip[i][0],strip[i][1],strip[i-1][1]),finish_mat)

    for index, station in enumerate(tank_stations, 1):
        tank = asset('well pressure tank %d' % index, station)
        if index==1:
            vessel(tank,tank_x,[(0,.212),(.016,.224),(.096,.220),(.123,.204)],foot)
            vessel(tank,tank_x,[(.103,.172),(.129,.207),(.172,.239),(.231,.268),
                   (.282,.277),(1.157,.277),(1.218,.272),(1.268,.258),
                   (1.319,.232),(1.371,.180),(1.406,.113),(1.421,.027)],blue)
            for z in (.545,.908):
                vessel(tank,tank_x,[(z,.277),(z+.003,.279),(z+.006,.279),(z+.009,.277)],blue)
            jacket_label(tank,.2777,.52,.343,.116,.064,directory)
            tank.beam((tank_x,0,1.421),(tank_x,0,1.435),.012,brass2,12)
            tank.beam((tank_x,0,1.435),(tank_x,0,1.452),.010,polymer,12)
        else:
            vessel(tank,tank_x,[(0,.212),(.015,.216),(.12,.205),(.172,.188)],polymer)
            vessel(tank,tank_x,[(.144,.176),(.171,.220),(.208,.251),(.261,.262),
                   (1.092,.262),(1.149,.253),(1.198,.232),(1.256,.190),
                   (1.297,.138),(1.318,.075),(1.327,.030)],olive)
            tank.beam((tank_x,0,1.322),(tank_x,0,1.342),.021,olive,16)
            jacket_label(tank,.263,.08,.290,.111,.075,directory)
            # The gray vessel has an exposed blue elbow at floor level.
            pipe(tank,[(tank_x-.238,-.06,.083),(tank_x-.283,-.06,.083),
                       (tank_x-.283,-.06,.234)],.011,pex,.018,12)
            tank.beam((tank_x-.283,-.06,.234),(tank_x-.283,-.06,.258),.015,brass2,8)
        # Under-shell water fitting and hex union leading out to the shared manifold.
        port(tank,tank_x,0,.083,.227,.020,brass2)
        port(tank,tank_x-.221,0,.083,.038,.027,brass2,6)
        port(tank,tank_x-.255,0,.083,.023,.019,sleeve)
        finish(tank)
        radius,top=(.279,1.452) if index==1 else (.263,1.342)
        collider('basement_pressure_tank_%d'%index,39.64-radius/ft,39.64+radius/ft,
                 station-radius/ft,station+radius/ft,slab+.02,slab+floor_finish+top)

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
    jacket_label(heater,.2525,.66,.76,.091,.165,label_yellow)
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
    filter_x = (40.18-wall_x)*ft
    outlet_y = sy(filter_station)+.31
    pipe(water,[(filter_x,outlet_y,1.329),(filter_x,outlet_y,.083),
                (filter_x,well_y,.083),(mx,well_y,.083)],.020,polymer,.045,12)
    # Transition fittings below the insulated outlet.
    for x in (-.363,-.394):
        water.beam((x,well_y,.083),(x+.010,well_y,.083),.023,steel,12)
    water.beam((-.414,well_y,.083),(-.489,well_y,.083),.026,brass2,6)
    pipe(water,[(mx,my1,.083),(cold_x,my1,.083),(cold_x,my1,cold_z),
                (cold_x,sy(heater_station)+.103,cold_z)],.0135,copper,.040,12)
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

    filtr=asset('well cartridge filter and insulated bypass',filter_station)
    vessel(filtr,filter_x,[(1.000,.041),(1.010,.055),(1.029,.063),
           (1.209,.072),(1.251,.073),(1.273,.070)],cartridge,32)
    for j in range(10):
        phi=math.tau*j/10
        dx,dy=math.cos(phi),math.sin(phi)
        filtr.beam((filter_x+dx*.059,dy*.059,1.026),
                   (filter_x+dx*.071,dy*.071,1.249),.004,cartridge,8)
    vessel(filtr,filter_x,[(1.251,.073),(1.262,.086),(1.286,.086),
           (1.292,.079),(1.309,.081),(1.330,.078),(1.341,.063)],cartridge,32)
    filtr.cube((filter_x,0,1.329),(.116,.193,.056),cartridge)
    # Wall-mounted filter bracket and the two foam-covered pipe paths in the photo.
    filtr.cube((-.016,0,1.374),(.025,.13,.114),steel)
    filtr.cube((filter_x/2,0,1.357),(-filter_x,.12,.016),steel)
    for y in (-.045,.045):
        port(filtr,-.027,y,1.408,.008,.007,steel,8)
    # The pale filter wrench hangs on a hook above the canister.
    wrench_x,wrench_z=-.077,1.540
    ring=[(wrench_x,.082*math.cos(math.tau*j/28),
           wrench_z+.082*math.sin(math.tau*j/28)) for j in range(29)]
    filtr.tube(ring,.007,cartridge,8)
    filtr.cube((wrench_x,0,1.418),(.008,.026,.097),cartridge)
    filtr.beam((-.008,0,1.627),(wrench_x-.012,0,1.627),.0035,steel,8)
    pipe(filtr,[(.005,-.37,1.77),(filter_x,-.37,1.77),
                (filter_x,-.37,1.329),(filter_x,-.091,1.329)],.032,foam,.035,12)
    pipe(filtr,[(filter_x,.091,1.329),(filter_x,.31,1.329),
                (filter_x,.31,.181)],.032,foam,.035,12)
    pipe(filtr,[(filter_x,-.28,1.329),(filter_x,-.28,1.665),
                (filter_x,.31,1.665),(filter_x,.31,1.329)],.030,foam,.040,12)
    for y in (-.093,.093):
        filtr.beam((filter_x,y-.017,1.329),(filter_x,y+.017,1.329),.034,cartridge,12)
    # Small valve levers and tied paper tags are visible on the old installation.
    for y,z in ((-.24,1.329),(.11,1.665)):
        filtr.beam((filter_x,y-.028,z),(filter_x,y+.028,z),.033,brass2,8)
        port(filtr,filter_x,y,z,.041,.009,brass2)
        filtr.cube((filter_x-.046,y+.032,z),(.010,.085,.017),label_yellow)
        pipe(filtr,[(filter_x-.044,y+.058,z),(filter_x-.052,y+.065,z-.030),
                    (filter_x-.049,y+.057,z-.043)],.0018,directory,.007,5)
        filtr.cube((filter_x-.049,y+.057,z-.077),(.003,.046,.070),directory,euler=(.11,0,0))
    finish(filtr)
    collider('basement_filter',40.18-.092/ft,40.78,
             filter_station-.40/ft,filter_station+.35/ft,slab+.99,slab+1.83)

    hy=sy(heater_station)
    pipe(water,[(tank_x,hy+.103,1.452),(tank_x,hy+.103,1.583),
                (cold_x,hy+.103,1.583),(cold_x,hy+.103,cold_z)],.0135,copper,.040)
    pipe(water,[(tank_x,hy-.103,1.452),(tank_x,hy-.103,1.679),
                (hot_x,hy-.103,1.679),(hot_x,hy-.103,hot_z),(hot_x,sy(18.55),hot_z)],.0135,copper,.040)
    # Both washer lines stay on the rough side and exit directly behind the recessed box.
    washer_box_x,washer_box_y = 35.50,19.30
    for offset, x, height in ((.060,cold_x,cold_z),(-.060,hot_x,hot_z)):
        y=sy(washer_box_y)+offset
        pipe(water,[(x,y,height),(sx(35.93),y,height),(sx(35.93),y,1.280),
                    (sx(washer_box_x),y,1.280)],.011,copper,.035)
    # Saddle brackets and couplings anchor the overhead pipework to the masonry wall.
    for station, height, x in ((19.55,cold_z,cold_x),(20.45,cold_z,cold_x),
                              (19.07,hot_z,hot_x),(19.86,hot_z,hot_x)):
        y=sy(station)
        water.beam((x,y-.012,height),(x,y+.012,height),.017,steel,12)
        water.beam((x+.008,y,height),(-.006,y,height),.004,steel,6)
        water.cube((-.006,y,height),(.012,.038,.045),panel_gray)
    # These drops are inside the lavatory wall and terminate at the fixture's stops.
    for x, height, end_x, feed_y in ((cold_x,cold_z,33.20,20.20),(hot_x,hot_z,33.66,20.16)):
        y=sy(feed_y)
        pipe(water,[(x,y,height),(sx(35.93),y,height),(sx(35.93),y,.50),
                    (sx(end_x),y,.50)],.010,copper,.026)
    # Two blue tubing runs sag slightly under the joists above the tanks.
    for offset,z in ((0,2.24),(-.052,2.28)):
        line_x=-.245+offset
        pipe(water,[(.010,sy(12.70)+offset,2.32),(line_x,sy(12.70)+offset,2.32),
                    (line_x,sy(14.00),z),(line_x,sy(15.90),z+.025),
                    (line_x,sy(17.18),z-.012),(line_x,sy(18.15),z+.055),
                    (.010,sy(18.71)+offset,2.35)],.011,pex,.065,10)
        for station,h in ((14.,z),(15.90,z+.025),(17.18,z-.012)):
            y=sy(station)
            water.beam((line_x,y-.008,h),(line_x,y+.008,h),.014,steel,12)
            water.beam((line_x,y,h+.007),(line_x,y,2.426),.0035,steel,6)
    finish(water)

    drain=asset('laundry standpipe, trap and PVC waste',10)
    dy=sy(washer_box_y)
    dx=sx(36.05)
    # Keep the trap on the service face of the laundry partition, with its
    # outlet disappearing into the wall. The middle of the aisle stays clear.
    trap_radius=.063
    trap_bottom=.275
    pts=[(sx(washer_box_x),dy,1.203),(dx,dy,1.203),(dx,dy,trap_bottom+trap_radius)]
    for step in range(1,13):
        angle=math.pi+step*math.pi/12
        pts.append((dx+trap_radius+trap_radius*math.cos(angle),dy,
                    trap_bottom+trap_radius+trap_radius*math.sin(angle)))
    pts += [(dx+2*trap_radius,dy,.408),(dx+2*trap_radius,dy-.16,.406),
            (sx(35.70),dy-.16,.402)]
    pipe(drain,pts,.025,pvc,.024,14)
    drain.beam((dx+trap_radius+.014,dy-.16,.404),(dx+trap_radius-.014,dy-.16,.404),.029,pvc,14)
    finish(drain)

    # Finished laundry photo: the panel is recessed beside the bath, above the
    # appliance. The door is closed and the cable entries are inside the partition.
    panel_x,panel_station = 35.55,19.28
    panel=group('Basement | laundry electrical panel and switches',
                (panel_x,panel_station,slab+floor_finish))
    cz=1.752
    panel.cube((.006,0,cz),(.024,.398,.646),shadow)
    panel.cube((-.005,0,cz),(.010,.394,.641),panel_gray)
    panel.cube((-.012,0,cz),(.006,.353,.581),shadow)
    panel.cube((-.017,0,cz),(.006,.345,.573),panel_gray)
    for y in (-.175,.175):
        for z in (cz-.297,cz+.297):
            port(panel,-.010,y,z,.0026,.0042,steel,10)
    for z in (cz-.185,cz+.185):
        panel.beam((-.022,.174,z-.020),(-.022,.174,z+.020),.005,panel_gray,12)
    panel.cube((-.021,-.117,cz-.018),(.007,.045,.036),shadow)
    panel.cube((-.026,-.127,cz-.019),(.004,.018,.026),rail)
    # Two white control plates sit immediately to the right in the photograph.
    for index,y in enumerate((-.249,-.328)):
        panel.cube((.004,y,cz-.172),(.019,.067,.105),ivory)
        panel.cube((-.008,y,cz-.172),(.010,.030,.051),shadow if index else cream)
        for z in (cz-.211,cz-.133):
            port(panel,-.005,y,z,.002,.0024,steel,8)
    finish(panel)
    collider('basement_electric_panel',panel_x-.028/ft,panel_x+.018/ft,
             panel_station-.365/ft,panel_station+.20/ft,slab+1.45,slab+2.11)

build_basement_utilities()
