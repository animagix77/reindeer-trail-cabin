"""Tie the front cross gable into the surveyed roof planes (L1040560 and L1040561)."""
def build_entry_junction():
    left, peak, right = 27.9, 31.0, 34.1
    eave, nose = -.8, -1.32
    crown=entry_rake_z
    def valley_y(x):
        return eave+(crown(x)-pz(0,x,eave))/(pz(0,x,1)-pz(0,x,0))
    def face(label,points,material,collection):
        return mesh(label,[pos(*p) for p in points],[tuple(range(len(points)))],material,collection)
    def strip(label,a,b,thickness,material,collection):
        return face(label,[a,b,(b[0],b[1],b[2]-thickness),(a[0],a[1],a[2]-thickness)],material,collection)
    # The original north roof and fascia ran straight through the open front
    # door. The two valleys now share vertices with the replacement host panels.
    for old in ('Roof · North wing 3','Roof fascia · North 3'):
        bpy.data.objects.remove(bpy.data.objects[old],do_unlink=True)
    stations=(22,left,peak,right,41.8)
    for x0,x1 in zip(stations,stations[1:]):
        upper0,upper1=ridge(x0,2),ridge(x1,2)
        lower0=valley_y(x0) if left<=x0<=right else eave
        lower1=valley_y(x1) if left<=x1<=right else eave
        plan=[(x0,lower0),(x1,lower1),(x1,upper1),(x0,upper0)]
        face('Roof · north pitch to entry valleys',[(x,y,pz(0,x,y)) for x,y in plan],shingle,roof)
    for x0,x1 in ((22,left),(right,41.8)):
        strip('Roof · front eave fascia',(x0,eave,pz(0,x0,eave)),(x1,eave,pz(0,x1,eave)),.115,trim,roof)
    for x0,x1 in ((left,peak),(peak,right)):
        face('Roof · entry cross gable shingles',
             [(x0,nose,crown(x0)),(x1,nose,crown(x1)),(x1,valley_y(x1),crown(x1)),(x0,valley_y(x0),crown(x0))],shingle,roof)
        strip('Roof · white entry rake',(x0,nose,crown(x0)),(x1,nose,crown(x1)),.095,trim,roof)
        # The ceiling of the overhang returns to the front wall along the rake.
        face('Roof · white entry soffit',[(x0,nose,crown(x0)-.095),(x1,nose,crown(x1)-.095),
             (x1,min(0,valley_y(x1)),crown(x1)-.095),(x0,min(0,valley_y(x0)),crown(x0)-.095)],trim,roof)
    # Rebuild the gable end on the actual wall plane, continuing the cedar
    # shingles around the tall door. End the new wall at the original wall head.
    cedar=bpy.data.materials['Entry wing · blue cedar shakes']
    intersections=[peak+(edge-peak)*(rise-(pz(0,peak,0)-pz(0,peak,eave)))/rise for edge in (left,right)]
    for x0,x1 in zip([intersections[0],29.48,peak,32.52],[29.48,peak,32.52,intersections[1]]):
        base=lambda x: max(pz(0,x,0)-.045, main+2.05) if 29.48<=(x0+x1)/2<=32.52 else pz(0,x,0)-.045
        face('Entry wall · continuous cedar gable',[(x0,0,base(x0)),(x1,0,base(x1)),
             (x1,0,crown(x1)-.025),(x0,0,crown(x0)-.025)],cedar,structure)
    # The painted reveal and exterior casing surround the open burgundy door.
    jamb_left,jamb_right=29.48,32.52
    for x in (jamb_left-.095,jamb_right+.095):
        box('Entry door · painted jamb casing',x-.095,x+.095,-.117,-.018,main,main+2.05,trim,structure)
    box('Entry door · painted head casing',jamb_left-.19,jamb_right+.19,-.117,-.018,main+2.05,main+2.108,trim,structure)
    # The existing exterior already encloses the slab perimeter. Model its two
    # horizontal faces only, including along the concave stepped wall return.
    slab_obj=bpy.data.objects['Appraisal main floor · 1063 ft²']
    bm=bmesh.new()
    bm.from_mesh(slab_obj.data)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if abs(f.normal.z)<.05],context='FACES')
    bm.to_mesh(slab_obj.data)
    bm.free()
    # Cutting window openings rebuilds polygons, invalidating the initial UV
    # loops. Project the final polygons in the same metric frame on every side.
    for obj in [*structure.objects,*roof.objects]:
        if obj.type!='MESH' or not obj.data.materials:continue
        material=obj.data.materials[0]
        if material not in (cedar,shingle,foundation):continue
        me=obj.data
        uv=me.uv_layers.active or me.uv_layers.new(name='Exterior metres')
        for polygon in me.polygons:
            coords=[local(me.vertices[me.loops[i].vertex_index].co) for i in polygon.loop_indices]
            width=max(v[0] for v in coords)-min(v[0] for v in coords)
            depth=max(v[1] for v in coords)-min(v[1] for v in coords)
            for i,(x,y,h) in zip(polygon.loop_indices,coords):
                if material==shingle: value=(x*ft/1.63,y*ft/1.55)
                else:
                    repeat=1.14 if material==cedar else 1.65
                    value=((x if width>depth else y)*ft/repeat,h/repeat)
                uv.data[i].uv=value

build_entry_junction()
