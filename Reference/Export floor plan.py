"""Build the small, roof-off website exhibit from the furnished walkthrough GLB.

    python "Reference/Export floor plan.py"

Requires numpy, Pillow, Node and the walkthrough’s installed npm dependencies. The input stays untouched. Geometry is batched in
its original Y-up metre frame. The section cut removes the upper walls along
with the roof, so even the small bedrooms can be seen from a three-quarter view.
"""
import io
import json
from pathlib import Path
import struct
import subprocess
from collections import defaultdict

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CUT_Y = 2.88 + 1.37
GRID = 0.0005
TYPES = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}
DIMENSIONS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def open_scene(path):
    with path.open('rb') as file:
        signature, version, _ = struct.unpack('<4sII', file.read(12))
        assert signature == b'glTF' and version == 2
        length, kind = struct.unpack('<I4s', file.read(8))
        assert kind == b'JSON'
        data = json.loads(file.read(length))
        length, kind = struct.unpack('<I4s', file.read(8))
        assert kind == b'BIN\0'
        return data, file.read(length)


source, binary = open_scene(ROOT / 'Reindeer Trail.glb')


def accessor(index):
    item = source['accessors'][index]
    view = source['bufferViews'][item['bufferView']]
    dtype = np.dtype(TYPES[item['componentType']])
    dimension = DIMENSIONS[item['type']]
    offset = view.get('byteOffset', 0) + item.get('byteOffset', 0)
    return np.ndarray((item['count'], dimension), dtype=dtype, buffer=binary, offset=offset,
                      strides=(view.get('byteStride', dimension * dtype.itemsize), dtype.itemsize))


