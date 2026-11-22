"""Living room/loft photographic reconstruction inside the appraisal-coordinate envelope.
Horizontal drawing units are feet; interior elevations are metres above the main floor.
"""
import random
from mathutils import Matrix
room = coll('09 · Living room and open sleeping loft')
fitout = coll('10 · Living room furniture')
fixtures = coll('11 · Interior lighting and view cameras')
assets = work/'Interior materials'
def texmat(name, filename, strength=0):
    m=mat(name,'#ffffff')
    nt=m.node_tree; im=bpy.data.images.load(str(assets/filename),check_existing=True); im.pack()
    sample=nt.nodes.new('ShaderNodeTexImage');sample.image=im
    b=nt.nodes.get('Principled BSDF');nt.links.new(sample.outputs['Color'],b.inputs['Base Color'])
    if strength:
        nt.links.new(sample.outputs['Color'],b.inputs['Emission Color']);b.inputs['Emission Strength'].default_value=strength
    return m
flank=texmat('Living · gray brown plank','Living room - weathered plank.jpg')
lining=texmat('Loft · stained pine','Loft - amber tongue and groove.jpg')
living_floor=texmat('Living · gray boards from the threshold photograph','Living - photographed gray floor.jpg')
loft_wood=texmat('Loft · stained roof boards from L1040629','Loft - photographed cedar.jpg')
oak=texmat('Joinery · amber oak','Joinery - warm oak.jpg')
landscape=texmat('Windows · illustrative view from the property','Window view - woodland daylight.jpg',.8)
ochre=mat('Interior · soft warm plaster','#dfcfa9'); ceilingmat=mat('Interior · soft ivory vault','#f5f0e6')
white=mat('Window frames · painted wood','#ebe5d4'); darkwood=mat('Loft exposed beams · walnut','#624331')
curtainmat=mat('Drapery · olive twill','#647048'); brass=mat('Curtain hardware · aged brass','#483f30',.55)
bedmat=mat('Loft mattress · canvas','#e8e0d0')
sky=mat('Daylight through rooflights','#d2e5ef')
sky.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.76,.86,1,1)
sky.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1.1
def point(u,v,h):return Vector(pos(u,v,main+h))
def local(p):
    de=p[0]-4.65;dn=p[1]-8.5
    return ((-co*de+si*dn)/ft,(-si*de-co*dn)/ft,p[2]-(main-OZ))
def surface(name,coords,material,uvs=None):
    ob=mesh(name,[point(*p) for p in coords],[tuple(range(len(coords)))],material,room)
    if uvs is not None:
        uv=ob.data.uv_layers.new(name='Timber or view projection')
        for i,lp in enumerate(ob.data.loops):uv.data[i].uv=uvs[lp.vertex_index]
    return ob
def block(name,x0,x1,y0,y1,h0,h1,m):
    return box(name,x0,x1,y0,y1,main+h0,main+h1,m,room)
def beam(name,a,b,width,depth,material):
    start,end=point(*a),point(*b);v=end-start
    q=v.to_track_quat('X','Z');r=q@Vector((0,width/2,0));s=q@Vector((0,0,depth/2))
    vs=[p+r*sy+s*sz for p in (start,end) for sy,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    ob=mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],material,room,True)
    if material in (oak,lining):
        uv=ob.data.uv_layers.new(name='Grain')
        for face in ob.data.polygons:
            for idx in face.loop_indices:
                vv=ob.data.vertices[ob.data.loops[idx].vertex_index].co-start
                axis=vv.dot(v.normalized());k=idx-face.loop_start
                uv.data[idx].uv=(axis/1.5,[0,.27,.27,0][k] if face.index in (0,1) else [.02,.02,.21,.21][k] if abs(vv.dot(r.normalized()))<width/2-.001 else vv.dot(s.normalized())/.32+.5)
    return ob
def clipped(poly,dim,v,less):
    ans=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        t=a[dim]-v;w=b[dim]-v;aa=(t<=.000001) if less else (t>=-.000001);bb=(w<=.000001) if less else (w>=-.000001)
        if aa:ans.append(a)
        if aa!=bb:ans.append(tuple(a[k]+(b[k]-a[k])*t/(t-w) for k in range(len(a))))
    return ans
