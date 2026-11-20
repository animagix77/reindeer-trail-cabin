"""Photo-based timberwork for the covered porch, picnic table and garden seats.

Plan coordinates are in appraisal feet and heights in absolute meters.
"""

# Deck end, as seen facing the landing. The stair opening is on the yard side.
deck_stair_y0, deck_stair_y1 = 31.65, 35.50

class Timberwork:
    """Join individual saw-cut members into one mesh with grain along each board."""
    def __init__(self, name, material, collection):
        self.name, self.material, self.collection = name, material, collection
        self.vertices, self.faces, self.face_uvs = [], [], []

    def member(self, start, end, width, depth):
        a, b = Vector(pos(*start)), Vector(pos(*end))
        length = (b-a).length
        along = (b-a).normalized()
        across = along.cross(Vector((0, 0, 1)))
        if across.length < .01:
            across = Vector((-co, si, 0))
        across.normalize()
        normal = along.cross(across)
        corners = [across*i*width/2 + normal*j*depth/2
                   for i, j in [(-1,-1), (1,-1), (1,1), (-1,1)]]
        first = len(self.vertices)
        self.vertices.extend(tuple(p+t) for p in (a,b) for t in corners)
        offset = (math.sin(first+1)*43758.5453) % 1
        for face in [(3,2,1,0), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]:
            self.faces.append(tuple(first+i for i in face))
            across_face = across if face[0] in (0,2) else normal
            points = [Vector(self.vertices[first+i])-a for i in face]
            if all(i < 4 for i in face) or all(i >= 4 for i in face):
                self.face_uvs.append([(offset+p.dot(across)/2, p.dot(normal)/.30) for p in points])
            else:
                self.face_uvs.append([(offset+p.dot(along)/2.6, offset+p.dot(across_face)/.36) for p in points])

    def finish(self):
        obj = mesh(self.name, self.vertices, self.faces, self.material, self.collection)
        uv = obj.data.uv_layers.new(name='Grain along member')
        for polygon, coords in zip(obj.data.polygons, self.face_uvs):
            for loop, value in zip(polygon.loop_indices, coords):
                uv.data[loop].uv = value
        return obj


def sawn_guard(boards, start, end, newels=(True, True)):
    """A cedar cap laid flat on edgewise rails and upright square balusters."""
    ax, ay, az = start
    bx, by, bz = end
    for height, width, depth in ((.125,.0381,.0889), (.887,.0381,.0889), (.95,.0889,.0381)):
        boards.member((ax,ay,az+height),(bx,by,bz+height),width,depth)
    spaces = math.ceil(math.hypot(bx-ax,by-ay)*ft/.142)
    for i in range(spaces+1):
        joint = i in (0, spaces)
        if (i == 0 and not newels[0]) or (i == spaces and not newels[1]):
            continue
        t = i/spaces
        x, y, z = ax+(bx-ax)*t, ay+(by-ay)*t, az+(bz-az)*t
        size = .0889 if joint else .0381
        boards.member((x,y,z+(-.09 if joint else .166)),
                      (x,y,z+(.931 if joint else .845)),size,size)


