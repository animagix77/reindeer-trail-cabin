"""Finish the two front courts on the terrain and cut out the timber and gravel paths."""
def pave_frontage(vertices,faces,materials,local_xy,half_plane,usable,ground,walk_cuts):
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
    beds=[ellipse(-32,-8,2.05,1.89),ellipse(10.5,-16.2,1.55,1.45),ellipse(gate_right+.38,roadside_line(gate_right)+1.81,1.52,1.43),
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
    result=[];ids=[]
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
            for part in pieces:
                start=len(vertices)
                vertices.extend(pos(x,y,ground(x,y)) for x,y,_ in part)
                result.append(tuple(range(start,len(vertices))));ids.append(material)
    return result,ids