def without(poly,rects,axes=(0,1)):
    regions=[poly]
    for rect in rects:
        remaining=[]
        for region in regions:
            core=region
            for ax,value,less in [(axes[0],rect[0],True),(axes[0],rect[1],False),(axes[1],rect[2],True),(axes[1],rect[3],False)]:
                if len(core)<3:break
                part=clipped(core,ax,value,less)
                if len(part)>=3:remaining.append(part)
                core=clipped(core,ax,value,not less)
        regions=remaining
    return regions
def hole_object(ob,holes,axes):
    me=ob.data;v=[];f=[]
    for face in me.polygons:
        corners=[local(me.vertices[i].co) for i in face.vertices]
        for part in without(corners,holes,axes):
            if (point(*part[1])-point(*part[0])).cross(point(*part[-1])-point(*part[0])).length<1e-8:continue
            i=len(v);v.extend([point(*p) for p in part]);f.append(tuple(range(i,len(v))))
    mats=list(me.materials);me.clear_geometry();me.from_pydata(v,[],f);me.update()
def soffit(u,v):return roofZ(u,v,1)-main-.14
# The exterior version used simple overlays to indicate openings. Replace the two that
# belong to this room with framed openings through the wall and the new interior lining.
# Fixed floor datum for the ordinary main-floor sash openings. Counter-height
# kitchen windows and the upper loft glazing each occupy a separate level.
room_sash_levels=(.82,1.74)
# IMG_3970 shows the casing clear of the house-end deck post. Share its
# bounds with the dining furnishings, wall opening and presentation light.
dining_window=(24.0,27.05,*room_sash_levels)
east_window=(18.6,26.0,*room_sash_levels)
loft_window=(16.25,18.05,2.65,3.40)
south_window=(6.9,14.1,*room_sash_levels)
for ob in list(inter.objects):
    if ob.name.startswith(('East gable windows B','Rear living area windows')):bpy.data.objects.remove(ob,do_unlink=True)
for ob in list(structure.objects):
    if ob.name.startswith('Exterior · wall 8.'):hole_object(ob,[east_window,loft_window],(1,2))
    if ob.name.startswith('Exterior · wall 7.'):hole_object(ob,[south_window],(0,2))
# Remove strips of outside cladding across the new windows.
clad=bpy.data.objects.get('Blue lap siding · garage wing')
if clad:
    facepoints=[[local(clad.data.vertices[i].co) for i in p.vertices] for p in clad.data.polygons]
    v=[];f=[]
    for face in facepoints:
        near_gable=max(abs(p[0]) for p in face)<.2
        near_rear=max(abs(p[1]-29) for p in face)<.2
        pieces=without(face,[east_window,loft_window],(1,2)) if near_gable else without(face,[south_window],(0,2)) if near_rear else [face]
        for part in pieces:
            i=len(v);v.extend([point(*p) for p in part]);f.append(tuple(range(i,len(v))))
    clad.data.clear_geometry();clad.data.from_pydata(v,[],f);clad.data.update()
lightslots=[(1.8,4.5,12.4,15.7),(2.1,4.9,19.5,22.7),(10.6,15.0,18.1,21.5)]
for ob in list(roof.objects):
    if ob.name.startswith(('Roof · North wing 1','Roof · South wing 1')):hole_object(ob,lightslots,(0,1))
def floorface(name,x0,x1,y0,y1,z,material,unit):
    vs=[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)]
    return surface(name,vs,material,[(x/unit,y/unit) for x,y,h in vs])