def transform(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    result = np.eye(4)
    result[:3, :3] = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag(node.get('scale', (1, 1, 1)))
    result[:3, 3] = node.get('translation', (0, 0, 0))
    return result


def instances(index, parent):
    node = source['nodes'][index]
    matrix = parent @ transform(node)
    if 'mesh' in node:
        yield node, matrix
    for child in node.get('children', []):
        yield from instances(child, matrix)


# Select architecture and furnished spaces, leaving terrain, render rig,
# collision meshes and utility rooms below the closed main floor in the tour.
SHELL = ('Exterior · wall', 'Entry wall', 'Entry door', 'Primary front', 'Blue lap siding',
         'Downspout', 'Rainwater', 'White trim', 'Bunk room | three', 'Interior perimeter',
         'Bedroom gable', 'East · picture', 'East wall', 'South · casement', 'West kitchen',
         'Living room · stair wall', 'Living room · curtained wall', 'Living room · hearth return',
         'Living room · gathered', 'Window · curtain', 'Rear patio slider', 'Bunk room ·',
         'Bunk room opening', 'Bunk three-sash', 'Bunk and primary', 'Full bedroom', 'Bathroom to ',
         'Bathroom front', 'Bathroom sliding', 'Bathroom | painted wall', 'Bathroom ·', 'Bath offset',
         'Primary bedroom barn', 'Primary bedroom rear', 'Primary side', 'Front hall · straight',
         'Front hall · plaster lintel', 'Main bedroom rear', 'Kitchen · pine gable', 'Tree alcove',
         'Master paired sash', 'Master · open', 'Barn door gable', 'Dining nook', 'Foyer and front room',
         'Dining · painted', 'Kitchen | knotty pine', 'FrontDoorHinge', 'FrontScreenHinge')
KEEP = ('Appraisal main floor', 'Baseboard', 'Bedside floor', 'Pine entry', 'Pine in kitchen',
        'Primary pine', 'Entry hall', 'Entry runner', 'Entry · cedar', 'Front landing', 'Foundation ·',
        'Garage bay', 'Garage gable', 'Garage · center', 'Front basement window', 'Rear basement window',
        'Street number', 'Rear covered deck', 'Rear deck · timber', 'Covered deck ·', 'Porch · deck boards',
        'Deck firewood rack', 'Barbecue ·', 'Stair ·', 'Cabin |', 'Living room · floor',
        'Front bedroom |', 'Main bedroom |', 'Bathroom |', 'Kitchen |', 'Dining |', 'Front hall |',
        'Living room · pedestal', 'Christmas tree |', 'Bunk bedroom by', 'Bunk bedside',
        'Dining · silver floor', 'Master · river', 'Master bedroom · inscribed', 'Front hall · lake',
        'Front hall · cabin', 'Front hall · Be Our Guest', 'Front bedroom · birchwood',
        'Front bedroom pine', 'Television ·', 'FrontDoor', 'FrontScreen')
OMIT = ('ceiling', 'soffit below loft', 'vertical grain in mirror', 'Barbecue · heat tray',
        'Barbecue · grate crossbar', 'Barbecue · seasoned iron grate', 'Barbecue · burner heat tent')
CAP_WALL = ('Exterior · wall', 'Interior perimeter', 'Bunk and primary', 'Full bedroom and',
            'Full bedroom to', 'Bathroom to entry', 'Bathroom sliding entry', 'Bathroom front',
            'Front hall · straight wall', 'Main bedroom rear', 'Primary side', 'Primary bedroom barn',
            'Primary bedroom rear', 'Living room · stair wall', 'Tree alcove', 'Bunk room wall')


def group_for(name):
    if any(term.casefold() in name.casefold() for term in OMIT):
        return None
    if name.startswith(('Roof ·', 'Roof fascia', 'Roof gable', 'Skylight ·', 'Gutter ·', 'Rainwater downspout', 'Downspout ·')):
        return 'Roof'
    if name.startswith(('Loft |', 'Loft ·')):
        return 'Loft' if not any(t in name for t in ('cedar lining', 'gable-end', 'ridge timber', 'gable window')) else None
    if name.startswith(SHELL):
        return 'Cut'
    if name.startswith(KEEP):
        return 'Main'
    return None


# Use one vertex-coloured primitive for all plain finishes and retain the
# most recognizable photographic finishes as small, self-contained textures.
TEXTURED = ('Floor · photograph', 'Living · gray boards', 'Room fabric | Bunk', 'Room fabric | Sea-glass',
            'Master · large woven', 'Master · floral shams', 'Dining · navy and red', 'Master · weathered',
            'Front bedroom · double buffalo', 'Room detail | Island · patterned', 'Loft quilt', 'Asphalt shingle',
            'Barn doors · photographed', 'Room detail | Kitchen gable', 'Painted block', 'Entry wing · blue',
            'Porch · natural', 'Room detail | Entry hall · charcoal', 'Room detail | Christmas · fir needles')
images = {}


def image_from_texture(index):
    if index not in images:
        item = source['images'][source['textures'][index]['source']]
        view = source['bufferViews'][item['bufferView']]
        offset = view.get('byteOffset', 0)
        with Image.open(io.BytesIO(binary[offset:offset + view['byteLength']])) as image:
            image.thumbnail((192, 192), Image.Resampling.LANCZOS)
            images[index] = image.convert('RGBA')
    return images[index]


def srgb_to_linear(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)


def finish(index):
    mat = source['materials'][index]
    pbr = mat.get('pbrMetallicRoughness', {})
    factor = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1]), dtype=float)
    tex = pbr.get('baseColorTexture', {}).get('index')
    name = mat['name']
    if tex is not None:
        image = image_from_texture(tex)
        if name.startswith(TEXTURED):
            return ('texture', index), factor
        # Ignore invisible texels when averaging a cutout, e.g. patterned curtains.
        rgba = np.asarray(image) / 255
        weights = rgba[:, :, 3:4]
        factor[:3] *= (srgb_to_linear(rgba[:, :, :3]) * weights).sum(axis=(0, 1)) / max(1, weights.sum())
    if (mat.get('alphaMode') == 'BLEND' or 'clear glazing' in name.casefold()
            or 'thin clear glass' in name.casefold() or 'frameless shower' in name.casefold()):
        factor[:3] = [.55, .74, .76]
        factor[3] = .25
        return ('glass', 0), factor
    factor[3] = 1
    return ('solid', 0), factor