def porch_structure(cedar):
    frame = Timberwork('Porch · deck boards, posts and guardrails', cedar, deck)
    roof_frame = Timberwork('Roof · covered porch framing and sheathing', cedar, roof)
    # L1040563 and L1060579 show a narrow roof overhang, exposed rectangular
    # rafters, continuous outer carrying beam and square cap and shoe rails.
    def roof_top(y):
        return dp+2.64-(y-25.6)*.37/11
    for i in range(22):
        y = 26+(i+.5)*10/22
        frame.member((23,y,dp+.007),(41,y,dp+.007),10/22*ft-.003, .014)
    for x in (23.3,32,40.7):
        frame.member((x,35.65,dp-.17),(x,35.65,roof_top(35.65)-.332),.122,.122)
    for x in (23.1,40.88):
        frame.member((x,26.03,dp-.115),(x,35.96,dp-.115),.05,.225)
    frame.member((23.02,35.92,dp-.115),(40.98,35.92,dp-.115),.05,.225)
    for x1,y1,x2,y2 in [(23.25,35.70,40.75,35.70),(23.25,26.15,23.25,35.70),
                          (40.75,26.15,40.75,deck_stair_y0)]:
        for h,w,d in [(.118,.0381,.0889),(.886,.0381,.0889),(.950,.0889,.0381)]:
            frame.member((x1,y1,dp+h),(x2,y2,dp+h),w,d)
        count=math.ceil(math.hypot(x2-x1,y2-y1)/.49)
        for i in range(1,count):
            t=i/count; x=x1+(x2-x1)*t; y=y1+(y2-y1)*t
            if y>35.3 and any(abs(x-post)<.22 for post in (23.3,32,40.7)):
                continue
            frame.member((x,y,dp+.159),(x,y,dp+.845),.0381,.0381)
    for x,y in [(23.25,26.15),(40.75,26.15),(40.75,deck_stair_y0)]:
        frame.member((x,y,dp),(x,y,dp+.953),.092,.092)
    frame.finish()
    # Roof top is the existing exterior shingle plane. The sawn underside has
    # short overhangs at all three open edges.
    roof_frame.member((22.83,35.65,roof_top(35.65)-.242),(41.19,35.65,roof_top(35.65)-.242),.093,.181)
    for y in (26.01,36.53):
        roof_frame.member((22.4,y,roof_top(y)-.086),(41.6,y,roof_top(y)-.086),.039,.165)
    for i in range(12):
        x=22.48+i*(41.52-22.48)/11
        roof_frame.member((x,25.70,roof_top(25.70)-.087),(x,36.53,roof_top(36.53)-.087),.041,.127)
    for i in range(16):
        x=22.4+(i+.5)*19.2/16
        roof_frame.member((x,25.64,roof_top(25.64)-.014),(x,36.59,roof_top(36.59)-.014),19.2*ft/16-.0012,.020)
    roof_frame.finish()


def deck_stove_flue(sx, sy, stove, galvanized, lining, tube, prism):
    """Continuous crimped duct rising to the open end at the porch eave."""
    def p(x,y,h):
        return Vector(pos(x,y,dp+h))
    tube(stove,p(sx,sy+.22,.883),p(sx,sy+.22,1.056),.078,.078,32)
    # The garden counterview shows the duct secured beside the outer roof post,
    # curving under the fascia, with its rolled mouth facing the yard.
    def cubic(a,b,c,d,t):
        return a*(1-t)**3+b*(3*t*(1-t)**2)+c*(3*t*t*(1-t))+d*t**3
    start=p(sx,sy+.22,1.046)
    elbow=p(23.84,35.11,1.901)
    end=p(22.26,35.15,2.095)
    curves=[(start,start+Vector((0,0,.39)),p(24.18,35.08,1.746),elbow),
            (elbow,p(23.51,35.14,2.051),p(23.13,35.15,2.095),end)]
    path=[start]
    for a,b,c,d in curves:
        path.extend(cubic(a,b,c,d,i/88) for i in range(1,89))
    vertices, faces, materials=[],[],[]
    sides=24
    def ring(center,tangent,radius):
        across=tangent.cross(Vector((0,1,0))).normalized()
        normal=tangent.cross(across)
        base=len(vertices)
        vertices.extend(tuple(center+radius*(across*math.cos(i*math.tau/sides)+normal*math.sin(i*math.tau/sides)))
                        for i in range(sides))
        return base
    def join(first,second,material):
        for i in range(sides):
            j=(i+1)%sides
            faces.append((first+i,first+j,second+j,second+i))
            materials.append(material)
    distance=0
    for k,center in enumerate(path):
        tangent=(path[min(k+1,len(path)-1)]-path[max(k-1,0)]).normalized()
        if k:distance+=(center-path[k-1]).length
        radius=.072+.0017*math.sin(math.tau*distance/.020)
        base=ring(center,tangent,radius)
        if k:join(base-sides,base,0)
    for depth,radius,material in ((.004,.076,0),(.011,.075,0),(.011,.067,0),(-.109,.066,1)):
        new=ring(end+tangent*depth,tangent,radius)
        join(base,new,material)
        base=new
    faces.append(tuple(base+i for i in range(sides)));materials.append(1)
    obj=mesh('Porch · corrugated stove flue to roof edge',vertices,faces,galvanized,deck)
    obj.data.materials.append(lining)
    for face,index in zip(obj.data.polygons,materials):
        face.material_index=index
        face.use_smooth=len(face.vertices)==4
    # Two metal cheeks form the hanger on the last rafter. The pipe is just below the timber.
    for side in (-1,1):
        yy=35.15+side*.237
        prism(galvanized,p(22.49,yy,2.022),p(22.49,yy,2.257),.020,.003)
    prism(galvanized,p(22.49,34.913,2.022),p(22.49,35.387,2.022),.020,.003)
    return obj