# DSC01698 and the kitchen threshold photograph show the boards parallel to the gable.
living_outline=[(.12,15.25,.014),(21.1,15.25,.014),(21.1,28.87,.014),(.12,28.87,.014)]
surface('Living room · floor',living_outline,living_floor,[(y*ft/3.60,-x*ft/1.52) for x,y,z in living_outline])
loftdeck=2.20; front=8.95;ynorth=15.25;yback=28.82
block('Loft · timber platform',.18,front,7.0,yback,loftdeck-.12,loftdeck,darkwood)
floorface('Loft · floor finish',.18,front,7,yback,loftdeck+.002,lining,4.8)
under=[(.18,ynorth,loftdeck-.123),(front,ynorth,loftdeck-.123),(front,yback,loftdeck-.123),(.18,yback,loftdeck-.123)]
surface('Loft · visible board soffit',list(reversed(under)),lining,[(x/4.8,y/4.8) for x,y,h in reversed(under)])
for x in (1.2,3.25,5.35,7.53):beam('Loft · exposed joist',(x,ynorth,loftdeck-.17),(x,yback,loftdeck-.17),.096,.15,darkwood)
# Two ceiling finishes follow the measured, gently offset roof planes; each skylight
# has an opening in the exterior surface and a profiled inner reveal.
def top(u,v):return soffit(u,v)
for x0,x1,v0,v1,material in [(.18,front,7.0,yback,loft_wood),(front,21.1,ynorth,yback,ceilingmat)]:
    for sign in (0,1):
        r0=ridge(x0,1);r1=ridge(x1,1)
        corners=([(x0,v0),(x1,v0),(x1,r1),(x0,r0)] if sign==0 else [(x0,r0),(x1,r1),(x1,v1),(x0,v1)])
        for part in without(corners,lightslots):
            pts=[(x,y,top(x,y)) for x,y in reversed(part)]
            if material==loft_wood:
                surface('Roof lining · spruce loft',pts,material,[(x*ft/2.3,y*ft*1.13/.86) for x,y,h in pts])
            else:
                surface('Roof lining · ivory vault',pts,material,[(x/5,y/5) for x,y,h in pts])
for x0,x1,y0,y1 in lightslots:
    pts=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
    if x0<front:
        inset=.10
        inner=[(x0+inset,y0+inset),(x1-inset,y0+inset),(x1-inset,y1-inset),(x0+inset,y1-inset)]
        for i,(x,y) in enumerate(pts):
            j=(i+1)%4
            a,b=pts[j]; c,d=inner[j]; e,f=inner[i]
            reveal=[(x,y,top(x,y)),(a,b,top(a,b)),(c,d,top(c,d)+.086),(e,f,top(e,f)+.086)]
            length=(point(*reveal[1])-point(*reveal[0])).length
            surface('Skylight · stained timber reveal',reveal,loft_wood,[(0,.31),(length/2.3,.31),(length/2.3,.42),(0,.42)])
            beam('Skylight · white inner sash',reveal[2],reveal[3],.038,.027,white)
    else:
        for (x,y),(a,b) in zip(pts,pts[1:]+pts[:1]):
            beam('Skylight · reveal',(x,y,top(x,y)+.03),(a,b,top(a,b)+.03),.064,.11,white)
    coords=[(x,y,top(x,y)+.091) for x,y in reversed(pts)];surface('Skylight · opal daylight glazing',coords,sky)
# Photo-matched wall finishes and sills.
def wallmaterial(name,polygon,material,holes=(),axes=(0,2)):
    for part in without(polygon,holes,axes):
        surface(name,part,material,[(p[axes[0]]/5,p[2]/1.45) for p in part])
xg=.18;ym=28.82
wallmaterial('East wall · under loft',[(xg,ynorth,.014),(xg,ym,.014),(xg,ym,loftdeck-.12),(xg,ynorth,loftdeck-.12)],ochre,[east_window],(1,2))
# Finish the low eave and the bedroom side of the platform up to the cedar
# roof. These inside faces sit just clear of the bedroom plaster behind them.
loft_side=front-.045
loft_eave=7.045
for label,edge in [
    ('low eave',[(loft_side,loft_eave),(xg,loft_eave)]),
    ('bedroom side',[(loft_side,ynorth),(loft_side,loft_eave)])]:
    a,b=edge
    pts=[(*a,loftdeck),(*b,loftdeck),(*b,top(*b)),(*a,top(*a))]
    axis=0 if label=='low eave' else 1
    surface('Loft · cedar lining at '+label,pts,loft_wood,
            [(p[axis]*ft/2.3,(p[2]-loftdeck)/.86) for p in pts])