palette = {}


def add(batch, points, indices, color):
    if not len(indices):
        return
    # Compact fixed-point positions and normals meet glTF's mesh quantization rules.
    # Welding by position, normal, UV and colour retains material seams at the cut.
    records = np.empty(len(points), dtype=[('p', '<i2', 3), ('n', 'i1', 3), ('c', 'u1', 4), ('uv', '<f2', 2)])
    assert np.abs(points[:, :3]).max() < 32767 * GRID
    records['p'] = np.rint(points[:, :3] / GRID)
    normal = points[:, 3:6]
    records['n'] = np.rint(normal / np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-8) * 127)
    records['c'] = np.rint(np.clip(color, 0, 1) * 255)
    records['uv'] = points[:, 6:8] if batch[1][0] == 'texture' else 0
    batches[batch].append(records[indices].reshape(-1))


def split(tri, keep_below):
    """Clip a crossing triangle and interpolate its normal and UV on the plane."""
    polygon = []
    hits = []
    for previous, point in zip(np.roll(tri, 1, axis=0), tri):
        prev_in = (previous[1] <= CUT_Y) == keep_below
        next_in = (point[1] <= CUT_Y) == keep_below
        if prev_in != next_in:
            cross = previous + (point - previous) * ((CUT_Y - previous[1]) / (point[1] - previous[1]))
            polygon.append(cross)
            hits.append(cross[:3])
        if next_in:
            polygon.append(point)
    return [point for i in range(1, len(polygon)-1) for point in (polygon[0], polygon[i], polygon[i+1])], hits


batches = defaultdict(list)
for root in source['scenes'][source['scene']]['nodes']:
    for node, matrix in instances(root, np.eye(4)):
        name = node['name']
        group = group_for(name)
        if not group:
            continue
        for primitive in source['meshes'][node['mesh']]['primitives']:
            mat = primitive['material']
            if mat not in palette:
                palette[mat] = finish(mat)
            key, color = palette[mat]
            attr = primitive['attributes']
            pos = accessor(attr['POSITION']) @ matrix[:3, :3].T + matrix[:3, 3]
            normal = accessor(attr['NORMAL']) @ np.linalg.inv(matrix[:3, :3])
            uv = accessor(attr['TEXCOORD_0']) if 'TEXCOORD_0' in attr else np.zeros((len(pos), 2))
            points = np.concatenate((pos, normal, uv), axis=1)
            indices = accessor(primitive['indices']).reshape(-1, 3)
            if name.startswith('Kitchen | stainless range'):
                # The hood and rectangular chimney hang on the upper gable,
                # separate from the refrigerator farther along the same wall.
                center = pos[indices].mean(axis=1)
                west = (4.65 - center[:, 0]) / .3048
                back = (center[:, 2] + 8.5) / .3048
                plan_y = .094108 * west + .995562 * back
                hood = (plan_y > 17.3) & (plan_y < 20.9) & (center[:, 1] > 4.52)
                add(('Roof', key), points, indices[hood], color)
                indices = indices[~hood]
            if group != 'Cut':
                # Omit hidden ceiling joists combined with the bunk furniture.
                if name.startswith('Bunk bedroom by'):
                    indices = indices[pos[indices, 1].min(1) < 4.83]
                add((group, key), points, indices, color)
                continue
            low = pos[indices, 1] <= CUT_Y
            add(('Main', key), points, indices[low.all(1)], color)
            add(('Roof', key), points, indices[~low.any(1)], color)
            cut = indices[low.any(1) & ~low.all(1)]
            for below, dest in [(True, 'Main'), (False, 'Roof')]:
                tris = []
                caps = []
                for face in cut:
                    clipped, hits = split(points[face], below)
                    tris.extend(clipped)
                    if below and len(hits) == 2 and name.startswith(CAP_WALL) and 'casing' not in name:
                        a, b = hits
                        tangent = b - a
                        side = np.array([tangent[2], 0, -tangent[0]])
                        side *= .025 / max(np.linalg.norm(side), 1e-8)
                        caps.extend([a-side, a+side, b+side, a-side, b+side, b-side])
                if tris:
                    add((dest, key), np.array(tris), np.arange(len(tris)), color)
                if caps:
                    cap = np.zeros((len(caps), 8))
                    cap[:, :3] = caps
                    cap[:, 4] = 1
                    add(('Main', ('solid', 0)), cap, np.arange(len(caps)), [.39, .31, .22, 1])


