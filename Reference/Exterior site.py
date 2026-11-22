"""Build the parcel landscape from public ground heights, airborne canopy returns and owner photos.
Dimensions in the cabin's local plan are feet. Heights are absolute NAVD88 meters.
"""
def build_exterior_site():
    import math, random, csv
    import bpy
    from pathlib import Path
    from mathutils import Vector, noise
    site_group=coll('12 · Landscape and exterior routes')
    base_dir=Path(work)
    asset_dir=base_dir/'Exterior materials'
    if not asset_dir.exists():
        asset_dir=Path(out)/'Reference'/'Exterior materials'
    rng=random.Random(20261119)
    def mapped(name,file):
        m=mat(name,'#ffffff')
        tex=m.node_tree.nodes.new('ShaderNodeTexImage')
        img=bpy.data.images.load(str(asset_dir/file),check_existing=True);img.pack();tex.image=img
        m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        return m
    forest=mapped('Leaf litter and low cover','Woodland leaf litter.jpg')
    pea_gravel=mapped('Fire circle · pale and brown pea gravel','Garden pea gravel.jpg')
    turf=mapped('Cool-season fescue','Lawn.jpg')
    crushed=mapped('Fine crushed gravel','Packed gravel.jpg')
    pavement=mapped('Paved public road','Road surface.jpg')
    bark=mapped('Hardwood bark','Bark.jpg')
    bough=mat('Oak and maple branchwood','#786c56')
    leaves=mapped('Daylight broadleaf sprays','Leaf spray.png')
    lt=next(n for n in leaves.node_tree.nodes if n.type=='TEX_IMAGE')
    lp=leaves.node_tree.nodes.get('Principled BSDF')
    leaves.node_tree.links.new(lt.outputs['Alpha'],lp.inputs['Alpha'])
    if hasattr(leaves,'blend_method'): leaves.blend_method='CLIP'
    if hasattr(leaves,'alpha_threshold'): leaves.alpha_threshold=.45
    porch_wood=mapped('Porch · natural sawn timber','Porch timber.jpg')
    porch_structure(porch_wood)
    oak=mat('Weathered railing timber','#98764e')
    ties=mapped('Weathered timber ties','Weathered ties.jpg')
    entrance_stone=mapped('Entry · blue-gray crushed stone','Front walk stone.jpg')
    entry_wood=mapped('Entry · weathered cedar','Weathered ties.jpg')
    graphite=mat('Stair tread · dark traction tape','#302e2a',.03,.89)
    stone=mat('Weathered fieldstone','#7b7664');darkstone=mat('Fieldstone shadows','#666355')
    metal=mat('Fire ring steel','#45453b',.25,.7);charcoal=mat('Charred wood','#322e28')
    stone2=mat('Weathered stone highlights','#938974')
    mats={}; foliage_data=[[],[],[]]
    def push(m,verts,faces):
        v,f=mats.setdefault(m,([],[]));k=len(v);v.extend(verts);f.extend([tuple(i+k for i in face) for face in faces])
    def prism(m,a,b,w,h=None):
        a,b=Vector(a),Vector(b); vec=b-a
        if vec.length<1e-6:return
        vec.normalize(); axis=Vector((0,0,1)) if abs(vec.z)<.95 else Vector((1,0,0))
        u=vec.cross(axis).normalized()*w*.5;v=vec.cross(u).normalized()*(w if h is None else h)*.5
        corners=(-u-v,u-v,u+v,-u+v)
        push(m,[tuple(pt+off) for pt in [a,b] for off in corners],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    def tube(m,a,b,rad,endrad,sides=7):
        a,b=Vector(a),Vector(b);dv=(b-a).normalized()
        axis=Vector((0,0,1)) if abs(dv.z)<.95 else Vector((1,0,0))
        u=dv.cross(axis).normalized();v=dv.cross(u)
        vs=[tuple(pt+(u*math.cos(t*math.tau/sides)+v*math.sin(t*math.tau/sides))*r) for pt,r in ((a,rad),(b,endrad)) for t in range(sides)]
        fs=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        fs += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        push(m,vs,fs)
    def plank(m,x0,x1,y0,y1,z0,z1):
        a=pos((x0+x1)*.5,y0,(z0+z1)*.5);b=pos((x0+x1)*.5,y1,(z0+z1)*.5)
        prism(m,a,b,(x1-x0)*ft,z1-z0)
    def sclip(t):return max(0,min(1,t))
    def fade(d,w):
        t=sclip(1-d/w);return t*t*(3-2*t)
    def mix(a,b,w):return a*(1-w)+b*w
    def extents(x,y,x0,x1,y0,y1):
        return math.hypot(max(x0-x,0,x-x1),max(y0-y,0,y-y1))
    def local(e,n):
        ex=(e-516342.65)/ft;ny=(n-4612447.5)/ft
        return -co*ex+si*ny,-si*ex-co*ny
    # Front route in the owner's opposing views L1040560/561 and appraisal p.15.
    # Widths, grades and the plan curvature are estimates. Station X/Y are feet.
    entry_steps=4
    lower_landing=366.25
    porch_apron=dp-.72
    # The side of the garage wing has its own utility apron and a lower
    # stairwell toward the covered porch. IMG_7608, 7620 and 7621 give
    # counterviews of the two flights, the tanks and the retaining wall.
    service_toe,service_head=7.50,13.20
    service_front,service_rail,service_back=29.05,32.65,38.85
    # IMG_7621 looks straight out between the propane tanks and the porch edge.
    # Two 170 mm risers tie the flagstones to the existing basement slab.
    well_x0,well_x1=21.20,24.90
    service_end=well_x1
    well_door_y,well_head_y=26.,30.50
    well_run=1.15
    well_bottom=low+.025
    well_rise=.17
    service_z=well_bottom+2*well_rise
    lower_cutouts=((well_x0,well_x1,well_door_y,well_head_y),)
    yard_z=365.85
    # The gravel path swings around the downhill deck stair and enters
    # the clearing before the near end of the photographed wood stack.
    garden_path=[(44.96,deck_stair_y1+2*1.14),(45.65,38.86),(47.42,39.10),
                 (49.56,38.57),(51.40,38.55),(52.80,39.45),(53.23,40.80),
                 (52.70,42.10),(51.36,43.08),(49.02,43.64),(45.81,43.86),
                 (42.75,43.74),(40.28,43.92),(38.26,44.55),(36.80,45.70)]
    garden_length=sum(math.dist(a,b) for a,b in zip(garden_path,garden_path[1:]))
    def garden_offset(x,y):
        best=(float('inf'),0.)
        along=0.
        for (ax,ay),(bx,by) in zip(garden_path,garden_path[1:]):
            dx,dy=bx-ax,by-ay;length=math.hypot(dx,dy)
            t=sclip(((x-ax)*dx+(y-ay)*dy)/(length*length))
            best=min(best,(math.hypot(x-ax-t*dx,y-ay-t*dy),along+t*length))
            along+=length
        return best
    def apron_grade(y):
        return mix(service_z,yard_z,sclip((y-33.4)/9.0))
    start_x,turn_x=4.8,28.55
    well_head=(4.45,-4.70)
    def center_y(x):
        t=sclip((x-start_x)/(turn_x-start_x))
        return -7.7-2.89*(t*t*(3-2*t))
    def walk_grade(x):
        # Low sleeper checks hold the sloping crushed stone. Each side of a
        # sleeper has its own elevation so the gravel never covers its face.
        rise=.065
        return (mix(lower_landing,porch_apron-2*rise,sclip((x-start_x)/(turn_x-start_x)))
                +rise*(x>=11.15)+rise*(x>=19.25))
    stations=(start_x,6.1,7.8,9.3,11.15,12.9,14.7,16.2,18.0,19.25,21.0,23.0,25.0,26.8,turn_x,33.58)
    def sides(x):
        half=mix(1.99,2.20,sclip((x-start_x)/(turn_x-start_x)))
        return center_y(x)-half,center_y(x)+half
    def shoulder_width(x,sign):
        return .43+.07*math.sin(x*.81+sign)
    def upper_finish(x,y):
        # A continuous ramp outside the two sleeper checks, with a gentle
        # crossfall away from the house. Its edges meet the gravel shoulders.
        t=sclip((x-start_x)/(turn_x-start_x))
        z=mix(lower_landing,porch_apron,t)
        y0,y1=sides(x)
        z+=.004*(max(0,y-y1)+min(0,y-y0))+.005*max(0,x-turn_x)
        return z-.012
    def drive_grade(x,y):
        return low-.018+max(-25,min(.1,x))*.0115+max(0,-14-y)*.013
    def terrace_grade(x,y,z):
        if x<-30 or x>48 or y<-25.5 or y>7:return z
        # The timber retainer is vertical along the lower stair flight. Beyond
        # its ends the adjoining ground opens into a sloping roadside bank.
        end=max(0,-14-y,y-2.7)
        left=-1.05-min(7,end)
        right=-.38+min(6,end)
        cross=sclip((x-left)/(right-left))
        center=mix(drive_grade(x,y),upper_finish(x,y),cross)
        edge=max(0.,-27-x,x-42.1,y-3.2)
        inner=fade(edge,5)
        gate_zone=fade(max(0,gate_left-x,x-gate_right),2.5)
        south=mix(-19.25,roadside_line(x)-1.24,gate_zone)
        width=4.2 if x<3 else 3.4
        return mix(z,center,inner*fade(max(0,south-y),width))
    def zone(x,y):
        base=terrainZ(*eastnorth(x,y)); z=base+woodland_relief(x,y)
        # Graded access at the two daylight-basement garage thresholds.
        west_edge=0.1 if y>=1 else max(-2.35,min(.1,(y-1)*.76))
        driveDist=extents(x,y,-30.85,west_edge,-25,32)
        track=drive_grade(x,y)
        z=mix(z,track,fade(driveDist,4))
        # Spread the fall to the garage stair foot along the outer driveway.
        d=extents(x,y,-27.,service_toe,service_front,service_rail)
        toe_z=service_z-.96
        driveway_entry=mix(track,toe_z,sclip((x+27)/(service_toe+27)))
        z=mix(z,driveway_entry,fade(d,8.0))
        # The flags, the two-step threshold and the gently rising garden share
        # one grade profile. Only the ground inside the actual treads is cut.
        shoulder=extents(x,y,service_head,well_x1+2,well_door_y,43.)
        z=mix(z,apron_grade(y)-.016,fade(shoulder,9.))
        d=extents(x,y,service_toe-2.0,service_head,service_front,service_rail)
        flight=toe_z+.96*sclip((x-service_toe)/(service_head-service_toe))
        z=mix(z,flight-.018,fade(d,1.5))
        apron=extents(x,y,service_head,service_end,service_front,service_back)
        z=mix(z,apron_grade(y)-.016,fade(apron,2.))
        # Outer side of porch steps, modest cut into the uphill grade.
        d=extents(x,y,40.1,48.65,deck_stair_y0-.40,deck_stair_y1+3.05)
        z=mix(z,dp-.87,fade(d,3.5))
        # Flatten the pictured gravel fire circle and feather the edges into the slope.
        r=math.hypot((x-24.85)/9.65,(y-55.4)/13.0)
        pad_edge=min(max(0,r-1)*9.65,extents(x,y,29.3,38.55,45.35,63.65))
        # Give the clearing a broad shoulder where the stacked logs meet the
        # drain. Tight interpolation to the DEM makes the two wood rows sit
        # on different levels and exposes the gravel bed as a raised platform.
        shoulder_width=4.5+13.5*sclip((y-service_back)/6.5)
        z=mix(z,yard_z+.0015*(x-25),fade(pad_edge,shoulder_width))
        if 30<x<60 and 32<y<53 and pad_edge>0:
            offset,along=garden_offset(x,y)
            path_z=mix(dp-.87,yard_z+.020,along/garden_length)
            z=mix(z,path_z,fade(max(0.,offset-1.85),5.5)*sclip(pad_edge/1.7))
        return terrace_grade(x,y,z+retained_bank(x,y))
    build_photo_facades(zone)
    def wpos(x,y,extra=0):return pos(x,y,zone(x,y)+extra)
    # Preserve the original NYS orthophoto/DEM reference in the source file.
    ref.objects.link(ground);site.objects.unlink(ground)
    ground.name='2025 aerial on original USGS terrain · optional reference'
    def uvmesh(name,verts,faces,material,scale):
        ob=mesh(name,verts,faces,material,site_group)
        if ob.data.polygons:
            uv=ob.data.uv_layers.new(name='Local meters')
            for loop in ob.data.loops:
                p=ob.data.vertices[loop.vertex_index].co
                uv.data[loop.index].uv=(p.x/scale,p.y/scale)
        return ob
    # Visible primary terrain. Its finer sampled grid allows local apron grading.
    dx=.43; exN=math.ceil((xmax-xmin)/dx);nyN=math.ceil((ymax-ymin)/dx)
    v=[];fs=[];indices=[]
    for jy in range(nyN+1):
        n=ymin+(ymax-ymin)*jy/nyN
        for ix in range(exN+1):
            e=xmin+(xmax-xmin)*ix/exN;x,y=local(e,n)
            # Keep the interpolated ground mesh below the open treads. Survey cells
            # span more than a tread; the walking surfaces follow each timber separately.
            off=extents(x,y,-1.91,4.31,-9.72,-5.68)
            clearance=.205*fade(off,1.17)
            v.append(rel(e,n,zone(x,y)-clearance))
            if ix<exN and jy<nyN:
                k=len(v)-1;fs.append((k,k+1,k+exN+2,k+exN+1))
                # Road centerline runs along north frontage, slightly skew to parcel.
                ry=-34.2221-.01804675*x
                if abs(y-ry)<9.8: idx=3
                elif (-26 < x < (min(.1,(y-1)*.76) if y<1 else .1) and -26<y<32):idx=2
                elif -1<x<60 and ry+9.8<y<roadside_line(x)+1:idx=1
                elif x< -27 or x>45 or y>38 or y<-22 or (x>=0 and y>26):idx=0
                else:idx=1
                indices.append(idx)
    # Subtract the measured stepped foundation in plan from every intersecting cell.
    # This preserves the exterior DEM edge and open daylight basement without
    # forcing a vertical slope down through the building.
    def half_plane(points,distance):
        keep=[]
        for a,b in zip(points,points[1:]+points[:1]):
            da=distance(a);db=distance(b)
            if da>=0: keep.append(a)
            if da*db<0:
                k=da/(da-db);keep.append(tuple(a[d]+(b[d]-a[d])*k for d in range(3)))
        return keep
    def slice_ring(points,axis,edge,sign):
        return half_plane(points,lambda p:(p[axis]-edge)*sign)
    def usable(p):
        return len(p)>2 and abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(p,p[1:]+p[:1])))>1e-7
    def cut_rect(points,rect):
        inner=points; remainder=[]
        for axis,val,sign in ((0,rect[0],1),(0,rect[1],-1),(1,rect[2],1),(1,rect[3],-1)):
            outside=slice_ring(inner,axis,val,-sign)
            if usable(outside):remainder.append(outside)
            inner=slice_ring(inner,axis,val,sign)
            if not usable(inner):break
        return remainder
    kept=[];ids=[]
    for face,idx in zip(fs,indices):
        pts=[(*local(v[k][0]+OX,v[k][1]+OY),v[k][2]+OZ) for k in face]
        # Split at both surveyed road margins so the grass shoulder meets the road
        # without a square grid-cell zigzag when seen from the old entrance piers.
        levels=[p[1]+34.2221+.01804675*p[0] for p in pts]
        edge=next((margin for margin in (-9.8,9.8) if min(levels)<margin<max(levels)),None)
        if edge is not None:
            dist=lambda p:p[1]+34.2221+.01804675*p[0]-edge
            for sign in (-1,1):
                piece=half_plane(pts,lambda p:sign*dist(p))
                if not usable(piece):continue
                k=len(v);v.extend(pos(*pt) for pt in piece)
                kept.append(tuple(range(k,len(v))))
                xmid=sum(pt[0] for pt in piece)/len(piece)
                paved=(sign<0) if edge>0 else (sign>0)
                verge=(1 if edge>0 and -1<xmid<60 else 2 if edge>0 and -26<xmid<-1 else 0)
                ids.append(3 if paved else verge)
            continue
        if max(a[0] for a in pts)<=0 or min(a[0] for a in pts)>=41 or max(a[1] for a in pts)<=0 or min(a[1] for a in pts)>=service_back:
            kept.append(face);ids.append(idx);continue
        parts=[pts]
        for rect in ((0,21,3,29),(21,22,3,26),(22,41,0,26),
                     (service_toe,service_head,service_front,service_rail),
                     (service_head,service_end,service_front,service_back),
                     *lower_cutouts):
            rem=[]
            for piece in parts:rem.extend(cut_rect(piece,rect))
            parts=rem
        for piece in parts:
            k=len(v);v.extend(pos(*pt) for pt in piece)
            kept.append(tuple(range(k,len(v))));ids.append(idx)
    def walk_boundary(x):
        a,b=sides(x)
        return a-shoulder_width(x,-1),b+shoulder_width(x,1)
    walk_cuts=[]
    for a,b in zip(stations,stations[1:]):
        a0,a1=walk_boundary(a);b0,b1=walk_boundary(b)
        walk_cuts.append([(a,a0),(b,b0),(b,b1),(a,a1)])
    # Side-by-side timber retaining walls close the lower stair cut.
    walk_cuts.append([(-2.425,-9.71),(4.97,-9.71),(4.97,-5.69),(-2.425,-5.69)])
    fs,indices=pave_frontage(v,kept,ids,local,half_plane,usable,zone,walk_cuts,well_head)
    land=uvmesh('Wooded terrain · local grading inferred',v,fs,forest,2.4)
    land.data.materials.append(turf);land.data.materials.append(crushed);land.data.materials.append(pavement)
    asphalt=mapped('Front motor court · weathered asphalt','Road surface.jpg')
    asphalt.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.94
    land.data.materials.append(asphalt)
    land.data.materials.append(mapped('Street gate and upper court · aged poured concrete','Front court concrete.jpg'))
    land.data.materials.append(mapped('Uphill front court · weathered gray pavement','Uphill gray paving.jpg'))
    for j,f in enumerate(land.data.polygons):
        f.material_index=indices[j];f.use_smooth=True
        if f.material_index==4:
            for i in f.loop_indices:
                land.data.uv_layers.active.data[i].uv*=1.45
    land['basis']='USGS 1 m DEM. Apron, timber stairs, fire circle and pedestrian paths are photo-guided estimates.'
    finish_driveway_clearing(land,local)
    # Helper geometry is hidden by the viewer. Each support polygon has no underside.
    def helper(name,verts,faces):
        o=mesh(name,verts,faces,None,site_group);o.display_type='WIRE';o.hide_render=True
        o['scope']='Browser navigation geometry';return o
    def surface(name,xy,z):
        vs=[pos(x,y,h) for (x,y),h in zip(xy,z)]
        # The local axes turn together, so a counterclockwise polygon faces up.
        if (Vector(vs[1])-Vector(vs[0])).cross(Vector(vs[2])-Vector(vs[0])).z<0:vs.reverse()
        return helper('WalkSurface_'+name,vs,[tuple(range(len(vs)))])
    def rectsurf(name,x0,x1,y0,y1,z):
        return surface(name,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)],[z]*4)
    def blocker(name,p,q,width,height):
        a,b=Vector(p),Vector(q);u=Vector((-(b-a).y,(b-a).x,0)).normalized()*width/2
        corners=[a-u,b-u,b+u,a+u]; vs=corners+[p+Vector((0,0,height)) for p in corners]
        return helper('WalkBlock_'+name,[tuple(t) for t in vs],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    def round_blocker(name,center,rx,ry,height):
        # Accurate footprints at the rolled fire ring and belly of each basket.
        origin=Vector(center)
        rim=[origin+Vector((rx*math.cos(j*math.tau/32),ry*math.sin(j*math.tau/32),0)) for j in range(32)]
        vertices=rim+[point+Vector((0,0,height)) for point in rim]
        faces=[tuple(reversed(range(32))),tuple(range(32,64))]+[(k,(k+1)%32,(k+1)%32+32,k+32) for k in range(32)]
        helper('WalkBlock_'+name,vertices,faces)
    # Limit free walking to this parcel. Align a grid edge to each floor or deck
    # edge so the whole building and stair openings can be removed precisely.
    corners=[local(e,n) for e,n,z in D['boundary']]
    def contained(x,y):
        if x<-40 or x>61 or y<-22 or y>80:return False
        inside=False
        for (ax,ay),(bx,by) in zip(corners,corners[1:]):
            if ((ay>y)!=(by>y)) and x<(bx-ax)*(y-ay)/(by-ay)+ax:inside=not inside
        return inside
    stair_toe=41+2*1.08
    lower_stair_end=deck_stair_y1+2*1.14
    lower_stair_side=46.76
    landing_end=48.29
    X=sorted(set([-40+i*2 for i in range(52)]+[0,21,22,23,29,33,41,stair_toe,lower_stair_side,landing_end,4.8,-2.4,1.8,11.15,19.25,service_toe,service_head,service_end,well_x0,well_x1]))
    Y=sorted(set([-22+i*2 for i in range(52)]+[0,3,26,29,36,-5,-5-entry_steps,-9.7,-5.7,26.15,deck_stair_y0,deck_stair_y1,lower_stair_end,service_front,service_rail,service_back,well_door_y,well_head_y,33.4,42.4]))
    v=[];fs=[]
    for j,y in enumerate(Y):
        for i,x in enumerate(X):
            in_path=start_x<=x<=33.58 and sides(x)[0]<=y<=sides(x)[1]
            v.append(wpos(x,y,-.055 if in_path else .010))
            if i+1==len(X) or j+1==len(Y):continue
            midx=(x+X[i+1])*.5;midy=(y+Y[j+1])*.5
            if not contained(midx,midy):continue
            if (service_toe<=midx<=service_head and service_front<=midy<=service_rail or
                service_head<=midx<=service_end and service_front<=midy<=service_back or
                any(a<=midx<=b and c<=midy<=d for a,b,c,d in lower_cutouts)):
                continue
            omit=(0<=midx<=22 and 3<=midy<=26 or 22<=midx<=41 and 0<=midy<=26 or 0<=midx<=21 and 26<=midy<=29 or 23<=midx<=41 and 26<=midy<=36 or 41<=midx<=landing_end and deck_stair_y0<=midy<=deck_stair_y1 or stair_toe<=midx<=lower_stair_side and deck_stair_y1<=midy<=lower_stair_end or 29<=midx<=33 and -5-entry_steps<=midy<=0 or -2.4<=midx<=4.8 and -9.7<=midy<=-5.7)
            if omit:continue
            k=len(v)-1;fs.extend(((k,k+1,k+len(X)+1),(k,k+len(X)+1,k+len(X))))
    helper('WalkSurface_ParcelGround',v,fs)
    driveway_edge_details(site_group,land,helper,tube)
    rectsurf('FrontLanding',29,33,-5,0,dp+.015)
    # Replace the original smooth handrail and sparse steps with the photographed
    # porch flight. The existing appraisal-sized landing and side guards stay in place.
    for obj in list(deck.objects):
        if obj.name.startswith(('Entry stair · photo-based','Front stair handrail')):
            bpy.data.objects.remove(obj,do_unlink=True)
    rise=(dp-porch_apron)/(entry_steps+1)
    for j in range(entry_steps):
        ya=-5-j-1;yb=ya+1;z=dp-rise*(j+1)
        plank(entry_wood,29.01,32.99,ya+.02,yb-.014,z-.042,z)
        plank(entry_wood,29.04,32.96,yb-.085,yb-.017,z,z+rise-.04)
        # Separate dark grip strips and visible worn timber nosing.
        for x0,x1 in ((29.28,30.93),(31.07,32.72)):
            plank(graphite,x0,x1,ya+.22,yb-.18,z+.0008,z+.0025)
        rectsurf('FrontStep%02d'%j,29.0,33.0,ya,yb,z+.003)
    entry_rails=Timberwork('Entry · cedar landing and sloping 2x4 handrails',entry_wood,deck)
    for side in (28.98,33.02):
        toe=-5-entry_steps
        entry_rails.member((side,toe+.06,porch_apron+.045),(side,-4.83,dp-.045),.050,.195)
        sawn_guard(entry_rails,(side,toe+.07,porch_apron),(side,-4.89,dp))
        sawn_guard(entry_rails,(side,-4.89,dp),(side,-.1,dp),(False,True))
        blocker('FrontStairRailing'+('A' if side<31 else 'B'),
                pos(side,toe+.06,porch_apron),pos(side,-4.89,dp-.06),.059,.98)
    entry_rails.finish()
    rectsurf('CoveredDeck',23,41,26,36,dp+.02)
    # Facing the landing, the grill stands on the right behind the short guard.
    # IMG_4462 and IMG_7629 show two timber treads followed by a concrete
    # landing. IMG_4453 shows the second flight turning toward the garden.
    wooden_steps=Timberwork('Rear deck · timber treads, risers and stair strings',porch_wood,deck)
    landing_z=dp-.435
    groove_wood=mat('Patio steps · worn board flutes','#73634c',rough=.89)
    for j in range(2):
        x0=41+1.08*j;x1=x0+1.08;z=dp-.145*(j+1)
        for board in range(2):
            xx=x0+(board+.5)*.54
            wooden_steps.member((xx,deck_stair_y0+.07,z-.023),(xx,deck_stair_y1-.04,z-.023),.54*ft-.003,.046)
        # Rounded, weathered treads with lengthwise grooves like the close-up.
        for flute in range(8):
            xx=x0+.08+flute*.132
            prism(groove_wood,pos(xx,deck_stair_y0+.10,z+.0004),
                  pos(xx,deck_stair_y1-.07,z+.0004),.003,.001)
        wooden_steps.member((x1-.09,deck_stair_y0+.07,z-.075),(x1-.09,deck_stair_y1-.04,z-.075),.043,.106)
        rectsurf('RearStep%02d'%j,x0,x1,deck_stair_y0,deck_stair_y1,z+.005)
    for y in (deck_stair_y0+.05,deck_stair_y1-.03):
        wooden_steps.member((40.95,y,dp-.095),(stair_toe,y,dp-.41),.050,.165)
    landing_finish=mapped('Rear landing · weathered concrete','Weathered rear landing.jpg')
    def concrete_slab(name,xa,xb,ya,yb,top,base,finish=landing_finish):
        plank(stone,xa,xb,ya,yb,base,top-.003)
        corners=[(xa,ya),(xb,ya),(xb,yb),(xa,yb)]
        uvmesh(name,[pos(x,y,top) for x,y in corners],[(0,1,2,3)],finish,1.6)
    concrete_slab('Rear deck · poured landing',stair_toe,landing_end,deck_stair_y0,deck_stair_y1,landing_z,dp-.90)
    rectsurf('DeckStairLanding',stair_toe,landing_end,deck_stair_y0,deck_stair_y1,landing_z+.002)
    tread_stone=mapped('Patio steps · photographed weathered stone','Patio tread stone.jpg')
    for j in range(2):
        ya=deck_stair_y1+j*1.14;yb=ya+1.14;z=landing_z-.145*(j+1)
        plank(darkstone,stair_toe+.14,lower_stair_side-.15,ya+.05,yb-.23,dp-.90,z-.11)
        patio_step(j+1,stair_toe,lower_stair_side,ya,yb,z,tread_stone)
        rectsurf('RearStoneStep%02d'%j,stair_toe,lower_stair_side,ya,yb,z+.003)
    # One open timber rail beside the upper flight. The turned landing and
    # lower masonry steps have low stone edging, with a clear view to the patio.
    rail_y=deck_stair_y0+.07
    wooden_steps.member((stair_toe-.10,rail_y,landing_z),(stair_toe-.10,rail_y,landing_z+.90),.086,.086)
    for h in (.28,.86):
        wooden_steps.member((40.75,rail_y,dp+h),(stair_toe-.10,rail_y,landing_z+h),.049,.076)
    blocker('RearRailUpperHouse',pos(40.75,rail_y,dp),pos(stair_toe-.10,rail_y,landing_z),.089,.91)
    wooden_steps.finish()
    concrete_slab('Patio landing · garden curb',landing_end-.18,landing_end+.17,
                  deck_stair_y0-.10,deck_stair_y1+.07,landing_z+.09,dp-.90)
    blocker('PatioGardenCurb',pos(landing_end,deck_stair_y0,dp-.87),
            pos(landing_end,deck_stair_y1,dp-.87),.105,.525)
    # The white elbow comes out from under the deck fascia beside the steps.
    boot=Timberwork('Patio steps · white downspout elbow',trim,deck)
    path=[(40.67,35.92,dp-.23),(40.67,36.10,dp-.40),(40.67,36.10,dp-.70),
          (40.77,36.26,dp-.78),(41.11,36.83,dp-.815)]
    for start,end in zip(path,path[1:]):
        boot.member(start,end,.083,.060)
    boot.finish()
    concrete_slab('Rear landing · low retaining cheek',lower_stair_side,lower_stair_side+.27,
                  deck_stair_y1,lower_stair_end+.04,landing_z+.018,dp-.90)
    blocker('RearStoneCheek',pos(lower_stair_side+.12,deck_stair_y1,dp-.87),
            pos(lower_stair_side+.12,lower_stair_end,dp-.87),.075,.46)
    drain_metal=mat('Rear landing · galvanized grate','#a4b1ac',.55,.47)
    plank(darkstone,lower_stair_side+.27,landing_end,deck_stair_y1-.23,deck_stair_y1,landing_z,landing_z+.004)
    for j in range(19):
        xx=lower_stair_side+.28+(landing_end-lower_stair_side-.30)*j/18
        prism(drain_metal,pos(xx,deck_stair_y1-.225,landing_z+.008),pos(xx,deck_stair_y1-.004,landing_z+.008),.009,.008)
    # The driveway-side flight climbs along the gray foundation. Its rail then
    # turns across the yard-facing edge of the higher flagstone platform.
    rail_paint=mat('Utility stair · weathered cream iron','#b4a38a',.28,.67)
    riser=mat('Utility apron · aged concrete','#857c70',.01,.88)
    service_finish=mapped('Concrete stairs · exposed aggregate','Service stair aggregate.jpg')
    run=(service_head-service_toe)/5
    for j in range(5):
        xa=service_toe+j*run
        h=service_z-.96+(j+1)*.16
        concrete_slab('Garage wing · concrete service tread',xa,xa+run,service_front,service_rail,h,service_z-1.08,service_finish)
        rectsurf('ServiceDriveStep'+str(j),xa,xa+run,service_front,service_rail,h+.003)
    for height in (.14,.83):
        tube(rail_paint,pos(service_toe,service_rail,service_z-.96+height),
             pos(service_head,service_rail,service_z+height),.014,.014,10)
        for a,b in ((service_rail,33.4),(33.4,service_back)):
            tube(rail_paint,pos(service_head,a,apron_grade(a)+height),
                 pos(service_head,b,apron_grade(b)+height),.014,.014,10)
    for i in range(10):
        xx=service_toe+(service_head-service_toe)*i/9
        h=service_z-.96+.96*i/9
        tube(rail_paint,pos(xx,service_rail,h+.03),pos(xx,service_rail,h+.84),.010,.010,8)
    for i in range(11):
        yy=service_rail+(service_back-service_rail)*i/10
        tube(rail_paint,pos(service_head,yy,apron_grade(yy)+.025),pos(service_head,yy,apron_grade(yy)+.85),.009,.009,8)
    blocker('ServiceDriveRail',pos(service_toe,service_rail,service_z-.98),
            pos(service_head,service_rail,service_z-.02),.043,.90)
    blocker('ServiceApronGuard',pos(service_head,service_rail,service_z-.90),
            pos(service_head,service_back,service_z-.90),.064,1.76)
    flags=[mat('Utility apron · flagstone '+str(i+1),c,.02,.89)
           for i,c in enumerate(('#838473','#7c8177','#74786d','#8a8177','#909083'))]
    flag_rng=random.Random(7620)
    def flagstone_region(x0,x1,y0,y1):
        # Irregular broken corners, staggered across each course, match IMG_7620.
        corners=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
        bed=[pos(x,y,apron_grade(y)+h) for h in (-.24,-.013) for x,y in corners]
        push(riser,bed,[(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        rows=max(1,round((y1-y0)/1.45))
        for row in range(rows):
            a=y0+(y1-y0)*row/rows+.012;b=y0+(y1-y0)*(row+1)/rows-.012
            x=x0
            while x<x1-.04:
                end=min(x1,x+flag_rng.uniform(1.52,2.46))
                if x1-end<.63:end=x1
                l=x+.012;r=end-.012
                corners=[(l+.08,a),(r-.13,a+.025),(r,a+.14),(r-.008,b-.11),
                         (r-.12,b),(l+.15,b),(l,b-.18),(l+.005,a+.14)]
                jitter=flag_rng.uniform(-.003,.002)
                top=[pos(xx,yy,apron_grade(yy)+jitter) for xx,yy in corners]
                bottom=[pos(xx,yy,apron_grade(yy)+jitter-.023) for xx,yy in corners]
                faces=[tuple(range(8))]+[(i,(i+1)%8,8+(i+1)%8,8+i) for i in range(8)]
                push(flag_rng.choice(flags),top+bottom,faces)
                x=end
        outline=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
        surface('UtilityFlagstoneApron',outline,[apron_grade(y)+.003 for x,y in outline])
    flagstone_region(service_head,well_x0,service_front,well_head_y)
    flagstone_region(service_head,service_end,well_head_y,33.4)
    flagstone_region(service_head,service_end,33.4,service_back)

    tread_finish=mapped('Areaway · gray poured concrete','Front court concrete.jpg')
    groove=mat('Areaway · scored tread grooves','#77736c',0,.92)
    for j in range(2):
        y1=well_head_y-j*well_run
        y0=y1-well_run
        h=service_z-(j+1)*well_rise
        concrete_slab('Areaway · concrete tread',well_x0,well_x1,y0,y1,h,well_bottom-.12,tread_finish)
        for inset in (.13,.20):
            plank(groove,well_x0+.055,well_x1-.055,y0+inset,y0+inset+.019,h+.0006,h+.0012)
        rectsurf('LowerServiceStep'+str(j),well_x0,well_x1,y0,y1,h+.003)
    landing_y=well_head_y-2*well_run
    concrete_slab('Areaway · lower landing',well_x0,well_x1,well_door_y,landing_y,well_bottom,well_bottom-.12,tread_finish)
    rectsurf('ExteriorServiceLanding',well_x0,well_x1,well_door_y,landing_y,well_bottom+.003)
    # Low block cheeks in IMG_7621, with mortar joints and thin coping.
    # The taller iron guard belongs to the separate garage-side flight.
    for i,x in enumerate((well_x0-.12,well_x1+.12)):
        top=service_z+.045
        plank(riser,x-.12,x+.12,well_door_y,well_head_y,well_bottom-.12,top)
        for y in (27.52,29.02):
            plank(groove,x-.121,x+.121,y,y+.015,well_bottom+.01,top)
        plank(riser,x-.15,x+.15,well_door_y,well_head_y,top,top+.025)
        blocker('AreawayRetainer'+str(i),pos(x,well_door_y,well_bottom-.12),pos(x,well_head_y,well_bottom-.12),.084,top+.025-(well_bottom-.12))
    plank(drain_metal,well_x0+.14,well_x1-.14,26.48,26.80,well_bottom+.0008,well_bottom+.003)
    for j in range(26):
        x=well_x0+.20+j*(well_x1-well_x0-.45)/25
        plank(graphite,x,x+.038,26.51,26.77,well_bottom+.003,well_bottom+.0045)
    for i,y in enumerate((26.27,35.73)):
        blocker('DeckServicePost'+str(i),pos(25.44,y-.18,low-.20),pos(25.44,y+.18,low-.20),.36*ft,dp-(low-.20))
    for desc,p,q in [('DeckSouth',(23,35.85),(41,35.85)),('DeckEast',(23.15,26.1),(23.15,35.8)),('DeckWestReturn',(40.75,26.15),(40.75,deck_stair_y0)),('EntryWestRail',(33,-4.8),(33,-.1)),('EntryEastRail',(29,-4.8),(29,-.1))]:
        blocker(desc,pos(*p,dp),pos(*q,dp),.08,.93)
    # Timber retaining wall crossing the entry approach. Leave a stair break in it.
    zbot=zone(-2.4,-7.7);ztop=lower_landing
    footx=-2.4;stairCount=7;run=7.2/stairCount
    for j in range(stairCount):
        x1=footx+j*run;x2=x1+run;z=mix(zbot,ztop,(j+1)/(stairCount+1))
        # Thick timber check riser at the leading edge, gravel infill behind.
        plank(ties,x1-.025,x1+.24,-9.71,-5.69,z-.18,z+.002)
        uvmesh('Driveway steps · crushed stone infill',[
            pos(x1+.24,-9.69,z),pos(x2+.012,-9.69,z),
            pos(x2+.012,-5.71,z),pos(x1+.24,-5.71,z)],[(0,1,2,3)],entrance_stone,.52)
        for yy in (-9.69,-5.82):plank(ties,x1+.23,x2+.012,yy,yy+.12,z-.14,z+.007)
        rectsurf('RetainerTread%02d'%j,x1,x2,-9.7,-5.7,z+.009)
    # The high concrete shoulders are retained beside the timber/gravel flight.
    # Side cheeks meet the face of each exposed tread along the cut.
    for j in range(stairCount):
        xa=footx+j*run;xb=xa+run
        z=mix(zbot,ztop,(j+1)/(stairCount+1))
        for y in (-9.71,-5.69):
            upper=upper_finish(xb,y)
            if xb>-.7 and upper>z:
                plank(ties,max(xa,-.70),xb,y-.034,y+.034,z-.015,upper+.014)
    # Landing check closes the last rise beneath the gravel path.
    plank(ties,4.77,4.97,-9.71,-5.69,ztop-.174,ztop+.002)
    for y in (-9.75,-5.65):
        prism(entry_wood,pos(footx,y,zbot+.9),pos(4.8,y,ztop+.9),.0381,.0889)
        for x in (footx+.15,4.65):
            z=zbot if x<0 else ztop;prism(oak,pos(x,y,z),pos(x,y,z+.90),.09)
    for seg,(a,b) in enumerate([(-14,-9.85),(-5.55,2.7)]):
        top=ztop+.023;bottom=min(drive_grade(-1.05,a),drive_grade(-1.05,b))-.105
        courses=max(1,math.ceil((top-bottom)/.145))
        depth=(top-bottom)/courses
        for j in range(courses):
            z=bottom+j*depth
            plank(ties,-1.05,-.38,a,b,z,z+depth-.0015)
        blocker('DriveRetainer'+str(seg),pos(-.7,a,bottom),pos(-.7,b,bottom),.2,top-bottom)
    # A narrow gravel path ties the upper timber stair landing to the front stair toe.
    def ribbon(name,path,width,material):
        vs=[];face=[]
        for j,(x,y) in enumerate(path):
            px,py=path[max(0,j-1)];qx,qy=path[min(len(path)-1,j+1)]
            dx=qx-px;dy=qy-py;ll=math.hypot(dx,dy);sx=-dy/ll*width*.5;sy=dx/ll*width*.5
            vs.extend((wpos(x-sx,y-sy,.034),wpos(x+sx,y+sy,.034)))
            if j>0:face.append((2*j-2,2*j,2*j+1,2*j-1))
        return uvmesh(name,vs,face,material,1.8)
    # Build the entire upper walkway as contiguous strips, with a shared final
    # edge at the apron. Width variation follows its crushed-stone shoulders.
    walkway_verts=[];walkway_faces=[]
    shoulder_verts=[];shoulder_faces=[]
    def shoulder(xa,aa,za,xb,bb,zb,sign):
        # Taper loose aggregate into the grass. The inner line sits under the
        # path top and the outer line meets the local terrain without a curb.
        k=len(shoulder_verts)
        for x,y,z in ((xa,aa,za),(xb,bb,zb)):
            w=shoulder_width(x,sign)
            shoulder_verts.extend((pos(x,y-sign*.02,z-.003),
                                   pos(x,y+sign*w,zone(x,y+sign*w))))
        shoulder_faces.append((k,k+2,k+3,k+1) if sign>0 else (k,k+1,k+3,k+2))
    def path_strip(xa,xb,ya0,ya1,yb0,yb1,za,zb):
        k=len(walkway_verts)
        walkway_verts.extend((pos(xa,ya0,za),pos(xb,yb0,zb),pos(xb,yb1,zb),pos(xa,ya1,za)))
        walkway_faces.append((k,k+1,k+2,k+3))
    for xa,xb in zip(stations,stations[1:]):
        a0,a1=sides(xa);b0,b1=sides(xb)
        za=walk_grade(xa+.002);zb=walk_grade(xb-.002)
        path_strip(xa,xb,a0,a1,b0,b1,za,zb)
        shoulder(xa,a0,za,xb,b0,zb,-1)
        shoulder(xa,a1,za,xb,b1,zb,1)
        if xa in (11.15,19.25):
            plank(ties,xa-.083,xa+.087,a0-.035,a1+.035,za-.073,za+.005)
            for sign,y in ((-1,a0),(1,a1)):
                outside=y+sign*shoulder_width(xa,sign)
                k=len(shoulder_verts)
                shoulder_verts.extend((pos(xa,y,za-.065),pos(xa,y,za),pos(xa,outside,zone(xa,outside))))
                shoulder_faces.append((k,k+1,k+2))
    uvmesh('Front walk · tapered aggregate shoulders',shoulder_verts,shoulder_faces,entrance_stone,.59)
    finish=uvmesh('Front walk · gravel terraces and entry apron',walkway_verts,walkway_faces,entrance_stone,.59)
    finish['references']='L1040560; L1040561; 2024 appraisal front photograph p.15. Centerline, width and stair rise are estimated.'
    helper('WalkSurface_FrontGravelPath',walkway_verts,walkway_faces)
    # The blue well cap is beside the uphill, cabin-side newel in L1040557,
    # L1040561 and the winter stair photo. Height and diameter are estimated.
    casing=mat('Water well · oxidized steel casing','#584b40',.17,.76)
    cap=mat('Water well · cobalt enamel cap','#1b58a8',.34,.36)
    conduit=mat('Water well · black conduit and gasket','#35383a',.12,.66)
    bolts=mat('Water well · weathered cap bolts','#aca597',.53,.52)
    base=Vector(wpos(*well_head))
    up=Vector((0,0,1))
    def well_ring(m,offset,h0,h1,r0,r1,sides=36):
        tube(m,base+offset+up*h0,base+offset+up*h1,r0,r1,sides)
    center=Vector((0,0,0))
    wire=Vector((.019,.090,0))
    well_ring(casing,center,-.040,.251,.080,.080)
    well_ring(conduit,center,.246,.255,.094,.094)
    well_ring(cap,center,.253,.267,.094,.101)
    well_ring(cap,center,.267,.285,.101,.101)
    well_ring(cap,center,.285,.299,.101,.088)
    well_ring(cap,center,.299,.306,.088,.061)
    well_ring(conduit,wire,-.026,.234,.011,.011,14)
    well_ring(bolts,wire,.218,.249,.015,.015,6)
    well_ring(cap,wire,.246,.289,.026,.026,24)
    well_ring(cap,wire,.289,.301,.026,.022,24)
    for j in range(4):
        angle=(j+.23)*math.tau/4
        lug=.100*Vector((math.cos(angle),math.sin(angle),0))
        well_ring(cap,lug,.253,.286,.013,.013,16)
        well_ring(bolts,lug,.286,.294,.0065,.0065,6)
    round_blocker('WellCasing',base-up*.035,.115,.115,.346)
    for name,location in [('TourEye_well',pos(8.67,-7.32,walk_grade(8.67)+1.59)),
                          ('TourLook_well',base+up*.20)]:
        anchor=bpy.data.objects.new(name,None);site_group.objects.link(anchor)
        anchor.location=location;anchor.empty_display_size=.04
    pathlamp=mat('Path lights · aged pewter','#726e62',.50,.48)
    opal=mat('Path lights · frosted lens','#b7b3a4',.04,.38)
    for xx in (4.2,10.6,19.15,27.5):
        yy=center_y(xx)-2.53;zz=walk_grade(max(start_x,xx))-.095
        tube(pathlamp,pos(xx,yy,zz),pos(xx,yy,zz+.22),.012,.012,8)
        tube(opal,pos(xx,yy,zz+.22),pos(xx,yy,zz+.275),.022,.028,10)
        tube(pathlamp,pos(xx,yy,zz+.275),pos(xx,yy,zz+.295),.033,.022,10)
    for name,location in [('TourEye_path',pos(5.48,center_y(5.48),walk_grade(5.48)+1.59)),
                          ('TourLook_path',pos(30.7,-5.10,dp+.36))]:
        ob=bpy.data.objects.new(name,None);site_group.objects.link(ob);ob.location=location;ob.empty_display_size=.04
    ribbon('Rear garden path',garden_path,3.65,crushed)
    # Outdoor seating follows the autumn and summer yard photos: a gravel circle,
    # Adirondack chairs, pergola on the far side when viewed from the driveway,
    # and picnic table beyond the ring when viewed from the deck.
    center=Vector(wpos(25.3,53.3));zpat=center.z+.023
    # IMG_3341 shows the entire picnic table inside the gravel edge; IMG_3337
    # shows the second gravel area reaching past both hanging seats to a drain.
    pad_x,pad_y=24.85,55.4
    pad_rx,pad_ry=9.65,13.0
    pad=(pad_x,pad_y,pad_rx,pad_ry)
    def gravel_height(x):return zpat+OZ+.0015*(x-25.3)
    v=[pos(pad_x,pad_y,gravel_height(pad_x))]
    for i in range(67):
        ang=math.tau*i/66
        x=pad_x+pad_rx*math.cos(ang)
        v.append(pos(x,pad_y+pad_ry*math.sin(ang),gravel_height(x)))
    ground_rings=[v[0]];ground_faces=[]
    for row,r in enumerate((.70,.775,.85,.925,1.)):
        start=len(ground_rings)
        for j in range(66):
            ang=math.tau*j/66
            x=pad_x+r*pad_rx*math.cos(ang);y=pad_y+r*pad_ry*math.sin(ang)
            ground_rings.append(pos(x,y,gravel_height(x)+gravel_ripple(r,ang)))
            i=start+j;k=start+(j+1)%66
            ground_faces.append((0,i,k) if row==0 else (i-66,i,k,k-66))
    helper('WalkSurface_FireCircleGravel',ground_rings,ground_faces)
    # Keep this material exclusive to the liner; the viewer attaches flames
    # to the center of its mesh. IMG_0773, April 2026, shows its rusty interior
    # inside three running-bond courses of tumbled gray wedge blocks.
    galvanized=mat('Garden drain · galvanized steel','#aaa9a2',.50,.52)
    liner=mat('Fire ring · galvanized steel','#80604a',.42,.73)
    edging=mat('Garden · steel landscape edging','#373a33',.28,.78)
    def fire_polar(angle,radius,height):
        return (center.x+radius*math.cos(angle),center.y+radius*math.sin(angle),zpat+height)
    profile=[(.49,.008),(.49,.045),(.52,.061),(.52,.080),(.493,.098),
             (.493,.190),(.52,.208),(.52,.229),(.493,.243),
             (.493,.311),(.507,.320),(.507,.333),(.473,.333),(.473,.012)]
    for j in range(64):
        a=math.tau*j/64;b=math.tau*(j+1)/64
        for (r0,h0),(r1,h1) in zip(profile,profile[1:]):
            push(liner,[fire_polar(a,r0,h0),fire_polar(b,r0,h0),
                              fire_polar(b,r1,h1),fire_polar(a,r1,h1)],[(0,1,2,3)])
    block_rng=random.Random(773)
    stone_colors=['#89867e','#858179','#928a7f','#827c73','#979187']
    block_finishes=[mat('Fire pit · tumbled stone '+str(i+1),c,.01,.93) for i,c in enumerate(stone_colors)]
    cap_stone=mapped('Fire pit · photographed aggregate','Tumbled fire pit stone.jpg')
    count=14
    for course in range(3):
        for j in range(count):
            a=(j+.5*(course%2))*math.tau/count
            b=a+math.tau/count
            rise=course*.108+.002
            rough=[block_rng.uniform(-.008,.008) for _ in range(4)]
            verts=[]
            for inset,z in ((.012,rise),(.001,rise+.012),(.000,rise+.093),(.012,rise+.106)):
                start=a+.006+inset;end=b-.006-inset
                for i,(t,r) in enumerate(((start,.507+inset),(start,.674-inset),(end,.674-inset),(end,.507+inset))):
                    verts.append(fire_polar(t,r+rough[i],z+.003*math.sin(t*3+j)))
            faces=[(3,2,1,0)]
            for h in range(3):
                faces.extend((4*h+i,4*h+(i+1)%4,4*h+4+(i+1)%4,4*h+4+i) for i in range(4))
            push(block_rng.choice(block_finishes),verts,faces)
            push(cap_stone,verts[12:16],[(0,1,2,3)])
    def rim(k):return .016+.008*math.sin(k*math.tau/66*3.0+.7)
    for j in range(66):
        a,b=v[j+1],v[j+2]
        push(edging,[(x,y,z+dz) for (x,y,z),dz in [(a,-.055),(b,-.055),(b,rim(j+1)),(a,rim(j))]],[(0,1,2,3)])
    apron=[];quads=[];drain_x=38.55
    for j in range(33):
        yy=45.35+(63.65-45.35)*j/32
        edge_x=pad_x+pad_rx*math.sqrt(1-((yy-pad_y)/pad_ry)**2)
        apron.extend([pos(edge_x-.035,yy,gravel_height(edge_x)-.008),pos(drain_x,yy,gravel_height(drain_x)-.008)])
        if j:quads.append((2*j-2,2*j-1,2*j+1,2*j))
    nearby_feet=[(26.525+side*1.92,63.8+end*2.22,.16,.47) for side in (-1,1) for end in (-1,1)]
    nearby_feet.extend([(35.,54.1+side*5.125,.19,.53) for side in (-1,1)])
    garden_gravel(site_group,pea_gravel,pad,gravel_height,drain_x,center,nearby_feet)
    helper('WalkSurface_PergolaGravel',apron,quads)
    dark_channel=mat('Yard drain · dark slot','#353c38',.25,.68)
    for xx in (drain_x-.16,drain_x+.16):
        prism(galvanized,pos(xx,45.35,gravel_height(drain_x)-.005),pos(xx,63.65,gravel_height(drain_x)-.005),.012,.013)
    plank(dark_channel,drain_x-.16,drain_x+.16,45.35,63.65,gravel_height(drain_x)-.022,gravel_height(drain_x)-.015)
    for j in range(133):
        yy=45.35+18.3*j/132
        prism(galvanized,pos(drain_x-.15,yy,gravel_height(drain_x)-.005),pos(drain_x+.15,yy+.055,gravel_height(drain_x)-.005),.017,.012)
    # The stack in IMG_3353 sits uphill of the long grate. Its sloped ends and
    # split faces remain recognizable through the open backs of the hanging seats.
    split_wood=mat('Firewood · weathered split face','#9a856d',.01,.93)
    wood_rng=random.Random(3353)
    for stack in range(2):
        xx=40.5+stack*1.48
        for row in range(7):
            first=46.6+row*.33;last=62.5-row*.33
            count=round((last-first)/.57)
            for j in range(count):
                yy=first+(j+wood_rng.uniform(.20,.68))*(last-first)/count
                radius=wood_rng.uniform(.075,.102)
                h=zone(xx,yy)+.055+row*.126+wood_rng.uniform(-.014,.012)
                toe=xx-.72+wood_rng.uniform(-.14,.11)
                foot=pos(toe,yy,h)
                tube(ties,foot,pos(xx+.74,yy+.07,h+.042),radius,radius*.85,6)
                tube(split_wood,pos(toe-.018,yy,h),foot,radius*.92,radius*.92,6)
    blocker('StackedGardenFirewood',pos(41.2,47,zone(41.2,47)),pos(41.2,62.0,zone(41.2,62.0)),.89,1.0)
    round_blocker('FireRing',(center.x,center.y,zpat-.01),.681,.681,.36)
    ashes=mat('Fire pit · bed of cold ash','#413b32',.01,.99)
    ash_rim=[fire_polar(j*math.tau/48,.472,.024+.003*math.cos(j*3)) for j in range(48)]
    push(ashes,ash_rim,[tuple(range(48))])
    woodface=mat('Fire pit · exposed split wood','#8d7460',.03,.94)
    for angle,offset,lift,material in ((.28,-.13,.054,charcoal),(.34,.12,.046,charcoal),
                                      (2.08,-.09,.108,charcoal),(1.95,.09,.124,woodface)):
        axis=Vector((math.cos(angle),math.sin(angle),0))
        side=Vector((-axis.y,axis.x,0))
        mid=Vector((center.x,center.y,zpat+lift))+side*offset
        tube(material,mid-axis*.254,mid+axis*.265+Vector((0,0,.024)),.056,.048,6)
    build_fire_circle_chairs(site_group,center,zpat,blocker)
    picnic_table(ties,site_group,zone,blocker)
    # Owner-confirmed clearing: only the side and rear parcel edges carry trees.
    # Crown heights are approximate. Stations are in the appraisal plan's feet.
    trees=[
        (-40,-8,16.4),(-40,9,15.1),(-40,28,14.4),(-40,49,13.6),(-40,65,13.1),
        (-32,79,24.6),(-15,79,24.9),(4,79,26.6),(21,79,26.1),(39,79,24.7),(55,79,18.0),
        (60.6,63,20.9),(60.6,43,17.7),(60.6,25,16.8),(60.6,6,17.5),(60.6,-9,17.9),
    ]
    cards=[];cardfaces=[];carduv=[]
    def spray(a,d,length,width):
        d=Vector(d).normalized()
        u=d.cross(Vector((0,0,1))).normalized()
        if u.length<.2:u=Vector((1.,0.,0.))
        u=(u*math.cos(rng.uniform(-.60,.60))+d.cross(u)*math.sin(rng.uniform(-.60,.60))).normalized()
        tail=Vector(a);tip=tail+d*length
        pts=[tail-u*width*.17,tail+u*width*.17,tip+u*width*.58,tip-u*width*.58]
        k=len(cards);cards.extend([tuple(p) for p in pts]);cardfaces.append((k,k+1,k+2,k+3));carduv.extend([(0,0),(1,0),(1,1),(0,1)])
    trunk_uvs={}
    for i,(x,y,h) in enumerate(trees):
        root=Vector(wpos(x,y,-.07));rad=.12+h*.008*rng.uniform(.78,1.14)
        skew=Vector((rng.uniform(-1.15,1.15),rng.uniform(-1.15,1.15),0))
        def stem(u):return root+skew*u*u+Vector((0,0,h*u))
        # Broad furrows cast real shadows and break the lower trunk silhouette.
        # The widest bark stays inside the original trunk radius used for walking.
        levels=(0,.027,.071,.14,.32,.51,.69,.84,.97)
        trunk_sides=20
        wrap_count=max(1,round(math.tau*rad/.59))
        verts=[];faces=[];coords=[]
        for level in levels:
            axis=stem(level)
            for j in range(trunk_sides):
                angle=math.tau*j/trunk_sides
                drift=.085*math.sin(level*9+i)+level*.19
                ridge=.5+.32*math.cos(5*angle+i*2.07)+.18*math.sin(3*angle+i)
                depth=.065+.14*math.exp(-level*12)
                radius=rad*(1-level)**.70*(1-depth*(1-ridge))
                verts.append(axis+Vector((math.cos(angle+drift)*radius,math.sin(angle+drift)*radius,0)))
        for row in range(len(levels)-1):
            v0,v1=(i*.31+level*h*.58 for level in levels[row:row+2])
            for j in range(trunk_sides):
                a=row*trunk_sides+j;b=row*trunk_sides+(j+1)%trunk_sides
                faces.append((a,b,b+trunk_sides,a+trunk_sides))
                u0=wrap_count*j/trunk_sides+i*.23;u1=u0+wrap_count/trunk_sides
                coords.append(((u0,v0),(u1,v0),(u1,v1),(u0,v1)))
        faces.append(tuple(range(len(verts)-trunk_sides,len(verts))))
        faces.append(tuple(reversed(range(trunk_sides))))
        base_face=len(mats.get(bark,([],[]))[1])
        push(bark,verts,faces)
        trunk_uvs.update((base_face+j,uv) for j,uv in enumerate(coords))
        for j in range(12):
            a=(rng.random()+j*.62)*math.tau;lv=.41+j*.043+rng.uniform(-.033,.025)
            heading=Vector((math.cos(a),math.sin(a),0)); spread=(h*.20)*(1-max(0,lv-.68)*1.8)*rng.uniform(.67,1.1)
            lowbranch=stem(lv);elbow=lowbranch+heading*spread*.55+Vector((0,0,h*.072));end=lowbranch+heading*spread+Vector((0,0,h*.135))
            rr=rad*(1-lv)*.64
            tube(bark,lowbranch,elbow,rr,max(.025,rr*.69),6);tube(bough,elbow,end,max(.025,rr*.69),.016,5)
            for k in range(7):
                angle=a+rng.uniform(-1.4,1.4);div=Vector((math.cos(angle),math.sin(angle),0))
                mid=elbow+(end-elbow)*rng.uniform(0,1); endp=mid+div*rng.uniform(.52,1.15)+Vector((0,0,rng.uniform(.36,.98)))
                tube(bough,mid,endp,.025,.007,4)
                for l in range(4):
                    yaw=angle+rng.uniform(-1.15,1.15)
                    d=Vector((math.cos(yaw),math.sin(yaw),rng.uniform(-.05,.92)))
                    s=mid+(endp-mid)*(.3+.23*l)
                    spray(s,d,rng.uniform(1.05,1.80),rng.uniform(.89,1.37))
        round_blocker('HardwoodTrunk%02d'%i,root,rad,rad,2.75)
    # Keep a walking lane along the cabin wall. The opposite rail holds the
    # woven settee, rectangular table, armchair and portable black stove.
    wicker=mapped('Outdoor wicker · woven taupe','Wicker weave.jpg')
    cushion=mat('Patio cushion · oatmeal','#b2aa94')
    navy=mat('Patio pillow · midnight blue','#3a495a')
    stove=mat('Portable patio stove · cast iron','#393b37',.28,.53)
    cable=mat('Soft black cord','#3a3930')
    bulb=mat('String bulbs · amber filament','#ffb451',0,.30)
    globe=mat('Cafe lights · clear teardrop glass','#fff0d7',.15,.17)
    globe.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.24
    bshader=bulb.node_tree.nodes.get('Principled BSDF')
    bshader.inputs['Emission Color'].default_value=(1.0,.57,.21,1)
    bshader.inputs['Emission Strength'].default_value=5.8
    def softbox(m,x0,x1,y0,y1,z0,z1,rft=.15):
        rad=min(rft,(x1-x0)*.45,(y1-y0)*.45)
        zrad=min(rad*ft*.55,(z1-z0)*.24);vs=[]
        for zz,inset in ((z0,rad*.22),(z0+zrad,0),(z1-zrad,0),(z1,rad*.22)):
            for cx,cy,start in ((x0+rad,y0+rad,180),(x1-rad,y0+rad,270),(x1-rad,y1-rad,0),(x0+rad,y1-rad,90)):
                for a in range(0,91,30):
                    tt=math.radians(start+a);rr=rad-inset;vs.append(pos(cx+rr*math.cos(tt),cy+rr*math.sin(tt),zz))
        faces=[tuple(reversed(range(16))),tuple(range(48,64))]
        for level in range(3):
            for j in range(16):
                k=level*16+j;next_k=level*16+(j+1)%16;faces.append((k,next_k,next_k+16,k+16))
        push(m,vs,faces)
    def wicker_seat(label,x0,x1,y0,y1,count,across_end=False):
        cx=(x0+x1)/2;cy=(y0+y1)/2
        def piece(material,a,b,c,d,lo,hi,radius):
            if across_end:
                a,b,c,d=cx-(d-cy),cx-(c-cy),cy+(a-cx),cy+(b-cx)
            softbox(material,a,b,c,d,lo,hi,radius)
        for xx in (x0+.23,x1-.23):
            for yy in (y0+.23,y1-.23):
                piece(stove,xx-.12,xx+.12,yy-.12,yy+.12,dp+.011,dp+.18,.08)
        piece(wicker,x0,x1,y0,y1,dp+.12,dp+.34,.18)
        piece(wicker,x0,x1,y1-.32,y1,dp+.31,dp+.81,.14)
        for xx in (x0,x1-.26):
            piece(wicker,xx,xx+.26,y0,y1-.12,dp+.32,dp+.61,.10)
        span=(x1-x0-.66)/count
        for j in range(count):
            a=x0+.33+j*span
            piece(cushion,a+.025,a+span-.025,y0+.06,y1-.32,dp+.34,dp+.47,.17)
            piece(cushion,a+.05,a+span-.05,y1-.58,y1-.29,dp+.45,dp+.77,.14)
        if across_end:
            piece(navy,cx-.62,cx+.62,y1-.72,y1-.45,dp+.48,dp+.80,.14)
            blocker(label,pos(cx,cy+(x0-cx)+.13,dp),pos(cx,cy+(x1-cx)-.13,dp),(y1-y0)*ft,.83)
        else:
            blocker(label,pos(x0+.13,cy,dp),pos(x1-.13,cy,dp),(y1-y0)*ft,.83)
    wicker_seat('DeckSettee',26.4,33.35,33.32,35.43,3)
    wicker_seat('DeckArmchair',34.95,37.4,33.02,35.44,1)
    # IMG_3970 and gallery 016 show a second chair across the far, stove end.
    wicker_seat('DeckArmchairStoveEnd',24.18,26.62,30.65,33.07,1,across_end=True)
    softbox(navy,26.68,27.9,34.45,34.77,dp+.46,dp+.80,.13)
    softbox(navy,31.92,32.96,34.39,34.70,dp+.46,dp+.79,.13)
    for xx in (27.78,32.72):
        softbox(wicker,xx,xx+.24,30.8,32.56,dp+.015,dp+.65,.07)
    softbox(wicker,27.64,33.06,30.65,32.7,dp+.645,dp+.71,.09)
    blocker('DeckDiningTable',pos(27.78,31.65,dp),pos(32.88,31.65,dp),.66,.71)
    sx,sy=24.35,34.1
    stove_rust=mat('Patio stove · weathered cast iron','#665040',.30,.72)
    softbox(stove,sx-.91,sx+.91,sy-.99,sy+.69,dp+.014,dp+.029,.06)
    softbox(stove_rust,sx-.59,sx+.59,sy-.53,sy+.53,dp+.18,dp+.765,.10)
    for dx in (-.45,.45):
        for dy in (-.4,.4):
            prism(stove_rust,pos(sx+dx,sy+dy,dp+.03),pos(sx+dx*.84,sy+dy*.84,dp+.25),.045)
    softbox(stove_rust,sx-.68,sx+.68,sy-.70,sy+.57,dp+.758,dp+.779,.04)
    softbox(stove_rust,sx-.50,sx+.50,sy-.58,sy-.535,dp+.375,dp+.721,.045)
    prism(stove,pos(sx+.38,sy-.62,dp+.59),pos(sx+.38,sy-.62,dp+.68),.018)
    softbox(charcoal,sx-.40,sx+.40,sy-.60,sy-.535,dp+.23,dp+.323,.05)
    for j in range(5):
        zz=dp+.782+j*.022
        softbox(stove_rust,sx-.65,sx+.65,sy-.035,sy+.54,zz,zz+.013,.035)
    softbox(stove_rust,sx-.60,sx+.60,sy+.005,sy+.52,dp+.773,dp+.884,.025)
    duct=mat('Patio stove · galvanized flue','#acb3b5',.55,.36)
    opening=mat('Patio stove · flue interior','#282b2b')
    deck_stove_flue(sx,sy,stove,duct,opening,tube,prism)
    blocker('DeckStove',pos(sx-.34,sy,dp),pos(sx+.34,sy,dp),.35,1.5)
    def ellipsoid(m,ctr,rx,ry,rz,seed,rough=0,nlon=12,nlat=7):
        rng_local=random.Random(seed);p=[];f=[]
        for i in range(nlat+1):
            lat=-math.pi/2+i*math.pi/nlat
            for j in range(nlon):
                lon=math.tau*j/nlon;rr=1.+rough*rng_local.uniform(-1,1)
                p.append((ctr[0]+rr*rx*math.cos(lon)*math.cos(lat),ctr[1]+rr*ry*math.sin(lon)*math.cos(lat),ctr[2]+rr*rz*math.sin(lat)))
        for i in range(nlat):
            for j in range(nlon):
                a=i*nlon+j;b=i*nlon+(j+1)%nlon
                f.append((a,b,b+nlon,a+nlon))
        push(m,p,f)
    def cafe_bulb(tip):
        tip=Vector(tip)
        # The clear lamps have a short black socket and a glowing center.
        tube(cable,tip,tip-Vector((0,0,.037)),.004,.004,6)
        tube(cable,tip-Vector((0,0,.033)),tip-Vector((0,0,.057)),.012,.013,8)
        center=tip-Vector((0,0,.082))
        ellipsoid(globe,center,.023,.023,.034,0,0,10,6)
        ellipsoid(bulb,center,.006,.006,.018,0,0,7,5)
    def festoon(a,b,sag,spacing,offset=.5):
        a,b=Vector(a),Vector(b)
        length=(b-a).length
        def point_on(t):return a.lerp(b,t)-Vector((0,0,4*sag*t*(1-t)))
        # Carry every drop on its cable vertex, including on the steep return.
        count=max(1,round(length/spacing))
        hang=[(j+offset)/count for j in range(count)] if length>.35 else []
        segments=max(2,math.ceil(length/.22))
        stations=sorted(set([j/segments for j in range(segments+1)]+hang))
        for t,u in zip(stations,stations[1:]):
            tube(cable,point_on(t),point_on(u),.004,.004,6)
        for t in hang:cafe_bulb(point_on(t))
    post_x=(23.30,32.00,40.70)
    for left,right in zip(post_x,post_x[1:]):
        # Under the eave, then in deep separate scallops on the outside rail.
        festoon(pos(left,35.84,dp+2.065),pos(right,35.84,dp+2.065),.09,.65)
        festoon(pos(left,35.89,dp+.919),pos(right,35.89,dp+.919),.39,.72)
    # The branch at the flue-side post drops visibly from fascia to guardrail.
    festoon(pos(post_x[0],35.87,dp+2.065),pos(post_x[0],35.89,dp+.919),0,.73)

    wicker_dark=mat('Suspended baskets · dark woven cane','#493e36',.08,.65)
    chain=mat('Suspension chains · galvanized links','#9c9a8d',.65,.37)
    corners=hanging_pergola(porch_wood,wicker_dark,chain,cushion,site_group,zone,tube,blocker,round_blocker)
    # L1060582 places the cable on the timber face. Both long faces follow the
    # square top frame, turning closely round the ends, clear of the swing chains.
    for j,a in enumerate(corners):
        b=corners[(j+1)%4]
        if j%2==0:
            mid=Vector(a).lerp(Vector(b),.5)
            festoon(a,mid,.07,.80,.38)
            festoon(mid,b,.065,.80,.62)
        else:festoon(a,b,.012,.8)
    # The two sides of the clearing are visible in L1060579 and the reverse view
    # DSC01537. A short run connects the near end to the deck; the longer return
    # passes the picnic-table side on slender black uprights.
    poles=[(18.4,62.0),(13.25,54.4)]
    tops=[]
    for k,(xx,yy) in enumerate(poles):
        zz=zone(xx,yy)
        top=Vector(pos(xx,yy,zz+2.64))
        tube(edging,pos(xx,yy,zz),top,.018,.013,10)
        tops.append(top)
        blocker('LightPole'+str(k),pos(xx-.065,yy,zz),pos(xx+.065,yy,zz),.065,2.6)
    near_deck=pos(40.70,35.84,dp+2.065)
    flue_end=pos(23.30,35.84,dp+2.065)
    festoon(near_deck,corners[0],.16,.78)
    festoon(corners[1],tops[0],.21,.77)
    festoon(tops[0],tops[1],.25,.76)
    festoon(tops[1],flue_end,.24,.92)
    # Three pooled emitters model bounced light from neighboring bulbs. They
    # follow the authored suspension heights when deck or garden grades change.
    for suffix,a,b in [('Pergola',corners[0],corners[1]),('Picnic',tops[0],corners[1]),
                        ('Deck',flue_end,near_deck)]:
        marker=bpy.data.objects.new('FestoonPool_'+suffix,None);site_group.objects.link(marker)
        marker.location=Vector(a).lerp(Vector(b),.5)-Vector((0,0,.20))
        marker.empty_display_size=.04
    for name,location in [('TourEye_yard',wpos(11.1,60.2,1.59)),('TourLook_yard',pos(28.4,50.2,367.32))]:
        ob=bpy.data.objects.new(name,None);site_group.objects.link(ob);ob.location=location;ob.empty_display_size=.04
    moss=mat('Glacial boulder · moss','#7e7b57')
    tank=mat('Propane cylinders · green enamel','#80988d',.22,.43)
    # Owner photo L1040560 shows the boulder on the uphill side of the front stoop.
    br=Vector(wpos(41.1,-10.4));ellipsoid(stone,(br.x,br.y,br.z+.20),.83,.81,.70,3001,.15)
    ellipsoid(moss,(br.x-.08,br.y+.03,br.z+.65),.61,.47,.29,3002,.18)
    blocker('EntryBoulder',br-Vector((.45,0,0)),br+Vector((.45,0,0)),1.19,.91)
    old_stone=mapped('Roadside masonry · lichen and rock-faced block','Old entrance masonry.jpg')
    build_roadside_wall(site_group,zone,blocker,old_stone,asset_dir/'Old entrance masonry normal.jpg')
    # Appraisal rear photograph shows two vertical cylinders beside the covered porch.
    for j,xx in enumerate((19.45,17.23)):
        yy=30.15;z=service_z+.060;base=Vector(pos(xx,yy,z))
        plank(riser,xx-.79,xx+.79,yy-.75,yy+.75,service_z+.003,z)
        tube(tank,base,base+Vector((0,0,.065)),.198,.203,28)
        ellipsoid(tank,base+Vector((0,0,.171)),.263,.263,.128,230+j,nlon=28)
        tube(tank,base+Vector((0,0,.17)),base+Vector((0,0,.89)),.263,.263,28)
        for hh in (.179,.878):
            tube(tank,base+Vector((0,0,hh)),base+Vector((0,0,hh+.012)),.266,.266,28)
        ellipsoid(tank,base+Vector((0,0,.885)),.262,.262,.135,234+j,nlon=28)
        tube(tank,base+Vector((0,0,.982)),base+Vector((0,0,1.114)),.135,.108,24)
        round_blocker('RearTank%02d'%j,base-Vector((0,0,.055)),.263,.263,1.18)
    # The fire-pit reference shows low growth under the hardwood trunks behind
    # the clearing. Keep the modeled driveway, gravel and deer feeding area open.
    from mathutils.bvhtree import BVHTree
    forest_floor=BVHTree.FromPolygons([v.co for v in land.data.vertices],
                                       [list(f.vertices) for f in land.data.polygons])
    dress_garden_ground(site_group,pad,gravel_height,drain_x,forest_floor,local,land,helper,garden_offset)
    # The 2025 leaf-off ortho places the deck and a woodland edge behind the
    # house. Sentinel-2 only supplies a broad summer density, never plant positions.
    vegetation=json.loads((base_dir/'Woodland context'/'Summer vegetation.json').read_text())
    def summer_cover(x,y):
        e,n=eastnorth(x,y)
        col=math.floor((e-vegetation['west'])/vegetation['cell'])
        row=math.floor((vegetation['north']-n)/vegetation['cell'])
        grid=vegetation['values']
        value=grid[row][col] if 0<=row<len(grid) and 0<=col<len(grid[0]) else vegetation['nodata']
        return .5 if value==vegetation['nodata'] else sclip((value-40)/45)
    understory=random.Random(579)
    frond_mats=[mat('Woodland ferns · '+name,tint) for name,tint in
                [('deep green','#355333'),('leaf green','#506f37'),('new growth','#708343')]]
    for attempt in range(235):
        x=understory.uniform(-34,57);y=understory.uniform(38.5,83)
        # Keep both beds, the deck exit, timber stack and clear travel lanes open.
        if math.hypot((x-pad_x)/(pad_rx+3.8),(y-pad_y)/(pad_ry+3.8))<1:continue
        if 27<x<44.3 and y<66:continue
        if 33<x<57 and 35<y<49 and garden_offset(x,y)[0]<2.8:continue
        if -12<x<19 and y<55:continue
        if understory.random()>.10+.73*summer_cover(x,y)**2:continue
        probe=Vector(wpos(x,y,2.0))
        base,normal,index,_=forest_floor.ray_cast(probe,(0,0,-1),4.0)
        if base is None or land.data.polygons[index].material_index!=0 or normal.z<.63:continue
        base.z-=.012
        if understory.random()<.29:
            # Young maples with a forked leader and attached photo-textured leaf sprays.
            height=understory.uniform(.55,1.36)
            lean=Vector((understory.uniform(-.17,.17),understory.uniform(-.17,.17),height))
            tube(bough,base,base+lean,.009,.002,5)
            for j in range(7):
                theta=j*2.40+understory.uniform(-.25,.25)
                root=base+lean*(.31+.084*j)
                heading=Vector((math.cos(theta),math.sin(theta),.41))
                tip=root+heading*height*(.27-.022*j)
                tube(bough,root,tip,.0038,.001,4)
                spray(tip,heading,height*.25,height*.20)
            continue
        # Each pinna folds around a rib on an arched frond, so nearby low woodland
        # catches side light even when viewed across the slope.
        scale=understory.uniform(.25,.48)
        for j in range(5):
            theta=math.tau*j/5+understory.uniform(-.40,.40)
            length=scale*understory.uniform(.63,1.2)
            direction=Vector((math.cos(theta),math.sin(theta),0))
            across=Vector((-direction.y,direction.x,0))
            def blade(t):
                return base+direction*(length*t)+Vector((0,0,length*(1.65*t-1.13*t*t)))
            for k in range(1,8):
                t=k/8.5;rib=blade(t)
                breadth=length*.20*(math.sin(t*math.pi)**.71)*(1-.28*t)
                for side in (-1,1):
                    tip=rib+across*(side*breadth)+direction*(.052*length)
                    ridge=rib.lerp(tip,.56)+Vector((0,0,.012*length))
                    half=direction*(length*(.019+.008*math.sin(t*math.pi)))
                    push(frond_mats[(j+k//4)%3],[rib,ridge-half,tip,ridge+half,ridge],
                         [(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
            tube(frond_mats[j%3],base,blade(.45),.0028,.0016,3)
            tube(frond_mats[j%3],blade(.45),blade(1),.0016,.0008,3)
    for m,(vs,faces) in mats.items():
        if m==bark:
            ob=mesh('Hardwood trunks and primary limbs · lidar-guided crown locations',vs,faces,m,site_group)
            uv=ob.data.uv_layers.new(name='Bark grain')
            for face in ob.data.polygons:
                if face.index in trunk_uvs:
                    for li,coord in zip(face.loop_indices,trunk_uvs[face.index]):uv.data[li].uv=coord
                    continue
                for li in face.loop_indices:
                    v=ob.data.vertices[ob.data.loops[li].vertex_index].co
                    uv.data[li].uv=((v.x*.72+v.y*.91)*2,v.z*.45)
            ob['basis']='Crown locations and heights inferred from 2018 lidar; stem positions and branches approximate.'
        else:
            ob=mesh('Exterior details · '+m.name,vs,faces,m,site_group)
            if m in (wicker,ties,entry_wood,cap_stone):
                uv=ob.data.uv_layers.new(name='Exterior materials')
                for face in ob.data.polygons:
                    axis=max(range(3),key=lambda i:abs(face.normal[i]))
                    for li in face.loop_indices:
                        vv=ob.data.vertices[ob.data.loops[li].vertex_index].co
                        a,b=((vv.y,vv.z) if axis==0 else (vv.x,vv.z) if axis==1 else (vv.x,vv.y))
                        uv.data[li].uv=(a*7,b*7) if m==wicker else (a*4,b*4) if m==cap_stone else (a*.64,b*2.4)
    flora=mesh('Deciduous tree crowns · illustrative warm-season leaves',cards,cardfaces,leaves,site_group)
    uv=flora.data.uv_layers.new(name='Photometric leaf sprays')
    for i,lp in enumerate(flora.data.loops):uv.data[i].uv=carduv[lp.vertex_index]
    # Road crossing and parcel context imagery are visible only. Starting point and
    # walk support remain wholly on this lot.
    spawn=bpy.data.objects.new('WalkSpawn_Outside',None);site_group.objects.link(spawn)
    spawn.location=wpos(-16.56,-14.17,.025);spawn.empty_display_type='PLAIN_AXES';spawn.empty_display_size=.05
    return site_group
site_extra=build_exterior_site()
