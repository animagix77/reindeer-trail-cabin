"""December tree and gifts beside the loft stair, from L1060791 and L1060792.
The sprays, lights, hangers and gifts share meshes to limit browser draw calls.
"""
def build_christmas_tree():
    import math
    import random
    from mathutils import Vector
    rng = random.Random(10792)
    center = (19.55, 16.88, .018)
    b = group('Christmas tree | tiered fir, pine sprays and wire lights', center)
    d = group('Christmas tree | glass baubles, ornaments and star', center)
    g = group('Christmas tree | ivory skirt and wrapped gifts', center)
    twopi = math.tau

    def finish_mat(label, color, metal=0, rough=.62):
        return material('Christmas · '+label, color, metal, rough)

    def textured(label, file, cutout=False, metal=0):
        m = finish_mat(label, '#838673', metal)
        m.use_backface_culling = False
        nt = m.node_tree
        bs = nt.nodes.get('Principled BSDF')
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(work/'Interior materials'/file), check_existing=True)
        tex.image.pack()
        nt.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if cutout:
            mask = nt.nodes.new('ShaderNodeMath')
            mask.operation = 'GREATER_THAN'
            mask.inputs[1].default_value = .31
            nt.links.new(tex.outputs['Alpha'], mask.inputs[0])
            nt.links.new(mask.outputs[0], bs.inputs['Alpha'])
            bs.inputs['Roughness'].default_value = .49
        return m

    leaf = textured('fir needles', 'Christmas - fir spray.png', True)
    paper = textured('photographed gold star gift wrap', 'Christmas - star paper.jpg', metal=.13)
    stem = finish_mat('green-wrapped branch wire', '#314135')
    cord = finish_mat('light string cable', '#29392e')
    red = finish_mat('crimson lacquer', '#ad132e', .52, .18)
    ruby = finish_mat('ruby satin glass', '#8a1830', .25, .4)
    gilded = finish_mat('gold foil', '#d9ac43', .62, .29)
    silver = finish_mat('silver stripe', '#d1c7b4', .58, .26)
    pine = finish_mat('carved pinecone scales', '#976747', .0, .81)
    ribbon = finish_mat('crimson ribbon', '#aa1836', .27, .42)
    pale = finish_mat('ivory fleece', '#f5eee0', .0, .97)
    hair = finish_mat('Santa beard', '#e8ddc8', .0, .95)
    skin = finish_mat('Santa nose', '#dcb093', .0, .74)
    tartan = finish_mat('plaid dark check', '#312b30', .0, .8)
    lamps = []
    for name, color in [('cherry','#ff513e'),('gold','#ffd178'),('green','#5bc179'),('blue','#527dff')]:
        m = finish_mat(name+' fairy light', color, 0, .29)
        shader = m.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Emission Color'].default_value = m.diffuse_color
        shader.inputs['Emission Strength'].default_value = 3.2
        lamps.append(m)

    def vec(angle):
        return Vector((math.cos(angle), math.sin(angle), 0))

    def sprig(a, c, width):
        direction = (c-a).normalized()
        across = Vector((-direction.y, direction.x, 0)).normalized()
        normal = direction.cross(across).normalized()
        mid = a.lerp(c,.56) - Vector((0,0,width*.13))
        for tilt in (-.49, .63):
            sideways = width*(across*math.cos(tilt) + normal*math.sin(tilt))
            centers = [(a, .51, 0), (mid, 1, .56), (c, .47, 1)]
            last = None
            for p, taper, u in centers:
                row = [b.vert(p-sideways*taper), b.vert(p+sideways*taper)]
                if last:
                    old, old_u = last
                    b.face([old[0], row[0], row[1], old[1]], leaf, [(old_u,0),(u,0),(u,1),(old_u,1)])
                last = row, u

    b.beam((0,0,.05),(0,0,1.77),.017,stem,8,.004)
    anchors = []
    for tier in range(15):
        z = .23 + tier*.105
        radius = .42 * (1-(tier/15)**1.05) + .038
        count = max(5, round(13 - tier*.45))
        offset = tier*2.39
        for j in range(count):
            angle = offset + twopi*j/count + rng.uniform(-.095,.095)
            direction = vec(angle)
            length = radius * rng.uniform(.86, 1.04)
            # Individual sockets on an artificial trunk are staggered. The
            # opposing boughs lift by different amounts, particularly at the tip.
            lift = rng.uniform(-.013,.069)
            start = Vector((0,0,z+rng.uniform(-.034,.034)))
            mid = start + direction*length*.60 + Vector((0,0,-.025+lift*.36))
            tip = start + direction*length + Vector((0,0,lift))
            b.beam(start, mid, .0038, stem, 5, .002)
            sprig(mid, tip, .027)
            for at in (.19,.36,.53,.69,.81):
                base = start.lerp(mid, at/.6) if at<=.6 else mid.lerp(tip, (at-.6)/.4)
                for side in (-1,1):
                    twig_length = (.076 + .28*length)*(1-.57*at)*rng.uniform(.81,1.18)
                    end = base + vec(angle+side*(.52+.47*at))*twig_length
                    end.z += rng.uniform(.016,.047)
                    sprig(base,end,.023+rng.random()*.009)
            if tier<14:
                anchors.append((tier,angle,tip))
            if tier>5 and j%2==0:
                base = mid.lerp(start,.38)
                end = base + direction*(.075+length*.16) + Vector((0,0,rng.uniform(.057,.092)))
                sprig(base,end,.021)
    sprig(Vector((0,0,1.60)),Vector((.004,0,1.82)),.024)

    # Elongated faceted bulbs sit on individual sockets along the draped green wire.
    prev = None
    for j in range(200):
        t = j/199
        a = t*twopi*6.3
        rr = .415*(1-t)+.038
        p = vec(a)*rr + Vector((0,0,.285+1.39*t-.021*math.cos(3*a)))
        if prev is not None:
            b.beam(prev,p,.0018,cord,5)
        if j%3==0:
            socket = p+Vector((.002,0,.01))
            b.beam(p,socket,.004,cord,6)
            b.beam(socket,socket+Vector((.002,0,.012)),.0043,lamps[j%4],6,.002)
        prev=p

    def globe(builder, center, sizes, matl, bands=None, sides=12, rings=8):
        rows=[]
        for k in range(1,rings):
            lat=math.pi*k/rings
            row=[]
            for j in range(sides):
                a=twopi*j/sides
                row.append(builder.vert((center.x+sizes[0]*math.cos(a)*math.sin(lat),
                                         center.y+sizes[1]*math.sin(a)*math.sin(lat),
                                         center.z+sizes[2]*math.cos(lat))))
            rows.append(row)
        n=builder.vert((center.x,center.y,center.z+sizes[2]))
        s=builder.vert((center.x,center.y,center.z-sizes[2]))
        for j in range(sides):
            k=(j+1)%sides
            builder.face([n,rows[0][j],rows[0][k]],matl,smooth=True)
            for i in range(len(rows)-1):
                m=bands.get(i,matl) if bands else matl
                builder.face([rows[i][j],rows[i+1][j],rows[i+1][k],rows[i][k]],m,smooth=True)
            builder.face([rows[-1][k],rows[-1][j],s],matl,smooth=True)

    # Spread ornaments around the whole tree, maintaining branch attachment.
    balls=[red,gilded,ruby,gilded,red]
    for tier in range(13):
        choices=[q for q in anchors if q[0]==tier]
        for idx,(_,angle,tip) in enumerate(choices):
            if (idx+tier)%3:continue
            rr=rng.uniform(.021,.038)
            loc = tip + Vector((0,0,-.019-rr))
            m=balls[(tier+idx//3)%len(balls)]
            stripes={1:silver,3:silver,5:silver} if (idx+tier)%11==0 else None
            globe(d,loc,(rr,rr,rr*1.04),m,stripes)
            top=loc+Vector((0,0,rr))
            d.beam(top,top+Vector((0,0,.007)),rr*.29,gilded,8)
            d.beam(top+Vector((0,0,.007)),tip,.001,gilded,5)

    # A dimensional metal star and the small red sleigh, Santa and carved cone
    # echo the close-up ornaments. Face them into the living room.
    front=vec(.65)
    side=vec(.65+math.pi/2)
    up=Vector((0,0,1))
    crown=Vector((0,0,1.83))
    points=[]
    for j in range(10):
        a=math.pi*j/5
        radius=.11 if j%2==0 else .049
        points.append(crown+radius*(side*math.sin(a)+up*math.cos(a)))
    for sg in (-1,1):
        hub=d.vert(crown+sg*.026*front)
        outline=[d.vert(p) for p in points]
        for j in range(10):
            tri=[hub,outline[j],outline[(j+1)%10]]
            d.face(tri if sg<0 else list(reversed(tri)),gilded)
    def hang(point, hook):
        d.beam(point,hook,.0011,gilded,5)
    face=front*.325+Vector((0,0,.75))
    globe(d,face,(.043,.043,.052),hair)
    globe(d,face+front*.041+up*.014,(.017,.017,.013),skin)
    d.beam(face+up*.029,face+up*.105+side*.021,.046,red,12,.0015)
    globe(d,face+up*.105+side*.021,(.010,.010,.011),pale)
    hang(face+up*.096, face+up*.151)
    cone=vec(1.67)*.40+up*.30
    for k in range(5):
        radius=.012+.017*math.sin(math.pi*(k+1)/6)
        d.beam(cone+up*(k*.011),cone+up*(k*.011+.023),radius*.36,pine,10,radius)
    hang(cone+up*.066,cone+up*.12)
    sleigh=vec(.21)*.396+up*.34
    d.cube(sleigh,(.082,.043,.015),red)
    for sy in (-.021,.021):
        d.tube([sleigh+Vector((-.043,sy,.027)),sleigh+Vector((-.04,sy,.004)),
                sleigh+Vector((.039,sy,.004)),sleigh+Vector((.054,sy,.028))],.0023,red,6)
        d.tube([sleigh+Vector((-.048,sy,-.020)),sleigh+Vector((.044,sy,-.020)),sleigh+Vector((.055,sy,-.012))],.0019,silver,6)
    hang(sleigh+up*.012,sleigh+up*.07)

    # The soft skirt has a rippled hem, raised folds, and an inset central collar.
    rings=[]
    for k,(r,h) in enumerate(((.029,.097),(.135,.059),(.29,.023),(.45,.006))):
        ring=[]
        for i in range(72):
            a=twopi*i/72
            fold=math.cos(13*a+.36*k)*.5+math.cos(8*a-.7*k)*.35
            rr=r*(1+.035*fold)
            ring.append(g.vert((rr*math.cos(a),rr*math.sin(a),h+(.005+.003*k)*(fold+.8))))
        rings.append(ring)
    for inner,outer in zip(rings,rings[1:]):
        for j in range(72):
            k=(j+1)%72
            g.face([inner[j],outer[j],outer[k],inner[k]],pale,smooth=True)

    def gift(x,y,w,l,h,wrap,tie,z=0):
        base=Vector((x,y,z))
        g.cube(base+up*h*.5,(w,l,h),wrap)
        g.cube(base+up*h*.5,(.025,l+.0015,h+.0015),tie)
        g.cube(base+up*h*.5,(w+.002,.025,h+.002),tie)
        knot=base+up*(h+.007)
        for sign in (-1,1):
            last=None
            for k in range(17):
                a=twopi*k/16
                p=knot+Vector((sign*.045*(1-math.cos(a)),.003*math.sin(a),.016*(1-math.cos(a))+.014*math.sin(a)))
                row=[g.vert(p+Vector((0,-.010,0))),g.vert(p+Vector((0,.010,0)))]
                if last:g.face([last[0],row[0],row[1],last[1]],tie)
                last=row
    gift(.20,.28,.24,.20,.23,paper,ribbon,.012)
    gift(-.095,.32,.14,.13,.11,gilded,ribbon,.014)
    gift(-.26,-.045,.16,.15,.135,ruby,gilded,.011)
    # Miniature red-and-black checked parcel with a burlap band.
    mini=vec(1.15)*.39+up*.466
    d.cube(mini,(.055,.05,.061),red)
    for xx in (-.019,.005):
        d.cube(mini+Vector((xx,0,0)),(.007,.051,.062),tartan)
    for zz in (-.017,.007):
        d.cube(mini+Vector((0,0,zz)),(.056,.052,.008),tartan)
    d.cube(mini,(.009,.053,.063),gilded)
    hang(mini+up*.03,mini+up*.075)
    for builder in (b,d,g):
        finish(builder)
    collider('Christmas_tree_and_skirt',18.23,20.87,15.56,18.20,.0,1.93)

build_christmas_tree()