a=(loft_side,ynorth);b=(front,ynorth)
pts=[(*a,loftdeck),(*b,loftdeck),(*b,top(*b)),(*a,top(*a))]
surface('Loft · cedar lining at stair jamb',pts,loft_wood,
        [(p[0]*ft/2.3,(p[2]-loftdeck)/.86) for p in pts])
crest_y=ridge(xg,1)
for a,b in [(7,crest_y),(crest_y,ym)]:
    outline=[(xg,a,loftdeck),(xg,b,loftdeck),(xg,b,top(xg,b)),(xg,a,top(xg,a))]
    slope=(top(xg,b)-top(xg,a))/((b-a)*ft)
    normalizer=math.hypot(1,slope)
    for part in without(outline,[loft_window],(1,2)):
        uv=[]
        for _,y,h in part:
            run=(y-crest_y)*ft
            rise=h-loftdeck
            uv.append(((run+rise*slope)/(normalizer*2.3),(rise-run*slope)/(normalizer*.86)))
        surface('Loft · gable-end wood',part,loft_wood,uv)
wallmaterial('Living room · curtained wall',[(.18,ym,.014),(21,ym,.014),(21,ym,top(21,ym)),(.18,ym,top(.18,ym))],ochre,[south_window])
wallmaterial('Living room · stair wall',[(.18,ynorth,.014),(20.8,ynorth,.014),(20.8,ynorth,top(20.8,ynorth)),(front,ynorth,top(front,ynorth)),(front,ynorth,loftdeck-.12),(.18,ynorth,loftdeck-.12)],ochre,[(2.0,4.9,-.1,1.94)])
for x0,x1 in ((.22,20.6),):
    for a,b in ((x0,1.99),(4.91,x1)):
        block('Baseboard · stair wall',a,b,ynorth+.01,ynorth+.12,.02,.105,white)
    block('Baseboard · curtain wall',x0,x1,ym-.12,ym-.01,.02,.105,white)
block('Baseboard · east',.18,.31,ynorth+.12,ym-.12,.02,.105,white)
# Windows with individual mullions. A daytime crop of the owner's woods sits behind
# the glazing as an illustrative view, not an exact panorama from each opening.
def sash(name,rect,endwall=False,small=False):
    a,b,z0,z1=rect
    def strip(tag,p,q,h0,h1,matl):
        if endwall:block(name+tag,.18,.36,p,q,h0,h1,matl)
        else:block(name+tag,p,q,ym-.19,ym,h0,h1,matl)
    def pt(al,z):
        return (.08,al,z) if endwall else (al,28.96,z)
    view=[pt(a,z0),pt(b,z0),pt(b,z1),pt(a,z1)]
    surface(name+' · clear glazing',view,interior_glass)
    band=.19 if small else .22;m=darkwood if small else white
    for p in [a,b]:strip(' · side frame',p-band,p+band*.5,z0-.07,z1+.07,m)
    for h in [z0,z1]:strip(' · casing',a-band,b+band*.5,h-.04,h+.045,m)
    # The liner covers the exposed wall thickness all the way to the trim.
    def reveal(left,right,low,high):
        if endwall:block(name+' · jamb lining',-.04,.181,left,right,low,high,m)
        else:block(name+' · jamb lining',left,right,ym-.002,29.041,low,high,m)
    for l,r in ((a-.02,a+.035),(b-.035,b+.02)):reveal(l,r,z0,z1)
    reveal(a+.035,b-.035,z0-.006,z0+.02)
    reveal(a+.035,b-.035,z1-.02,z1+.006)
    # Outside the lap siding the living and loft sashes also have a weather
    # casing, centered on the same level cutout as the interior frames.
    def weather_trim(left,right,low,high):
        if endwall:block(name+' · exterior casing',-.155,-.035,left,right,low,high,white)
        else:block(name+' · exterior casing',left,right,29.035,29.155,low,high,white)
    for l,r in ((a-.19,a+.035),(b-.035,b+.19)):weather_trim(l,r,z0-.017,z1+.018)
    weather_trim(a-.20,b+.20,z1+.018,z1+.069)
    weather_trim(a-.23,b+.23,z0-.066,z0-.017)
    if not small:
        fractions=(.25,.75) if endwall else (1/3,2/3)
        left,right=[a+(b-a)*f for f in fractions]
        for p in (left,right):strip(' · mullion',p-.065,p+.065,z0,z1,m)
        spans=[(a,left),(right,b)] if endwall else [(a,left),(left,right),(right,b)]
        for p,q in spans:strip(' · lower sash',p,q,z0+(z1-z0)*.49,z0+(z1-z0)*.49+.034,m)