scene = {'asset': {'version': '2.0', 'generator': 'Reindeer Trail cutaway exhibit'},
         'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
         'scene': 0, 'scenes': [{'nodes': [0, 1, 2]}], 'nodes': [], 'meshes': [],
         'materials': [], 'accessors': [], 'bufferViews': [], 'textures': [], 'images': []}
blob = bytearray()


def view(raw, **options):
    while len(blob) % 4:
        blob.append(0)
    idx = len(scene['bufferViews'])
    scene['bufferViews'].append(dict(buffer=0, byteOffset=len(blob), byteLength=len(raw), **options))
    blob.extend(raw)
    return idx


def buffer(array, component, shape, element_size=0, **attributes):
    components = array.shape[-1] if len(array.shape) == 2 else 1
    stride = array.dtype.itemsize * components
    if element_size and stride != element_size:
        padded = np.zeros((len(array), element_size), 'u1')
        padded[:, :stride] = np.ascontiguousarray(array).view('u1').reshape(len(array), stride)
        raw = padded.tobytes()
        slot = view(raw, byteStride=element_size, target=34962)
    else:
        slot = view(array.tobytes(), target=34963 if shape == 'SCALAR' else 34962)
    idx = len(scene['accessors'])
    scene['accessors'].append(dict(bufferView=slot, componentType=component, count=len(array), type=shape, **attributes))
    return idx


material_indices = {}