def picnic_table(timber, group, zone, blocker):
    # On the side away from the deck, the table presents its narrow end to the
    # deck and its bench side to the hanging chairs (DSC01537, L1060583).
    table = Timberwork('Garden · A-frame picnic table and benches',timber,group)
    x,y=26.525,63.8
    level=zone(x,y)
    for i in range(5):
        xx=x+(i-2)*.48
        table.member((xx,y-3,level+.733),(xx,y+3,level+.733),.14,.04)
    for sign in (-1,1):
        for i in (0,1):
            xx=x+sign*(1.78+.50*i)
            table.member((xx,y-3,level+.422),(xx,y+3,level+.422),.144,.04)
    for yy in (y-2.22,y+2.22):
        table.member((x-2.56,yy,level+.349),(x+2.56,yy,level+.349),.042,.118)
        table.member((x-1.14,yy,level+.664),(x+1.14,yy,level+.664),.042,.105)
        for sign in (-1,1):
            foot=x+sign*1.92
            table.member((foot,yy,zone(foot,yy)-.008),(x+sign*.61,yy,level+.695),.045,.125)
        table.member((x,yy,level+.39),(x,y,level+.685),.050,.077)
    table.finish()
    blocker('GardenPicnicTable',pos(x,y-2.95,level-.08),pos(x,y+2.95,level-.08),1.54,.86)