interior_glass=mat('Clear glass · real outdoor view','#c2d7dd',.06,.14)
glass_bs=interior_glass.node_tree.nodes.get('Principled BSDF');glass_bs.inputs['Alpha'].default_value=.085
interior_glass.surface_render_method='BLENDED'
sash('East · picture window',east_window,True);sash('South · casement group',south_window)
sash('Loft · gable window',loft_window,True,True)
# Drapery with soft vertical pleats pulled to the sides, visible on the south wall.
for x0,x1 in [(5.45,7.7),(13.35,15.68)]:
    rows=10;cols=58;verts=[];faces=[]
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            u=i/cols; x=x0+(x1-x0)*u+.04*math.sin(6*t+4*u)*t
            y=ym-.53-.085*(1+.45*(1-t))*math.sin(8*math.pi*u)
            z=(.50+.03*math.cos(8*math.pi*u))*(1-t)+(south_window[3]+.105)*t
            verts.append(point(x,y,z))
    for j in range(rows):
        for i in range(cols):
            k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
    ob=mesh('Living room · gathered olive curtain',verts,faces,curtainmat,room)
    for p in ob.data.polygons:p.use_smooth=True
beam('Window · curtain rod',(5.24,ym-.51,south_window[3]+.126),(15.90,ym-.51,south_window[3]+.126),.035,.035,brass)
# Loft access: open treads, stringers, one guard along the open side, clear landing.
sx0=15.85; stair_y0=ynorth+.18; stair_y1=18.1;count=10
for j in range(count):
    frac=(j+1)/count; xx=sx0+(front-sx0)*frac; zz=loftdeck*frac
    beam('Stair · oak tread',(xx+.28,stair_y0,zz-.037),(xx+.28,stair_y1,zz-.037),.283,.074,oak)
for yy in [stair_y0+.10,stair_y1-.1]:
    beam('Stair · open stringer',(sx0+.50,yy,.045),(front-.21,yy,loftdeck-.11),.088,.16,darkwood)
guard=stair_y1-.08
for j in range(11):
    frac=j/10;x=sx0+(front-sx0)*frac;z=loftdeck*frac
    beam('Stair · baluster',(x,guard,z+.025),(x,guard,z+.79),.047,.047,oak)
beam('Stair · handrail',(sx0+.1,guard,.80),(front-.12,guard,loftdeck+.80),.0889,.0381,oak)
beam('Loft · edge beam',(front,guard,loftdeck-.045),(front,yback,loftdeck-.045),.16,.20,darkwood)
guardtop=loftdeck+.77;end=25.0
for j in range(10):
    y=guard+.15+(end-guard-.15)*j/9
    h=min(guardtop,top(front,y)-.055)
    if h>loftdeck+.10:beam('Loft · square baluster',(front-.12,y,loftdeck),(front-.12,y,h),.061,.061,oak)
beam('Loft · handrail',(front-.12,guard,guardtop),(front-.12,end,min(guardtop,top(front,end)-.045)),.0889,.0381,oak)
verts=[(front, end,loftdeck),(front,ym,loftdeck),(front,ym,top(front,ym)),(front,end,top(front,end))]
wallmaterial('Loft · timber edge return',verts,lining,axes=(1,2))
beam('Loft · ridge timber',(.22,ridge(.22,1),top(.22,ridge(.22,1))-.05),(front,ridge(front,1),top(front,ridge(front,1))-.05),.14,.14,darkwood)
# Low loft bed on floor. A subtle stitched duvet follows the fold at the edge.
def softblock(name,x0,x1,y0,y1,z0,z1,material,r):
    ob=block(name,x0,x1,y0,y1,z0,z1,material)
    bevel=ob.modifiers.new('Soft corners','BEVEL');bevel.width=r;bevel.segments=4
    w=ob.modifiers.new('Face normals','WEIGHTED_NORMAL');return ob
