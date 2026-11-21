"""Walk-out lower level; plan feet and vertical metres relative to the main floor.

The appraisal establishes two garage bays, a finished family room, painted
columns and a freestanding stove. Partition positions and door swing are
reconstructed. Only the four established tour destinations are used.
"""
def build_basement_shell():
    floor_z=base+.025
    ceiling_z=base+2.46
    partition=material('Lower level · warm buff paint','#c3b096')
    slab_finish=material('Lower level · sealed concrete','#aaa59b',0,.81)
    steel_gray=material('Areaway · enamel service door','#87948d',.17,.57)
    liner=material('Mechanical room · painted masonry','#b7bab0')
    ceiling=material('Basement ceiling · plaster','#d3d0c6')
    # Reuse the existing packed masonry/concrete maps at hand-sized block scale.
    def mapped_copy(target,asset):
        tex=target.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(work/'Exterior materials'/asset),check_existing=True)
        tex.image.pack()
        bs=target.node_tree.nodes.get('Principled BSDF')
        target.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    # A direct packed map is portable to both Blender and glTF.
    mapped_copy(slab_finish,'Front court concrete.jpg')
    mapped_copy(liner,'Gray painted block.jpg')
    wood_floor=material('Den · brown plank finish','#795f48',0,.56)
    tex=wood_floor.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(work/'Interior materials'/'Master - weathered timber.jpg'),check_existing=True)
    tex.image.pack()
    wood_floor.node_tree.links.new(tex.outputs['Color'],wood_floor.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    joint=material('Den · plank seams','#655444')
    # Structural opening through the outer rear foundation. Reproject clipped
    # polygons because clipping necessarily rebuilds their loops and UVs.
    jamb_l,jamb_r=21.43,24.67
    entry_x=(jamb_l+jamb_r)*.5
    head_z=base+2.085
    for obj in structure.objects:
        if obj.name.startswith('Foundation · wall 5.'):
            hole_object(obj,[(jamb_l,jamb_r,base-.001,head_z)],(0,2))
            uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Masonry courses')
            for lp in obj.data.loops:
                u,_,h=local(obj.data.vertices[lp.vertex_index].co)
                uv.data[lp.index].uv=(u*ft/1.65,h/1.65)
    # Every support polygon ends at the footprint step and every wall uses
    # matching collision segments, including the service doorway.
    def pavement(name,xa,xb,ya,yb,finish):
        flat('Basement · '+name,xa,xb,ya,yb,floor_z,finish,4.8)
        o=flat('WalkSurface_Basement'+name,xa,xb,ya,yb,floor_z+.002,empty)
        o.hide_render=True;o.display_type='WIRE'
    pavement('GarageSlab',0,20.26,3,29,slab_finish)
    pavement('ServiceSlabEast',20.26,21,12,29,slab_finish)
    pavement('ServiceSlabStep',21,22,12,26,slab_finish)
    pavement('DenWood',22,36.72,0,12,joint)
    pavement('DenWoodReturn',20.26,22,3,12,joint)
    pavement('ServiceSlabWest',36.72,41,0,12,slab_finish)
    pavement('ServiceSlab',22,41,12,26,slab_finish)
    # Simple battens and rectangular lintels provide substantial wall reveals.
    walls=group('Basement · interior walls, trim and jambs')
    def wall(n,axis,f,a,b,matl,holes=(),th=.25,height=None):
        top=height or ceiling_z
        def strip(l,r,z,h,m,wide):
            if axis=='x':bounds=(f-wide/2,f+wide/2,l,r)
            else:bounds=(l,r,f-wide/2,f+wide/2)
            if h<=z or r<=l:return
            if m==liner:
                # UVs follow the courses on both room-facing surfaces.
                for d in (-wide/2,wide/2):
                    if axis=='x':pts=[(f+d,l,z),(f+d,r,z),(f+d,r,h),(f+d,l,h)]
                    else:pts=[(l,f+d,z),(r,f+d,z),(r,f+d,h),(l,f+d,h)]
                    if (d>0)==(axis=='y'):pts.reverse()
                    face('Basement · block lining',pts,m,[(p[1 if axis=='x' else 0]*ft/1.65,p[2]/1.65) for p in pts])
            else:bx(walls,*bounds,z,h,m)
        def full(l,r):
            if r<=l:return
            strip(l,r,floor_z,top,matl,th)
            if matl!=liner:strip(l,r,floor_z,floor_z+.085,cream,th+.045)
            if axis=='x':bounds=(f-th/2,f+th/2,l,r)
            else:bounds=(l,r,f-th/2,f+th/2)
            collider('Basement'+n+str(round(l,2)),*bounds,base-.02,top)
        cursor=a
        for l,r,sill,head in holes:
            full(cursor,l)
            strip(l,r,floor_z,sill,matl,th)
            strip(l,r,head,top,matl,th)
            if sill>floor_z+.07:
                if axis=='x':bounds=(f-th/2,f+th/2,l,r)
                else:bounds=(l,r,f-th/2,f+th/2)
                collider('Basement'+n+'Sill',*bounds,base,sill)
            cursor=r
        full(cursor,b)
    def opening(l,r):return [(l,r,floor_z,head_z)]
    # Inside the garage, the rear faces of the paired wood doors and their
    # hardware align exactly with the closed carriage leaves on the façade.
    wall('GarageEnd','x',.14,3,29,partition)
    wall('GarageFront','y',3.14,.13,22,partition,[(4.82,7.18,-1.32,-.353)])
    wall('GarageRear','y',28.85,.07,21,partition,[(3.42,5.78,-1.32,-.353)])
    wall('FootprintStepA','x',21-.13,26,29,liner)
    wall('FootprintStepB','x',22+.13,0,3,partition)
    wall('SouthFacade','y',.13,22,41,partition)
    wall('UtilityEast','x',40.89,0,26,liner,th=.22)
    wall('UtilityRear','y',25.88,21,41,liner,opening(jamb_l,jamb_r),th=.22)
    wall('GaragePartition','x',20.12,3.17,28.79,partition,opening(19.80,23.06),th=.29)
    wall('DenDivider','y',12,20.26,36.72,partition,opening(24.28,27.48))
    wall('DenSide','x',36.72,.23,12,partition)
    # Stagger joints and vary the wood grain offsets across the photographed
    # brown family-room floor. Clip the first rows to the appraisal footprint.
    boards=[];quads=[];uvs=[];prng=random.Random(1708)
    for row in range(27):
        ya=row*.455;yb=min(12.,ya+.455)
        for ya_,yb_ in ((ya,min(yb,3.)),(max(ya,3.),yb)):
            if yb_-ya_<.005:continue
            left=22. if ya_<3. else 20.26
            x=left-prng.uniform(.20,3.10)
            while x<36.72:
                end=x+prng.uniform(3.2,5.75)
                a=max(left,x)+.002;b=min(36.72,end)-.002
                if b>a:
                    coords=[(a,ya_+.002),(b,ya_+.002),(b,yb_-.002),(a,yb_-.002)]
                    k=len(boards);quads.append(tuple(range(k,k+4)));u=prng.random();v=prng.random()
                    for xx,yy in coords:
                        boards.append(point(xx,yy,floor_z+.001))
                        uvs.extend((u+(xx-x)/6.4,v+(yy-ya)/1.18))
                x=end
    planks=mesh('Basement · family room plank boards',boards,quads,wood_floor,rooms_extra)
    planks.data.uv_layers.new(name='Board grain').data.foreach_set('uv',uvs)
    for xx in (jamb_l,jamb_r):
        bx(walls,xx-.065,xx+.065,25.48,26.08,base+.021,head_z+.058,cream)
        bx(walls,xx-.115,xx+.115,26.05,26.13,base+.021,head_z+.081,steel_gray)
    bx(walls,jamb_l-.085,jamb_r+.085,25.48,26.07,head_z,head_z+.065,cream)
    bx(walls,jamb_l-.10,jamb_r+.10,26.03,26.13,head_z+.04,head_z+.086,steel_gray)
    bx(walls,jamb_l,jamb_r,25.77,26.12,base+.0255,base+.035,steel)
    # A parked open steel door, with a lever, hinge knuckles and weatherstrip.
    leaf=jamb_l+.09
    bx(walls,leaf-.065,leaf+.065,22.40,25.56,base+.055,head_z-.025,steel_gray)
    for z in (.22,1.01,1.79):
        cyl(walls,leaf-.066,25.54,base+z,base+z+.075,.012,steel,12)
    for side in (-1,1):
        line(walls,(leaf,22.74,base+.96),(leaf+side*.19,22.74,base+.96),.018,steel,14)
        line(walls,(leaf+side*.19,22.74,base+.96),(leaf+side*.19,23.06,base+.96),.009,steel,12)
    collider('BasementEntryLeaf',leaf-.065,leaf+.065,22.40,25.56,base+.055,head_z-.025)
    for yy in (9.4,22.1):
        for i in range(16):
            y=yy-4+i*.5
            bx(walls,.27,.375,y+.008,y+.492,base+.045,base+2.15,woodboard)
        for half in (-1,1):
            m=yy+half*1.99
            for h in (.16,1.03,2.02):bx(walls,.38,.47,m-1.90,m+1.90,base+h,base+h+.069,honey)
            for h in (.73,1.69):
                bx(walls,.47,.485,m+half*1.83-.115,m+half*1.83+.115,base+h,base+h+.036,rail)
    for xx,yy in ((6,3.24),(4.6,28.76)):
        for x in (xx-1.17,xx+1.17):bx(walls,x-.052,x+.052,yy-.045,yy+.045,-1.34,-.32,cream)
        for h in (-1.34,-.353):bx(walls,xx-1.22,xx+1.22,yy-.065,yy+.065,h,h+.033,cream)
    for label,xa,xb,ya,yb in [('Garage',0,21,3,29),('Step',21,22,3,26),('Service',22,41,0,26)]:
        bx(walls,xa,xb,ya,yb,ceiling_z,ceiling_z+.04,ceiling)
    # Painted boxed beam and steel columns, as seen in the appraisal den.
    bx(walls,27.63,28.37,.31,25.68,ceiling_z-.17,ceiling_z,cream)
    for yy in (9.5,17.5,23.5):
        cyl(walls,28,yy,floor_z,ceiling_z-.17,.062,cream,24)
        bx(walls,27.70,28.30,yy-.32,yy+.32,ceiling_z-.195,ceiling_z-.169,cream)
        collider('BasementPost'+str(yy),27.80,28.20,yy-.21,yy+.21,floor_z,ceiling_z)
    finish(walls)

    # The den photograph shows a plain black stove with a vertical flue,
    # wood-pattern flooring, an open shelf and a flush opal ceiling light.
    furnishings=group('Basement · family room stove and storage')
    stove_iron=material('Den stove · cast iron','#333633',.35,.63)
    stove_glass=material('Den stove · smoked window','#372e25',.19,.28)
    crate=material('Den shelving · muted ochre','#997e5b')
    for x in (29.93,32.27):
        for y in (1.10,2.25):bx(furnishings,x-.07,x+.07,y-.07,y+.07,floor_z,base+.19,stove_iron)
    bx(furnishings,29.72,32.48,.94,2.48,base+.145,base+.71,stove_iron,3)
    bx(furnishings,29.63,32.57,.86,2.55,base+.70,base+.74,stove_iron,3)
    bx(furnishings,29.98,32.22,2.48,2.53,base+.26,base+.625,rail)
    bx(furnishings,30.12,32.08,2.535,2.55,base+.30,base+.585,stove_glass)
    for i in range(7):bx(furnishings,29.99+i*.34,30.06+i*.34,.99,2.18,base+.741,base+.746,rail)
    cyl(furnishings,31.71,1.3,base+.74,ceiling_z,.072,stove_iron,24)
    for h in (1.10,1.89):cyl(furnishings,31.71,1.3,base+h,base+h+.026,.076,rail,24)
    collider('BasementStove',29.63,32.57,.86,2.55,floor_z,base+.74)
    for x in (21.01,23.88):
        for y in (4.32,5.55):bx(furnishings,x-.045,x+.045,y-.045,y+.045,floor_z,base+1.70,rail)
    for i in range(4):
        z=base+.13+i*.49
        bx(furnishings,20.94,23.95,4.27,5.61,z,z+.023,rail)
        if i<3:
            bx(furnishings,21.12+i*.14,23.11+i*.14,4.40,5.47,z+.024,z+.29,crate,2)
            bx(furnishings,21.16+i*.14,23.07+i*.14,5.471,5.48,z+.184,z+.193,darkoak)
    collider('BasementShelf',20.94,23.95,4.27,5.61,floor_z,base+1.70)
    finish(furnishings)

    # Individual diffuser origins are also real-time light attachment points.
    for tag,x,y,h in [('Service',25.7,21.7,2.34),('PanelAisle',37.7,10.7,2.34),
                       ('Garage',12,18,2.34),('Den',27.7,6.3,2.25),('Entry',entry_x,25.1,2.34)]:
        anchor_h=base+h
        diffuser=group('BasementLamp_'+tag,origin=(x,y,anchor_h))
        cyl(diffuser,0,0,-.005,.012,.118,lamp,32,.134)
        cyl(diffuser,0,0,.012,.044,.134,lamp,32,.13)
        cyl(diffuser,0,0,.044,.053,.133,steel,32)
        cyl(diffuser,0,0,.053,ceiling_z-anchor_h,.127,cream,32)
        finish(diffuser)
    # Wet-location light centered over the doorway at the foot of the straight stair.
    weatherlight=group('BasementLamp_Areaway',origin=(entry_x,26.14,base+2.24))
    bx(weatherlight,-.53,.53,0,.115,-.084,.084,rail,3)
    bx(weatherlight,-.45,.45,.114,.22,-.060,.058,lamp,3)
    for u in (-.44,-.22,0,.22,.44):
        bx(weatherlight,u-.014,u+.014,.216,.244,-.060,.063,steel_gray)
    finish(weatherlight)
    area_light('Areaway · threshold light',(entry_x,26.4,base+2.17),(entry_x,31.6,base+.64),58,.72,(1,.80,.53))
    area_light('Basement · family room',(27.7,6.3,base+2.19),(28.2,8.2,base+.7),68,1.25,(1,.82,.64))
    area_light('Basement · utility',(37.7,10.7,base+2.27),(39.5,15,base+.79),90,1.3,(1,.89,.75))
    area_light('Basement · laundry',(25.7,21.7,base+2.27),(32.8,22,base+.8),88,1.5,(1,.87,.73))
    area_light('Basement · garage',(12,18,base+2.27),(9,14,base+.7),65,1.3,(1,.89,.76))
build_basement_shell()
