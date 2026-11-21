"""The black twin-hoop firewood rack beneath the deck window in IMG_3970."""
def build_deck_firewood_rack():
    from math import cos, pi, sin, sqrt, tau
    from random import Random

    # The photo locates the rack between the short end rail and the slider.
    # Plan coordinates are feet. All dimensions local to the rack are metres.
    x, y = 25.48, 27.18
    radius, center_z, tube = .465, .522, .012
    build = furniture_lib['_IFBuilder']
    frame, logs = build(), build()
    steel = mat('Deck rack · charcoal powder-coated steel', '#343738', .52, .41)
    bark = bpy.data.materials['Hardwood bark']
    split = bpy.data.materials['Porch · natural sawn timber']
    ends = [mat('Deck logs · sawn end '+str(i), tone, rough=.88)
            for i, tone in enumerate(('#9f8161', '#b19777', '#aa8b67'))]
    grain = mat('Deck logs · latewood and seasoning checks', '#80674e', rough=.91)

    # Two continuous swept hoops, with welded crosspieces and feet standing
    # on the tops of the deck planks. The unfilled top reads through to the wall.
    for depth in (-.128, .128):
        circles = []
        for i in range(64):
            a = tau*i/64
            circles.append([frame.vert(((radius+tube*cos(tau*j/10))*cos(a),
                                        depth+tube*sin(tau*j/10),
                                        center_z+(radius+tube*cos(tau*j/10))*sin(a)))
                            for j in range(10)])
        for i, row in enumerate(circles):
            nxt = circles[(i+1)%64]
            for j in range(10):
                k = (j+1)%10
                frame.face([row[j], row[k], nxt[k], nxt[j]], steel, smooth=True)
    for side in (-1, 1):
        xx = side*.274
        joint_z = center_z-sqrt(radius**2-xx**2)
        frame.beam((xx,-.13,joint_z),(xx,.13,joint_z),tube,steel,12)
        frame.cube((xx,0,.027),(.074,.389,.024),steel)
        for face in (-1, 1):
            frame.beam((xx,face*.171,.035),(xx,face*.128,joint_z),tube,steel,12)

    # Each billet is a sector of a larger round. Settle its rotated section
    # against the inner arc of the cradle and the pieces already resting there.
    rng = Random(3970)
    settled = []
    inner = radius-tube
    def edges(polygon):
        return zip(polygon, polygon[1:]+polygon[:1])
    def heights(polygon, u):
        return [z+(h-z)*(u-a)/(b-a) for (a,z),(b,h) in edges(polygon)
                if min(a,b)-1e-8 <= u <= max(a,b)+1e-8 and abs(a-b)>1e-8]
    def resting_height(poly):
        z = max(center_z-sqrt(inner*inner-u*u)-v for u,v in poly)
        for other in settled:
            for u in [p[0] for p in poly+other]:
                bottom, top = heights(poly,u), heights(other,u)
                if bottom and top:
                    z = max(z, max(top)-min(bottom))
        return z

    for billet in range(26):
        rad, angle = rng.uniform(.108,.15), rng.uniform(.97,1.69)
        detail = Random(1801+billet)
        # Split edges chip near the pith; a little of the uneven bark survives outside.
        chip = detail.uniform(.004,.022)
        section = [(chip*cos(angle),chip*sin(angle)),(chip,0.)]
        for i in range(6):
            rr = rad*detail.uniform(.98,1.02)
            section.append((rr*cos(angle*i/5),rr*sin(angle*i/5)))
        spin = rng.uniform(0,tau)
        rotated = [(a*cos(spin)-b*sin(spin),a*sin(spin)+b*cos(spin)) for a,b in section]
        candidates = []
        for j in range(19):
            shift = -.43+.86*(j+rng.uniform(0,.9))/19
            poly = [(a+shift,b) for a,b in rotated]
            if any(abs(u)>=inner-.001 for u,v in poly):
                continue
            h = resting_height(poly)
            if all(u*u+(v+h-center_z)**2 < (inner+.0002)**2 for u,v in poly):
                candidates.append((h,shift,poly))
        if not candidates:
            continue
        h, shift, poly = min(candidates, key=lambda item:item[0])
        if max(v+h for u,v in poly) > .78:
            continue
        settled.append([(u,h+v) for u,v in poly])
        inset, tip = -.20+rng.uniform(-.023,.022), .20+rng.uniform(-.028,.023)
        # Saw cuts are slightly oblique. Keep the overhanging ends short enough to fit the deck aisle.
        slope = detail.uniform(-.075,.075)
        def cut_depth(u,v):
            return tip+slope*(u-shift)+.032*v
        rings = [[logs.vert((u,inset,h+v)) for u,v in poly],
                 [logs.vert((u,cut_depth(u,v),h+v)) for u,v in poly]]
        cap = rng.choice(ends)
        logs.face(rings[0],cap)
        logs.face(rings[1][::-1],cap)
        uv_offset = rng.random()
        for j in range(len(section)):
            k = (j+1)%len(section)
            outer = 1<j<len(section)-1
            width = math.dist(section[j],section[k])/.34
            uv = [(uv_offset+width,0),(uv_offset,0),(uv_offset,.83),(uv_offset+width,.83)]
            if not outer:
                # The porch timber photograph runs along U; bark ridges run along V.
                uv = [(v*.31,u) for u,v in uv]
            logs.face([rings[0][k],rings[0][j],rings[1][j],rings[1][k]],bark if outer else split,uv)
            uv_offset+=width
        # Curved growth bands end at both cleft faces on the aisle-facing cut.
        for fraction in (.32,.54,.76,.91):
            samples = []
            for j in range(9):
                a = spin+angle*j/8
                samples.append([logs.vert((shift+s*cos(a),cut_depth(shift+s*cos(a),s*sin(a))+.00045,h+s*sin(a)))
                                for s in (rad*fraction,rad*fraction+.00105)])
            for prev, nxt in zip(samples,samples[1:]):
                logs.face([prev[0],nxt[0],nxt[1],prev[1]],grain)

    for name, part in [('tubular steel frame',frame),('split logs',logs)]:
        obj = part.finish('Deck firewood rack · '+name,pos(x,y,dp),174.6)
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        deck.objects.link(obj)
    obstacle = box('WalkBlock_DeckFirewoodRack',x-(radius+tube)/ft,x+(radius+tube)/ft,
                   y-.224/ft,y+.224/ft,dp+.014,dp+center_z+radius+tube,None,deck)
    obstacle.display_type='WIRE'
    obstacle.hide_render=True

build_deck_firewood_rack()