bedbase=loftdeck+.016
loft_bed_bounds=(.52,5.52,13.38,19.91)
softblock('Loft · floor mattress',*loft_bed_bounds,bedbase,bedbase+.155,bedmat,.056)
exec(compile((work/'Loft bedding.py').read_text(),'Loft bedding.py','exec'),globals())
furniture_lib={'__name__':'cabin_furniture'}
exec(compile((work/'Cabin furniture.py').read_text(),'Cabin furniture.py','exec'),furniture_lib)
def furnishing(kind,x,y,h,yaw,**opts):
    ob=furniture_lib['design_assets'](kind,point(x,y,h),174.6+yaw,**opts)
    for collection in list(ob.users_collection):collection.objects.unlink(ob)
    fitout.objects.link(ob)
    return ob

def loft_and_hearth_accessories():
    # DSC01090 shows both loft lamps and the portable fan. DSC01697 shows the
    # fan near the railing and a separate pedestal model beside the hearth.
    Builder=furniture_lib['_IFBuilder']
    graphite=mat('Fan and lantern · charcoal enamel','#303234',.34,.42)
    silver=mat('Fan · brushed button','#96938b',.58,.38)
    bulb=mat('Loft reading lights · warm bulb','#ffe7b5',0,.34)
    shader=bulb.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value=(1,.73,.40,1)
    shader.inputs['Emission Strength'].default_value=.55
    def place(builder,name,x,y,h,yaw):
        obj=builder.finish(name,point(x,y,h),174.6+yaw)
        for collection in list(obj.users_collection):collection.objects.unlink(obj)
        fitout.objects.link(obj)
    def fan(name,x,y,h,height,radius,yaw):
        fan=Builder()
        for radius_ratio,depth in ((1,0),(.82,-.023),(.62,-.039),(.4,-.047)):
            ring=[(math.cos(i*math.tau/40)*radius*radius_ratio,depth,
                   height+math.sin(i*math.tau/40)*radius*radius_ratio) for i in range(41)]
            fan.tube(ring,.0035,graphite,5)
        for i in range(30):
            a=math.tau*i/30
            fan.beam((radius*.19*math.cos(a),-.048,height+radius*.19*math.sin(a)),
                     (radius*math.cos(a),0,height+radius*math.sin(a)),.0019,graphite,5)
        for i in range(3):
            a=math.tau*i/3
            blade=[(.12,0),(.84,.18),(.90,.6),(.58,1),(.22,.94)]
            vertices=[fan.vert((radius*r*math.cos(a+d),.026,height+radius*r*math.sin(a+d))) for r,d in blade]
            fan.face(vertices,graphite)
        fan.beam((0,-.061,height),(0,-.046,height),radius*.19,silver,20)
        fan.beam((0,.013,height),(0,.104,height),radius*.47,graphite,20,radius*.29)
        if height>.5:
            fan.beam((0,.055,.017),(0,.055,.038),radius*.79,graphite,24)
            fan.beam((0,.055,.036),(0,.055,height),.017,graphite,12)
        else:
            fan.tube([(-radius,.021,height),(-radius,.055,.043),(-radius*.79,.047,.021),
                      (radius*.79,.047,.021),(radius,.055,.043),(radius,.021,height)],.014,graphite)
        place(fan,name,x,y,h,yaw)
    fan('Living room · pedestal fan beside the heater',17.19,27.86,.109,1.12,.19,-25)
    fan('Loft · portable pivot fan',7.05,23.18,loftdeck+.006,.188,.142,98)

    # Small caged reading light suspended from the timber edge of the right rooflight.
    light=Builder()
    light.beam((0,0,-.045),(0,0,.005),.031,graphite,18)
    light.beam((0,0,-.088),(0,0,-.045),.075,graphite,24,.030)
    light.cube((0,0,-.133),(.047,.047,.086),bulb,2)
    for i in range(6):
        dx,dy=math.cos(i*math.tau/6),math.sin(i*math.tau/6)
        light.tube([(.057*dx,.057*dy,-.089),(.047*dx,.047*dy,-.150),
                    (.028*dx,.028*dy,-.178),(0,0,-.184)],.0026,graphite,5)
    place(light,'Loft · caged reading light by the skylight',2.24,19.34,top(2.24,19.34),0)

    lamp=Builder()
    bark=mat('Loft · cut log with bark','#6e4a33')
    lamp.beam((0,0,.004),(0,0,.198),.121,bark,16,.115)
    for i in range(27):
        a=math.tau*i/27
        lamp.beam((.120*math.cos(a),.120*math.sin(a),.012),
                  (.115*math.cos(a+.045),.115*math.sin(a+.045),.192),.0035,darkwood,5)
    lamp.beam((0,0,.198),(0,0,.228),.058,graphite,18)
    lamp.cube((0,0,.302),(.050,.050,.120),bulb,2)
    for i in range(4):
        dx,dy=math.cos(i*math.tau/4),math.sin(i*math.tau/4)
        lamp.tube([(.040*dx,.040*dy,.223),(.052*dx,.052*dy,.247),
                   (.039*dx,.039*dy,.356),(.028*dx,.028*dy,.375)],.0035,graphite,6)
    lamp.beam((0,0,.36),(0,0,.376),.046,graphite,18,.029)
    lamp.beam((0,0,.376),(0,0,.398),.025,graphite,14)
    place(lamp,'Loft · reading lantern on a cut log',.79,20.75,loftdeck+.006,0)