def hanging_pergola(timber, dark, chain, cushion, group, zone, tube, blocker, round_blocker):
    # The owner places the pergola on the uphill side formerly assigned to the
    # table. Both chair openings look inward toward the fire circle. L1040565
    # establishes the ratio of basket widths to the post-to-post span.
    x, middle_y = 35.0, 54.1
    post_span = 10.25
    near_y, far_y = middle_y - post_span/2, middle_y + post_span/2
    beam = zone(x,middle_y) + 2.20
    frame = Timberwork('Garden · hanging seat frame',timber,group)
    for index,(y,sign) in enumerate(((near_y,1),(far_y,-1)),1):
        grade=zone(x,y)
        frame.member((x,y,grade-.015),(x,y,beam-.02),.15,.15)
        frame.member((x,y,beam-.49),(x,y+sign*1.35,beam-.07),.087,.123)
        blocker('SwingFrame'+str(index),pos(x,y-.246,grade-.02),pos(x,y+.246,grade-.02),
                .15,beam+.10-grade+.02)
    frame.member((x,near_y-.72,beam),(x,far_y+.72,beam),.158,.20)
    for i in range(8):
        y=near_y-.17+(post_span+.34)*i/7
        frame.member((x-.77,y,beam+.162),(x+.77,y,beam+.162),.038,.129)
    frame.finish()
    def wire(points, radius, material=dark, sides=6):
        for a,b in zip(points,points[1:]):
            tube(material,a,b,radius,radius,sides)
    for i,y in enumerate((middle_y+2.65,middle_y-2.65)):
        ground=zone(x,y)
        bottom=ground+.38
        top=bottom+1.25
        def rib(angle,t):
            radius=math.sin(math.pi*t)**.75*(1.14-.28*t)
            return pos(x+.13+radius*1.48*math.cos(angle),
                       y-radius*1.62*math.sin(angle),bottom+(top-bottom)*t)
        # The rear lattice is open to the fire circle (-X). A full outer
        # aperture ring gives the hanging shell its photographed silhouette.
        opening=math.radians(112)
        for sign in (-1,1):
            wire([rib(sign*opening,j/22) for j in range(23)],.018)
        for t in (.07,.15,.24):
            wire([rib(j*math.tau/30,t) for j in range(31)],.008)
        for j in range(9):
            angle=opening+(math.tau-2*opening)*j/8
            wire([rib(angle,.24*k/7) for k in range(8)],.006)
        for j in range(7):
            angle=-opening+2*opening*j/6
            wire([rib(angle,k/16) for k in range(17)],.009)
        levels=(.084,.26,.48,.71,.89)
        for level in levels:
            wire([rib(-opening+2*opening*j/28,level) for j in range(29)],.010)
        for lo,hi in zip(levels,levels[1:]):
            for j in range(8):
                angle=-opening+2*opening*j/8
                end_angle=angle+2*opening/8
                for sign in (1,-1):
                    begin,end=(angle,end_angle) if sign==1 else (end_angle,angle)
                    wire([rib(begin+(end-begin)*k/4,lo+(hi-lo)*k/4)
                          for k in range(5)],.006, dark,5)
        underside=beam-.10
        count=max(2,round((underside-top)/.055))
        for j in range(count):
            cz=top+(underside-top)*(j+.5)/count
            def link(t):
                theta=t*math.tau/12
                dx=.019*math.cos(theta);z=cz+.035*math.sin(theta)
                return pos(x+.13+(0 if j%2 else dx/ft),y-(dx/ft if j%2 else 0),z)
            wire([link(k) for k in range(13)],.0034,chain,5)
        # In L1040572 the near basket has a padded seat folding up against
        # its back. The seams and four button depressions catch the side light.
        if i==0:
            verts=[];faces=[];nr=12;ns=56
            for layer in (0,1):
                for ring in range(nr+1):
                    r=ring/nr
                    for seg in range(ns):
                        a=math.tau*seg/ns
                        dx=.359*r*math.cos(a)
                        dy=.326*r*math.sin(a)+.019
                        turn=max(0,math.sin(a))
                        lift=r**2*(.084+.30*turn**1.3)
                        puff=.073*(1-.73*r**3)+.011*math.cos(6*a)*r
                        dimples=sum(.047*math.exp(-((dx-u)**2+(dy-v)**2)/.0019) for u in (-.12,.12) for v in (-.08,.12))
                        h=.106+lift+(puff-dimples if layer else -.014)
                        verts.append(pos(x+.13+dy/ft,y-dx/ft,bottom+h))
            stride=(nr+1)*ns
            for ring in range(nr):
                for seg in range(ns):
                    v=ring*ns+seg;n=ring*ns+(seg+1)%ns
                    faces.append((n,n+ns,v+ns,v))
                    faces.append(tuple(k+stride for k in (v,v+ns,n+ns,n)))
            for seg in range(ns):
                v=nr*ns+seg;n=nr*ns+(seg+1)%ns
                faces.append((v,n,n+stride,v+stride))
            obj=mesh('Garden · tufted canvas basket cushion',verts,faces,cushion,group)
            for face in obj.data.polygons:face.use_smooth=True
        round_blocker('HangingBasket'+str(i+1),pos(x+.13,y,ground-.02),.477,.516,1.72)
    # End and face attachment points on the top timber, in winding order.
    return [pos(x+dx,y,beam+.040) for dx,y in
            ((-.29,near_y-.65),(-.29,far_y+.65),(.29,far_y+.65),(.29,near_y-.65))]
