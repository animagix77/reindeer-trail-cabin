"""Photo-matched fire circle chairs. Local coordinates are metres, +Y toward the fire."""
def build_fire_circle_chairs(group, center, zpat, blocker):
    from math import cos, sin, radians, atan2, pi
    import bmesh

    cedar = mat('Adirondack slat timber', '#b48a58', rough=.71)
    paint = mat('Adirondack slat timber · burgundy', '#813447', rough=.58)
    steel = mat('Adirondack · recessed stainless fasteners', '#928b7e', metal=.66, rough=.52)
    vertices, faces, grain_axes = [], [], []
    screw_vertices, screw_faces = [], []

    def board(face, thickness, grain):
        """Extrude one sawn board; preserve its own grain axis across the front and edges."""
        base, n = len(vertices), len(face)
        face = [Vector(p) for p in face]
        vertices.extend(face)
        vertices.extend(p + Vector(thickness) for p in face)
        local_faces = [tuple(reversed(range(n))), tuple(range(n, n*2))]
        local_faces.extend((i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n))
        faces.extend(tuple(base+i for i in f) for f in local_faces)
        grain_axes.extend([(Vector(grain).normalized(), (base*.217)%1)] * len(local_faces))

    def fastening(point, axis, radius, washer=False):
        # The carriage bolts on the folding frame are larger than the slat screws.
        origin, normal = Vector(point), Vector(axis).normalized()
        across = normal.orthogonal().normalized()
        up = normal.cross(across).normalized()
        profile = [(0,1.34),(.12,1.34),(.12,.97),(.29,.89),(.45,.55)] if washer else [(0,1),(.13,.84),(.18,.46)]
        base = len(screw_vertices)
        for depth, spread in profile:
            for k in range(10):
                a = 2*pi*k/10
                screw_vertices.append(origin + radius*(depth*normal + spread*(cos(a)*across + sin(a)*up)))
        screw_faces.append(tuple(range(base+9,base-1,-1)))
        for row in range(len(profile)-1):
            for i in range(10):
                a, b = base+10*row+i, base+10*row+(i+1)%10
                screw_faces.append((a,b,b+10,a+10))
        screw_faces.append(tuple(range(len(screw_vertices)-10,len(screw_vertices))))

    def seat_height(y):
        # Eight transverse planks dip at the hips and rise toward the knee.
        t = (y+.16)/.49
        return .288 + .110*t + .022*t*t

    # Long side stringers finish as feet behind the reclined back (IMG_3341).
    for side in (-1,1):
        x = side*.243
        profile = [(-.562,-.005),(-.446,-.005),(.285,.286),(.328,.329),(.328,.390)]
        profile += [(y, seat_height(y)-.022) for y in (.32,.18,0,-.15,-.222)]
        profile += [(-.275,.236),(-.49,.081),(-.562,.041)]
        board([(x-.016,y,z) for y,z in profile], (.032,0,0), (0,.88,.47))
        # Plumb front legs and a side gusset directly below each paddle.
        x = side*.274
        board([(x-.014,y,z) for y,z in ((.187,-.006),(.257,-.006),(.251,.575),(.183,.575))],
              (.028,0,0), (0,0,1))
        board([(x-.018,y,z) for y,z in ((.203,.416),(.248,.416),(.312,.568),(.188,.568))],
              (.036,0,0), (0,0,1))

    # The backrest boards follow one continuous arched crest with narrow gaps,
    # seen head-on in IMG_0773 and from the rear in L1060580.
    def back_y(x, z):
        return -.196 - .407*(z-.235) + .033*(x/.273)**2

    def crown(x):
        return .996 - .039*(x/.276)**2 - .080*(x/.276)**4

    for i in range(-3,4):
        foot, head = i*.065, i*.080
        # Upper left/right ends have different heights on the outer boards.
        brow = [(head+.035-k*.070/6, crown(head+.035-k*.070/6)) for k in range(7)]
        outline = [(foot-.029,.222),(foot+.029,.222)] + brow
        board([(x,back_y(x,z),z) for x,z in outline], (0,-.021,0), (head-foot,-.29,.75))

    # A low stretcher between the two tails and shaped cleats behind the fan.
    for y0,y1,z0,z1 in [(-.511,-.476,.028,.060),(.219,.251,.311,.346)]:
        board([(-.244,y0,z0),(-.244,y1,z0),(-.244,y1,z1),(-.244,y0,z1)],
              (.488,0,0), (1,0,0))

    for z, width, height, depth in [(.252,.489,.039,.044),(.556,.596,.042,.060),(.822,.526,.040,.042)]:
        # A shallow curve seats each rail against the cupped backrest.
        xs = [width*(k/8-.5) for k in range(9)]
        front = [(x,back_y(x,z-height/2)-.0205,z-height/2) for x in xs]
        plank = front + [(x,y-depth,h) for x,y,h in reversed(front)]
        board(plank, (0,-height*.407,height), (1,0,0))
        for x in (-width*.42,0,width*.42):
            fastening((x,back_y(x,z)-.021-depth,z), (0,-1,0), .004)

    for i in range(8):
        y0 = -.164+i*.061
        y1 = y0+.055
        half = .263+.008*i/7
        board([(-half,y0,seat_height(y0)),(half,y0,seat_height(y0)),
               (half,y1,seat_height(y1)),(-half,y1,seat_height(y1))],
              (0,0,-.023), (1,0,0))
        for side in (-1,1):
            mid = (y0+y1)/2
            fastening((side*.244,mid,seat_height(mid)+.0003), (0,-.25,1), .0032)

    # The owner photo shows two shallow scallops on the seat's front apron.
    apron = [(-.272,.412),(.272,.412)]
    for k in range(33):
        x = .272-.544*k/32
        apron.append((x,.354+.020*sin(2*pi*k/32)**2))
    board([(x,.323,z) for x,z in apron], (0,-.022,0), (1,0,0))

    for side in (-1,1):
        # Rear end narrows alongside the back; broad rounded nose projects
        # past the front leg. Local X values are for the right-hand arm.
        arm = [(.243,-.355),(.263,-.375),(.299,-.375),(.313,-.353),
               (.324,-.213),(.342,-.042),(.365,.138),(.389,.260),
               (.391,.307),(.381,.337),(.360,.355),(.332,.360),
               (.302,.351),(.277,.329),(.259,.294),(.246,.225),
               (.231,.050),(.229,-.108),(.234,-.249)]
        board([(side*x,y,.591+.009*y) for x,y in arm], (0,0,-.024), (0,1,0))
        # Small bracket carries the arm behind the post and meets the middle rail.
        x = side*.260
        board([(x-.014,y,z) for y,z in ((-.251,.266),(-.199,.296),(-.306,.571),(-.359,.571))],
              (.028,0,0), (0,-.34,.94))
        for y,z in [(.214,.322),(-.244,.279)]:
            fastening((side*(.289 if y>0 else .275),y,z), (side,0,0), .0066, True)
        for y in (.217,-.324):
            fastening((side*.273,y,.592+.009*y),(0,0,1),.0034)

    chair = mesh('Adirondack 00 · cedar', vertices, faces, cedar, group, closed=True)
    # Board-local UVs avoid changing grain direction at the fan crest and paddle tips.
    uv = chair.data.uv_layers.new(name='Board grain')
    for face,(axis,offset) in zip(chair.data.polygons,grain_axes):
        u = axis - face.normal*axis.dot(face.normal)
        if u.length < .05:
            u = face.normal.orthogonal()
        u.normalize()
        v = face.normal.cross(u)
        for li in face.loop_indices:
            p = chair.data.vertices[chair.data.loops[li].vertex_index].co
            uv.data[li].uv = (offset+p.dot(u)/2.6, offset+p.dot(v)/.36)
    bm = bmesh.new()
    bm.from_mesh(chair.data)
    bm.normal_update()
    edges = [e for e in bm.edges if len(e.link_faces)==2 and e.calc_face_angle()>radians(25)]
    bmesh.ops.bevel(bm,geom=edges,offset=.0025,segments=2,affect='EDGES',clamp_overlap=True)
    bm.to_mesh(chair.data)
    bm.free()
    chair.data.update()
    natural = chair.data
    burgundy = natural.copy()
    burgundy.materials[0] = paint
    bolts = mesh('Adirondack 00 · hardware', screw_vertices, screw_faces, steel, group)
    for i,deg in enumerate((25,107,194,269)):
        t = radians(deg)
        dx,dy = 1.62*cos(t),1.62*sin(t)
        floor = zpat + .0015*(-co*dx+si*dy)/ft
        origin = Vector((center.x+dx,center.y+dy,floor))
        yaw = atan2(dx,-dy)
        forward = Vector((-cos(t),-sin(t),0))
        if i:
            body = bpy.data.objects.new('Adirondack %02d · %s'%(i,'burgundy' if i%2 else 'cedar'),
                                        burgundy if i%2 else natural)
            group.objects.link(body)
            metal = bpy.data.objects.new('Adirondack %02d · hardware'%i, bolts.data)
            group.objects.link(metal)
        else:
            body,metal = chair,bolts
        for obj in (body,metal):
            obj.location = origin
            obj.rotation_euler.z = yaw
        up = Vector((0,0,1))
        # Sit on the second slat up from the rear, facing the fire.
        sit_y = -.164+.061+.0275
        marker = bpy.data.objects.new('YardChairSeat%02d'%i,None)
        group.objects.link(marker)
        marker.location = origin+forward*sit_y+up*(seat_height(sit_y)+.004)
        marker.empty_display_size = .025
        blocker('YardChair%02d'%i,origin-.565*forward+.010*up,
                origin+.362*forward+.010*up,.786,.991)