loft_and_hearth_accessories()
furnishing('sofa',1.91,22.2,.017,90)
furnishing('sofa',10.55,27.10,.017,0,style='love')
coffee=furnishing('coffee_table',7.65,22.50,.017,0,style='wood')
furnishing('curio',1.30,27.52,.014,40)
furnishing('end_table',15.52,26.93,.017,0,style='wood')
media=furnishing('media',7.62,15.92,.017,180)
# Wall-mount the screen behind the inner stringer; the cabinet stays set off the wall.
for v in media.data.vertices:
    if v.co.z>.82:v.co.y+=.067
block('Television · concealed wall mount',7.05,8.15,ynorth+.01,ynorth+.20,1.11,1.31,darkwood)
for mm in media.data.materials:
    if 'Television glass' in mm.name:
        mm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.25
oak_image=bpy.data.images.load(str(assets/'Coffee table - stained oak.jpg'));oak_image.pack()
for name in ['Storage table stained oak','Storage table edge grain']:
    mm=bpy.data.materials.get('Cabin furnishing • '+name)
    if mm:
        node=mm.node_tree.nodes.new('ShaderNodeTexImage');node.image=oak_image
        mm.node_tree.links.new(node.outputs['Color'],mm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

# IMG_0007 shows the upper stonework stopping at the plane of the dining
# wall. The projecting slate plinth still supports the freestanding furnace.
dining_wall_y=25.86
hearth=furnishing('hearth',20.72,28.68,.014,180,height=2.37,left_length=1.3,right_length=1.18,
                  stone_return_length=(28.68-dining_wall_y)*ft)
for part,filename in [('Charcoal firebox glazing','Hearth - heater window.jpg'),
                      ('Stove perforated surround','Hearth - perforated silver.jpg')]:
    stove_part=next(m for m in hearth.data.materials if part in m.name)
    window_tex=stove_part.node_tree.nodes.new('ShaderNodeTexImage')
    window_tex.image=bpy.data.images.load(str(assets/filename),check_existing=True)
    window_tex.image.pack()
    stove_part.node_tree.links.new(window_tex.outputs['Color'],stove_part.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# DSC01547 shows the running propane heater. This separate emission channel
# keeps the inset glass and ambient reflections intact when the burner goes out.
fire_glass=next(m for m in hearth.data.materials if 'Charcoal firebox glazing' in m.name)
burner_photo=fire_glass.node_tree.nodes.new('ShaderNodeTexImage')
burner_photo.image=bpy.data.images.load(str(assets/'Hearth - lit firebox.jpg'),check_existing=True)
burner_photo.image.pack()
fire_shader=fire_glass.node_tree.nodes.get('Principled BSDF')
fire_glass.node_tree.links.new(burner_photo.outputs['Color'],fire_shader.inputs['Emission Color'])
fire_shader.inputs['Emission Strength'].default_value=1.65
# Fit the top courses and flue collar to the underside of the vaulted ceiling.
masonry=set()
for f in hearth.data.polygons:
    if 'Ledgestone' in hearth.data.materials[f.material_index].name:
        masonry.update(f.vertices)
for i,v in enumerate(hearth.data.vertices):
    h=v.co.z
    if i in masonry or h>2.352:
        target=top(20.72-v.co.x/ft,28.68-v.co.y/ft)-.023
        v.co.z=h*target/2.37
# Keep the photographed courses level where the top of the wall meets the vault.
stone=next(m for m in hearth.data.materials if 'Ledgestone split face' in m.name)
detail_uv=hearth.data.uv_layers.active.data
for face in hearth.data.polygons:
    if hearth.data.materials[face.material_index]==stone:
        for loop in face.loop_indices:
            vi=hearth.data.loops[loop].vertex_index
            detail_uv[loop].uv.y=hearth.data.vertices[vi].co.z/.88
nodes=stone.node_tree.nodes
shader=nodes.get('Principled BSDF')
photo=nodes.new('ShaderNodeTexImage')
photo.image=bpy.data.images.load(str(assets/'Hearth - split face ledgestone.jpg'),check_existing=True)
photo.image.pack()
stone.node_tree.links.new(photo.outputs['Color'],shader.inputs['Base Color'])
relief=nodes.new('ShaderNodeTexImage')
relief.image=bpy.data.images.load(str(assets/'Hearth - split face normal.png'),check_existing=True)
relief.image.colorspace_settings.name='Non-Color'
relief.image.pack()
normal=nodes.new('ShaderNodeNormalMap')
normal.inputs['Strength'].default_value=.72
stone.node_tree.links.new(relief.outputs['Color'],normal.inputs['Color'])
stone.node_tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])
for x in (20.77,20.94):
    c=[(x,dining_wall_y,.014),(x,28.82,.014),(x,28.82,top(20.77,28.82)),
       (x,dining_wall_y,top(x,dining_wall_y))]
    surface('Living room · hearth return plaster',c,ochre)
