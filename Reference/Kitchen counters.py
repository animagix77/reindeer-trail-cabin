"""Kitchen fit-out from owner's L1040596–598, L1040612, L1040614 and the three owner views of the hall, vault and threshold.
Called inside the main-floor furnishing pass. Local horizontal units are feet,
vertical units are metres. The corner, appliances and kitchen aisles share this layout.
"""
def fit_kitchen():
    from math import cos, pi, sin, tau
    from mathutils import Matrix
    quartz=material('Kitchen worktops · warm white','#eee9de',0.04,.29)
    paint=material('Kitchen Shaker cabinets · espresso','#443a31',0,.56)
    dark=material('Recessed toe kick','#292623')
    inset=material('Recessed cabinet panels','#392f28',0,.60)
    shelves=material('Maple shelves and island planks','#ae8a64',0,.66)
    enamel=material('Counter microwave · robin egg blue','#81c0c5',.15,.30)
    creamware=material('Stoneware · ivory','#e8ddc5',.02,.27)
    pine=material('Plate ware · teal','#3e858c',.03,.24)
    cranberry=material('Stoneware · cranberry','#98545c',.02,.32)
    silver=material('Polished appliance trim','#c0c2be',.63,.26)
    blackglass=material('Tinted dark appliance glass','#24292b',.28,.16)
    framework=group('Kitchen | window and return base cabinetry')
    # No filled carcass behind the open sink bowl. Drawer reveals remain visible.
    def door_run(y0,y1,double=False):
        # The two sink fronts finish below the stainless apron.
        head=.677 if 14.74<=y0<17.14 else .84
        rows=(.12,.68,head) if double else (.12,head)
        for z0,z1 in zip(rows,rows[1:]):
            bx(framework,38.53,38.62,y0+.025,y1-.025,z0,z1,paint)
            bx(framework,38.50,38.53,y0+.10,y1-.10,z0+.046,z1-.045,inset)
            if double and z0>.65:
                line(framework,(38.45,y0+.14,(z0+z1)/2),(38.45,y1-.14,(z0+z1)/2),.008,silver)
            else:
                yy=y0+.15
                line(framework,(38.44,yy,z1-.085),(38.44,yy,z1-.19),.007,silver)
    for a,b in [(12.58,14.734),(17.148,17.925),(20.435,23.14)]:
        bx(framework,38.62,40.76,a,b,.092,.855,paint)
    for a,b in [(12.58,14.74),(14.74,15.94),(15.94,17.14),(17.14,17.93),(20.43,21.79),(21.79,23.14)]:
        door_run(a,b,a>=17.14)
    for a,b in ((12.59,17.923),(20.437,23.14)):
        bx(framework,38.71,40.76,a,b,.025,.107,dark)
    # Return runs from the sink corner toward dining along the solid bedroom wall.
    bx(framework,34.12,38.64,12.60,14.52,.091,.859,paint)
    bx(framework,34.17,38.57,12.61,14.39,.026,.108,dark)
    for xa,xb in [(34.13,36.28),(36.28,38.56)]:
        for z0,z1 in [(.12,.45),(.46,.69),(.70,.855)]:
            bx(framework,xa+.024,xb-.024,14.50,14.55,z0,z1,paint)
            bx(framework,xa+.11,xb-.11,14.55,14.565,z0+.045,z1-.044,inset)
            wid=.43 if z0>.68 else .54;mid=(xa+xb)/2;zh=z1-.055
            line(framework,(mid-wid,14.66,zh),(mid+wid,14.66,zh),.009,silver)
            for xx in (mid-wid,mid+wid):line(framework,(xx,14.54,zh),(xx,14.66,zh),.008,silver)
    finish(framework)
    # IMG_4658 looks across the island from the door and shows the steel
    # pedal bin at the end of the short return, on a scalloped rubber tray.
    entry_bin=group('Kitchen | pedal bin and rubber floor tray')
    xx,yy=33.46,13.23
    outline=[]
    for corner,(sx,sy) in enumerate(((1,1),(-1,1),(-1,-1),(1,-1))):
        for step in range(6):
            angle=(corner+step/5)*pi/2
            outline.append(((xx-.33+sx*.82+.20*cos(angle))*ft,(yy+sy*.35+.20*sin(angle))*ft))
    entry_bin.slab(outline,.008,.019,dark)
    for z0,z1,r0,r1,finish_mat in ((.019,.048,.13,.151,dark),(.048,.552,.147,.155,steel),(.552,.564,.157,.157,rail),(.564,.58,.156,.147,silver)):
        cyl(entry_bin,xx,yy,z0,z1,r0,finish_mat,36,r1)
    bx(entry_bin,xx-.57,xx-.42,yy-.17,yy+.17,.032,.054,silver,3)
    finish(entry_bin)
    collider('kitchen_pedal_bin',xx-.52,xx+.52,yy-.51,yy+.51,.018,.58)
    worktop=group('Kitchen | white L-shaped counters · window run and appliance return')
    top=.91;bottom=.869
    # An L polygon eliminates a coplanar join at the corner. The sink is open at
    # its front edge, with a narrow bridge behind the bowl. The stove interrupts the top.
    corner=[(34.02,12.56),(40.78,12.56),(40.78,17.93),(38.48,17.93),
            (38.48,17.14),(40.15,17.14),(40.15,14.74),(38.48,14.74),
            (38.48,14.67),(34.02,14.67)]
    worktop.slab([(x*ft,y*ft) for x,y in corner],bottom,top,quartz)
    bx(worktop,38.48,40.78,20.43,23.15,bottom,top,quartz)
    finish(worktop)
    sink=group('Kitchen | stainless apron sink and spring-coil faucet')
    bx(sink,38.45,38.53,14.74,17.14,.683,.914,silver)
    bx(sink,38.53,40.17,14.74,17.14,.737,.75,sinkgrey)
    for yy in (14.74,17.10):bx(sink,38.53,40.17,yy,yy+.042,.742,.913,silver)
    bx(sink,40.12,40.17,14.74,17.14,.742,.914,silver)
    drainy=15.94
    cyl(sink,39.48,drainy,.75,.755,.043,silver,20)
    cyl(sink,39.48,drainy,.755,.757,.024,dark,16)
    # Commercial pull-down faucet. A helix wraps the arched hose all the way over
    # its bend; the small metal sprayer hangs above the bowl as in L1040596.
    cyl(sink,40.31,drainy,.910,.943,.043,silver)
    cyl(sink,40.31,drainy,.934,1.158,.020,silver)
    line(sink,(40.31,drainy,1.003),(40.31,drainy-.27,1.003),.012,silver)
    line(sink,(40.31,drainy-.27,1.003),(40.31,drainy-.27,1.129),.008,silver)
    arc=[];spring=[]
    for j in range(151):
        t=j/150;ang=pi*t;x=39.84+.47*cos(ang);z=1.153+.151*sin(ang)
        arc.append((x,drainy,z))
        phase=tau*15*t
        spring.append((x+.049*cos(ang)*cos(phase),drainy+.047*sin(phase),z+.014*sin(ang)*cos(phase)))
    for k in range(0,150,6):line(sink,arc[k],arc[k+6],.0075,rail,8)
    for a,b in zip(spring,spring[1:]):line(sink,a,b,.0036,silver,6)
    line(sink,(39.37,drainy,1.157),(39.37,drainy,1.072),.010,silver)
    cyl(sink,39.37,drainy,1.045,1.098,.025,silver,16,.016)
    finish(sink)
    appliances=group('Kitchen | stainless range, vent hood and tall refrigerator')
    y0,y1=17.93,20.43;cy=(y0+y1)/2
    bx(appliances,38.43,40.76,y0,y1,.047,.884,steel)
    bx(appliances,38.39,38.435,y0+.035,y1-.035,.145,.785,rail)
    bx(appliances,38.37,38.391,y0+.10,y1-.10,.167,.707,silver)
    bx(appliances,38.36,38.373,y0+.16,y1-.16,.235,.666,blackglass)
    bx(appliances,38.408,38.434,y0+.018,y1-.018,.787,.887,blackglass)
    for yy in (y0+.15,y1-.15):
        line(appliances,(38.39,yy,.747),(38.20,yy,.747),.017,silver,12)
    line(appliances,(38.20,y0+.14,.747),(38.20,y1-.14,.747),.020,silver,20)
    bx(appliances,38.42,40.69,y0+.018,y1-.018,.883,.908,cooktop)
    graphite=material('Ceramic hob · element outlines','#414544',.13,.38)
    for xx,yy,radii in ((39.00,cy-.61,(.112,.080)),(39.07,cy+.57,(.096,)),
                         (39.90,cy-.53,(.084,)),(39.90,cy+.57,(.099,.074))):
        for radius in radii:
            rings=[[appliances.vert((xx*ft+r*cos(tau*j/36),yy*ft+r*sin(tau*j/36),.9087))
                    for j in range(36)] for r in (radius,radius-.0018)]
            for j in range(36):
                k=(j+1)%36
                appliances.face([rings[0][j],rings[0][k],rings[1][k],rings[1][j]],graphite)
    # The stainless controls rake back toward the gable above a glossy black riser.
    bx(appliances,40.41,40.74,y0+.016,y1-.016,.907,1.003,rail)
    def backguard_x(z):
        return 40.39+(z-1.001)*1.46
    def control_plate(ylo,yhi,zlo,zhi,standout,mat):
        corners=[(ylo,zlo),(ylo,zhi),(yhi,zhi),(yhi,zlo)]
        ids=[appliances.vert(((backguard_x(z)-standout)*ft,y*ft,z)) for y,z in corners]
        appliances.face(ids,mat)
    pts=[(40.39,1.001),(backguard_x(1.171),1.171),(40.76,1.171),(40.76,1.001)]
    lo=[appliances.vert((x*ft,(y0+.018)*ft,z)) for x,z in pts]
    hi=[appliances.vert((x*ft,(y1-.018)*ft,z)) for x,z in pts]
    appliances.face(lo[::-1],steel);appliances.face(hi,steel)
    for j in range(4):
        k=(j+1)%4;appliances.face([lo[j],lo[k],hi[k],hi[j]],silver)
    control_plate(cy-.50,cy+.50,1.037,1.136,.008,blackglass)
    for j in range(7):
        for z in (1.058,1.076,1.093):
            yy=cy-.40+j*.13
            control_plate(yy-.021,yy+.021,z,z+.004,.010,steel)
    for yy in (y0+.15,y0+.42,y0+.66,y1-.42,y1-.14):
        z=1.082;x=backguard_x(z)
        line(appliances,(x,yy,z),(x-.065,yy,z+.008),.024,blackglass,20)
        line(appliances,(x-.044,yy,z+.006),(x-.111,yy,z+.015),.019,silver,20)
        line(appliances,(x-.113,yy,z+.018),(x-.102,yy,z+.030),.0029,rail)
    # Low hood and centered rectangular flue, between both windows.
    bx(appliances,38.74,40.831,y0-.06,y1+.06,1.687,1.76,silver)
    bx(appliances,38.735,38.743,cy-.47,cy+.47,1.705,1.746,blackglass)
    for yy in (cy-.30,cy-.15,cy,cy+.15,cy+.30):
        line(appliances,(38.734,yy,1.724),(38.731,yy,1.724),.004,silver,8)
    bx(appliances,38.85,40.75,y0+.04,y1-.04,1.680,1.708,rail)
    for j in range(14):
        yy=y0+.34+j*.143
        bx(appliances,39.05,40.52,yy,yy+.055,1.676,1.683,steel)
    for yy in (y0+.15,y1-.15):
        cyl(appliances,38.98,yy,1.672,1.684,.024,creamware,18)
    # The steel chimney ends below the gable peak and its back is flush against the wood.
    bx(appliances,40.04,40.831,cy-.53,cy+.53,1.759,min(2.85,topz(40.4,cy)-.035),steel)
    bx(appliances,40.035,40.042,cy-.529,cy+.529,2.398,2.402,silver)
    # L1040614 shows a charcoal side, the pull on the patio edge, a separate
    # lower freezer and an exposed side grille inside the compressor cover.
    appliance_side=material('Refrigerator · charcoal side panel','#272a2a',.32,.40)
    bx(appliances,38.27,40.75,23.15,25.74,.033,1.795,appliance_side)
    bx(appliances,38.178,38.295,23.177,25.71,.477,1.789,steel)
    bx(appliances,38.157,38.294,23.183,25.704,.096,.461,steel)
    bx(appliances,38.245,38.32,23.23,25.66,.023,.096,rail)
    for z in (.617,1.448):
        line(appliances,(38.183,25.51,z),(37.98,25.51,z),.016,silver,16)
    line(appliances,(37.98,25.51,.550),(37.98,25.51,1.531),.0135,silver,18)
    for yy in (23.34,25.55):
        line(appliances,(38.16,yy,.404),(37.99,yy,.404),.012,silver,14)
    line(appliances,(37.99,23.29,.404),(37.99,25.60,.404),.013,silver,16)
    bx(appliances,38.36,40.25,23.21,25.66,1.797,2.088,appliance_side)
    for z in (1.79,2.088):
        bx(appliances,38.172,40.38,23.15,25.73,z,z+.020,silver)
    for yy in (23.15,25.68):
        bx(appliances,38.175,38.224,yy,yy+.045,1.801,2.105,silver)
    for j in range(6):
        z=1.822+j*.045
        appliances.cube((38.24*ft,24.442*ft,z),(.035,2.43*ft,.014),steel,euler=(0,-.44,0))
    for j in range(8):
        z=1.827+j*.033
        bx(appliances,38.32,40.25,23.171,23.210,z,z+.010,rail)
    bx(appliances,40.27,40.33,23.17,23.23,1.801,2.10,silver)
    # Matte articulated pot filler to the right of center; both arms fold against the pine.
    patina=material('Oil-rubbed pot filler','#66523b',.59,.36)
    line(appliances,(40.76,18.61,1.301),(40.54,18.61,1.301),.028,patina,16)
    cyl(appliances,40.54,18.61,1.298,1.438,.015,patina)
    for xx,zz in ((40.50,1.368),(40.36,1.434)):
        line(appliances,(xx,18.62,zz),(xx,19.58,zz),.010,patina,12)
        for yy in (18.62,19.58):cyl(appliances,xx,yy,zz-.017,zz+.017,.017,patina)
    line(appliances,(40.50,19.58,1.368),(40.36,19.58,1.434),.010,patina)
    line(appliances,(40.36,18.63,1.436),(40.29,18.63,1.407),.013,patina)
    line(appliances,(40.50,18.64,1.466),(40.45,18.87,1.466),.0065,patina)
    # The arched tabletop sign remains blank in the public tour.
    sign_frame=material('Chalkboard · muted sage frame','#73795e')
    chalk=material('Chalkboard · slate','#303632')
    def sign_face(half,bottom,zcenter,front,m):
        poly=[(-half,bottom),(half,bottom),(half,zcenter)]
        for idx in range(1,20):
            a=pi*idx/19
            poly.append((half*cos(a),zcenter+half*ft*sin(a)))
        ids=[appliances.vert((front*ft,(22.33+v)*ft,h)) for v,h in poly]
        appliances.face(ids,m)
    sign_face(.34,.936,1.144,39.83,sign_frame)
    sign_face(.29,.958,1.141,39.824,chalk)
    for yy in (22.03,22.63):
        line(appliances,(39.79,yy,.912),(39.82,yy,1.07),.007,sign_frame)
        line(appliances,(40.09,yy,.911),(39.84,yy,1.107),.007,sign_frame)
    # Counter paper towel roll and brushed appliance pulls.
    cyl(appliances,39.98,17.53,.912,.927,.062,shelves,22)
    cyl(appliances,39.98,17.53,.927,1.139,.053,creamware,32)
    cyl(appliances,39.98,17.53,1.139,1.151,.009,shelves,12)
    tea_towel=material('Oven towel · oat plaid','#e4c4a4',0,.94)
    plaid=material('Oven towel · copper stripe','#a26b54',0,.93)
    bx(appliances,38.08,38.20,18.45,19.05,.439,.760,tea_towel)
    for yy in (18.51,18.57,18.82,18.88):
        bx(appliances,38.074,38.08,yy,yy+.018,.442,.753,plaid)
    for hh in (.453,.473,.555,.64):
        bx(appliances,38.068,38.074,18.453,19.047,hh,hh+.006,plaid)
    finish(appliances)
    collider('kitchen_window_counters',38.36,40.87,12.55,25.78,0,.94)
    collider('kitchen_fridge',37.93,40.77,23.13,25.78,0,2.11)
    collider('kitchen_counter_return',34.015,38.48,12.54,14.68,0,.92)
    # The return is the coffee station documented in the front-on photograph.
    station=group('Kitchen | counter microwave, apothecary drawers, coffee maker and pantry shelves')
    bx(station,35.09,36.62,12.86,13.91,.916,1.182,enamel,11)
    bx(station,35.49,36.575,13.888,13.945,.944,1.159,rail,9)
    bx(station,35.54,36.53,13.941,13.956,.953,1.150,blackglass,9)
    # The handle bows forward beside the glass instead of being a line on its face.
    handle=[(35.49,13.94,.943),(35.52,14.017,.966),(35.56,14.051,1.038),(35.54,14.037,1.111),(35.48,13.94,1.159)]
    for a,b in zip(handle,handle[1:]):line(station,a,b,.0095,silver,12)
    bx(station,35.171,35.403,13.91,13.938,1.116,1.157,creamware,8)
    bx(station,35.194,35.380,13.934,13.945,1.123,1.149,blackglass)
    for z in (1.098,1.076,1.054):bx(station,35.20,35.37,13.914,13.95,z,z+.008,silver)
    line(station,(35.29,13.928,.997),(35.29,13.962,.997),.025,silver,20)
    line(station,(35.29,13.963,.988),(35.29,13.965,1.006),.0028,rail)
    # Eighteen separate painted spice drawers, with inset label plates and knobs.
    edges=material('Spice chest · worn pale oak edges','#bdab8c',0,.78)
    enamel_white=material('Spice drawers · antique ivory','#ece0ca',0,.68)
    bx(station,36.72,38.62,12.84,13.60,.938,1.244,edges)
    for z in (.929,1.242):
        bx(station,36.68,38.66,12.81,13.66,z,z+.021,creamware)
    for xx in (36.77,38.42):bx(station,xx,xx+.13,13.334,13.59,.91,.95,edges)
    for ix in range(6):
        for iz in range(3):
            x=36.745+.310*ix;z=.949+.096*iz
            bx(station,x,x+.293,13.592,13.623,z,z+.087,enamel_white,18)
            bx(station,x+.090,x+.207,13.622,13.633,z+.045,z+.066,shelves)
            line(station,(x+.146,13.63,z+.040),(x+.146,13.668,z+.040),.0067,patina,10)
    bx(station,38.69,39.35,12.85,13.49,.916,.953,creamware,9)
    bx(station,38.82,39.23,12.83,13.09,.954,1.210,creamware)
    bx(station,38.65,39.35,12.84,13.47,1.184,1.257,creamware,9)
    cyl(station,39.0,13.28,.959,1.074,.060,blackglass,20,.070)
    for xx,yy,h,rad in [(34.46,13.13,.235,.078),(34.78,13.62,.174,.061)]:
        cyl(station,xx,yy,.913,.924,rad*.96,creamware,25)
        cyl(station,xx,yy,.924,.913+h,rad,creamware,25,rad*.94)
        cyl(station,xx,yy,.913+h,.927+h,rad*1.01,creamware,25)
        cyl(station,xx,yy,.927+h,.948+h,rad,creamware,25,rad*.62)
        cyl(station,xx,yy,.948+h,.963+h,.013,creamware,14,.021)
    for z in (1.374,1.735):
        bx(station,34.52,39.82,12.59,13.42,z,z+.030,shelves)
        for xx in (35.14,38.93):
            bx(station,xx-.056,xx+.056,12.60,12.72,z-.174,z,rail)
            line(station,(xx,12.67,z-.15),(xx,13.24,z-.015),.010,rail)
    for j in range(6):
        cyl(station,37.52,13.02,1.407+j*.008,1.414+j*.008,.104,pine,28)
    def mug(x,z,col):
        cyl(station,x,13.05,z,z+.076,.034,col,16,.039)
        cyl(station,x,13.05,z+.076,z+.079,.031,sinkgrey,16)
        for a,b in [((x+.078,13.05,z+.059),(x+.177,13.05,z+.060)),
                    ((x+.177,13.05,z+.060),(x+.177,13.05,z+.025)),
                    ((x+.177,13.05,z+.025),(x+.078,13.05,z+.023))]:
            line(station,a,b,.0065,col,7)
    for xx in (34.89,35.23,35.57,36.0,36.42):mug(xx,1.406,creamware)
    for xx in (38.32,38.69,39.06,39.43):mug(xx,1.406,silver)
    for j,xx in enumerate((34.95,35.42,36.02,37.03,37.58,38.19,38.87,39.30)):
        h=1.77+(.10,.07,.176,.11)[j%4]
        cyl(station,xx,13.03,1.765,h,.058,[creamware,pine,cranberry][j%3],20,.073)
    finish(station)
    # Face the pine planks in the direction of the actual gable across both windows.
    def mapped_material(name,file,rough,alpha=1):
        m=material(name,'#ffffff',0,rough);bs=m.node_tree.nodes.get('Principled BSDF')
        src=m.node_tree.nodes.new('ShaderNodeTexImage')
        src.image=bpy.data.images.load(str(work/'Interior materials'/file),check_existing=True)
        src.image.pack();m.node_tree.links.new(src.outputs['Color'],bs.inputs['Base Color'])
        if alpha<1:
            bs.inputs['Alpha'].default_value=alpha;m.surface_render_method='BLENDED'
            m.node_tree.links.new(src.outputs['Color'],bs.inputs['Emission Color'])
            bs.inputs['Emission Strength'].default_value=.105
        return m
    boards=mapped_material('Kitchen gable · horizontal knotty pine','Kitchen - knotty pine boards.jpg',.71)
    relief=boards.node_tree.nodes.new('ShaderNodeTexImage')
    relief.image=bpy.data.images.load(str(work/'Interior materials'/'Kitchen - knotty pine relief.jpg'),check_existing=True)
    relief.image.colorspace_settings.name='Non-Color';relief.image.pack()
    normal=boards.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.4
    boards.node_tree.links.new(relief.outputs['Color'],normal.inputs['Color'])
    boards.node_tree.links.new(normal.outputs['Normal'],boards.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
    for obj in rooms_extra.objects:
        if not obj.name.startswith('Kitchen · pine gable') or obj.type!='MESH':continue
        if not obj.data.materials or obj.data.materials[0]!=lining:continue
        obj.data.materials[0]=boards
        uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Horizontal gable boards')
        for lp in obj.data.loops:
            _,yy,zz=local(obj.matrix_world@obj.data.vertices[lp.vertex_index].co)
            uv.data[lp.index].uv=((yy-12.47)/9.6,(zz-.015)/1.44)
    # Use separate, photo-derived bear and deer curtain prints across the two windows.
    prints=[mapped_material('Kitchen fabric · '+n,'Kitchen - woodland '+n+'.jpg',.88,.79) for n in ('deer','bear')]
    hang=group('Kitchen | knotty pine window casing and printed curtain panels')
    for j,(ya,yb) in enumerate(((k1[0],k1[1]),(k2[0],k2[1]))):
        for edge in (ya-.135,yb):
            bx(hang,40.56,40.79,edge,edge+.135,1.005,2.026,shelves)
        bx(hang,40.54,40.79,ya-.14,yb+.14,1.00,1.055,shelves)
        bx(hang,40.56,40.79,ya-.14,yb+.14,1.951,2.025,shelves)
        rod=2.059
        line(hang,(40.47,ya-.18,rod),(40.47,yb+.18,rod),.006,rail,10)
        for ed in (ya-.17,yb+.17):line(hang,(40.47,ed-.034,rod),(40.47,ed+.034,rod),.011,rail,12)
        mid=(ya+yb)/2
        for first,(low,high) in enumerate(((ya-.032,mid-.023),(mid+.023,yb+.032))):
            for n in range(4):
                yy=low+(high-low)*(n+.25)/4
                line(hang,(40.47,yy,rod),(40.46,yy,2.024),.0028,silver,8)
            width=high-low
            for n in range(19):
                t0=n/19;t1=(n+1)/19
                def panel_point(t,z):
                    r=(z-1.073)/.954
                    yy=low+t*width+.018*(1-r)*sin(t*2*pi)
                    x=40.47+.044*cos(t*6*pi+.3)+.016*(1-r)*sin(t*4*pi)
                    return hang.vert((x*ft,yy*ft,z))
                verts=[panel_point(t0,2.025),panel_point(t1,2.025),panel_point(t1,1.073),panel_point(t0,1.073)]
                u0=1-(first+t0)*.5;u1=1-(first+t1)*.5
                hang.face(verts,prints[j],[(u0,1),(u1,1),(u1,0),(u0,0)],True)
    finish(hang)
    # The oblique kitchen original shows each pair hanging from one ceiling
    # plate on the range side of the middle collar tie.
    antler=material('Pendant antlers · aged bronze','#9b7144',.40,.52)
    ribs=material('Pendant · bronze sockets and chains','#69513b',.61,.44)
    glassmilk=material('Pendant · warm milk-glass shades','#f3e7c4',.02,.31)
    shader=glassmilk.node_tree.nodes.get('Principled BSDF');shader.inputs['Emission Color'].default_value=(1,.78,.49,1);shader.inputs['Emission Strength'].default_value=1.25
    for label,cy in [('Hall side',18.40),('Patio side',21.70)]:
        cx,low_z=33.45,1.83
        light=group('Kitchen and dining | '+label+' twin antler pendant')
        canopy=[]
        for radius,drop in ((.082,0),(.082,.014),(.060,.020),(.045,.035)):
            row=[]
            for index in range(28):
                angle=tau*index/28
                x=cx*ft+radius*cos(angle);y=cy*ft+radius*sin(angle)
                row.append(light.vert((x,y,kitchen_vault_z(y/ft)-drop)))
            canopy.append(row)
        for upper,lower in zip(canopy,canopy[1:]):
            for j in range(28):
                k=(j+1)%28
                light.face([upper[j],lower[j],lower[k],upper[k]],brass2,smooth=True)
        light.face(canopy[-1][::-1],brass2)
        for side in (-1,1):
            chain_top_y=cy+side*.095
            span=kitchen_vault_z(chain_top_y)-.034-(low_z+.344)
            count=max(1,round(span/.049))
            for n in range(count):
                fraction=(n+.5)/count
                zmid=low_z+.344+span*fraction
                yy=cy+side*(.35*(1-fraction)+.095*fraction)
                xx=cx+.06*(1-fraction)
                for k in range(10):
                    def chainpoint(k):
                        ang=tau*k/10;offset=.032*sin(ang)
                        return (xx+(offset if n%2 else 0),yy+(0 if n%2 else offset),zmid+.030*cos(ang))
                    line(light,chainpoint(k),chainpoint(k+1),.0025,ribs,6)
        for side in (-1,1):
            def rod(points,rs):
                for u,v,ra,rb in zip(points,points[1:],rs,rs[1:]):light.beam((u[0]*ft,u[1]*ft,u[2]),(v[0]*ft,v[1]*ft,v[2]),ra,antler,9,rb)
            rod([(cx-.13,cy-side*.18,low_z+.29),(cx,cy+side*.13,low_z+.29),(cx+.10,cy+side*.47,low_z+.355),(cx+.11,cy+side*.87,low_z+.343),(cx+.07,cy+side*1.04,low_z+.295),(cx+.03,cy+side*1.16,low_z+.309),(cx+.03,cy+side*1.28,low_z+.341)], [.019,.025,.022,.017,.012,.009,.002])
            for off,h,dire in [(.38,.352,-1),(.69,.35,1),(.9,.329,1)]:
                rod([(cx+.07,cy+side*off,low_z+h),(cx+.07+dire*.09,cy+side*(off+.10),low_z+h+.028),(cx+.07+dire*.18,cy+side*(off+.15),low_z+h+.070)], [.014,.010,.0015])
            sx=cx+.07;sy=cy+side*.92
            cyl(light,sx,sy,low_z+.226,low_z+.302,.022,ribs,16)
            # Sloping pressed-glass shade with rolled, lightly scalloped rim.
            profile=[(.226,.025),(.203,.044),(.180,.057),(.146,.071),(.100,.098),(.059,.129),(.035,.133),(.020,.151),(.010,.153),(.000,.145),(.008,.136),(.023,.127),(.052,.119),(.097,.092),(.142,.066),(.18,.049),(.201,.038)]
            rings=[];seg=36
            for h,r in profile:
                row=[]
                for k in range(seg):
                    a=tau*k/seg;w=cos(18*a)
                    rr=r+.0026*w*(1-min(1,h/.07));z=low_z+h+.002*w*(1-min(1,h/.042))
                    row.append(light.vert((sx*ft+rr*cos(a),sy*ft+rr*sin(a),z)))
                rings.append(row)
            for row,nxt in zip(rings,rings[1:]):
                for k in range(seg):light.face([row[k],row[(k+1)%seg],nxt[(k+1)%seg],nxt[k]],glassmilk,smooth=True)
        finish(light)
    # Leave space to reach the prep aisle from either end of the long island.
    island=group('Kitchen | walnut island with two Windsor stools')
    # Samples from the same island in L1040612: the dark stained top, honey
    # horizontal boards facing the stools, and the brick-red patterned cloth.
    walnut=mapped_material('Island · dark stained timber','Kitchen - dark island timber.jpg',.39)
    panel=mapped_material('Island · honey pine boarding','Kitchen - island pine face.jpg',.56)
    runner=mapped_material('Island · patterned red table runner','Kitchen - red island runner.jpg',.86)
    # DSC01550 shows a glass-front beverage cooler under a dark wood top,
    # flanked by espresso cabinets. Its offset within the island is estimated.
    cooler_a,cooler_b=19.14,21.14
    bx(island,31.55,32.19,17.49,22.82,.039,.875,walnut)
    for ya,yb in ((17.49,cooler_a-.008),(cooler_b+.008,22.82)):
        bx(island,32.19,33.72,ya,yb,.039,.873,paint)
        for za,zb in ((.109,.64),(.655,.852)):
            bx(island,33.72,33.78,ya+.026,yb-.026,za,zb,inset)
            for y in (ya+.026,yb-.14):
                bx(island,33.78,33.81,y,y+.114,za,zb,paint)
            for z in (za,zb-.031):
                bx(island,33.78,33.81,ya+.14,yb-.14,z,z+.031,paint)
            mid=(ya+yb)/2
            line(island,(33.90,mid-.32,zb-.071),(33.90,mid+.32,zb-.071),.008,silver,10)
            for y in (mid-.32,mid+.32):
                line(island,(33.79,y,zb-.071),(33.90,y,zb-.071),.007,silver)
    cooler=group('Kitchen | under-counter beverage cooler · glazed work face')
    smoked=material('Beverage cooler · smoked glazing','#638184',.08,.19)
    smoked.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.26
    if hasattr(smoked,'surface_render_method'):smoked.surface_render_method='BLENDED'
    display=material('Beverage cooler · blue display','#547dac',.12,.30)
    disp=display.node_tree.nodes.get('Principled BSDF')
    disp.inputs['Emission Color'].default_value=(.08,.32,.92,1)
    disp.inputs['Emission Strength'].default_value=.65
    bx(cooler,32.21,32.30,cooler_a,cooler_b,.045,.859,dark)
    for y in (cooler_a,cooler_b-.08):
        bx(cooler,32.29,33.80,y,y+.08,.050,.860,rail)
    for z,h in ((.042,.08),(.123,.029),(.810,.051)):
        bx(cooler,32.29,33.80,cooler_a+.08,cooler_b-.08,z,z+h,rail)
    for z in (.171,.266,.363,.525,.628,.730):
        bx(cooler,32.40,33.57,cooler_a+.10,cooler_b-.10,z,z+.011,dark)
        line(cooler,(33.57,cooler_a+.11,z+.012),(33.57,cooler_b-.11,z+.012),.006,silver,8)
    bx(cooler,33.58,33.64,cooler_a+.08,cooler_b-.08,.425,.478,rail)
    bx(cooler,33.64,33.65,19.93,20.18,.439,.466,display)
    bx(cooler,33.72,33.73,cooler_a+.08,cooler_b-.08,.152,.81,smoked)
    for z in (.054,.075,.096):
        bx(cooler,33.80,33.81,cooler_a+.09,cooler_b-.09,z,z+.006,steel)
    for z in (.230,.737):
        line(cooler,(33.78,cooler_b-.10,z),(33.92,cooler_b-.10,z),.012,silver)
    line(cooler,(33.92,cooler_b-.10,.230),(33.92,cooler_b-.10,.737),.012,silver,12)
    finish(cooler)
    def top_box(x0,x1,y0,y1,z0,z1,mat):
        island.cube(((x0+x1)*ft/2,(y0+y1)*ft/2,(z0+z1)/2),
                    ((y1-y0)*ft,(x1-x0)*ft,z1-z0),mat,euler=(0,0,pi/2))
    top_box(31.10,33.95,17.33,22.96,.875,.920,walnut)
    for i in range(4):
        bx(island,31.48,31.556,17.76,22.54,.064+i*.205,.265+i*.205,panel)
    for yy in (17.48,22.50):
        bx(island,31.27,31.72,yy,yy+.32,.017,.877,walnut)
    for yy in (17.445,22.818):
        bx(island,31.46,33.78,yy,yy+.036,.044,.871,walnut)
    # Black outlet at the near end visible from the front hall and work aisle.
    bx(island,32.04,32.292,17.423,17.445,.688,.794,rail)
    for z in (.717,.762):
        line(island,(32.167,17.423,z),(32.167,17.412,z),.012,blackglass,12)
    def windsor_stool(cy):
        old=island.transform.copy()
        island.transform=Matrix.Translation((30.23*ft,cy*ft,0))@Matrix.Rotation(pi/2,4,'Z')
        # Wide oval saddle with a shallow hollow, hoop and five paddle-shaped splats.
        rings=[]
        for s,h in ((.93,.607),(1,.619),(.99,.636),(.85,.644),(.47,.638),(.10,.632)):
            ring=[]
            for j in range(40):
                a=tau*j/40
                xx=.704*s*cos(a);yy=.623*s*sin(a)
                ring.append(island.vert((xx*ft,yy*ft,h)))
            rings.append(ring)
        island.face(rings[0][::-1],honey)
        for row,nxt in zip(rings,rings[1:]):
            for j in range(40):
                k=(j+1)%40;island.face([row[j],row[k],nxt[k],nxt[j]],honey,smooth=True)
        island.face(rings[-1],honey)
        for sign in (-1,1):
            for face in (-1,1):
                line(island,(.605*sign,.505*face,.010),(.422*sign,.335*face,.618),.0175,honey,12)
            line(island,(sign*.541,-.438,.258),(sign*.541,.438,.258),.012,honey,12)
            line(island,(-.546,sign*.45,.230),(.546,sign*.45,.230),.013,honey,12)
        hoop=[(-.617,.37,.630),(-.638,.45,.783)]
        for j in range(25):
            a=pi*(1-j/24)
            hoop.append((.653*cos(a),.555+.10*sin(a),.823+.215*sin(a)))
        hoop.extend([(.638,.45,.783),(.617,.37,.630)])
        for a,b in zip(hoop,hoop[1:]):
            line(island,a,b,.021,honey,14)
        for x in (-.48,-.24,0,.24,.48):
            t=x/.653;top=.823+.215*(1-t*t)**.5;top_y=.555+.10*(1-t*t)**.5
            edge=[]
            for f,width in ((0,.027),(.19,.032),(.70,.054),(.94,.043),(1,.029)):
                xc=x*(.95+.05*f);yc=.373+(top_y-.373)*f
                z=.631+(top-.631)*f
                edge.append([island.vert(((xc+width*cos(tau*j/10))*ft,(yc+.021*sin(tau*j/10))*ft,z)) for j in range(10)])
            for row,nxt in zip(edge,edge[1:]):
                for j in range(10):
                    k=(j+1)%10;island.face([row[j],row[k],nxt[k],nxt[j]],honey,smooth=True)
        island.transform=old
    for stool_y in (18.62,21.67):
        windsor_stool(stool_y)
    top_box(31.80,32.97,17.53,22.71,.9204,.9225,runner)
    amber_glass=material('Island · amber pressed glass','#8b7247',.28,.24)
    foot=.923
    cyl(island,32.38,20.13,foot,foot+.012,.054,amber_glass,28,.044)
    cyl(island,32.38,20.13,foot+.012,foot+.066,.011,amber_glass,20)
    cyl(island,32.38,20.13,foot+.064,foot+.086,.019,amber_glass,24,.055)
    # Build a flared, open mouth on the footed vessel seen between the two trays.
    def vessel_ring(r,z):
        return [island.vert((32.38*ft+r*cos(tau*j/48),20.13*ft+r*sin(tau*j/48),z)) for j in range(48)]
    vessel=[vessel_ring(r,foot+dz) for r,dz in ((.055,.086),(.070,.228),(.076,.239),(.071,.241),(.065,.227),(.050,.087))]
    for row,nxt in zip(vessel,vessel[1:]):
        for j in range(48):
            k=(j+1)%48;island.face([row[j],row[k],nxt[k],nxt[j]],amber_glass,smooth=True)
    pewter=material('Island trays · pewter','#988f83',.56,.32)
    for yy in (18.68,21.61):
        curves=[]
        for rx,ry,z in ((.063,.142,.926),(.078,.171,.940),(.074,.165,.942),(.059,.137,.933)):
            curves.append([island.vert((32.36*ft+rx*cos(tau*j/32),yy*ft+ry*sin(tau*j/32),z)) for j in range(32)])
        for row,nxt in zip(curves,curves[1:]):
            for j in range(32):
                k=(j+1)%32;island.face([row[j],row[k],nxt[k],nxt[j]],pewter, smooth=True)
        island.face(curves[-1],pewter)
    finish(island)
    collider('kitchen_island',31.08,33.97,17.31,22.98,0,.925)
    for j,yy in enumerate((18.62,21.67)):collider('kitchen_stool_'+str(j),29.50,30.87,yy-.70,yy+.70,0,1.062)
fit_kitchen()