def material(key):
    if key in material_indices:
        return material_indices[key]
    kind, index = key
    name = {'solid': 'Cabin finishes', 'glass': 'Clear glazing', 'texture': source['materials'][index]['name']}[kind]
    item = {'name': name, 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': .84}}
    if kind == 'glass':
        item['alphaMode'] = 'BLEND'
    if kind == 'texture':
        image = image_from_texture(source['materials'][index]['pbrMetallicRoughness']['baseColorTexture']['index'])
        encoded = io.BytesIO()
        # Preserve cut-out fir needles as an alpha-tested texture.
        if source['materials'][index].get('alphaMode') == 'MASK':
            image.save(encoded, 'PNG', optimize=True)
            mime = 'image/png'
            item['alphaMode'] = 'MASK'
            item['alphaCutoff'] = source['materials'][index].get('alphaCutoff', .5)
        else:
            image.convert('RGB').save(encoded, 'JPEG', quality=81)
            mime = 'image/jpeg'
        ti = len(scene['textures'])
        scene['images'].append({'name': name, 'mimeType': mime, 'bufferView': view(encoded.getvalue())})
        scene['textures'].append({'source': ti})
        item['pbrMetallicRoughness']['baseColorTexture'] = {'index': ti}
    index = len(scene['materials'])
    material_indices[key] = index
    scene['materials'].append(item)
    return index


def simplify(vertices, indices):
    # Use the same open-source meshoptimizer distributed with the walkthrough's
    # Three.js dependency. Decimate within a material and preserve UV/normal/
    # colour discontinuities. The 12 mm error bound is in cabin metres.
    if len(indices) < 600:
        used, new_indices = np.unique(indices, return_inverse=True)
        return vertices[used], new_indices.reshape(-1, 3)
    positions = vertices['p'].astype('<f4') * GRID
    attributes = np.column_stack((vertices['n'] / 127., vertices['c'][:, :3] / 255., vertices['uv'])).astype('<f4')
    raw = struct.pack('<II', len(vertices), indices.size) + positions.tobytes() + attributes.tobytes()
    module = ROOT/'Reference/viewer-src/node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js'
    script = '''
        import {readFileSync} from 'node:fs';
        const {MeshoptSimplifier: mesh} = await import(process.argv[1]);
        await mesh.ready;
        const data = readFileSync(0);
        const count = data.readUInt32LE(0), size = data.readUInt32LE(4);
        const pos = new Float32Array(data.buffer, data.byteOffset + 8, count*3);
        const attr = new Float32Array(data.buffer, data.byteOffset + 8 + count*12, count*8);
        const idx = new Uint32Array(data.buffer, data.byteOffset + 8 + count*44, size);
        const [result] = mesh.simplifyWithAttributes(idx, pos, 3, attr, 8,
            [.008,.008,.008, .07,.07,.07, .004,.004], null,
            3*Math.max(1,Math.round(size*.22/3)), .012, ['ErrorAbsolute','Permissive','Prune']);
        process.stdout.write(Buffer.from(result.buffer, result.byteOffset, result.byteLength));
    '''
    reduced = subprocess.run(['node', '--input-type=module', '-e', script, module.as_uri()],
                             input=raw + indices.astype('<u4').tobytes(), stdout=subprocess.PIPE, check=True)
    used, compact = np.unique(np.frombuffer(reduced.stdout, '<u4'), return_inverse=True)
    return vertices[used], compact.reshape(-1, 3)


for group in ['Main', 'Loft', 'Roof']:
    primitives = []
    for (layer, key), parts in batches.items():
        if layer != group:
            continue
        vertices, index = np.unique(np.concatenate(parts), return_inverse=True)
        index = index.reshape(-1, 3)
        index = index[(index[:, 0] != index[:, 1]) & (index[:, 1] != index[:, 2]) & (index[:, 2] != index[:, 0])]
        if not index.size:
            continue
        vertices, index = simplify(vertices, index)
        if not index.size:
            continue
        xyz = vertices['p']
        attr = {'POSITION': buffer(xyz, 5122, 'VEC3', 8, min=xyz.min(0).tolist(), max=xyz.max(0).tolist()),
                'NORMAL': buffer(vertices['n'], 5120, 'VEC3', 4, normalized=True),
                'COLOR_0': buffer(vertices['c'], 5121, 'VEC4', normalized=True)}
        if key[0] == 'texture':
            attr['TEXCOORD_0'] = buffer(vertices['uv'].astype('<f4'), 5126, 'VEC2')
        wide = len(vertices) > 65535
        ix = buffer(index.reshape(-1).astype('<u4' if wide else '<u2'), 5125 if wide else 5123, 'SCALAR')
        primitives.append({'attributes': attr, 'indices': ix, 'material': material(key)})
    scene['nodes'].append({'name': group, 'mesh': len(scene['meshes']), 'scale': [GRID]*3})
    scene['meshes'].append({'name': group+' geometry', 'primitives': primitives})

while len(blob) % 4:
    blob.append(0)
scene['buffers'] = [{'byteLength': len(blob)}]
header = json.dumps(scene, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
output = ROOT / 'Website/media/cabin-cutaway.glb'
with output.open('wb') as file:
    file.write(struct.pack('<4sII', b'glTF', 2, 28 + len(header) + len(blob)))
    file.write(struct.pack('<I4s', len(header), b'JSON'))
    file.write(header)
    file.write(struct.pack('<I4s', len(blob), b'BIN\0'))
    file.write(blob)
print(f'{output.name} · {output.stat().st_size:,} bytes · {len(material_indices)} finishes')
