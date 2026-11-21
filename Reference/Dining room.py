"""Window-side dining nook, including the aisle chair visible in L1040608."""
def build_dining_room():
    fabric=texmat('Dining · navy and red tartan','Dining - red tartan.jpg')
    napkin=texmat('Dining · dotted navy placemats','Dining - navy placemat.jpg')
    pine=texmat('Floor · photograph of clear-finished knotty pine','Dining - honey pine floor.jpg')
    pine.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.55
    for name in ('Pine in kitchen and dining','Pine entry','Front bedroom pine · entry end','Front bedroom pine · wider hall end','Bedside floor','Primary pine return'):
        obj=bpy.data.objects.get(name)
        if not obj:continue
        obj.data.materials[0]=pine
        uv=obj.data.uv_layers.active
        for loop in obj.data.loops:
            x,y,_=local(obj.matrix_world@obj.data.vertices[loop.vertex_index].co)
            uv.data[loop.index].uv=(y/8.6,x/4.2)
    # The living-room roof and the lower interior kitchen gable meet at the
    # broad opening beside the hearth. Fit the plaster at BOTH ridge lines.
    cuts=sorted({15.24,25.92,ridge(20.91,1),kitchen_ridge_y})
    for ya,yb in zip(cuts,cuts[1:]):
        x=20.89
        za=soffit(x,ya)+.02;zb=soffit(x,yb)+.02
        la=kitchen_vault_z(ya);lb=kitchen_vault_z(yb)
        face('Dining · sloping plaster header',[(x,ya,la),(x,yb,lb),(x,yb,zb),(x,ya,za)],ochre)
        face('Dining · painted opening reveal',[(x,ya,la),(21.006,ya,la),(21.006,yb,lb),(x,yb,lb)],ceilingmat)
    black=material('Dining chairs · dark stained wood','#262522',.02,.51)
    left_jamb,right_jamb,_,head=dinwin
    tx,ty,hw,hd=(left_jamb+right_jamb)/2,24.17,2.04,1.43
    # In L1040608 the top nearly reaches the window sill. IMG_4658
    # shows it at island height, with tall seats and low foot rails.
    table_rise=.145
    d=group('Dining | table under window with three place settings',(0,0,table_rise))
    bx(d,tx-hw,tx+hw,ty-hd,ty+hd,.707,.747,darkoak)
    for sx in (-1,1):
        for sy in (-1,1):
            x=tx+sx*(hw-.17);y=ty+sy*(hd-.18)
            bx(d,x-.088,x+.088,y-.088,y+.088,.012-table_rise,.72,black)
    drape(d,tx-hw,tx+hw,ty-hd,ty+hd,.754,fabric,.18)
    for x,y,rx,ry in [(tx-1.26,ty+.10,.53,.76),(tx+1.26,ty+.10,.53,.76),(tx,ty-.79,.70,.43)]:
        pts=[];uvs=[]
        for corner,(sx,sy) in enumerate(((1,1),(-1,1),(-1,-1),(1,-1))):
            for step in range(5):
                angle=(corner+step*.25)*pi/2
                u=sx*(rx-.13)+.13*cos(angle);v=sy*(ry-.13)+.13*sin(angle)
                pts.append(d.vert(((x+u)*ft,(y+v)*ft,.772)))
                uvs.append((.5+.5*u/rx,.5+.5*v/ry))
        d.face(pts,napkin,uvs)
    mug=material('Dining · deep red cup','#953330',0,.34)
    cyl(d,tx+.58,ty-.69,.777,.866,.034,mug,18,.038)
    cyl(d,tx+.58,ty-.69,.867,.869,.032,darkoak,18)
    cyl(d,tx+.38,ty+.53,.766,.901,.031,steel)
    cyl(d,tx+.38,ty+.53,.901,.922,.022,steel)
    cyl(d,tx+.38,ty+.53,.922,.938,.019,rail)
    # Low round serving tray and two pieces of stoneware.
    cyl(d,tx-.17,ty+.65,.765,.777,.104,steel,28)
    for x in (tx-.36,tx+.07):
        cyl(d,x,ty+.65,.778,.822,.027,paper,16,.033)
    finish(d)
    collider('dining_table',tx-hw,tx+hw,ty-hd,ty+hd,0,.76+table_rise)
    chairs=[('left',tx-hw-.48,ty,90),('right',tx+hw+.48,ty,-90),('aisle',tx,ty-hd-.36,180)]
    for label,cx,cy,yaw in chairs:
        c=group('Dining | '+label+' chair with oval handhold',(cx,cy,table_rise),yaw)
        bx(c,-.61,.61,-.57,.57,.401,.445,black,5)
        for xx in (-.50,.50):
            for yy in (-.48,.48):
                bx(c,xx-.056,xx+.056,yy-.055,yy+.055,.012-table_rise,.416,black)
            bx(c,xx-.053,xx+.053,.425,.531,.43,.908,black)
            bx(c,xx-.035,xx+.035,-.45,.45,.158,.198,black)
        for bottom in (.552,.702):bx(c,-.5,.5,.437,.518,bottom,bottom+.061,black)
        # Shape the curved crest around an actual finger slot, visible against the window.
        rings=[]
        for depth in (.417,.538):
            outer=[];inner=[]
            for j in range(36):
                a=2*pi*j/36;u,v=cos(a),sin(a)
                xx=.62*math.copysign(abs(u)**.56,u);zz=.873+.066*math.copysign(abs(v)**.65,v)
                outer.append(c.vert((xx*ft,depth*ft,zz)))
                inner.append(c.vert((.19*u*ft,depth*ft,.875+.022*v)))
            rings.append((outer,inner))
        for j in range(36):
            k=(j+1)%36
            for outer,inner in rings:c.face([outer[j],outer[k],inner[k],inner[j]],black)
            for t in (0,1):c.face([rings[0][t][j],rings[1][t][j],rings[1][t][k],rings[0][t][k]],black)
        finish(c)
        rx,ry=(.61,.53) if label=='aisle' else (.53,.61)
        collider('dining_chair_'+label,cx-rx,cx+rx,cy-ry,cy+ry,.015,.94+table_rise)
    side=group('Dining | window and slider blinds, display shelf and framed sign')
    for j in range(43):
        h=head-.037-j*.016
        bx(side,left_jamb+.12,right_jamb-.09,25.695,25.755,h,h+.012,cream)
    bx(side,left_jamb+.06,right_jamb-.05,25.64,25.81,head-.038,head+.006,cream)
    for x in (left_jamb+.30,right_jamb-.23):line(side,(x,25.711,head-.71),(x,25.711,head-.025),.0015,paper)
    # The open patio leaf stacks over the stationary, internally blinded panel.
    for j in range(81):
        h=1.945-j*.023
        bx(side,32.40,35.35,25.889,25.901,h,h+.018,cream)
    bx(side,32.39,35.36,25.881,25.907,1.929,1.958,cream)
    line(side,(32.49,25.874,.915),(32.49,25.835,.949),.009,cream,12)
    line(side,(32.49,25.835,.949),(32.49,25.835,1.117),.009,cream,12)
    line(side,(32.49,25.835,1.117),(32.49,25.874,1.151),.009,cream,12)
    # In L1040608 the little shelf fits entirely on the pier between the
    # sash casing and the patio slider. Lay out its hooks and lettering there.
    center=(right_jamb+slider[0])/2
    bx(side,center-.76,center+.76,25.40,25.85,1.719,1.755,darkoak)
    bx(side,center-.70,center+.70,25.76,25.84,1.56,1.73,darkoak)
    for offset,col in ((-.54,brass2),(-.06,terr),(.42,honey)):
        x=center+offset
        line(side,(x,25.73,1.683),(x+.08,25.65,1.618),.012,col,8)
        line(side,(x+.08,25.65,1.618),(x+.13,25.674,1.63),.002,steel)
    # The narrow hand-lettered shelf sign is visible looking out from the hall.
    bx(side,center-.69,center+.69,25.56,25.75,1.756,2.018,darkoak)
    bx(side,center-.64,center+.64,25.552,25.561,1.769,2.006,cream)
    strokes={
        'L':[[(0,1),(0,0),(1,0)]],
        'E':[[(1,1),(0,1),(0,0),(1,0)],[(0,.52),(.76,.52)]],
        'T':[[(0,1),(1,1)],[(.50,1),(.50,0)]],
        '’':[[(.40,1),(.20,.84)]],
        'S':[[(1,.92),(.77,1),(.27,1),(0,.86),(.08,.64),(.78,.48),(1,.34),(.96,.12),(.72,0),(.20,0),(0,.08)]],
        'A':[[(0,0),(.44,1),(.56,1),(1,0)],[(.23,.40),(.78,.40)]]}
    for letter,offset,w in [('L',-.59,.10),('E',-.43,.10),('T',-.27,.12),('’',-.13,.06),('S',-.05,.10),
                            ('E',.18,.09),('A',.33,.10),('T',.49,.10)]:
        for path in strokes[letter]:
            points=[(center+offset+u*w,25.548,1.805+v*.168) for u,v in path]
            for start,end in zip(points,points[1:]):line(side,start,end,.0028,black,7)
    finish(side)
    # IMG_0007 (Dec 2025) and IMG_0776 (Apr 2026) show the heat pump
    # between the hearth return and window casing, above a two-rocker switch.
    unit=group('Dining | wall-mounted mini-split beside the hearth')
    enamel=material('Mini-split · white enamel','#efeeeb',.04,.34)
    grille=material('Mini-split · outlet shadow','#383d3c',0,.75)
    blade=material('Mini-split · outlet vanes','#d1d2ce',.04,.47)
    left,right=20.81,22.83
    top,base=2.075,1.795
    def casing_section(x0,x1,profile,surface):
        # Counterclockwise cross sections in the wall-depth / height plane.
        ends=[[unit.vert((x*ft,y*ft,h)) for y,h in profile] for x in (x0,x1)]
        unit.face(ends[0][::-1],surface)
        unit.face(ends[1],surface)
        for i in range(len(profile)):
            j=(i+1)%len(profile)
            unit.face([ends[0][i],ends[0][j],ends[1][j],ends[1][i]],surface)
    casing_section(left,right,[(25.21,top-.015),(25.23,base+.079),
                   (25.51,base+.053),(25.56,base+.013),(25.843,base+.013),
                   (25.843,top-.004),(25.27,top)],enamel)
    endcap=[(25.23,base+.080),(25.35,base+.010),(25.54,base),
            (25.85,base+.004),(25.85,base+.093)]
    casing_section(left,left+.12,endcap,enamel)
    casing_section(right-.27,right,endcap,enamel)
    vent_left,vent_right=left+.12,right-.27
    bx(unit,vent_left,vent_right,25.325,25.60,base+.017,base+.081,grille)
    for j in range(1,6):
        x=vent_left+(vent_right-vent_left)*j/6
        bx(unit,x-.009,x+.009,25.25,25.36,base+.026,base+.080,blade)
    casing_section(vent_left,vent_right,[(25.14,base+.038),(25.28,base+.014),
                   (25.31,base+.018),(25.16,base+.043)],blade)
    bx(unit,21.36,21.73,25.80,25.86,1.075,1.187,enamel)
    for x in (21.485,21.605):
        bx(unit,x-.038,x+.038,25.786,25.80,1.101,1.161,rail)
    finish(unit)
build_dining_room()
