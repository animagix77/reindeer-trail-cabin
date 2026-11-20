"""Walk-only local context. Origin and source URLs are in terrain-provenance.json
and lidar-provenance.json. Heights use the full 300 m USGS/NYS horizontal extent.
Crown centers are thinned peaks of 2018 unclassified laser returns above the DEM,
masked to omit the tax parcel, state building footprints, and county roads.
Tree forms, species, and seasonal appearance are illustrative.
"""

def build_surrounding_woods():
    import random
    import numpy as np
    c = coll('Backdrop_Woodland context · walking views')
    folder = work / 'Woodland context'
    measures = json.loads((folder / 'Woodland canopy.json').read_text())
    with np.load(folder / 'Woodland heights.npz') as heights:
        grid = heights['cm'].astype('f4') / 100

    def elevation(x, y):
        # Pixel centers, UTM offsets from cabin scene origin.
        i = min(298.9999, max(0., x + 148.5))
        j = min(298.9999, max(0., 149.5 - y))
        ix, iy = int(i), int(j)
        u, v = i - ix, j - iy
        return float((1-v)*((1-u)*grid[iy, ix]+u*grid[iy, ix+1])
                   + v*((1-u)*grid[iy+1, ix]+u*grid[iy+1, ix+1]))

    def photo_material(name, filename, cutout=False):
        material = mat('Backdrop_' + name, '#838975', rough=.96)
        material.use_backface_culling = False
        nt = material.node_tree
        bs = nt.nodes.get('Principled BSDF')
        texture = nt.nodes.new('ShaderNodeTexImage')
        texture.image = bpy.data.images.load(str(folder / filename), check_existing=True)
        texture.image.pack()
        nt.links.new(texture.outputs['Color'], bs.inputs['Base Color'])
        if cutout:
            # Export as glTF MASK to retain fine leaves without layer-sorting issues.
            clip = nt.nodes.new('ShaderNodeMath')
            clip.operation = 'GREATER_THAN'
            clip.inputs[1].default_value = .31
            nt.links.new(texture.outputs['Alpha'], clip.inputs[0])
            nt.links.new(clip.outputs[0], bs.inputs['Alpha'])
            bs.inputs['Specular IOR Level'].default_value = .10
            nt.links.new(texture.outputs['Color'], bs.inputs['Emission Color'])
            bs.inputs['Emission Strength'].default_value = .20
        return material

    terrain_material = photo_material('Woodland floor, toned state ortho', 'Woodland terrain.jpg')
    leaves = photo_material('Hardwood cutouts', 'Hardwood silhouettes.png', True)
    ix0, ix1 = xmin-OX, xmax-OX
    iy0, iy1 = ymin-OY, ymax-OY
    # Four narrow transition strips connect the fine local patch perimeter to
    # the coarser outer grid, with no surface under the existing site.
    ax, bx, ay, by = ix0-3, ix1+3, iy0-3, iy1+3
    def knots(start, end, lo, hi):
        return sorted(set([start, end, lo, hi] + list(range(start, end, 3))))
    xs = knots(-149, 151, ax, bx)
    ys = knots(-150, 150, ay, by)
    vertices = []
    faces = []
    cache = {}
    def vertex(x, y, z=None):
        key = (round(x, 5), round(y, 5))
        if key not in cache:
            cache[key] = len(vertices)
            vertices.append((x, y, elevation(x,y) if z is None else z))
        return cache[key]
    def face(ids):
        pts = [vertices[i] for i in ids]
        if sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(pts, pts[1:]+pts[:1]))<0:
            ids = list(reversed(ids))
        faces.append(ids)
    for y0,y1 in zip(ys,ys[1:]):
        for x0,x1 in zip(xs,xs[1:]):
            if ax<=x0 and x1<=bx and ay<=y0 and y1<=by:
                continue
            face([vertex(x0,y0),vertex(x1,y0),vertex(x1,y1),vertex(x0,y1)])

    site_land = next(obj for obj in site_extra.objects if obj.name.startswith('Wooded terrain'))
    # Retrieve only primary grid vertices that survive at the border.
    border = [tuple(v.co) for v in site_land.data.vertices
              if min(abs(v.co.x-ix0),abs(v.co.x-ix1),abs(v.co.y-iy0),abs(v.co.y-iy1))<.00005]
    for axis, inner, outer, u0, u1, span in (
        (0,ix0,ax,ay,by,ys),(0,ix1,bx,ay,by,ys),
        (1,iy0,ay,ax,bx,xs),(1,iy1,by,ax,bx,xs)):
        inside = sorted((p for p in border if abs(p[axis]-inner)<.00005),
                        key=lambda p:p[1-axis])
        outside = [((outer,v) if axis==0 else (v,outer)) for v in span if u0<=v<=u1]
        in_ids = [vertex(*p) for p in inside]
        out_ids = [vertex(*p) for p in outside]
        i,j = 0,0
        # Progress by normalized distance on each concentric edge to form
        # corner-to-corner strips, without overlaps at their four diagonal seams.
        while i+1<len(in_ids) or j+1<len(out_ids):
            if j+1 == len(out_ids) or (i+1 < len(in_ids) and (i+1)/(len(in_ids)-1)<=(j+1)/(len(out_ids)-1)):
                face([in_ids[i],in_ids[i+1],out_ids[j]]);i+=1
            else:
                face([in_ids[i],out_ids[j+1],out_ids[j]]);j+=1
    land = mesh('Backdrop_Woodland terrain',vertices,faces,terrain_material,c)
    uv = land.data.uv_layers.new(name='State orthophoto')
    for lp in land.data.loops:
        x,y,z = vertices[lp.vertex_index]
        uv.data[lp.index].uv = ((x+149)/300,(y+150)/300)
    for polyface in land.data.polygons:
        polyface.use_smooth = True
    land['basis'] = 'USGS 1 m DEM, resampled to 3 m beyond site, 2021 NY orthophoto with subdued leaf-off colors.'

    def trees(records, name, small=False):
        vert, polygons, coords = [], [], []
        rng = random.Random(946 if small else 421)
        for x,y,height,width_ratio,variant in records:
            z = elevation(x,y)-.055
            # Crossed vertical silhouettes keep crowns three-dimensional from
            # different walking directions. Higher-detail foreground uses three.
            angle = rng.random()*math.pi
            panels = 3 if x*x+y*y<55**2 and not small else 2
            for n in range(panels):
                theta = angle + n*math.pi/panels
                r = .5*height*width_ratio*rng.uniform(.90,1.04)
                dx,dy = r*math.cos(theta),r*math.sin(theta)
                k = len(vert)
                vert.extend(((x-dx,y-dy,z), (x+dx,y+dy,z),
                             (x+dx,y+dy,z+height), (x-dx,y-dy,z+height)))
                polygons.append((k,k+1,k+2,k+3))
                cell = variant if n==0 else (variant+n)%3
                a,b = (cell+.002)/3,(cell+.998)/3
                if rng.random()<.5:a,b=b,a
                coords.extend(((a,0),(b,0),(b,1),(a,1)))
        obj = mesh('Backdrop_'+name,vert,polygons,leaves,c)
        uv = obj.data.uv_layers.new(name='Seasonal silhouettes')
        for lp in obj.data.loops:
            uv.data[lp.index].uv = coords[lp.vertex_index]
        obj['basis'] = 'Thinned peaks from 2018 airborne returns outside mapped parcel, roads, and buildings. Positions approximate.'
        return obj
    trees(measures['crowns'],'Mixed hardwood crowns')
    trees(measures['understory'],'Low woodland regrowth',True)
    return c

context_extra = build_surrounding_woods()
