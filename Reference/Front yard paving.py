"""Finish the two front courts on the terrain and cut out the timber and gravel paths."""
def pave_frontage(vertices,faces,materials,local_xy,half_plane,usable,ground,walk_cuts,well_head):
    # Tree shadows obscure the downhill edge in the six-inch aerial. Blend the
    # estimated garage court into the flared roadside opening visible from ground level.
    garage=[(-30.9,-25.3),(-2.4,-25.3),(.48,-8),(.48,29.4),(-4,32.4),(-24,32.4),(-30.9,29)]
    throat=[(-31.55,-25.7),(-1.05,-25.55),(-2.45,-17.95),(-30.25,-17.8)]
    # The sharp pale/gray seam follows the 2025 state six-inch orthophoto.
    seam_south=(25.25,-18.67);seam_north=(25.04,-1.88)
    light=[(-.70,-11.4),(8.55,-17.65),(18.2,-19.00),seam_south,seam_north,
           (7.1,-1.15),(-.70,-3.8)]
    gray=[seam_south,(40.25,-16.7),(40.15,-3.35),(37.0,-1.36),seam_north]
    # The Street View entrance is poured concrete between a free-standing left
    # pier and the uphill wall. Leave the narrow verge in front of the masonry.
    gate=[(gate_left+.64,roadside_line(gate_left)-1.10),
          (gate_right-.64,roadside_line(gate_right)-1.10),
          (gate_right+1.1,-16.2),(gate_left-.7,-16.2)]
    def ellipse(x,y,rx,ry):
        return [(x+rx*math.cos(k*math.tau/20),y+ry*math.sin(k*math.tau/20)) for k in range(20)]
    # L1040557 and 0561 show soil around the well on the house side of the treads.
    wx,wy=well_head
    well_soil=[(-.70,2.7),(-.70,-5.69),(wx+.52,wy-1.14),
              (wx+1.83,wy-.40),(wx+4.55,wy+3.40),(wx+4.62,wy+4.8)]
    beds=[well_soil,ellipse(-32,-8,2.05,1.89),ellipse(10.5,-16.2,1.55,1.45),ellipse(gate_right+.38,roadside_line(gate_right)+1.81,1.52,1.43),
          ellipse(40.1,-11.0,4.70,3.43)]
    def bounds(points):
        return min(v[0] for v in points),max(v[0] for v in points),min(v[1] for v in points),max(v[1] for v in points)
    def overlaps(a,b):
        return a[0]<b[1] and b[0]<a[1] and a[2]<b[3] and b[2]<a[3]
    def split(poly,outline):
        rest=[];inside=poly
        for a,b in zip(outline,outline[1:]+outline[:1]):
            def side(p):
                return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
            d=[side(p) for p in inside]
            if max(d)<1e-8:return [poly],None
            if min(d)>=-1e-8:continue
            outside=half_plane(inside,lambda p:-side(p))
            if usable(outside):rest.append(outside)
            inside=half_plane(inside,side)
            if not usable(inside):return [poly],None
        return rest,inside
    # First disposition wins. Walk and stair finishes replace the terrain;
    # soil, concrete and asphalt are materials on one continuous surface.
    zones=[(outline,None) for outline in walk_cuts]+[(bed,0) for bed in beds]
    zones.extend(((gate,5),(light,5),(gray,6),(garage,4),(throat,4)))
    outlines=[(ring,finish,bounds(ring)) for ring,finish in zones]
    result=[];ids=[];patches=[]
    for face,finish in zip(faces,materials):
        source=[vertices[k] for k in face]
        pts=[(*local_xy(p[0]+OX,p[1]+OY),p[2]+OZ) for p in source]
        area=bounds(pts)
        if finish==3 or not overlaps(area,(-33,47,-27,35)):
            result.append(face);ids.append(finish);continue
        cx=(area[0]+area[1])*.5;cy=(area[2]+area[3])*.5
        if -.7<cx<47 and roadside_line(cx)+.7<cy<3 and finish==1:finish=0
        groups=[pts];done=[]
        for ring,material,bb in outlines:
            if not overlaps(area,bb):continue
            unpainted=[]
            for poly in groups:
                outside,patch=split(poly,ring)
                unpainted.extend(outside)
                if patch and material is not None:done.append((patch,material))
            groups=unpainted
            if not groups:break
        for poly,material in done+[(p,finish) for p in groups]:
            # Partition grade breaks inside the half-foot retainer thickness.
            # This prevents terrain triangles from bridging the two terraces.
            pieces=[poly]
            if area[0]<-.38 and area[1]>-1.05 and area[2]<3.2 and area[3]>-14.6:
                for xcut in (-1.05,-.38):
                    divided=[]
                    for part in pieces:
                        if min(p[0] for p in part)<xcut<max(p[0] for p in part):
                            for sign in (-1,1):
                                pp=half_plane(part,lambda p:sign*(p[0]-xcut))
                                if usable(pp):divided.append(pp)
                        else:divided.append(part)
                    pieces=divided
            patches.extend((part,material) for part in pieces)
    # Material cuts introduce vertices midway down neighbouring edges. On
    # sloping grades those points must belong to BOTH faces, or eye-level
    # views see daylight through the mismatched edges beside the steps.
    grid={};index={}
    def vertex(x,y):
        key=(round(x,6),round(y,6))
        if key not in index:
            idx=len(vertices);index[key]=idx
            vertices.append(pos(x,y,ground(x,y)))
            grid.setdefault((math.floor(x),math.floor(y)),[]).append((x,y,idx))
        return index[key]
    for part,_ in patches:
        for x,y,_ in part:vertex(x,y)
    for part,material in patches:
        ring=[];divided=False
        for a,b in zip(part,part[1:]+part[:1]):
            ax,ay=a[:2];bx,by=b[:2]
            dx=bx-ax;dy=by-ay;length2=dx*dx+dy*dy
            if length2<1e-12:continue
            along=[]
            for ix in range(math.floor(min(ax,bx)-1e-6),math.floor(max(ax,bx)+1e-6)+1):
                for iy in range(math.floor(min(ay,by)-1e-6),math.floor(max(ay,by)+1e-6)+1):
                    for x,y,idx in grid.get((ix,iy),()):
                        t=((x-ax)*dx+(y-ay)*dy)/length2
                        cross=(x-ax)*dy-(y-ay)*dx
                        if 1e-6<t<1-1e-6 and cross*cross<1e-12*length2:along.append((t,idx))
            ring.append(vertex(ax,ay))
            if along:
                divided=True;ring.extend(idx for _,idx in sorted(along))
        unique=list(dict.fromkeys(ring))
        if len(unique)<3:continue
        if divided:
            # A fan preserves every short boundary segment during GLB export.
            middle=len(vertices)
            vertices.append(tuple(sum(vertices[i][axis] for i in unique)/len(unique) for axis in (0,1,2)))
            for a,b in zip(unique,unique[1:]+unique[:1]):
                result.append((a,b,middle));ids.append(material)
        else:
            result.append(tuple(unique));ids.append(material)
    return result,ids
