"""Furnished main-floor bedrooms, bathroom, kitchen and dining reconstructed from the appraisal sketch and owner photography.
The interior partitions and exact openings are estimates. Appraisal page 16 documents lower-level services; the by-arrangement laundry entrance position is unverified.
Local plan X/Y feet, relative Z metres. UI collision geometry is separately identified by name.
"""
rooms_extra=coll('13 · Kitchen, bedrooms, bath and circulation')
private_extra=coll('14 · Owner reference only · basement and service spaces')
def _furnish_remaining():
    from math import sin,cos,pi,exp,sqrt
    from mathutils import Matrix,Vector,Euler
    import random,math
    art=furniture_lib['_IFBuilder']
    def material(n,col,metal=0,rough=.72):return mat('Room detail | '+n,col,metal,rough)
    cream=material('Painted cream casing','#ece6d5');amber=material('Hall paint, warm straw','#cfbf93')
    sage=material('Bathroom · quiet sage','#a9baa8');pale=material('Bedroom · muted mushroom','#b9b6a7');mint=material('Bedroom · pale sage','#bcc6b8')
    ivory=material('Bathroom · porcelain','#f1eee4',.03,.25);night=material('Cabinet fronts · carbon brown','#3c3733')
    rail=material('Blackened hardware','#242827',.45,.39);steel=material('Brushed stainless','#a7a8a3',.75,.31)
    brass2=material('Warm brass hardware','#ad8b51',.62,.35);sinkgrey=material('Steel basin interior','#686f6b',.68,.29)
    counter=material('Warm white worktop','#e4dfd2',.07,.35);cooktop=material('Black ceramic hob','#252b2b',.25,.19)
    granite=material('Island · dark top','#47403e',.16,.28); darkoak=material('Dark oak furniture','#665041');whitewood=material('Painted paneling','#e9e7dd')
    wool=material('Bath linen','#76949b');terr=material('Bath floor grout','#93867d');woodboard=oak
    glas=material('Shower enclosure','#c4d6d2',.06,.18);gp=glas.node_tree.nodes.get('Principled BSDF');gp.inputs['Alpha'].default_value=.16
    if hasattr(glas,'surface_render_method'):glas.surface_render_method='BLENDED'
    mirror=material('Bathroom mirror','#afbec1',.74,.14);lamp=material('Warm opal shade','#f7edcd');lp=lamp.node_tree.nodes.get('Principled BSDF');lp.inputs['Emission Color'].default_value=(.82,.64,.37,1);lp.inputs['Emission Strength'].default_value=.48
    honey=material('Island stools · maple','#b68b59');dots=material('Decor · fern','#586c47');plaidA=material('Flannel red','#a54349')
    blues=material('Lofted bed · turquoise','#4aabb8');graycloth=material('Lower bunk · indigo','#50596c');red=material('Double bed · rust linen','#b9524f');lightfabric=material('Cotton pillow','#d9d3c4')
    bathroom_tile=[material('Shower ledgestone '+str(j),c) for j,c in enumerate(('#bcb4a1','#a4947f','#b6ab96','#ccc7ba','#9e9280','#c2baa9'))]
    tile=material('Bath floor tile','#c3b5ac');shade=material('Roller shades','#d4ccbb');paper=material('Shelf stoneware','#d8d2be')
    empty=material('Walk volumes','#7596a0')
    def group(label,origin=(0,0,0),yaw=0,collection=None):
        b=art();b._name=label;b._origin=origin;b._yaw=yaw;b._collection=collection or rooms_extra;return b
    def finish(b):
        if not b.v:return
        ob=b.finish(b._name,point(*b._origin),174.6+b._yaw)
        for c in list(ob.users_collection):c.objects.unlink(ob)
        b._collection.objects.link(ob);return ob
    def bx(b,x0,x1,y0,y1,h0,h1,m,s=0):
        if min(x1-x0,y1-y0,h1-h0)<=.00001:return
        b.cube(((x0+x1)*ft/2,(y0+y1)*ft/2,(h0+h1)/2),((x1-x0)*ft,(y1-y0)*ft,h1-h0),m,s)
    def line(b,a,c,r,m,segments=8):
        b.beam((a[0]*ft,a[1]*ft,a[2]),(c[0]*ft,c[1]*ft,c[2]),r,m,segments)
    def cyl(b,x,y,z0,z1,r,m,sides=16,r2=None):
        b.beam((x*ft,y*ft,z0),(x*ft,y*ft,z1),r,m,sides,r2)
    def obox(n,x0,x1,y0,y1,z0,z1,m,collection=None):
        return box(n,x0,x1,y0,y1,main+z0,main+z1,m,collection or rooms_extra)
    def collider(n,x0,x1,y0,y1,z0=0,z1=2.1):
        o=obox('WalkBlock_'+n,x0,x1,y0,y1,z0,z1,empty)
        o.hide_render=True;o.display_type='WIRE';return o
    def coll_line(n,axis,f,a,b,holes=(),th=.24):
        u=a
        for l,r in sorted(list(holes)+[(b,b)]):
            if l>u+.001:
                if axis=='x':collider(n+'_'+str(round(u,2)),f-th/2,f+th/2,u,l)
                else:collider(n+'_'+str(round(u,2)),u,l,f-th/2,f+th/2)
            u=max(u,r)
    def face(name,verts,m,uv=None,col=None):
        o=mesh(name,[point(*p) for p in verts],[tuple(range(len(verts)))],m,col or rooms_extra)
        if uv:
            layer=o.data.uv_layers.new(name='Material projection')
            for i,p in enumerate(uv):layer.data[i].uv=p
        return o
    def flat(n,x0,x1,y0,y1,z,m,step=4.8,col=None):
        vs=[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)];return face(n,vs,m,[(p[0]/step,p[1]/step) for p in vs],col)
    def topz(x,y):
        if x>=21 and y>=kitchen_eave_y:
            return kitchen_vault_z(y)
        if 23.44<=x<=33.26 and 10.25<=y<kitchen_eave_y:
            return kitchen_vault_z(kitchen_eave_y)
        return roofZ(x,y,1 if x<=21 else 2)-main-.13
    def wall(n,axis,f,a,b,material,openings=(),cap=None,partition=False,rev=False):
        # Split at holes and roof ridge. Surface plus narrow jambs and trim provide actual openings, not pictures on walls.
        def coord(t,z):return (f,t,z) if axis=='x' else (t,f,z)
        def top(t):
            x,y,_=coord(t,0)
            limit=min(cap,topz(x,y)) if cap else topz(x,y)
            if x<=front+.001 and y>=7-.001:limit=min(limit,loftdeck-.125)
            return limit
        cuts={a,b}
        for lo,hi,z0,z1 in openings:cuts.update((max(a,lo),min(b,hi)))
        if axis=='y' and a<front<b:cuts.add(front)
        if axis=='x' and a<7<b:cuts.add(7)
        if axis=='x':
            ry=ridge(f,1 if f<=21 else 2)
            if a<ry<b:cuts.add(ry)
            if f>=21:
                cuts.update(t for t in (10.25,kitchen_eave_y,kitchen_ridge_y) if a<t<b)
        elif a<21<b:cuts.add(21)
        vals=sorted(cuts)
        for l,r in zip(vals,vals[1:]):
            if r-l<.001:continue
            mid=(l+r)/2;hits=[d for d in openings if d[0]<mid<d[1]]
            parts=[(0,10)] if not hits else [(0,hits[0][2]),(hits[0][3],10)]
            for z0,z1 in parts:
                lh,rh=min(z1,top(l)),min(z1,top(r))
                if min(lh,rh)-z0<.012:continue
                ps=[coord(l,z0),coord(r,z0),coord(r,rh),coord(l,lh)]
                if rev:ps.reverse()
                face(n,ps,material,[(p[1 if axis=='x' else 0]/6,p[2]/1.7)for p in ps])
        # Simplified trims as actual sweeps; doors retain the open path.
        for idx,(l,r,z0,z1) in enumerate(openings):
            if z0>.04:continue
            def fram(l_,r_,z_,h_):
                if axis=='x':return obox(n+' · casing',f-.12,f+.12,l_,r_,z_,h_,cream)
                return obox(n+' · casing',l_,r_,f-.12,f+.12,z_,h_,cream)
            fram(l-.15,l,.012,z1+.055);fram(r,r+.15,.012,z1+.055);fram(l-.15,r+.15,z1,z1+.055)
        # At doors the skirting stops neatly short.
        for l,r in zip(vals,vals[1:]):
            if any(q[0]<(l+r)/2<q[1] and q[2]<.05 for q in openings):continue
            if axis=='x':obox(n+' · skirting',f-.04,f+.04,l,r,.012,.086,cream)
            else:obox(n+' · skirting',l,r,f-.04,f+.04,.012,.086,cream)
        if partition:coll_line(n.replace(' ','_'),axis,f,a,b,[(l,r) for l,r,z0,z1 in openings if z0<.05])
    def patch_exterior(wallnum,holes,axes):
        for o in list(structure.objects):
            if o.name.startswith('Exterior · wall '+str(wallnum)+'.'):hole_object(o,holes,axes)
    def aperture(n,axis,t,low,high,z0,z1,backsign,glasspane=True):
        """Physical frame around visible opening; forest view sits on a recessed double-sided rectangle at windows."""
        a,b=low,high
        def strip(u,v,za,zb,k,d=.09,d0=0):
            cc=t+backsign*d0
            if axis=='x':return obox(n+' · frame',cc-d,cc+d,u,v,za,zb,k)
            return obox(n+' · frame',u,v,cc-d,cc+d,za,zb,k)
        if glasspane:
            c=t+backsign*.10
            coords=[(c,a,z0),(c,b,z0),(c,b,z1),(c,a,z1)] if axis=='x' else [(a,c,z0),(b,c,z0),(b,c,z1),(a,c,z1)]
            face(n+' · clear glazing to the grounds',coords,interior_glass)
        for x in (a,b):strip(x-.058,x+.058,z0-.034,z1+.041,cream)
        strip(a-.11,b+.11,z0-.043,z0+.017,cream,.15);strip(a-.1,b+.1,z1-.037,z1+.033,cream)
        if glasspane:
            strip(a,b,(z0+z1)/2-.012,(z0+z1)/2+.012,cream,.045,-.03)
    for o in list(inter.objects):
        if o.name.startswith(('Paired front windows','Front foyer window','Front west window','East gable windows A','Rear porch glazed opening','Front entry surround','Front entry door')):bpy.data.objects.remove(o,do_unlink=True)
    dinwin=(23.0,26.05,.84,1.83);slider=(29.1,35.5,.025,2.01)
    queenwin=(35.5,38.8,.77,1.71);foyerwin=(24.35,26.85,.82,1.74)
    smallwin=(11.0,16.4,.84,1.78);bunkwin=(6.0,12.65,.80,1.77)
    bedwin=(1.22,2.91,.85,1.73);k1=(14.55,17.33,1.05,1.96);k2=(20.66,23.08,1.05,1.96);frontdoor=(29.48,32.52,.0,2.05)
    patch_exterior(1,[smallwin],(0,2));patch_exterior(3,[foyerwin,queenwin,frontdoor],(0,2));patch_exterior(4,[bedwin,k1,k2],(1,2));patch_exterior(5,[dinwin,slider],(0,2));patch_exterior(8,[bunkwin],(1,2))
    # Also remove blue lap siding spanning actual opening on east gable; base model has additional horizontal board strips there.
    clad=bpy.data.objects.get('Blue lap siding · garage wing')
    if clad:
        me=clad.data;vv=[];ff=[]
        for f in me.polygons:
            pts=[local(me.vertices[i].co) for i in f.vertices];east=all(abs(p[0])<.35 for p in pts)
            # low exterior panels in foundation and non-gable boards are left alone.
            front_face=all(abs(p[1]-3)<.20 for p in pts)
            parts=without(pts,[bunkwin],(1,2)) if east else without(pts,[smallwin],(0,2)) if front_face else [pts]
            for poly_ in parts:
                if len(poly_)<3:continue
                i=len(vv);vv.extend(point(*p) for p in poly_);ff.append(tuple(range(i,i+len(poly_))))
        me.clear_geometry();me.from_pydata(vv,[],ff);me.update()
    for num,(axis,t,a,b,holes,isrev) in enumerate([('y',3.12,.18,22,[smallwin],True),('x',22.14,.1,3.12,[],False),('y',.13,22,40.88,[foyerwin,queenwin,frontdoor],True),('x',40.84,.12,25.87,[bedwin,k1,k2],True),('y',dining_wall_y,20.70,40.84,[dinwin,slider],False),('x',.15,3.12,15.25,[bunkwin],False)]):
        mm=amber
        if num==3:
            wall('Bedroom gable plaster',axis,t,a,12.49,pale,[bedwin],rev=isrev)
            wall('Kitchen · pine gable',axis,t,12.49,b,lining,[k1,k2],rev=isrev)
        elif num==5:
            wall('Bunk room · single three-sash opening',axis,t,a,b,mint,[bunkwin],rev=isrev)
        else:wall('Interior perimeter '+str(num),axis,t,a,b,mm,holes,rev=isrev)
    for n,axis,t,holes,sign in [('Master paired sash','y',3.08,[smallwin],-1),('Foyer and front room','y',.08,[foyerwin,queenwin],-1),('Bunk three-sash group','x',.09,[bunkwin],-1),('West kitchen pair','x',40.95,[bedwin,k1,k2],1),('Dining nook','y',25.94,[dinwin],1)]:
        for j,(a,b,z0,z1) in enumerate(holes):aperture(n+' '+str(j+1),axis,t,a,b,z0,z1,sign)
    # The double-hung colonial pair belongs wholly to the master (L1040561, DSC01554).
    # The shared meeting rail is already part of each aperture. The center post and
    # thin glazing bars produce two distinct three-by-two-light sashes on each side.
    muntins=group('Primary front | paired double-hung divided lights')
    middle=(smallwin[0]+smallwin[1])/2
    bx(muntins,middle-.060,middle+.060,3.054,3.17,smallwin[2],smallwin[3],cream)
    for x0,x1 in ((smallwin[0]+.055,middle-.060),(middle+.060,smallwin[1]-.055)):
        for step in (1/3,2/3):
            x=x0+(x1-x0)*step;bx(muntins,x-.014,x+.014,3.078,3.113,smallwin[2]+.025,smallwin[3]-.037,cream)
        for frac in (.25,.75):
            z=smallwin[2]+(smallwin[3]-smallwin[2])*frac
            bx(muntins,x0,x1,3.078,3.113,z-.005,z+.005,cream)
    finish(muntins)
    bunk_window=group('Bunk room | three equal double-hung sashes and gathered curtains')
    ya,yb,lo,hi=bunkwin
    for ratio in (1/3,2/3):
        y=ya+(yb-ya)*ratio;bx(bunk_window,.028,.21,y-.066,y+.066,lo,hi,cream)
    line(bunk_window,(.40,ya-.49,hi+.115),(.40,yb+.49,hi+.115),.012,rail,16)
    cloth=material('Bunk · gathered gray curtains','#807f81',0,.94)
    for end,direction in ((ya,-1),(yb,1)):
        last=None
        for i in range(22):
            t=i/21;ytop=end+direction*(-.24+.61*t);ylow=end+direction*(-.24+.80*t)
            x=.40+.095*cos(i*pi/3.5)
            row=[bunk_window.vert((x*ft,ylow*ft,.50+.008*sin(i*.56))),bunk_window.vert((x*ft,ytop*ft,hi+.095))]
            if last:bunk_window.face([last[0],row[0],row[1],last[1]],cloth,smooth=True)
            last=row
    finish(bunk_window)
    # IMG_6130 shows the burgundy front door has six lights over a single panel.
    doorM=material('Front entrance · oxblood red','#713d3c')
    panel=group('Front door · open, inset panel and divided glass',(29.48,.02,0),90)
    bx(panel,-.02,2.98,-.12,.02,.02,1.23,doorM);bx(panel,-.02,2.98,-.12,.02,1.86,2.055,doorM)
    for x0,x1 in [(0,.26),(2.67,2.98),(1.01,1.10),(1.83,1.92)]:bx(panel,x0,x1,-.12,.02,1.22,1.87,doorM)
    inset=material('Front entrance · inset panel shadow','#593635')
    for ya,yb in ((-.135,-.12),(.020,.035)):
        bx(panel,.29,2.65,ya,yb,.17,1.069,inset)
        bx(panel,.32,2.62,ya-.002,yb+.002,.18,1.058,doorM)
    bx(panel,.18,2.80,-.12,.02,1.50,1.55,doorM);bx(panel,2.57,2.71,-.19,-.13,.85,.99,rail);finish(panel)
    collider('front_door_open_leaf',29.33,29.57,.02,2.98)
    # In L1040636 the timber screen closes outside the red entry door. Park
    # it open along the landing railing so both sides remain traversable.
    screen=group('Entry screen door · timber frame and lower spindles',(29.48,-.08,0),-90)
    frame=material('Front screen · warm timber','#855b3f')
    for x in (.015,2.89):bx(screen,x,x+.105,-.043,.043,.025,2.035,frame)
    for lo,hi in ((.025,.105),(.568,.610),(.762,.805),(1.980,2.035)):
        bx(screen,.12,2.89,-.043,.043,lo,hi,frame)
    for x in (.97,1.98):bx(screen,x,x+.085,-.032,.032,.105,.568,frame)
    for x in (.42,.90,1.39,1.88,2.37,2.76):
        line(screen,(x,0,.61),(x,0,.762),.0065,frame,8)
    for z in (.756,.861):line(screen,(2.94,-.04,z),(2.94,-.15,z),.007,steel,10)
    line(screen,(2.94,-.15,.756),(2.94,-.15,.861),.008,steel,10)
    finish(screen)
    collider('front_screen_open_leaf',29.42,29.54,-3.08,-.08)
    # Sliding glass stacks to the right. Keep an actually walkable left opening.
    aperture('Rear patio slider','y',25.94,29.1,35.5,.026,2.01,1,False)
    patio=group('Rear patio slider · open on dining side')
    for x0,x1 in [(32.27,32.37),(35.38,35.49)]:bx(patio,x0,x1,25.85,25.99,.037,2.01,cream)
    bx(patio,32.37,35.38,25.91,25.938,.065,1.97,glas)
    bx(patio,32.27,35.49,25.85,25.99,.04,.08,cream);bx(patio,32.27,35.49,25.85,25.99,1.96,2.01,cream);finish(patio)
    for i,(p,q) in enumerate(zip(poly,poly[1:]+poly[:1])):
        ax='x' if p[0]==q[0] else 'y';k=(1 if ax=='x' else 0);a,b=sorted((p[k],q[k]))
        gaps={2:[(29.48,32.52)],4:[(29.1,32.26)]}.get(i,[])
        coll_line('outer'+str(i),ax,p[1-k],a,b,gaps)
    # The owner's TV-wall doorway is the bunk room. Photographs DSC01557 and
    # DSC01704 establish its connection to the sofa and the full bed's front-hall entrance.
    bunk_partition=9.63
    def primary_ceiling(y):
        # L1040619 shows the ceiling rising from the window side to the headboard.
        return 2.075+.085*(y-3.12)
    wall('Bunk and primary common wall','x',bunk_partition,3.12,15.25,mint,(),None,True)
    # The master side of the bunk partition is mushroom plaster in L1040619.
    face('Master bedroom · warm plaster behind hanging rail',
         [(bunk_partition+.008,3.12,.083),(bunk_partition+.008,15.11,.083),
          (bunk_partition+.008,15.11,primary_ceiling(15.11)),(bunk_partition+.008,3.12,primary_ceiling(3.12))],pale)
    wall('Primary bedroom barn door wall','x',23.45,10.25,15.48,pale,[(11.15,14.35,0,2.04)],None,True)
    wall('Primary bedroom rear return','y',15.27,20.75,23.45,pale,(),2.35,True)
    wall('Full bedroom and front hall','x',33.25,.13,12.49,pale,[(3.05,6.05,0,2.02)],2.30,True)
    wall('Full bedroom to kitchen','y',12.49,33.25,40.84,pale,(),None,True,True)
    wall('Bathroom to entry passage','x',29.04,.13,10.25,amber,(),None,True)
    # The offset at the street-facing end follows the existing step in the footprint.
    wall('Primary side of shower partition','x',21.38,3.12,10.25,pale,(),None,True)
    wall('Bathroom front return','x',22.20,.13,3.12,sage,(),None,True)
    wall('Bath offset along front exterior step','y',3.12,21.38,22.20,pale,(),None,True)
    wall('Bathroom sliding entry','y',10.25,21.38,29.04,amber,[(26.02,28.78,0,2.04)],None,True)
    # Sightline to the dining room from the narrow, straight front hall (L1040640).
    # Open shared junction: the camera in L1040618 sees the master, bathroom and stairs together.
    wall('Master barn door stone return','x',23.45,15.48,18.15,terr,(),None,True)
    # The right end of the stone pier has a finished thickness toward the living room.
    wall('Master pier return','y',18.15,23.02,23.45,terr,(),None,True)
    wall('Hall-tree backing','y',10.25,29.04,30.35,amber,(),None,True)
    header=[(30.35,10.25,2.14),(33.25,10.25,2.14),(33.25,10.25,topz(33.25,10.25)),(30.35,10.25,topz(30.35,10.25))]
    face('Front hall · finished header above passage',header,amber)
    wall('Bunk room wall lining at living entry','y',15.105,.18,bunk_partition,mint,[(2,4.9,0,1.94)],loftdeck-.16,False)
    wall('Main bedroom rear headboard wall','y',15.11,bunk_partition,20.76,pale,(),None)
    # The gray entry flooring and striped runner are distinct in L1040636.
    # Continuous boards run from the living-room threshold to the kitchen gable.
    for n,coords in [
        ('Pine in kitchen and dining',(21.10,40.89,10.25,25.88)),
        ('Pine entry',(22.05,29.05,.12,10.25)),
        ('Front bedroom pine',(33.25,40.87,.12,10.25)),
        ('Bedside floor',(.14,21.10,3.10,15.25)),
        ('Primary pine return',(21.10,22.05,3.12,10.25))]:
        flat(n,*coords,.013,oak,6)
    # The separate gray-tile entrance ends at the open passage into the kitchen.
    entry_tile=material('Entry hall · charcoal-gray tile','#726e68',rough=.61)
    entry_grout=material('Entry hall · dark joints','#68645f')
    flat('Entry hall · grout',29.05,33.25,.12,10.25,.008,entry_grout)
    for i in range(3):
        for j in range(8):
            xa=29.05+i*1.4; ya=.12+j*(10.25-.12)/8
            flat('Entry hall · gray tile',xa+.007,xa+1.393,ya+.007,ya+(10.25-.12)/8-.007,.012,entry_tile)
    obox('Entry hall · threshold at pine',30.35,33.25,10.21,10.27,.011,.017,steel)
    obox('Dining · silver floor transition at hearth',21.06,21.14,18.17,dining_wall_y,.013,.019,steel)
    # Flat ceilings and pine kitchen vaulted ceiling, avoiding false surfaces through the sloping roof.
    # The main-floor ceiling stops at the underside of the loft platform.
    # The deck framing itself closes the step at each end.
    for label,rect,limit in [
        ('Bunk bedroom under loft',(.15,bunk_partition,3.12,15.24),loftdeck-.125),
        ('Front hall',(29.04,33.25,.12,10.25),2.30)]:
        x0,x1,y0,y1=rect
        for j in range(10):
            y=y0+(y1-y0)*j/10;v=y0+(y1-y0)*(j+1)/10
            pts=[(x0,y),(x1,y),(x1,v),(x0,v)]
            face('Interior · '+label+' ceiling',[(x,y,min(limit,topz(x,y))) for x,y in reversed(pts)],ceilingmat)
    # The full bedroom has one continuous ceiling from its front eave to its
    # headboard wall. Its flat portion spans the hall's change of ceiling height.
    front_eave=.12
    def front_bed_eave_height(x,y):return pz(0,x,y)-main-.13
    def edge_of_flat(x):
        low=front_bed_eave_height(x,front_eave)
        return front_eave+(2.30-low)/(front_bed_eave_height(x,front_eave+1)-low)
    left,right=33.25,40.86
    knee_left=(left,edge_of_flat(left),2.30)
    knee_right=(right,edge_of_flat(right),2.30)
    face('Front bedroom · continuous plaster below front eave',
         [(left,front_eave,front_bed_eave_height(left,front_eave)),knee_left,knee_right,
          (right,front_eave,front_bed_eave_height(right,front_eave))],ceilingmat)
    face('Front bedroom · continuous flat plaster ceiling',
         [knee_left,(left,12.50,2.30),(right,12.50,2.30),knee_right],ceilingmat)
    # Keep the full-height room face above the entry door, even where the
    # ceiling on the hall side falls away. Its low end follows the front eave.
    hall_x=33.255
    start_y=front_eave+(2.077-front_bed_eave_height(hall_x,front_eave))/(
        front_bed_eave_height(hall_x,front_eave+1)-front_bed_eave_height(hall_x,front_eave))
    face('Front bedroom · continuous upper plaster at hall',
         [(hall_x,start_y,2.077),(hall_x,12.495,2.077),(hall_x,12.495,2.302),
          (hall_x,edge_of_flat(hall_x),2.302)],pale)
    for label,a,b in [
        ('headboard',(33.25,12.485),(40.855,12.485)),
        ('gable',(40.835,12.495),(40.835,10.20))]:
        face('Front bedroom · upper plaster at '+label,
             [(*a,2.17),(*b,2.17),(*b,2.302),(*a,2.302)],pale)
    for y0,y1,edge in [(3.12,10.25,21.38),(10.25,15.27,23.45)]:
        corners=[(bunk_partition,y0),(bunk_partition,y1),(edge,y1),(edge,y0)]
        face('Primary bedroom · sloping plaster',[(x,y,primary_ceiling(y)) for x,y in corners],ceilingmat)
    # The primary ceiling rises higher than the adjacent hallway. A separate
    # bedroom-facing lining closes the wall above the door and its two returns.
    # All three infills start above the exposed doorway trim and rail.
    for label,a,b,finish_mat in [
        ('barn door',(23.444,10.25),(23.444,15.27),pale),
        ('headboard return',(23.45,15.264),(20.746,15.264),pale),
        ('shower return',(21.374,10.256),(23.45,10.256),amber)]:
        face('Primary bedroom · upper plaster at '+label,
             [(*a,2.17),(*b,2.17),(*b,primary_ceiling(b[1])+.004),(*a,primary_ceiling(a[1])+.004)],finish_mat)
    # At the full-bedroom boundary, the flat 2.30 m room ceiling meets the taller
    # vaulted hall. The painted face closes the otherwise exposed roof cavity.
    for ya,yb in [(10.25,12.49)]:
        face('Front hall · plaster above full-bedroom ceiling',
             [(33.25,ya,2.30),(33.25,yb,2.30),(33.25,yb,topz(33.25,yb)),(33.25,ya,topz(33.25,ya))],
             pale)
    # A flat hall soffit meets the low north edge of the vault. Each side of
    # the interior gable is one plane; the return follows the primary room.
    hall_lid=kitchen_vault_z(kitchen_eave_y)
    face('Front hall · plaster soffit at kitchen entry',
         [(23.44,10.24,hall_lid),(23.44,kitchen_eave_y,hall_lid),
          (33.26,kitchen_eave_y,hall_lid),(33.26,10.24,hall_lid)],ceilingmat)
    north=[(21,15.25),(23.45,15.25),(23.45,kitchen_eave_y),
           (40.91,kitchen_eave_y),(40.91,kitchen_ridge_y),(21,kitchen_ridge_y)]
    south=[(21,kitchen_ridge_y),(40.91,kitchen_ridge_y),(40.91,25.92),(21,25.92)]
    for slope,outline in [('hall side',north),('slider side',south)]:
        face('Kitchen vault · ivory plaster on '+slope,
             [(x,y,kitchen_vault_z(y)) for x,y in reversed(outline)],ceilingmat)
    # The bedroom return meets the hearth opening at the two different
    # ceiling heights. Finish both pieces above its existing 2.35 m wall.
    for xa,xb,high_a,high_b in [
        (20.75,20.89,soffit(20.75,15.27),soffit(20.89,15.27)),
        (20.89,23.45,kitchen_vault_z(15.27),kitchen_vault_z(15.27))]:
        face('Living to kitchen · plaster above bedroom return',
             [(xa,15.27,2.35),(xb,15.27,2.35),(xb,15.27,high_b+.005),(xa,15.27,high_a+.005)],pale)

    # A square-sawn collar tie sits horizontally between the slopes. Its ends
    # are scribed against the plaster. Project the grain along the timber on
    # all four long sides, including the soffit visible from the floor.
    tie_bottom=cooking_tie_underside()
    tie_top=tie_bottom+.120
    def half_span(z):return (kitchen_vault_z(kitchen_ridge_y)-z)/kitchen_vault_pitch
    section=[(kitchen_ridge_y-half_span(tie_bottom),tie_bottom),
             (kitchen_ridge_y+half_span(tie_bottom),tie_bottom),
             (kitchen_ridge_y+half_span(tie_top),tie_top),
             (kitchen_ridge_y-half_span(tie_top),tie_top)]
    for station,label,offset in [(25.74,'dining',.11),(32.75,'island lights',.35),(37.68,'range',.57)]:
        half_thick=.22
        corners=[(x,y,z) for x in (station-half_thick,station+half_thick) for y,z in section]
        ob=mesh('Kitchen vault · pine collar tie at '+label,[point(*p) for p in corners],
                [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],oak,rooms_extra,True)
        uv=ob.data.uv_layers.new(name='Pine grain along collar tie')
        for poly_ in ob.data.polygons:
            for li in poly_.loop_indices:
                xx,yy,zz=corners[ob.data.loops[li].vertex_index]
                if poly_.index in (0,1):v=(zz-tie_bottom)/.34
                else:v=(xx-station)*ft/.38
                uv.data[li].uv=(yy*ft/1.6+offset,v+offset)
    # One flush downlight is visible on the slope above the dining opening.
    # The back can and ring follow that surface's normal.
    x,y=27.62,22.36
    z=kitchen_vault_z(y)
    center=point(x,y,z)+Vector((0,0,-.006))
    tangent=(point(x,y+.1,kitchen_vault_z(y+.1))-point(x,y,z)).normalized()
    along=(point(x+1,y,z)-point(x,y,z)).normalized()
    normal=tangent.cross(along).normalized()
    for label,rad,depth,mm in [('trim',.072,.002,cream),('diffuser',.056,.003,lamp)]:
        vs=[center+along*(rad*cos(2*pi*k/32))+tangent*(rad*sin(2*pi*k/32))+normal*depth for k in range(32)]
        mesh('Kitchen vault · recessed '+label,vs,[tuple(reversed(range(32)))],mm,rooms_extra)
    # Fixtures and furniture below have local dimensions grouped into editable meshes.
    def patterned(label,mode):
        # Woven color repeat baked into a packed image, shared by the renderer and glTF viewer.
        import numpy as np
        from pathlib import Path
        import tempfile
        data=mat('Room fabric | '+label,'#aaaaaa',0,.88);N=256
        y,x=np.mgrid[0:N,0:N];ra=np.random.default_rng(5114)
        if mode in ('check','bluecheck','pillow'):
            rgb=np.array([[163,51,46],[191,177,144],[43,56,55],[75,66,63]],float) if mode=='check' else np.array([[91,100,123],[188,191,190],[68,75,92],[102,108,123]],float) if mode=='bluecheck' else np.array([[150,47,52],[228,221,208],[49,48,49],[214,203,188]],float)
            profile=np.repeat([1,0,0,2,0,3,0,2,1,0,0,2,0,3,0,2],16)
            warp=rgb[profile[x]];weft=rgb[profile[y]];t=(.5+.23*np.sin((x+y)*pi/2))[:,:,None]
            arr=t*warp+(1-t)*weft
        elif mode=='tweed':
            arr=np.ones((N,N,3))*[154,181,177]+np.cos((x+y)*pi/9)[:,:,None]*3
        elif mode=='stone':
            coarse=ra.normal(0,1,(32,32));coarse=coarse.repeat(8,0).repeat(8,1)
            arr=np.ones((N,N,3))*[80,70,62]+coarse[:,:,None]*5+ra.normal(0,12,(N,N,1))
        else:
            arr=np.ones((N,N,3))*[76,105,132]+np.cos(2*pi*x/24)[:,:,None]*13
        arr=np.clip(arr+ra.normal(0,2.3,(N,N,1)),0,255)/255
        rgba=np.concatenate([arr,np.ones((N,N,1))],axis=2).astype(np.float32)
        im=bpy.data.images.new('Cabin textile | '+label,N,N,alpha=True)
        # Blender pixel buffers take linear values.
        rgba[:,:,:3]=np.where(rgba[:,:,:3]<=.04045,rgba[:,:,:3]/12.92,((rgba[:,:,:3]+.055)/1.055)**2.4)
        im.pixels.foreach_set(rgba.ravel());im.pack()
        tex=data.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;data.node_tree.links.new(tex.outputs['Color'],data.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);return data
    tartan=patterned('Cabin red plaid','check');bunksheet=patterned('Bunk · gray-blue flannel','bluecheck');pillowprint=patterned('Buffalo check pillow','pillow')
    wash=patterned('Sea-glass cotton','tweed');islandstone=patterned('Kitchen · mottled island top','stone')
    def drape(b,x0,x1,y0,y1,h,m,drop=.125):
        # Grid coordinates extend over the side of the horizontal surface and gather at corners.
        w=(x1-x0)*ft;l=(y1-y0)*ft;E=.042
        def arr(n,vv):return [-drop,-.065,-.022]+[vv*i/n for i in range(n+1)]+[vv+.022,vv+.065,vv+drop]
        rows=[]
        for yp in arr(23,l):
            row=[]
            for xp in arr(20,w):
                xx=max(0,min(w,xp));yy=max(0,min(l,yp));ex=xp-xx;ey=yp-yy;rr=math.hypot(ex,ey)
                dd=0
                if rr:
                    swell=E*(1-exp(-rr/E))+.005*(sin(21*xp+29*yp)+.6*cos(17*yp))*(1-exp(-rr/.025));xx+=swell*ex/rr;yy+=swell*ey/rr;dd=rr-E*(1-exp(-rr/E))
                dz=.004*sin(7*xp+2*yp)*sin(7*yp)+.007*exp(-((xp-.18-.31*yp)/.045)**2)
                row.append((b.vert((x0*ft+xx,y0*ft+yy,h-dd+dz)),(xp/.29,yp/.29)))
            rows.append(row)
        for j in range(len(rows)-1):
            for i in range(len(rows[0])-1):
                corners=[rows[j][i],rows[j][i+1],rows[j+1][i+1],rows[j+1][i]]
                b.face([p[0] for p in corners],m,[p[1] for p in corners],True)
    def chair(b,cx,cy,chairh=1.0,facing=1,stool=False):
        m=honey if stool else night;seat=.64 if stool else .44;hw=.62;hd=.60
        bx(b,cx-hw,cx+hw,cy-hd,cy+hd,seat-.041,seat,m,6)
        for xx in (-1,1):
            for yy in (-1,1):
                line(b,(cx+xx*.54,cy+yy*.52,.01),(cx+xx*.44,cy+yy*.42,seat-.022),.017,m,9)
        sy=cy+facing*.47
        for xx in ((-.53,-.28,0,.28,.53) if stool else (-.52,.52)):
            endz=chairh-.048-.18*abs(xx/.59)**2 if stool else chairh-.040
            line(b,(cx+xx,sy,seat-.01),(cx+xx*1.06,sy+facing*.17,endz),.013 if stool else .024,m,9)
        if stool:
            chain=[(cx+.61*cos(k*pi/14),sy+facing*.16,seat+.11+.30*sin(k*pi/14)) for k in range(15)]
            for a1,a2 in zip(chain,chain[1:]):line(b,a1,a2,.024,m,12)
        else:
            for hh in (chairh-.115,chairh-.266):
                bx(b,cx-.525,cx+.525,sy+facing*.125-.041,sy+facing*.125+.041,hh,hh+.058,m)
        for sign in (-1,1):line(b,(cx-.50,cy+.46*sign,.24),(cx+.50,cy+.46*sign,.24),.013,m)
    # The photographed L-shaped counters, pantry shelves, island and appliances.
    kitchen_script=work/'Kitchen counters.py'
    exec(compile(kitchen_script.read_text(),str(kitchen_script),'exec'),{**globals(),**locals()})
    dining_script=work/'Dining room.py'
    exec(compile(dining_script.read_text(),str(dining_script),'exec'),{**globals(),**locals()})
    # DSC01700/701 and L1040619/621 show the same timber joinery across two linen changes.
    timber=texmat('Master · weathered timber','Master - weathered timber.jpg')
    buffalo=texmat('Master · large woven red and charcoal check','Bedrooms - buffalo check.jpg')
    quilting=texmat('Master · stone diamond quilting','Master - diamond quilt.jpg')
    floral=texmat('Master · floral shams','Master - floral sham.jpg')
    front_checks=texmat('Front bedroom · double buffalo-check shams','Front bedroom - check pillow.jpg')
    navy=material('Master · ink fitted sheet','#242c41',0,.94)
    pillowback=material('Master · warm gray back pillows','#827669',0,.90)
    def bed(b,wfeet,lfeet,quilt,queen=False):
        w,l=wfeet,lfeet
        wood=timber if queen else darkoak
        for xx in (-w/2+.09,w/2-.09):
            for yy in (-l/2+.08,l/2-.10):bx(b,xx-.105,xx+.105,yy-.12,yy+.12,.012,.36,wood)
            bx(b,xx-.10,xx+.10,-l/2,l/2,.10,.31,wood)
        bx(b,-w/2,w/2,-l/2,l/2,.275,.503,navy if queen else lightfabric,8)
        if queen:
            for i in range(4):
                z=.360+.184*i
                bx(b,-w/2-.08,w/2+.08,-l/2-.13,-l/2+.035,z,z+.177,wood)
                for x in (-w/2+.14,w/2-.14):
                    line(b,(x,-l/2+.036,z+.086),(x,-l/2+.052,z+.086),.009,rail,12)
            for i in range(2):
                bx(b,-w/2-.10,w/2+.10,l/2-.01,l/2+.12,.064+i*.166,.225+i*.166,wood)
            drape(b,-w/2,w/2,-l/2+.62,l/2,.51,quilting,.170)
            drape(b,-w/2-.075,w/2+.075,-l/2+2.00,l/2+.105,.529,quilt,.227)
            for s in (-1,1):
                xx=s*w*.240
                b.cube((xx*ft,(-l/2+.38)*ft,.70),(.66,.175,.414),pillowback,3.6,(.22,.035*s,-.035*s),pillow=True)
                b.cube((xx*ft,(-l/2+.74)*ft,.667),(.675,.185,.37),floral,3.8,(.32,.026*s,-.05*s),pillow=True)
        else:
            bx(b,-w/2-.01,w/2+.01,l/2-.12,l/2+.04,.125,.292,darkoak)
            drape(b,-w/2,w/2,-l/2+.21,l/2,.51,quilt,.125)
            for s in (-1,1):
                b.cube((s*w*.238*ft,(-l/2+.44)*ft,.642),(.643,.161,.320),front_checks,3.5,
                       (.34,s*.018,s*.050),pillow=True)
    queen=group('Main bedroom | weathered plank queen, buffalo-check cover and floral shams',(15.59,11.68,0),180)
    bed(queen,5.0,6.56,buffalo,True);finish(queen);collider('bedroom_queen',12.99,18.19,8.33,15.12,0,.55)
    def tablelamp(b,x,y):
        # Open rectangular iron bases, pale timber tops and lantern-shaped bedside lamps in DSC01701.
        bx(b,x-.68,x+.68,y-.52,y+.52,.503,.535,woodboard)
        for xx in (x-.64,x+.64):
            for yy in (y-.48,y+.48):
                line(b,(xx,yy,.016),(xx,yy,.505),.010,rail)
            line(b,(xx,y-.48,.016),(xx,y+.48,.016),.010,rail)
        for yy in (y-.48,y+.48):
            line(b,(x-.64,yy,.016),(x+.64,yy,.016),.010,rail)
        cyl(b,x,y,.535,.551,.062,rail,20)
        cyl(b,x,y,.551,.579,.052,rail,20,.034)
        cyl(b,x,y,.579,.66,.032,nickel_lamp,16,.043);cyl(b,x,y,.66,.68,.043,nickel_lamp,16,.026)
        cyl(b,x,y,.678,.706,.035,rail,16,.025);cyl(b,x,y,.70,.77,.012,rail)
        for s in (-1,1):
            chain=[(x+s*.09,y,.557),(x+s*.15,y,.578),(x+s*.164,y,.666),(x+s*.12,y,.692),(x+s*.06,y,.703)]
            for a,bp in zip(chain,chain[1:]):line(b,a,bp,.006,rail,8)
        cyl(b,x,y,.757,.958,.119,lamp,32,.099)
        cyl(b,x,y,.959,.971,.012,rail,12)
    nickel_lamp=material('Master · lantern body','#686055',.46,.32)
    qdec=group('Main bedroom | bedside lanterns, clothes rack, dresser and antler chandelier')
    for xx in (12.04,19.14):
        tablelamp(qdec,xx,14.21)
        collider('main_bedroom_nightstand_'+str(xx),xx-.68,xx+.68,13.69,14.73,0,.535)
    # Facing the actual paired window the tall chest sits on its left. DSC01554.
    bx(qdec,17.43,20.17,3.28,4.76,.06,1.225,woodboard)
    bx(qdec,17.38,20.22,3.26,4.82,1.226,1.262,darkoak)
    for j in range(5):
        z=.10+j*.216
        bx(qdec,17.49,20.11,4.76,4.83,z,z+.203,night)
        for xx in (18.02,19.58):line(qdec,(xx,4.83,z+.105),(xx,4.90,z+.105),.013,brass2,12)
    collider('main_bedroom_dresser',17.38,20.22,3.26,4.90,0,1.26)
    # Open steel hanging rail along the same side as the three river prints.
    rack_x=10.13
    for y in (4.35,7.58):
        line(qdec,(rack_x,y,.07),(rack_x,y,1.57),.012,rail,12)
        line(qdec,(rack_x-.34,y,.065),(rack_x+.72,y,.065),.012,rail,12)
        line(qdec,(rack_x+.71,y,.067),(rack_x,y,.59),.009,rail,10)
    for z in (.12,1.49,1.57):line(qdec,(rack_x,4.35,z),(rack_x,7.58,z),.012,rail,12)
    bx(qdec,rack_x-.26,rack_x+.66,4.38,7.55,.13,.165,rail)
    for y in (4.70,4.91):
        points=[(rack_x-.035,y,1.586),(rack_x+.064,y,1.595),(rack_x+.078,y,1.565),
                (rack_x+.015,y,1.523),(rack_x+.015,y,1.485),(rack_x+.568,y,1.402),
                (rack_x-.525,y,1.402),(rack_x+.015,y,1.485)]
        for a,bp in zip(points,points[1:]):line(qdec,a,bp,.006,timber,8)
    collider('main_bedroom_hanging_rail',9.77,10.87,4.32,7.61,0,1.58)
    # The crown has two staggered levels of tines and six candle bulbs (L1040619 and DSC01701).
    cx,cy=15.65,11.75
    tine=material('Master · amber antlers','#94754f',0,.55)
    tip=material('Master · ivory antler tips','#c7a87a',0,.53)
    line(qdec,(cx,cy,primary_ceiling(cy)),(cx,cy,2.20),.005,rail)
    cyl(qdec,cx,cy,1.981,2.221,.029,rail,16)
    def tapered(points,radii):
        for j,(a,bp) in enumerate(zip(points,points[1:])):
            qdec.beam((a[0]*ft,a[1]*ft,a[2]),(bp[0]*ft,bp[1]*ft,bp[2]),radii[j],tine if j<len(points)-2 else tip,10,radii[j+1])
    for j in range(6):
        ang=pi*2*j/6+.13
        def arm(rad,z,da=0):return (cx+rad*cos(ang+da),cy+rad*sin(ang+da),z)
        for rad,z,da in [(.98,1.982,.11),(.76,2.108,-.14)]:
            tapered([arm(.05,z),arm(.38*rad,z-.025,da*.40),arm(.74*rad,z+.014,da),
                     arm(.94*rad,z+.064,da+.13),arm(rad,z+.113,da+.23)],[.018,.017,.012,.009,.002])
            tapered([arm(.59*rad,z-.003,da*.8),arm(.66*rad,z+.043,da-.20),arm(.70*rad,z+.099,da-.27)],[.013,.008,.0018])
            tapered([arm(.76*rad,z+.023,da),arm(.82*rad,z+.06,da-.10),arm(.85*rad,z+.11,da-.12)],[.010,.006,.0018])
        sx,sy,_=arm(.57,2.17,-.08)
        cyl(qdec,sx,sy,2.134,2.203,.010,rail,12)
        cyl(qdec,sx,sy,2.203,2.23,.011,lamp,12,.014);cyl(qdec,sx,sy,2.23,2.264,.014,lamp,12,.003)
    # Parts rotated in plan match the frames' two independent wall planes.
    plaque=texmat('Master · photographed small sign','Master - headboard plaque.jpg')
    bx(qdec,14.32,16.86,15.038,15.097,1.67,1.788,darkoak)
    face('Master bedroom · inscribed headboard sign',[(16.86,15.035,1.67),(14.32,15.035,1.67),
         (14.32,15.035,1.788),(16.86,15.035,1.788)],plaque,[(1,0),(0,0),(0,1),(1,1)])
    for j in range(3):
        start=8.29+j*.96;end=start+.90
        bx(qdec,9.656,9.72,start,end,1.19,1.655,woodboard)
        river=texmat('Master · photographed river panel '+str(j+1),'Master - river panel '+str(j+1)+'.jpg')
        # From in front of this wall +Y appears to the right.
        face('Master · river triptych panel '+str(j+1),[(9.727,start+.025,1.20),(9.727,end-.025,1.20),
             (9.727,end-.025,1.645),(9.727,start+.025,1.645)],river,[(0,0),(1,0),(1,1),(0,1)])
    # Theater-gray split drapes at the primary's divided-light front window. DSC01554.
    curtain=material('Master · gray linen drapes','#8f8985',0,.91)
    line(qdec,(10.62,3.38,1.89),(16.78,3.38,1.89),.013,rail,16)
    for side,edge in [(-1,11.04),(1,16.37)]:
        last=None
        for i in range(19):
            t=i/18;topx=edge+side*(-.04+.40*t);lowx=edge+side*(-.17+.69*t)
            fold=.068*cos(i*pi/3)
            row=[qdec.vert((lowx*ft,(3.40+fold)*ft,.195+.007*sin(i*.85))),
                 qdec.vert((topx*ft,(3.40+fold)*ft,1.872))]
            if last:qdec.face([last[0],row[0],row[1],last[1]],curtain,smooth=True)
            last=row
        for i in range(4):
            xx=edge+side*(-.02+i*.122)
            line(qdec,(xx,3.38,1.87),(xx,3.38,1.90),.008,rail,10)
    # Both sliding doors are parked, as in L1040618. They serve separate rooms.
    door_pine=texmat('Barn doors · photographed knotty pine','Doors - natural pine grain.jpg')
    def barn_door(label,origin,yaw,panels,track_start,track_end,handle_u,reverse_braces=False):
        panel=group(label,origin,yaw)
        width=panels*ft
        # Each cut board has a broad planar face. Project the owner's grain along
        # each piece so the diagonal braces and perimeter rails read as carpentry.
        def board(corners,back,front,grain,seed):
            area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(corners,corners[1:]+corners[:1]))
            if area<0:corners=list(reversed(corners))
            gy,gz=grain;length=math.hypot(gy,gz);gy/=length;gz/=length
            uv=[((y*gz-z*gy)*3.4+seed*.183,(y*gy+z*gz)*.48+seed*.471) for y,z in corners]
            rings=[[panel.vert((x,y,z)) for y,z in corners] for x in (back,front)]
            panel.face(rings[0][::-1],door_pine,uv[::-1])
            panel.face(rings[1],door_pine,uv)
            for i in range(len(corners)):
                j=(i+1)%len(corners)
                panel.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],woodboard)
        def rect(u,v,b,t,back,front,grain,seed):
            board([(u,b),(v,b),(v,t),(u,t)],back,front,grain,seed)
        for i in range(7):
            rect(i*width/7+.0007,(i+1)*width/7-.0007,.025,2.012,-.021,.018,(0,1),i)
        stile=.077
        for i,u in enumerate((0,width-stile)):rect(u,u+stile,.024,2.012,.018,.039,(0,1),8+i)
        for i,(lo,hi) in enumerate(((.024,.138),(.936,1.052),(1.904,2.012))):
            rect(stile,width-stile,lo,hi,.018,.039,(1,0),10+i)
        for i,(bottom,top,at_left) in enumerate(((.138,.936,True),(1.052,1.904,False))):
            # Master chevron points to the trailing edge. On the perpendicular
            # bathroom door it points back to the pull (IMG_3969 and L1040618).
            left,right=stile,width-stile
            corners=[(left,bottom),(left+.122,bottom),(right,top),(right-.122,top)]
            if reverse_braces==at_left:corners=[(width-u,z) for u,z in corners]
            dy=corners[2][0]-corners[1][0]
            board(corners,.019,.038,(dy,top-bottom),15+i)
        # Flat bar and wide black straps, with separate rollers and fastening heads.
        bx(panel,.155,.200,track_start,track_end,2.073,2.112,rail)
        for u in (.28,panels-.28):
            bx(panel,.132,.178,u-.066,u+.066,1.877,2.129,rail)
            line(panel,(.095,u,2.124),(.184,u,2.124),.033,rail,20)
            for z in (1.922,2.002):line(panel,(.176,u,z),(.184,u,z),.008,rail,12)
        for z in (.893,1.072):
            line(panel,(.125,handle_u,z),(.232,handle_u,z),.012,rail)
        line(panel,(.232,handle_u,.893),(.232,handle_u,1.072),.013,rail,12)
        finish(panel)
    # Park the master leaf to the right of its opening over the stone-faced return.
    sr=random.Random(551);stones=[material('Master door · stone '+str(i),c) for i,c in enumerate(('#9b958e','#817b75','#a69e90','#a29585','#7d7a75','#b2aa9c'))]
    zs=.016
    while zs<2.30:
        hz=min(sr.uniform(.040,.080),2.30-zs);yy=14.42
        while yy<18.13:
            ww=min(sr.uniform(.40,1.50),18.14-yy)
            if ww<.012:break
            bx(qdec,23.47,23.53+sr.random()*.07,yy,yy+ww-.009,zs,zs+hz-.003,sr.choice(stones))
            yy+=ww
        zs+=hz
    # L1040618 shows continuous horizontal pine boards behind the black track.
    # Clip each board to the ceiling slope so the stepped board ends never show.
    for i in range(18):
        bottom=2.045+i*.132
        upper=bottom+.130
        for left,right in ((10.30,kitchen_eave_y),(kitchen_eave_y,18.15)):
            zl,zr=topz(23.47,left),topz(23.47,right)
            if max(zl,zr)<=bottom+.0001:continue
            edge=[(left,zl),(right,zr)]
            if abs(zl-zr)>.0001:
                for h in (bottom,upper):
                    if min(zl,zr)<h<max(zl,zr):
                        edge.append((left+(right-left)*(h-zl)/(zr-zl),h))
            edge=sorted((y,min(upper,z)) for y,z in edge if z>=bottom)
            cap=[(y,z) for y,z in reversed(edge) if z>bottom+.0001]
            outline=[(edge[0][0],bottom),(edge[-1][0],bottom)]+cap
            face('Barn door gable · pine boarding',[(23.625,y,z) for y,z in outline],door_pine,
                 [(z*3.4+i*.183,y*ft*.48+i*.471) for y,z in outline])
    barn_door('Master · open knotty-pine barn door',(23.73,14.42,0),0,3.18,-3.41,3.69,.22)
    # With this 90° rotation, the broad face, pull and track all face the kitchen.
    # The door extends toward -X, to the right in the head-on bathroom view.
    barn_door('Bathroom · open knotty-pine barn door',(25.95,10.41,0),90,2.46,-2.97,2.57,.20,True)
    finish(qdec)
    double=group('Front bedroom | full bed, sea-glass cover and checked pillow',(38.36,9.15,0),180)
    bed(double,4.50,6.27,wash);finish(double);collider('bedroom_double',36.04,40.68,5.96,12.32,0,.49)
    dbl=group('Front bedroom | paneled pine door and small nightstand',(.50,0,0))
    # Door swings into the room and parks beside the photographed bedside table.
    bx(dbl,32.80,35.70,5.87,6.00,.028,1.997,woodboard)
    for xx in (33.00,34.33):
        for z,h in ((.14,.84),(.99,1.83)):
            bx(dbl,xx,xx+1.11,5.845,5.87,z,h,darkoak)
            bx(dbl,xx+.032,xx+1.08,5.831,5.848,z+.024,h-.026,woodboard)
    line(dbl,(35.42,5.818,.91),(35.42,5.718,.91),.032,brass2,14)
    pine_leaf=finish(dbl)
    pine_hull=collider('front_bedroom_open_door',33.31,36.21,5.82,6.02,0,2.0)
    bpy.context.view_layer.update()
    hinge=point(33.31,5.93,0)
    swing=Matrix.Translation(hinge)@Matrix.Rotation(math.radians(58),4,'Z')@Matrix.Translation(-hinge)
    for ob in (pine_leaf,pine_hull):ob.matrix_world=swing@ob.matrix_world
    dbl=group('Front bedroom | drawer stand and reading lamp',(.50,1.64,0))
    # DSC01704 places the checked pillow on the side wall next to a slim reading lamp.
    # In L1040639 the stand faces the foot of the bed, with a shallow drawer,
    # open shelf and a slatted wood crate in a black steel frame.
    for x in (34.38,35.56):
        for y in (9.83,10.55):bx(dbl,x,x+.051,y,y+.050,.014,.512,rail)
    for z in (.037,.20,.326):bx(dbl,34.39,35.61,9.82,10.59,z,z+.025,darkoak)
    bx(dbl,34.42,35.55,9.82,10.57,.352,.468,woodboard)
    bx(dbl,34.32,35.65,9.75,10.67,.48,.52,woodboard)
    line(dbl,(34.99,9.82,.407),(34.99,9.72,.407),.015,rail,12)
    for k in range(3):
        z=.065+k*.045;bx(dbl,34.45,35.51,9.816,9.875,z,z+.039,woodboard)

    cyl(dbl,35.02,10.20,.520,.539,.069,rail,14)
    cyl(dbl,35.02,10.20,.539,.831,.009,rail,10)
    cyl(dbl,35.02,10.20,.732,.813,.034,lamp,14)
    finish(dbl)
    collider('front_bedroom_nightstand',34.83,36.14,11.40,12.28,0,.52)
    # Looking from the pillows toward the street, DSC01552 shows the dresser on
    # the right of the large blind, across the room from the small gable window.
    dbl=group('Front bedroom | white dresser and window blinds')
    dx0,dx1=33.53,35.83
    bx(dbl,dx0,dx1,.39,1.79,.035,.92,whitewood)
    for j in range(5):
        z=.071+j*.163
        bx(dbl,dx0+.022,dx1-.022,1.79,1.86,z,z+.148,cream)
        for xx in (dx0+.46,dx1-.46):line(dbl,(xx,1.86,z+.078),(xx,1.91,z+.078),.013,brass2,10)
    bx(dbl,dx0-.035,dx1+.035,.37,1.88,.918,.944,whitewood)
    blind=material('Front bedroom · ivory Venetian blind','#ece8d9',0,.79)
    for j in range(32):
        z=queenwin[3]-.044-j*.023
        bx(dbl,queenwin[0]+.068,queenwin[1]-.068,.138,.210,z-.012,z,blind)
    for x in (queenwin[0]+.54,queenwin[1]-.54):
        line(dbl,(x,.189,z-.012),(x,.189,queenwin[3]-.043),.0013,blind)
    finish(dbl)
    collider('front_bedroom_white_dresser',dx0-.035,dx1+.035,.37,1.91,0,.944)
    bunk=group('Bunk bedroom by television | steel frame, painted loft joists and tall chest')
    # Photo 027 explicitly identifies the twin-over-full. The outer posts jog
    # out at the lower rail and the inclined ladder follows the wider mattress.
    x0,x1,y0=.68,7.20,4.07
    twin_edge=y0+3.25
    full_edge=y0+4.50
    for x in (x0,x1):
        cyl(bunk,x,y0,.015,1.62,.024,rail,12)
        for a,b in zip(((x,full_edge,.015),(x,full_edge,.30),(x,twin_edge,1.093)),
                       ((x,full_edge,.30),(x,twin_edge,1.093),(x,twin_edge,1.62))):
            line(bunk,a,b,.026,rail,12)
        for h,edge in ((.22,full_edge),(1.13,twin_edge),(1.51,twin_edge)):
            line(bunk,(x,y0,h),(x,edge,h),.019,rail)
    for h,outer,cloth in ((.23,full_edge,bunksheet),(1.13,twin_edge,blues)):
        for yy in (y0,outer):line(bunk,(x0,yy,h),(x1,yy,h),.026,rail)
        bx(bunk,x0+.04,x1-.04,y0+.06,outer-.06,h+.015,h+.163,lightfabric,7)
        drape(bunk,x0+.03,x1-.03,y0+.055,outer-.055,h+.168,cloth,.078)
        bunk.cube(((x1-.64)*ft,(y0+outer)*ft/2,h+.218),(.32,.61,.093),lightfabric,4.2,(0,.025,.024),pillow=True)
    for z in (1.36,1.47,1.57):
        line(bunk,(x0,y0,z),(x1,y0,z),.011,rail)
        line(bunk,(x0,twin_edge,z),(x1,twin_edge,z),.012,rail)
    for xx in (x0+2.12,x0+4.47):
        line(bunk,(xx,twin_edge,1.15),(xx,twin_edge,1.57),.012,rail,12)
    ladder_front=full_edge+.28
    def ladder_y(height):
        return ladder_front+(twin_edge+.024-ladder_front)*(height/1.57)
    for xx in (x0+.22,x0+1.37):line(bunk,(xx,ladder_front,.008),(xx,twin_edge+.024,1.57),.016,steel,12)
    for j in range(5):
        z=.224+j*.267;yy=ladder_y(z)
        bx(bunk,x0+.19,x0+1.40,yy-.060,yy+.060,z-.014,z+.014,rail)
    # DSC01557 looks from the ladder to the tall chest, window and living-room sofa.
    bx(bunk,5.87,8.12,13.65,14.98,.034,1.15,night)
    for j in range(5):
        bx(bunk,5.93,8.06,13.57,13.65,.09+j*.209,.271+j*.209,night)
        for xx in (6.26,7.74):line(bunk,(xx,13.56,.18+j*.209),(xx,13.51,.18+j*.209),.012,brass2,9)
    collider('bunk_tall_chest',5.87,8.12,13.51,14.98,0,1.15)
    for xx in (1.1,3.8,6.6):bx(bunk,xx,xx+.22,3.21,15.02,loftdeck-.20,loftdeck-.13,mint)
    cyl(bunk,4.15,9.55,1.99,2.025,.096,lamp,20);cyl(bunk,4.15,9.55,2.025,2.067,.109,cream,20)
    finish(bunk);collider('bunk_beds',x0,x1,y0,full_edge,0,.42)
    collider('bunk_ladder',x0+.15,x0+1.43,twin_edge,ladder_front+.05,0,1.60)
    bath_script=work/'Bathroom.py'
    exec(compile(bath_script.read_text(),str(bath_script),'exec'),{**globals(),**locals()})
    # DSC01704 looks from full bed straight out onto this long striped hall runner.
    rugm=material('Entry runner · dark woven binding','#34363a',rough=.95)
    runner=texmat('Entry runner · photographed woven stripes','Entry - striped woven runner.jpg')
    foyer=group('Front hall | striped runner and landscape triptych')
    bx(foyer,30.04,32.04,1.55,9.47,.014,.019,rugm)
    face('Entry runner · longitudinal weave',[(30.05,1.56,.0196),(32.03,1.56,.0196),
         (32.03,9.46,.0196),(30.05,9.46,.0196)],runner,[(0,0),(1,0),(1,2.5),(0,2.5)])
    # Three landscape panels face the bedroom door from the passage, above the runner.
    for j in range(3):
        yy=2.53+j*.78;bx(foyer,29.07,29.13,yy,yy+.74,1.27,1.67,darkoak)
        bx(foyer,29.13,29.15,yy+.02,yy+.72,1.29,1.65,woodboard)
    # Map the owner's photographed prints to the canvases on the two opposing walls.
    def framed_print(label,filename,points,coords):
        img=bpy.data.images.load(str(work/'Interior materials'/filename),check_existing=True);img.pack()
        mm=material(label,'#fffdf4',rough=.98)
        node=mm.node_tree.nodes.new('ShaderNodeTexImage');node.image=img
        mm.node_tree.links.new(node.outputs['Color'],mm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        face(label,points,mm,coords)
    framed_print('Front bedroom · birchwood canvas','Front bedroom woodland print.jpg',
                 [(37.10,12.45,1.30),(39.40,12.45,1.30),(39.40,12.45,1.72),(37.10,12.45,1.72)],[(1,0),(0,0),(0,1),(1,1)])
    # In the April entry photo the hanging cabin plaque is on the bedroom
    # side of the passage, before its open doorway as you face the front door.
    bx(foyer,33.16,33.215,7.25,8.30,1.14,1.58,darkoak)
    framed_print('Front hall · cabin plaque','Entry - cabin rules plaque.jpg',
        [(33.157,8.30,1.14),(33.157,7.25,1.14),(33.157,7.25,1.58),(33.157,8.30,1.58)],
        [(0,0),(1,0),(1,1),(0,1)])
    for yy in (7.31,8.24):line(foyer,(33.16,yy,1.579),(33.18,7.78,1.70),.0025,darkoak)
    for jj in range(3):
        ya=2.56+jj*.78;yb=ya+.68;l=jj/3;r=(jj+1)/3
        framed_print('Front hall · lake landscape '+str(jj+1),'Front hall landscape triptych.jpg',
                     [(29.17,ya,1.30),(29.17,yb,1.30),(29.17,yb,1.64),(29.17,ya,1.64)],[(l,0),(r,0),(r,1),(l,1)])
    # The wood hall tree separates the front passage from the bathroom (IMG_3969).
    bx(foyer,28.91,30.69,10.34,10.61,.07,1.86,darkoak)
    for xx in (28.96,30.51):
        bx(foyer,xx,xx+.12,10.42,11.54,.025,.49,woodboard)
        bx(foyer,xx,xx+.12,10.43,10.63,.49,1.91,woodboard)
    bx(foyer,28.86,30.75,10.37,11.62,.42,.48,darkoak)
    for hh in (.09,.255):
        bx(foyer,28.97,30.62,10.48,11.42,hh,hh+.035,woodboard)
    bx(foyer,29.76,29.82,10.47,11.43,.09,.42,woodboard)
    for j in range(6):
        xx=29.1+j*.23;bx(foyer,xx,xx+.018,10.59,10.63,.51,1.70,woodboard)
    for xx in (29.2,29.78,30.39):
        line(foyer,(xx,10.62,1.58),(xx,10.77,1.55),.010,rail)
        line(foyer,(xx,10.77,1.55),(xx,10.80,1.59),.009,rail)
    bx(foyer,28.81,30.79,10.33,11.01,1.87,1.925,darkoak)
    collider('hall_tree_bench',28.84,30.77,10.33,11.64,0,1.88)
    finish(foyer)
    # Private reference fit-out. No connection to the published camera route. The source documents establish these facilities,
    # but do not resolve the laundry room's exact location or a separate outdoor threshold.
    basement=group('Private lower level | two garage bays, den posts and laundry service equipment',collection=private_extra)
    base=low-main
    bx(basement,19.97,20.26,3.28,27.72,base+.02,base+2.35,terr)
    for yy in (9.5,17.5,23.5):cyl(basement,28.0,yy,base+.025,base+2.38,.077,whitewood)
    # Listing photos 087/088 identify the newer graphite all-in-one unit.
    # Keep its plan position provisional within the private lower-level study.
    flats=group('Private lower level | front-load wash and dry combo, holding tank and water heater',collection=private_extra)
    case=material('Laundry · brushed graphite cabinet','#625e5d',.49,.32)
    hatch=material('Laundry · smoked drum glazing','#302e2e',.37,.18)
    bezel=material('Laundry · soft silver rim','#aaa5a1',.69,.29)
    wx,wy=33.56,21.99
    bx(flats,wx-1.13,wx+1.13,wy,wy+2.53,base+.026,base+1.036,case)
    def round_control(x,z,depth,r,material,sides):
        line(flats,(x,wy-.004,z),(x,wy-depth,z),r,material,sides)
    round_control(wx,base+.554,.034,.310,bezel,56)
    round_control(wx,base+.554,.049,.298,rail,56)
    round_control(wx,base+.555,.058,.240,hatch,56)
    bx(flats,wx-.98,wx-.31,wy-.02,wy-.004,base+.883,base+.998,case)
    bx(flats,wx-.92,wx-.35,wy-.023,wy-.019,base+.901,base+.916,rail)
    round_control(wx,base+.960,.043,.044,bezel,28)
    round_control(wx,base+.960,.048,.037,rail,28)
    bx(flats,wx+.35,wx+.99,wy-.023,wy-.004,base+.927,base+.976,hatch)
    bx(flats,wx-1.032,wx-.48,wy-.016,wy-.004,base+.055,base+.168,case)
    cyl(flats,38.33,22.67,base+.03,base+1.35,.27,material('Pressure vessel · blue','#38618b'),18)
    cyl(flats,38.42,20.01,base+.035,base+1.43,.26,steel,18)
    # Owner confirms an enclosed WC downstairs, reached from outside. Photos do not establish its location or which
    # outside door serves it. Keep the following movable, editable layout as an owner reference and off the renter route.
    powder=group('Private lower level | enclosed half bath · layout estimated',collection=private_extra)
    ax,bxw,ay,by=31.10,36.24,15.52,20.73
    for xx in (ax,bxw):bx(powder,xx-.09,xx+.09,ay,by,base+.01,base+2.06,whitewood)
    bx(powder,ax,bxw,by-.09,by+.09,base+.01,base+2.06,whitewood)
    bx(powder,ax,ax+.58,ay-.09,ay+.09,base+.01,base+2.06,whitewood)
    bx(powder,ax+3.15,bxw,ay-.09,ay+.09,base+.01,base+2.06,whitewood)
    bx(powder,ax+.58,ax+3.15,ay-.09,ay+.09,base+1.94,base+2.06,whitewood)
    bx(powder,ax+.63,ax+3.10,ay-.065,ay+.061,base+.018,base+1.923,cream)
    # IMG_4398 looks through the door at two facing fixtures on the side walls.
    # Their relationship is photographed; the exterior entrance position is inferred.
    wc_y=18.79
    bx(powder,31.23,31.77,wc_y-.65,wc_y+.65,base+.32,base+.754,ivory,6)
    bx(powder,31.21,31.80,wc_y-.675,wc_y+.675,base+.750,base+.784,ivory,8)
    cyl(powder,31.52,wc_y,base+.783,base+.788,.023,steel,18)
    bx(powder,31.47,32.78,wc_y-.38,wc_y+.38,base+.023,base+.32,ivory,6)
    rings=[]
    for rx,ry,h in ((.59,.42,.224),(.84,.59,.295),(.88,.62,.42),(.70,.44,.421),(.49,.32,.31)):
        rings.append([powder.vert(((32.37+rx*cos(pi*j/20))*ft,(wc_y+ry*sin(pi*j/20))*ft,base+h)) for j in range(40)])
    for row,nxt in zip(rings,rings[1:]):
        for j in range(40):powder.face([row[j],row[(j+1)%40],nxt[(j+1)%40],nxt[j]],ivory,smooth=True)
    powder.face(rings[-1],mirror)
    # A white two-door vanity supports an integral oval basin and arched mixer.
    vx,vy=35.42,18.37
    bx(powder,34.71,36.10,16.97,19.78,base+.05,base+.77,whitewood,5)
    for y0,y1 in ((17.03,18.36),(18.38,19.71)):
        bx(powder,34.67,34.73,y0,y1,base+.12,base+.73,cream,3)
        bx(powder,34.65,34.681,y0+.12,y1-.12,base+.18,base+.65,whitewood)
    for yy in (18.20,18.52):line(powder,(34.67,yy,base+.61),(34.59,yy,base+.61),.012,steel,10)
    outer=[];rim=[];well=[]
    for j in range(40):
        t=2*pi*(j+.5)/40;c=cos(t);sn=sin(t)
        mul=1/max(abs(c),abs(sn))
        outer.append(powder.vert(((vx+.779*c*mul)*ft,(vy+1.436*sn*mul)*ft,base+.800)))
        rim.append(powder.vert(((vx+.511*c)*ft,(vy+.855*sn)*ft,base+.798)))
        well.append(powder.vert(((vx+.180*c)*ft,(vy+.267*sn)*ft,base+.704)))
    for j in range(40):
        k=(j+1)%40
        powder.face([outer[j],outer[k],rim[k],rim[j]],ivory)
        powder.face([rim[j],rim[k],well[k],well[j]],ivory,smooth=True)
    powder.face(well,ivory);cyl(powder,vx,vy,base+.705,base+.708,.018,steel,16)
    bx(powder,36.125,36.196,16.93,19.81,base+.792,base+.867,ivory,3)
    for a,b in zip(((36.00,vy,base+.799),(35.99,vy,base+.926),(35.82,vy,base+.967)),
                   ((35.99,vy,base+.926),(35.82,vy,base+.967),(35.69,vy,base+.909))):
        line(powder,a,b,.013,steel,12)
    for yy in (vy-.21,vy+.21):cyl(powder,36.0,yy,base+.798,base+.865,.021,steel,12)
    privwc=finish(powder);privwc['evidence']='Owner-confirmed enclosed basement half bath accessed outdoors. IMG_4398 shows opposite-facing toilet and white vanity. Placement of the room within the basement is inferred.'
    finish(basement);finish(flats)
    flat('Private · den floor',20.32,40.76,3.28,25.80,base+.027,flank,4.7,private_extra)
    private_extra['visibility_note']='Owner reference only; not included in renter walk. Exact basement partition and appliance locations inferred.'
    # Views and local fill lights for Blender. The same room stations are available to the browser in the route specification.
    for tag,p,t,power,radius in [('Kitchen',(33,20.2,2.30),(36,20.2,.8),105,1.6),('Dining',(26.4,23.4,2.02),(25,22,.65),55,1.15),('Queen room',(16.3,10,2.23),(15.6,11.5,.52),57,1.45),('Bunk room',(4.1,9.2,1.99),(4.0,5.6,.8),33,.95),('Double room',(36.6,8.4,2.13),(35.8,8.5,.57),40,1.0),('Bathroom',(27.3,5.1,2.06),(25.7,4.7,.99),35,.72),('Front hall',(31.0,5.2,2.06),(31.0,3.0,.60),37,.98)]:
        area_light('Room daylight · '+tag,p,t,power,radius,(1,.91,.80))
    rooms_extra['source']='Appraisal p.20 envelope and room names; owner references L1040596, 598, 605, 608, 612, 614, 618, 619, 621–624, 636, 639 and July–December photographs. Partition dimensions and furniture positions reconstructed.'
    rooms_extra['clear_thresholds_ft']='Front x29.48–32.52 at y0; rear slider x29.1–32.26 at y26; front bedroom y3.05–6.05 at x33.25; bunk x2–4.9 at y15.25 from living room; main bedroom y11.15–14.35 at x23.45; bath x26.02–28.78 at y10.25.'
_furnish_remaining()
