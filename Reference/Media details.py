"""Media cabinet and vintage runner sled from owner's L1040632.
Distances within the cabinet and sled are metres. Local -Y faces the living room.
The original wall-mounted TV retains its checked transform and stair clearance.
"""
def media_details():
    import bmesh,math
    from mathutils import Vector, Matrix
    Builder=furniture_lib['_IFBuilder'];make_material=furniture_lib['_if_mat']
    # The previous console contains the TV in a shared mesh. Retain both screen
    # materials above the lower edge, including the bezel's back surface.
    bm=bmesh.new();bm.from_mesh(media.data)
    remove=[f for f in bm.faces if 'Television' not in media.data.materials[f.material_index].name
            or min(v.co.z for v in f.verts)<.855]
    bmesh.ops.delete(bm,geom=remove,context='FACES')
    bm.to_mesh(media.data);bm.free();media.data.update()
    def mapped(label,file,rough):
        m=make_material(label,'ffffff',rough)
        bs=m.node_tree.nodes.get('Principled BSDF');node=m.node_tree.nodes.new('ShaderNodeTexImage')
        im=bpy.data.images.load(str(work/'Interior materials'/file),check_existing=True);im.pack()
        node.image=im;m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
        return m
    grain=mapped('Media console · dark weathered grain','Media console grain.jpg',.74)
    printmat=mapped('Media console · artwork from L1040632','Media console artwork.jpg',.74)
    black=make_material('Media electronics · graphite','232427',.43,.12)
    blackrim=make_material('Taxidermy plaque · dark rim','32271b',.49)
    signs=make_material('Mountain ornaments · maroon','704457',.71)
    slate=make_material('Case tray and edges','344551',.62)
    cream=make_material('Printed board game cardboard','ede6d6',.68)
    honey=make_material('Sled · varnished maple','9a6036',.50)
    walnut=make_material('Sled · aged bent hardwood','71472e',.53)
    burgundy=make_material('Sled · aged oxblood steel','603531',.45,.58)
    brass=make_material('Console sculpture · antique polished brass','b89952',.26,.78)
    bright=make_material('Console sculpture · gold points','d5ad65',.29,.66)
    def finish(B,name):
        o=B.finish(name,media.location,math.degrees(media.rotation_euler.z))
        for c in list(o.users_collection):c.objects.unlink(o)
        fitout.objects.link(o);return o
    def uv(rect,u,v):
        l,t,r,b=rect
        return ((l+(r-l)*u)/1024,1-(b-(b-t)*v)/800)
    def artwork(B,coords,rect,unit):
        B.face([B.vert(q)for q in coords],printmat,[uv(rect,u,v)for u,v in unit])
    frontuv=((0,0),(1,0),(1,1),(0,1))
    def jacket(B,x,y,z,w,d,h,base,face,top=None):
        B.cube((x,y,z+h/2),(w,d,h),base)
        yy=y-d/2-.0008
        artwork(B,[(x-w/2,yy,z),(x+w/2,yy,z),(x+w/2,yy,z+h),(x-w/2,yy,z+h)],face,frontuv)
        if top:
            zz=z+h+.0007
            artwork(B,[(x-w/2,y-d/2,zz),(x+w/2,y-d/2,zz),(x+w/2,y+d/2,zz),(x-w/2,y+d/2,zz)],top,frontuv)
    def cutout(B,x,y,base,w,h,outline,m,rect,thick):
        # The print exactly follows the cut timber silhouette rather than a square decal.
        back=[B.vert((x+(u-.5)*w,y+thick,base+v*h))for u,v in outline]
        front=[B.vert((x+(u-.5)*w,y,base+v*h))for u,v in outline]
        B.face(front,printmat,[uv(rect,u,v)for u,v in outline]);B.face(list(reversed(back)),m)
        for i,j in zip(range(len(front)),[*range(1,len(front)),0]):B.face([front[j],front[i],back[i],back[j]],m)
    B=Builder()
    for z,w,d,h in ((.105,1.58,.382,.041),(.323,1.49,.356,.028),(.606,1.61,.409,.038)):
        B.cube((0,-.002,z),(w,d,h),grain)
    for x in (-.753,0,.753):B.cube((x,.006,.354),(.035,.356,.471),grain)
    for x in (-.69,.69):B.cube((x,0,.048),(.108,.293,.094),grain)
    B.cube((0,-.177,.075),(1.49,.035,.048),grain)
    topz=.625
    # Media player, two remotes and the short cable drop visible at the TV edge.
    B.cube((-.612,-.025,topz+.019),(.217,.135,.038),black)
    B.cube((-.454,-.017,topz+.009),(.075,.031,.017),black,5)
    B.cube((.17,-.121,topz+.012),(.048,.113,.024),black,5)
    keymat=make_material('Remote keys · charcoal silver','808184',.63)
    for x in (-.011,0,.011):
        for j in range(5):B.cube((.17+x,-.122+j*.009,topz+.026),(.006,.005,.002),keymat)
    B.tube([(.355,.147,.856),(.347,.146,.808),(.332,.136,.761),(.291,.119,.690),(.273,.107,.632)],.0027,black,6)
    plaque=(4,4,384,268)
    # A dark cut edge and the actual bass/plaque artwork are visible past the mountain signs.
    shape=[(.20,.016),(.79,.016),(.84,.12),(.94,.22),(.974,.37),(.965,.66),(.92,.83),
           (.84,.85),(.78,.977),(.225,.96),(.19,.87),(.10,.81),(.07,.67),
           (.027,.61),(.026,.55),(.063,.507),(.080,.28),(.101,.18),(.165,.115)]
    cutout(B,-.022,.07,topz+.012,.325,.224,shape,blackrim,plaque,.026)
    # The same three printed mountain fronts as the source, independently stood on the tabletop.
    for i,(x,w,h,rect) in enumerate([(-.338,.135,.138,(390,4,540,164)),(-.016,.160,.143,(546,4,726,164)),(.257,.148,.141,(732,4,904,164))]):
        cutout(B,x,-.052+.003*i,topz,w,h,[(.035,.02),(.971,.02),(.50,.968)],signs,rect,.012)
    # Compound spherical body with rounded brass points, supported by the lower spikes.
    ctr=Vector((.575,.00,topz+.099))
    B.cube(ctr,(.103,.099,.104),brass,2)
    for i in range(16):
        v=Vector((math.cos(i*2.39996)*math.sqrt(1-((i+.5)/8-1)**2),
                  math.sin(i*2.39996)*math.sqrt(1-((i+.5)/8-1)**2),(i+.5)/8-1))
        B.beam(ctr+v*.028,ctr+v*(.108 if i%3==0 else .095),.024,brass if i%2 else bright,9,.001)
    # Each DVD case has a separate shell and its portion of the photographed spine row.
    dvd_rect=(4,275,1000,446)
    for i in range(25):
        w=.0221;x=.038+w/2+i*(w+.0019);h=.171+.009*math.sin(3.4*i)
        z=.338
        B.cube((x,.040,z+h/2),(w,.135,h),slate)
        y=.040-.135/2-.001;u0=i/25;u1=(i+1)/25
        artwork(B,[(x-w/2,y,z),(x+w/2,y,z),(x+w/2,y,z+h),(x-w/2,y,z+h)],dvd_rect,[(u0,0),(u1,0),(u1,1),(u0,1)])
    books=(515,665,991,753)
    for i in range(2):
        jacket(B,-.37+.009*i,-.07,.340+.009*i,.255,.15,.008,slate,books,books)
    jacket(B,-.481,-.033,.127,.424,.238,.100,slate,(4,450,444,549),(4,558,444,613))
    jacket(B,.360,-.029,.127,.433,.232,.048,cream,(5,661,508,715))
    jacket(B,.344,-.040,.177,.483,.268,.051,cream,(449,451,989,511),(449,519,990,654))
    console=finish(B,'Cabin | Dark media console with fish plaque, mountain trio, brass star and games')
    # Pull the carcass clear of the deep baseboard and the bunk-door casing.
    console.location += point(0,.15,0)-point(0,0,0)
    console['source']='Owner photograph L1040632. Photo-derived labels and carving, reconstructed cabinet dimensions.'
    # The original under-stair sled sits beside the cabinet with its curved bow toward the console.
    S=Builder()
    tail,front=-2.08,-.84
    for yy in (-.105,.075):
        runner=[(tail,yy,.017),(-1.70,yy,.017),(-1.19,yy,.017),(-1.085,yy,.026),(-1.008,yy,.049),
                (-.954,yy,.082),(-.900,yy,.130),(-.856,yy,.189),(-.838,yy,.235)]
        S.tube(runner,.0075,burgundy,8)
        for x in (-1.91,-1.57,-1.25):
            S.tube([(x-.033,yy,.022),(x+.01,yy,.103),(x+.012,yy,.153),(x+.051,yy,.182)],.009,burgundy,7)
    for x in (-1.91,-1.58,-1.24):
        S.cube((x,-.015,.167),(.040,.31,.022),walnut)
    for i in range(5):
        y=-.155+i*.070;end=-1.11+.036*(2-abs(2-i));beg=tail+.009*abs(2-i)
        # Chamfered front tips and small dark steel heads on the seat boards.
        poly=[(beg,y-.028),(end-.032,y-.028),(end,y-.017),(end,y+.017),(end-.032,y+.028),(beg,y+.028)]
        S.slab(poly,.174,.191,honey if i%2==0 else walnut)
        for x in (-1.90,-1.27):S.beam((x,y,.190),(x,y,.193),.003,burgundy,6)
    for y in (-.154,.125):
        S.tube([(-1.17,y,.172),(-1.074,y,.183),(-1.00,y,.206),(-.949,y,.236),(-.915,y,.269)],.010,walnut,8)
    S.beam((-.949,-.197,.216),(-.949,.161,.249),.018,walnut,9)
    S.tube([(-.916,-.103,.23),(-.866,-.104,.246),(-.833,-.029,.248),(-.876,.074,.224)],.0035,blackrim,6)
    sled=finish(S,'Cabin | Vintage slatted maple sled with curled iron runners')
    sled['source']='Owner photograph L1040632. Vintage runner sled tucked beneath the lift of the stairs.'
    prev=bpy.data.objects.get('WalkBlock_MediaConsole')
    if prev:bpy.data.objects.remove(prev,do_unlink=True)
    for label,x0,x1,y0,y1,h in [('MediaConsole',4.99,10.25,15.40,16.75,.647),('RunnerSled',10.36,14.46,15.38,16.60,.283)]:
        o=box('WalkBlock_'+label,x0,x1,y0,y1,main+.018,main+h,None,fitout)
        o.hide_render=True;o.display_type='WIRE'
media_details()
