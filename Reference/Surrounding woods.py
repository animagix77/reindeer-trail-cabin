"""Walk-only local context. Origin and source URLs are in terrain-provenance.json
and lidar-provenance.json. Heights use the full 300 m USGS/NYS horizontal extent.
Crown centers are thinned peaks of 2018 unclassified laser returns above the DEM,
masked to omit the tax parcel, state building footprints, and county roads.
Tree forms, species, and seasonal appearance are illustrative.
"""

def build_neighboring_homes(group, records, terrain):
    from mathutils.bvhtree import BVHTree

    # The visible local grading and the outer DEM mesh meet at a stitched edge.
    terrain_trees = [BVHTree.FromPolygons([v.co for v in obj.data.vertices],
                    [p.vertices[:] for p in obj.data.polygons]) for obj in terrain]
    def ground_height(p):
        for tree in terrain_trees:
            hit = tree.ray_cast((p.x, p.y, 80), (0, 0, -1))[0]
            if hit is not None:
                return hit.z
        raise ValueError(f'Neighboring footprint lies beyond the terrain at {p}')

    # One flat-shaded surface per house. Corner colors group walls, roof and
    # plinth into a single draw without loading any more textures.
    finish = mat('Backdrop_Neighboring homes', '#ffffff', rough=.94)
    tree = finish.node_tree
    color = tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Exterior colors'
    tree.links.new(color.outputs['Color'], tree.nodes.get('Principled BSDF').inputs['Base Color'])
    walls = [(120, 112, 94), (112, 118, 103), (129, 117, 102), (101, 105, 101)]
    roofs = [(74, 73, 70), (78, 79, 78), (86, 77, 68)]

    for house in records:
        ring = [Vector(p) for p in house['ring']]
        if sum(a.cross(b) for a,b in zip(ring, ring[1:]+ring[:1])) < 0:
            ring.reverse()
        edges = list(zip(ring, ring[1:]+ring[:1]))
        # Run the illustrative ridge along the long axis of the footprint.
        ridge_direction = max((b-a for a,b in edges), key=lambda v: v.length_squared).normalized()
        across = Vector((-ridge_direction.y, ridge_direction.x))
        projections = [p.dot(across) for p in ring]
        ridge = (min(projections) + max(projections)) * .5
        half_width = (max(projections) - min(projections)) * .5
        grade = [ground_height(p) for a,b in edges for p in (a, (a+b)*.5)]
        floor = max(grade) + .12
        eave = floor + 2.58
        rise = min(2.4, half_width*.48)
        def roof_z(p):
            return eave + rise * (1 - abs(p.dot(across)-ridge) / half_width)

        points, faces, tones = [], [], []
        def face(coords, tone):
            offset = len(points)
            points.extend(coords)
            faces.append(tuple(range(offset, len(points))))
            tones.append(tone)

        def at_height(a, b, low_a, low_b, high_a, high_b, tone):
            face([(*a,low_a), (*b,low_b), (*b,high_b), (*a,high_a)], tone)

        roof = roofs[house['id'] % len(roofs)]
        wall = walls[house['id'] % len(walls)]
        for a,b in edges:
            d0,d1 = a.dot(across)-ridge,b.dot(across)-ridge
            mid = [a.lerp(b,d0/(d0-d1))] if d0*d1 < 0 else []
            for p,q in zip([a]+mid,mid+[b]):
                at_height(p,q,min(grade)-.20,min(grade)-.20,floor,floor,(88,86,79))
                at_height(p,q,floor,floor,roof_z(p),roof_z(q),wall)
                at_height(p,q,roof_z(p),roof_z(q),roof_z(p)+.14,roof_z(q)+.14,roof)
            # Two flat panes on broad faces make the distant masses legible as homes.
            if (b-a).length < 5.5:
                continue
            along = (b-a).normalized()
            outward = Vector((along.y,-along.x)) * .018
            for station in (.29,.71):
                center = a.lerp(b,station) + outward
                at_height(center-along*.56, center+along*.56, floor+.85, floor+.85,
                          floor+1.85, floor+1.85, (63,73,72))

        # Split each plan triangle at the ridge before lifting it. This keeps
        # the gable planar and respects the small returns of L-shaped homes.
        for tri in tessellate_polygon([[p.to_3d() for p in ring]]):
            triangle = [ring[i] for i in tri]
            for side in (-1,1):
                panel = []
                for a,b in zip(triangle, triangle[1:]+triangle[:1]):
                    d0,d1 = (a.dot(across)-ridge)*side,(b.dot(across)-ridge)*side
                    if d0 >= 0:
                        panel.append(a)
                    if d0*d1 < 0:
                        panel.append(a.lerp(b,d0/(d0-d1)))
                if len(panel) >= 3:
                    face([(*p,roof_z(p)+.14) for p in panel], roof)
        obj = mesh('Backdrop_Neighbor_'+str(house['id']),points,faces,finish,group)
        attr = obj.data.color_attributes.new(name=color.layer_name,type='BYTE_COLOR',domain='CORNER')
        for polygon, tone in zip(obj.data.polygons,tones):
            rgba = (*[v/255 for v in tone], 1)
            for i in polygon.loop_indices:
                attr.data[i].color_srgb = rgba

def build_surrounding_woods():
    import random
    import numpy as np
    c = coll('Backdrop_Woodland context · walking views')
    folder = work / 'Woodland context'
    measures = json.loads((folder / 'Woodland canopy.json').read_text())
    summer = json.loads((folder / 'Summer vegetation.json').read_text())
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
    homes = json.loads((folder / 'Neighboring homes.json').read_text())
    if homes['origin'] != [OX,OY]:
        raise ValueError('Neighboring footprints use a different horizontal origin')
    build_neighboring_homes(c, homes['homes'], [site_land, land])

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
    # Each 10 m Sentinel-2 sample measures mixed canopy and ground cover.
    # Thin only the existing off-parcel regrowth candidates in less green cells.
    # Missing observations leave the lidar interpretation intact.
    sample_grid = summer['values']
    density_rng = random.Random(20250603)
    regrowth = []
    for record in measures['understory']:
        x, y = record[:2]
        col = math.floor((OX+x-summer['west'])/summer['cell'])
        row = math.floor((summer['north']-OY-y)/summer['cell'])
        keep = 1.
        if 0 <= row < len(sample_grid) and 0 <= col < len(sample_grid[row]):
            ndvi = sample_grid[row][col]
            if ndvi != summer['nodata']:
                keep = max(.18, min(1., (ndvi-35)/48))
        if density_rng.random() < keep:
            regrowth.append(record)
    low = trees(regrowth,'Low woodland regrowth',True)
    low['basis'] = 'Off-parcel lidar candidates, thinned using 10 m Sentinel-2 vegetation index from 2025-06-03. Individual understory locations are illustrative.'
    low['lidar_candidates'] = len(measures['understory'])
    low['retained_candidates'] = len(regrowth)
    return c

context_extra = build_surrounding_woods()