furnishing('sconce',3.57,ym-.07,1.66,0)
# Warm recessed downlights and controlled daylight, kept in Blender's presentation rig.
def area_light(name,xyz,target,watts,radius,color):
    ld=bpy.data.lights.new(name,'AREA');ld.energy=watts;ld.shape='DISK';ld.size=radius;ld.color=color
    ob=bpy.data.objects.new(name,ld);fixtures.objects.link(ob);ob.location=point(*xyz)
    ob.rotation_euler=(point(*target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
area_light('Daylight · east window',(.6,22.4,1.4),(13,21,1),145,1.90,(.93,.96,1))
area_light('Daylight · south window',(10.2,28.45,1.4),(11,19,.8),180,2.05,(1,.92,.80))
area_light('Daylight · loft rooflight',(3.4,20.1,3.26),(3.7,16.4,2.26),32,.74,(1,.90,.78))
area_light('Loft · bounced light',(6.7,16.4,3.0),(.5,18.7,2.64),21,1,(1,.81,.61))
area_light('Living · bounced light',(19.2,20.3,2.58),(3.8,22,1.1),105,2.2,(1,.88,.74))
for xx,yy in [(11.2,24),(18.2,21.7)]:
    hh=top(xx,yy)-.03
    beam('Vault · recessed fixture',(xx,yy,hh),(xx,yy,hh+.013),.08,.08,sky)
def make_view(name,xyz,look,lens):
    camera_data=bpy.data.cameras.new(name);camera_data.lens=lens;camera_data.clip_start=.025
    ob=bpy.data.objects.new(name,camera_data);fixtures.objects.link(ob);ob.location=point(*xyz)
    ob.rotation_euler=(point(*look)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
living_view=make_view('Living room · toward the loft',(22.65,18.8,1.46),(7.4,27,1.45),16.5)
loft_view=make_view('Loft · from stair landing',(7.43,17.65,3.00),(.82,17.38,2.91),16.4)
