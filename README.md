# Reindeer Trail Cabin

Explore the Smallwood, New York cabin in a browser, or open its furnished 3D model in Blender. The self-contained tour works offline after downloading.

[Test the live tour from the deck](https://reindeer-trail-cabin.binhthere.chatgpt.site/#deck-grill). The hosted preview requires the owner’s sign-in.

## Open the tour

Download **Explore the property.html** and open it in a current desktop or mobile browser with WebGL 2. Choose a view to jump between spaces. Use the movement pad or keyboard to walk and drag to look around. The scene controls change the time of day, weather, propane heater and fire pit.

Open **Reindeer Trail.blend** in Blender to inspect the editable scene, cameras, terrain and navigation geometry. Its textures are packed. **Reindeer Trail.glb** contains the tour geometry and materials for other glTF-compatible viewers. The HTML adds walking, lighting, weather and fire controls.

## Rebuild from source

Use Blender 5.2, Node.js 22 or later, and npm. From the repository root, with the Blender executable on your path, run the following commands.

```sh
blender --background --python-exit-code 1 --python "Reference/Build cabin.py" -- --geometry-only build
npm ci --prefix Reference/viewer-src
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" "build/Explore the property.html"
```

The `build` directory will contain the scene, GLB and offline tour. To also render the exterior, living room, sleeping loft and site views, omit `--geometry-only` and leave `build` as the final argument.

To prepare a static website from the same scene, run the following after the rebuild. Serve the contents of the web directory over HTTP. The web viewer loads its model in three smaller files with content-based names.

```sh
mkdir -p build/web
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" build/web/index.html Reference --web
```

## Model references

The footprint follows the dimensioned appraisal sketch. Interior details come from the owner’s photographs. Room dimensions, clearances, many furniture positions and individual vegetation placements are photographic estimates. The terrain uses USGS elevation and lidar with New York State aerial imagery. The parcel line is approximate.

Editable geometry and materials are in **Reference**. **model-geometry.json** holds the terrain grid, boundary, roof planes and alignment. **lidar-parcel.csv** holds the clipped reference points. **Woodland context** contains the surrounding elevation and vegetation inputs. Source attribution, coordinates and vertical units are recorded in [terrain provenance](Reference/terrain-provenance.json) and [lidar provenance](Reference/lidar-provenance.json).

The browser viewer uses Three.js. Its [MIT license](Reference/viewer-src/THREE-LICENSE.txt) is included.
