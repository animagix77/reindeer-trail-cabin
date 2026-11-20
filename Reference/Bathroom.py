"""Bathroom geometry in plan feet, elevations in metres. Matched to L1040622–624."""
def fitted_bathroom():
    softgreen=material('Bath · sage wall','#9aac95')
    snow=material('Bath · painted tongue and groove','#f2f1e8',0,.62)
    porcelain=material('Bath · white vitreous china','#f7f7ee',.02,.22)
    graphite=material('Bath · espresso vanity lacquer','#332d2b',0,.45)
    walnut=texmat('Bathroom · photographed walnut drawer grain','Bathroom - walnut drawer.jpg')
    nickel=material('Bath · satin nickel','#c1c2bd',.68,.27)
    edge=material('Bath · shower glass edge','#b6cbc2',.12,.34)
    floor_tile=texmat('Bathroom · brushed greige floor porcelain','Bathroom - brushed porcelain.jpg')
    grout=material('Bath · floor joints','#bdbaae',0,.73)
    stone=texmat('Bathroom · split-face shower mosaic','Bathroom - split face stone.jpg')
    principled=stone.node_tree.nodes.get('Principled BSDF');principled.inputs['Roughness'].default_value=.64
    relief=stone.node_tree.nodes.new('ShaderNodeTexImage')
    relief.image=bpy.data.images.load(str(assets/'Bathroom - mosaic normal.png'),check_existing=True)
    relief.image.colorspace_settings.name='Non-Color';relief.image.pack()
    normal=stone.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.50
    stone.node_tree.links.new(relief.outputs['Color'],normal.inputs['Color'])
    stone.node_tree.links.new(normal.outputs['Normal'],principled.inputs['Normal'])
    def local_ceiling(x,y):
        return min(2.12+.066*(y-.13),roofZ(x,y,2)-main-.058)
    # Low window eave, high barn-door end. The split at the two underlying slopes
    # turns gradually enough to retain the daylight reveal above the window.
    extents=[(.13,3.12,22.20),(3.12,10.25,21.38)]
    for lo,hi,left in extents:
        for i in range(7):
            a=lo+(hi-lo)*i/7;b=lo+(hi-lo)*(i+1)/7
            ring=[(left,a),(left,b),(29.04,b),(29.04,a)]
            face('Bathroom · sloped plaster ceiling',[(x,y,local_ceiling(x,y)) for x,y in ring],ceilingmat)
            face('Bathroom · sage shower-side lining',[(left+.018,a,.017),(left+.018,b,.017),
                 (left+.018,b,local_ceiling(left,b)+.012),(left+.018,a,local_ceiling(left,a)+.012)],softgreen)
    face('Bathroom · plaster at footprint return',[(21.38,3.136,.019),(22.2,3.136,.019),
         (22.2,3.136,local_ceiling(22.2,3.12)),(21.38,3.136,local_ceiling(21.38,3.12))],softgreen)
    for lo,hi in [(.13,3.12),(3.12,6.25),(6.25,10.25)]:
        face('Bathroom · vanity wall paint',[(29.015,lo,.02),(29.015,lo,local_ceiling(29.04,lo)),
                (29.015,hi,local_ceiling(29.04,hi)),(29.015,hi,.02)],softgreen)
    # Entrance wall and far wall get the bathroom finish on their inward faces.
    for x0,x1,low,high in [(21.38,26.02,0,None),(28.78,29.04,0,None),(26.02,28.78,2.04,None)]:
        face('Bathroom · inside of barn door wall',[(x0,10.22,low),(x1,10.22,low),(x1,10.22,local_ceiling(x1,10.22)),(x0,10.22,local_ceiling(x0,10.22))],softgreen)
    for x0,x1,lo,hi in [(22.20,24.35,0,None),(26.85,29.04,0,None),(24.35,26.85,0,.82),(24.35,26.85,1.74,None)]:
        face('Bathroom · window return plaster',[(x0,.152,lo),(x1,.152,lo),(x1,.152,hi or local_ceiling(x1,.15)),(x0,.152,hi or local_ceiling(x0,.15))],softgreen)
    trim=group('Bathroom | painted wall boards, window and blind')
    for i in range(5):
        z0=.078+.177*i
        bx(trim,28.957,29.006,.20,10.19,z0,z0+.173,snow)
        bx(trim,28.78,29.01,10.149,10.21,z0,z0+.173,snow)
    bx(trim,28.928,29.008,.2,10.19,.961,.984,snow)
    for x in (24.20,26.84):bx(trim,x,x+.16,.154,.242,.792,1.767,cream)
    bx(trim,24.18,27.03,.14,.277,.789,.816,cream)
    bx(trim,24.2,27.0,.145,.227,1.730,1.764,cream)
    slat=material('Bath · blind warm white','#e0e1d7',0,.68)
    for i in range(35):
        z=1.703-i*.0235;bx(trim,24.41,26.79,.135,.19,z-.017,z,slat)
    for coord in (24.79,26.35):line(trim,(coord,.185,.867),(coord,.185,1.703),.0015,slat)
    # April's doorway photo shows two small gold-framed wildlife prints,
    # one beside the window and one on the return beyond the mirror.
    artframe=material('Bath · brushed gold picture frames','#aa8c53',.48,.43)
    bx(trim,27.22,28.04,.163,.214,1.342,1.692,artframe)
    back_art=texmat('Bath · deer beside window','Bath - far wall deer print.jpg')
    face('Bathroom · far wall wildlife print',[(28.015,.217,1.352),(27.246,.217,1.352),
          (27.246,.217,1.682),(28.015,.217,1.682)],back_art,[(0,0),(1,0),(1,1),(0,1)])
    bx(trim,28.927,29.007,1.42,2.23,1.34,1.69,artframe)
    side_art=texmat('Bath · wildlife print beyond mirror','Bath - side wall deer print.jpg')
    face('Bathroom · side wall wildlife print',[(28.924,2.205,1.349),(28.924,1.445,1.349),
         (28.924,1.445,1.68),(28.924,2.205,1.68)],side_art,[(0,0),(1,0),(1,1),(0,1)])
    finish(trim)
    # Full-scale porcelain field tiles with narrow joints continuous across the return.
    for ya,yb,xleft in extents:
        flat('Bathroom · floor grout',xleft,29.04,ya,yb,.019,grout)
    tiles=group('Bathroom | large rectangular greige porcelain')
    for i in range(8):
        x=21.22+i
        for k in range(6):
            y=.13+k*2
            for ya,yb,xleft in extents:
                l,r=max(x,xleft+.012),min(x+1,29.028);a,b=max(y,ya),min(y+2,yb)
                if r>l and b>a:bx(tiles,l+.004,r-.004,a+.004,b-.004,.020,.027,floor_tile)
    for ya,yb,xleft in extents:bx(tiles,xleft+.016,xleft+.064,ya+.01,yb-.01,.027,.101,floor_tile)
    # Hexagonal skirting (L1040622) continues under the window behind the towels.
    cove_grout=material('Bath · cove grout','#bcb4a9',0,.77)
    cove_stone=[material('Bath · greige hex '+str(i),c,0,.54)
                for i,c in enumerate(('#8a837b','#918980','#958c83','#877e76'))]
    bx(tiles,22.235,28.98,.16,.21,.027,.142,cove_grout)
    radius=.0274
    xmin,xmax=22.235*ft,28.98*ft
    for col in range(49):
        x=xmin+col*1.5*radius
        for row in range(4):
            z=.026+(row+.5*(col%2))*sqrt(3)*radius
            ring=[(x+radius*.96*cos(i*pi/3),z+radius*.96*sin(i*pi/3)) for i in range(6)]
            # Clip partial edge tiles flush at the window-wall return and top of the cove.
            for axis,limit,side in [(0,xmin,1),(0,xmax,-1),(1,.027,1),(1,.141,-1)]:
                clipped=[]
                for a,b in zip(ring,ring[1:]+ring[:1]):
                    da,db=(a[axis]-limit)*side,(b[axis]-limit)*side
                    if da>=0:clipped.append(a)
                    if da*db<0:
                        t=da/(da-db);clipped.append((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))
                ring=clipped
            if len(ring)>2:tiles.face([tiles.vert((px,.214*ft,pz)) for px,pz in ring],cove_stone[(2*row+col)%4])

    finish(tiles)
    # An open walk-in pan. Only the curb-length fixed glass and the closed ends block the visitor.
    x0,x1,y0,y1=21.40,24.32,5.17,10.11
    pan=group('Bathroom | shower threshold, hex mosaic pan and drain')
    bx(pan,x0,x1,y0,y1,.027,.095,ivory)
    bx(pan,x1-.17,x1+.02,y0,y1,.03,.146,counter)
    def tile_face(label,verts,uv):return face(label,verts,stone,uv)
    def back_panel(ya,yb,za,zb):
        tile_face('Bathroom · mosaic with recessed niche',[(x0+.36,ya,za),(x0+.36,yb,za),(x0+.36,yb,zb),(x0+.36,ya,zb)],
                  [(ya*.46,za*1.05),(yb*.46,za*1.05),(yb*.46,zb*1.05),(ya*.46,zb*1.05)])
    for ya,yb,za,zb in [(y0,y1,.115,1.10),(y0,y1,1.65,2.16),(y0,6.50,1.10,1.65),(7.64,y1,1.10,1.65)]:back_panel(ya,yb,za,zb)
    # The model wall is the back of the niche. The surrounding tile face stands forward of it.
    # Offset the niche box toward the shower, so it does not intrude into the neighboring bedroom.
    for ya,yb in [(6.50,7.64)]:
        bx(pan,x0+.030,x0+.38,ya,yb,1.095,1.115,counter)
        bx(pan,x0+.030,x0+.38,ya,yb,1.64,1.66,counter)
        bx(pan,x0+.03,x0+.37,ya,ya+.035,1.11,1.65,counter)
        bx(pan,x0+.03,x0+.37,yb-.035,yb,1.11,1.65,counter)
        tile_face('Bathroom · shower niche back',[(x0+.029,ya,1.11),(x0+.029,yb,1.11),(x0+.029,yb,1.65),(x0+.029,ya,1.65)],[(0,0),(1,0),(1,.54),(0,.54)])
        for j,col in enumerate(('#598d9b','#f6f3e9','#b0848c')):
            pm=material('Bath · shower bottle '+str(j),col,0,.33);y=ya+.20+j*.27
            cyl(pan,x0+.17,y,1.115,1.220+j*.014,.022,pm,14);cyl(pan,x0+.17,y,1.215+j*.014,1.24+j*.014,.012,snow,12)
    for y in (y0+.012,y1-.012):
        tile_face('Bathroom · shower end mosaic',[(x0,y,.114),(x1,y,.114),(x1,y,2.161),(x0,y,2.161)],
                  [(0,0),(1.28,0),(1.28,2.2),(0,2.2)])
    # The shower sides are inside tiled returns, with painted green exteriors.
    bx(pan,x0-.035,x1+.02,y0-.14,y0-.012,.028,2.165,softgreen)
    bx(pan,x0-.035,x1+.02,y1+.012,y1+.085,.028,2.165,softgreen)
    bx(pan,x0,x1+.055,y0-.14,y1+.08,2.158,2.24,snow)
    bx(pan,x1+.004,x1+.060,y0-.14,y1+.08,2.162,2.285,softgreen)
    for a,b in [(y0-.14,y0-.02),(y1+.012,y1+.085)]:
        collider('bath_shower_return_'+str(a),x0,x1+.035,a,b,0,2.16)
    pan_tiles=[material('Bath · hex tile '+str(i),c,0,.49) for i,c in enumerate(('#d5c9bb','#cbbfb1','#d9cec2'))]
    pitch=.168
    for i in range(17):
        xx=x0+.09+i*pitch
        for j in range(30):
            yy=y0+.098+(j+.5*(i%2))*.164
            if yy+.09>=y1 or xx+.085>x1-.17:continue
            ring=[((xx+.101*cos(k*pi/3))*ft,(yy+.091*sin(k*pi/3))*ft) for k in range(6)]
            pan.slab(ring,.094,.099,pan_tiles[(i+2*j)%3])
    # IMG_4190 shows the removable square cover over the recessed strainer.
    bx(pan,22.60,22.94,8.69,9.03,.100,.104,rail)
    bx(pan,22.608,22.932,8.698,9.022,.104,.106,nickel)
    finish(pan)
    shower=group('Bathroom | clear frameless fixed panel, controls and downlight')
    # One transparent sheet avoids four blended faces stacking at grazing angles in WebGL.
    glass_corners=[(x1-.08,7.37,.148),(x1-.08,10.04,.148),(x1-.08,10.04,2.105),(x1-.08,7.37,2.105)]
    shower.face([shower.vert((x*ft,y*ft,z)) for x,y,z in glass_corners],glas)
    line(shower,(x1-.08,7.37,.15),(x1-.08,7.37,2.104),.0025,edge)
    line(shower,(x1-.08,7.37,2.104),(x1-.08,10.04,2.104),.0025,edge)
    for z in (.35,1.74):bx(shower,x1-.145,x1+.005,9.99,10.10,z,z+.046,nickel)
    collider('bath_fixed_shower_panel',x1-.10,x1-.045,7.37,10.08,.10,2.105)
    line(shower,(22.93,10.080,1.13),(22.93,9.98,1.13),.065,nickel,24)
    line(shower,(22.93,9.98,1.13),(22.91,9.86,1.075),.010,nickel,12)
    line(shower,(22.91,10.08,1.897),(22.91,9.76,1.921),.010,nickel,16)
    # Tapered showerhead, satin face and spray holes on its tilted underside.
    arm_base=Vector((22.91*ft,9.76*ft,1.921));spray=Vector((0,-.66,-.75)).normalized()
    shoulder=arm_base+spray*.025;rim=arm_base+spray*.07
    shower.beam(arm_base,shoulder,.016,nickel,24,.026)
    shower.beam(shoulder,rim,.026,nickel,32,.051)
    shower.beam(rim,rim+spray*.003,.047,nickel,32)
    across=Vector((1,0,0));up=spray.cross(across)
    for j in range(18):
        ang=j*pi/9;pt=rim+spray*.003+across*(.034*cos(ang))+up*(.034*sin(ang))
        shower.beam(pt,pt+spray*.002,.0027,graphite,6)

    cyl(shower,22.89,7.63,2.143,2.159,.067,cream,24);cyl(shower,22.89,7.63,2.142,2.147,.053,lamp,24)
    finish(shower)
    # Dark open-bottom cabinet with a walnut drawer and a recessed, white rectangular vessel.
    vanity=group('Bathroom | open espresso vanity, walnut drawer and square vessel')
    for x in (27.28,28.74):
        for y in (4.25,6.42):bx(vanity,x,x+.13,y,y+.13,.036,.75,graphite)
    bx(vanity,27.26,28.94,4.23,6.56,.128,.165,graphite)
    for y in (4.23,6.46):bx(vanity,27.30,28.93,y,y+.095,.14,.74,graphite)
    bx(vanity,27.28,28.94,4.23,6.56,.72,.773,graphite)
    bx(vanity,27.28,27.40,4.40,6.39,.355,.674,walnut)
    # The photographed drawer is a single continuous figured walnut front.
    bx(vanity,27.245,27.30,5.34,5.46,.58,.615,nickel)
    for y in (4.64,5.25,5.86):
        cyl(vanity,27.94,y,.165,.277,.058,snow,24);cyl(vanity,27.94,y,.277,.278,.016,darkoak,14)
    bx(vanity,27.31,28.91,4.32,6.47,.773,.793,porcelain)
    def corners(box):
        a,b,c,d,h=box
        return [vanity.vert((x*ft,y*ft,h)) for x,y in [(a,c),(b,c),(b,d),(a,d)]]
    rims=[corners(v) for v in [(27.32,28.91,4.32,6.47,.785),(27.32,28.91,4.32,6.47,.928),
                                (27.39,28.65,4.40,6.39,.928),(27.60,28.48,4.66,6.13,.807)]]
    basin_glaze=material('Bath · off-white basin interior','#dadfdc',.02,.28)
    basin_bottom=material('Bath · shadowed porcelain at drain','#cbd2d0',.02,.29)
    for layer,(l,r) in enumerate(zip(rims,rims[1:])):
        for i in range(4):vanity.face([l[i],l[(i+1)%4],r[(i+1)%4],r[i]],basin_glaze if layer==2 else porcelain)
    vanity.face(rims[-1],basin_bottom)
    cyl(vanity,28.00,5.35,.807,.814,.028,nickel,24)
    cyl(vanity,28.00,5.35,.814,.815,.017,graphite,22)
    cyl(vanity,28.00,5.35,.815,.819,.011,nickel,20)
    for dx,dy in [(28.78,4.88),(28.78,5.85)]:
        cyl(vanity,dx,dy,.927,.990,.027,nickel,18,.016)
        line(vanity,(dx,dy,.983),(dx-.15,dy,.995),.008,nickel)
    cyl(vanity,28.79,5.38,.927,.985,.029,nickel,20,.019)
    for a,b in zip([(28.79,5.38,.97),(28.78,5.38,1.036),(28.72,5.38,1.061),(28.59,5.38,1.067),(28.48,5.38,1.05)],
                   [(28.78,5.38,1.036),(28.72,5.38,1.061),(28.59,5.38,1.067),(28.48,5.38,1.05),(28.45,5.38,1.027)]):line(vanity,a,b,.014,nickel,14)
    collider('bath_open_vanity',27.26,29.0,4.23,6.56,0,.94)
    # The actual photographed mirror reflection contains the opposite doorway and tiled shower.
    frame=texmat('Bathroom · photographed weathered mirror frame','Bathroom - driftwood trim.jpg')
    for y in (3.98,6.63):bx(vanity,28.80,28.96,y,y+.15,1.043,1.978,frame)
    for z in (1.043,1.925):bx(vanity,28.80,28.96,4.09,6.68,z,z+.053,frame)
    for y0,y1 in [(3.98,4.13),(6.63,6.78)]:
        face('Bathroom · vertical grain in mirror stile',[(28.798,y0,1.046),(28.798,y1,1.046),
             (28.798,y1,1.976),(28.798,y0,1.976)],frame,[(0,0),(0,1),(1,1),(1,0)])
    reflection=texmat('Bathroom · reflected entry and opposite shower','Bathroom - mirror reflection.jpg')
    reflection.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.29
    face('Bathroom · vanity mirror',[(28.825,6.63,1.099),(28.825,3.99+.15,1.099),(28.825,4.14,1.925),(28.825,6.63,1.925)],
         reflection,[(0,0),(1,0),(1,1),(0,1)])
    bx(vanity,28.83,28.98,4.96,5.73,2.027,2.112,rail)
    line(vanity,(28.85,5.36,2.088),(28.47,5.36,2.118),.014,rail,12)
    line(vanity,(28.47,4.48,2.118),(28.47,6.24,2.118),.012,rail,12)
    # L1040624: black sockets and clear Edison A19 bulbs with exposed amber filaments.
    bulb_glass=material('Bath · clear bulb envelope','#dce5dd',.10,.18)
    bulb_glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.14
    if hasattr(bulb_glass,'surface_render_method'):bulb_glass.surface_render_method='BLENDED'
    wire=material('Bath · amber wire filaments','#e5a047',.25,.34)
    wire_shader=wire.node_tree.nodes.get('Principled BSDF')
    wire_shader.inputs['Emission Color'].default_value=(1,.39,.065,1)
    wire_shader.inputs['Emission Strength'].default_value=.56
    for y in (4.50,5.36,6.22):
        cyl(vanity,28.47,y,2.038,2.119,.012,rail,16)
        cyl(vanity,28.47,y,2.006,2.051,.021,rail,24)
        rings=[]
        for h,rad in ((2.011,.012),(1.996,.017),(1.982,.025),(1.965,.034),(1.947,.036),
                      (1.929,.031),(1.919,.021),(1.914,.009),(1.913,.002)):
            rings.append([vanity.vert((28.47*ft+rad*cos(k*pi/12),y*ft+rad*sin(k*pi/12),h)) for k in range(24)])
        for upper,lower in zip(rings,rings[1:]):
            for k in range(24):
                j=(k+1)%24
                vanity.face([lower[k],lower[j],upper[j],upper[k]],bulb_glass,smooth=True)
        line(vanity,(28.47,y,2.002),(28.47,y,1.936),.0015,nickel,8)
        for j in range(2):
            points=[]
            for k in range(22):
                a=j*pi+k*.46;rad=.010+.005*sin(k*pi/21)
                points.append((28.47+rad*cos(a)/ft,y+rad*sin(a)/ft,1.986-k*.00227))
            for a,b in zip(points,points[1:]):line(vanity,a,b,.0011,wire,6)
    # Towel ring and toilet roll holder on the cabinet side.
    line(vanity,(29,3.75,1.051),(28.76,3.75,1.051),.017,nickel)
    for j in range(28):
        an=j*2*pi/28;bn=(j+1)*2*pi/28
        line(vanity,(28.75,3.75+.230*sin(an),.993+.064*cos(an)),(28.75,3.75+.230*sin(bn),.993+.064*cos(bn)),.0045,nickel)
    for xa in (27.39,28.02):
        bx(vanity,xa,xa+.035,6.53,6.72,.55,.57,nickel)
    line(vanity,(27.40,6.70,.56),(28.05,6.70,.56),.010,nickel,14)
    line(vanity,(27.53,6.70,.56),(27.94,6.70,.56),.053,snow,22)
    finish(vanity)
    wc=group('Bathroom | white close-coupled toilet alongside the vanity')
    py=7.76
    bx(wc,27.25,28.58,py-.46,py+.46,.028,.317,porcelain,3)
    bx(wc,28.45,28.925,py-.68,py+.68,.34,.758,porcelain,8)
    bx(wc,28.41,28.94,py-.70,py+.70,.752,.782,porcelain,8)
    bx(wc,28.39,28.43,py+.35,py+.52,.678,.697,nickel)
    rings=[]
    for rx,ry,h in [(.61,.43,.218),(.82,.57,.252),(.93,.64,.326),(.94,.65,.419),(.95,.67,.447),(.67,.40,.448),(.60,.34,.382),(.37,.22,.314)]:
        rings.append([wc.vert(((27.73+rx*cos(j*pi/20))*ft,(py+ry*sin(j*pi/20))*ft,h)) for j in range(40)])
    for aa,bb in zip(rings,rings[1:]):
        for i in range(40):wc.face([aa[i],aa[(i+1)%40],bb[(i+1)%40],bb[i]],porcelain,smooth=True)
    # A raised oval lid sits just in front of the cistern in L1040624.
    lid=[]
    for x in (28.24,28.33):
        lid.append([wc.vert(((x+.126*cos(j*pi/18))*ft,(py+.59*sin(j*pi/18))*ft,
                            .667+.226*cos(j*pi/18))) for j in range(36)])
    wc.face(lid[0],porcelain);wc.face(lid[1][::-1],porcelain)
    for j in range(36):
        k=(j+1)%36;wc.face([lid[0][j],lid[1][j],lid[1][k],lid[0][k]],porcelain,smooth=True)
    wc.face(rings[-1],material('Bath · water in porcelain','#c7d0c7',.09,.25))
    finish(wc);collider('bath_toilet',26.81,28.95,py-.67,py+.67,0,.77)
    # Folded bath towels behind the shower and a narrow toiletries shelf past the basin.
    store=group('Bathroom | towel shelves, bath mats and washstand cabinet')
    # IMG_3950 shows a tall cream metal baker's rack in the window alcove.
    rack=material('Bath towel rack · cream enamel','#d3c8ad',.18,.54)
    for y in (.72,3.92):
        for x,height in ((22.39,1.72),(23.44,.82)):
            bx(store,x-.041,x+.041,y-.040,y+.040,.031,height,rack)
        line(store,(23.44,y,.825),(22.39,y,1.424),.008,rack)
    for z in (.11,.38,1.425):
        edge=23.00 if z>1 else 23.43
        for x in (22.39,edge):line(store,(x,.72,z),(x,3.92,z),.009,rack)
        for i in range(17):
            yy=.72+i*.20;line(store,(22.39,yy,z),(edge,yy,z),.0035,rack)
    bx(store,22.36,23.48,.67,3.97,.806,.834,woodboard)
    for z,bow in ((1.53,.065),(1.697,.070)):
        pts=[(22.39,.72+3.20*i/24,z+bow*sin(pi*i/24)**2) for i in range(25)]
        for pa,pb in zip(pts,pts[1:]):line(store,pa,pb,.008,rack)
    for side in (-1,1):
        pts=[]
        for j in range(31):
            t=j/30;ang=-pi/2+1.7*pi*t;r=.093-.057*t
            pts.append((22.39,2.32+side*(.79+r/ft*cos(ang)),1.614+r*sin(ang)))
        for pa,pb in zip(pts,pts[1:]):line(store,pa,pb,.006,rack)
    towelm=[material('Bath linen · '+n,c,0,.94) for n,c in [('mint','#77aaaa'),('cream','#e6dfcd'),('coral','#a66569'),('blue','#718fa4')]]
    for row,z in enumerate((.391,.839,1.434)):
        for col in range(2):
            for layer in range((5,1,2)[row]):
                yy=.83+col*1.46+.025*(layer%2);hh=z+layer*.037
                bx(store,22.42,22.99 if row==2 else 23.41,yy,yy+1.24,hh,hh+.037,towelm[(row+col+layer//2)%4],8)
    # Owner's vanity closeup shows the white cabinet touching the vanity,
    # with a shadowed open cubby over two paneled doors and a small step beyond.
    cab_end,cab_start=2.04,4.20
    for y in (cab_end,cab_start-.08):bx(store,27.81,28.92,y,y+.08,.035,.73,snow)
    for z in (.10,.47,.73):bx(store,27.78,28.95,cab_end-.025,cab_start+.015,z,z+.028,snow)
    bx(store,28.88,28.92,cab_end,cab_start,.12,.734,snow)
    for ya,yb in ((cab_end+.069,3.106),(3.119,cab_start-.066)):
        bx(store,27.77,27.84,ya,yb,.12,.466,snow)
        bx(store,27.756,27.775,ya+.085,yb-.085,.15,.435,cream)
    for yy in (3.035,3.19):line(store,(27.78,yy,.409),(27.72,yy,.409),.010,nickel,12)
    stool_top=material('Bath · step stool tread','#484845',0,.85)
    bx(store,27.78,28.80,1.043,1.89,.127,.161,snow,8)
    bx(store,27.83,28.75,1.093,1.84,.158,.166,stool_top,7)
    for yy in (1.08,1.75):bx(store,27.81,28.76,yy,yy+.10,.029,.14,snow)
    # Small dark pedal bin alongside the toilet, visible in the vanity closeup.
    cyl(store,28.36,6.84,.028,.271,.085,graphite,24,.092)
    cyl(store,28.36,6.84,.268,.284,.094,graphite,24)
    bx(store,28.01,28.13,6.73,6.95,.038,.048,nickel)
    for j in range(3):
        yy=2.42+j*.58;cyl(store,28.38,yy,.758,.854,.022,towelm[(j+1)%4],14);cyl(store,28.38,yy,.854,.877,.013,nickel,12)
    sponge=material('Bath mat · charcoal cotton','#373835',0,.94)
    for xa,xb,ya,yb,mm in [(24.48,25.75,6.36,8.75,sponge),(26.00,27.14,4.53,6.50,towelm[0])]:
        bx(store,xa,xb,ya,yb,.030,.039,mm,9)
    finish(store)
    collider('bath_linen_shelves',22.34,23.49,.64,4.02,0,1.73)
    collider('bath_washstand_cabinet',27.75,28.96,1.02,4.22,0,.76)
fitted_bathroom()
