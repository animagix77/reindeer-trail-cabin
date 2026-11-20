# Reindeer Trail Cabin

A furnished, walkable model of a cabin in Smallwood, New York. [Visit the public cabin](https://animagix77.github.io/reindeer-trail-cabin/).

## Visit

Start at the front gate or choose a destination from **View**. Walk with WASD, the arrow keys or the movement pad. Drag to look around. **Scene** controls the hour, weather, propane furnace and fire pit. Turn on sound to hear the woods and the fire from where you stand.

- Visit the deck grill to light it, cook steak, chicken or vegetable skewers, turn the food and serve it.
- Visit the backyard deer to offer or toss apples, carrots and vegetables. You can refill the basket.
- Visit the Christmas tree beside the loft stairs. Choose **Stargazing** for a clear night at the fire pit. Facing north, look for Polaris above the trees.
- Open **Map** for the state aerial and neighborhood satellite views. The parcel, road and historic building outlines can be switched individually. Map pins take you to the front approach and covered porch.

## Visit with friends

The public tour opens without an account. Select **Friends**, enter a nickname, create a group and share its invitation. Up to eight visitors can walk independently, meet at a friend's location and chat. The group shares the time, weather, fire pit and furnace. Cooking and wildlife activities run on each visitor's device.

Keep the host's tab open. Chat and membership last for the session. A visitor with the invitation can join. The invitation key stays in the link fragment. The app uses PeerJS Cloud for connection setup and WebRTC data channels for the group. A network that blocks WebRTC can prevent a connection. [PeerJS Cloud](https://peerjs.com/server/cloud)

## Download and rebuild

Download **Explore the property.html** to tour offline in a browser with WebGL 2. Shared visits need the hosted site and an internet connection. **Reindeer Trail.blend** contains the editable scene with packed textures, cameras and navigation geometry. **Reindeer Trail.glb** contains the geometry and materials for other glTF viewers. Interactions, the night sky and sound live in the browser viewer.

With Blender 5.2, Node.js 22 or later and npm installed, run these commands from the repository root.

```sh
blender --background --python-exit-code 1 --python "Reference/Build cabin.py" -- --geometry-only build
npm ci --prefix Reference/viewer-src
node Reference/viewer-src/check-geometry.mjs "build/Reindeer Trail.glb"
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" "build/Explore the property.html" Reference
mkdir -p build/web
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" build/web/index.html Reference --web
```

The website loads its model in content-addressed parts. Serve the web directory over HTTP. GitHub Pages builds the website from the checked-in GLB and viewer sources on each push to main. Include the rebuilt GLB, Blender file and standalone HTML in updates that change the modeled scene.

## Model references

The cabin footprint follows the dimensioned appraisal sketch. Owner photographs guide rooms, furnishings, finishes, outdoor structures and the gravel fire circle. Window heights, individual furniture placements and paving under tree cover are estimates. Parcel lines and historical building outlines are approximate.

New York's 2025 six-inch orthophoto and Sullivan County mapping guide the frontage. The surrounding terrain uses elevation and lidar. The wider woodland uses June 2025 Sentinel-2 vegetation measurements. Contains modified Copernicus Sentinel data 2025. [Map sources and accuracy](Reference/map-provenance.json) · [Terrain sources](Reference/terrain-provenance.json) · [Lidar sources](Reference/lidar-provenance.json)

The night sky uses stars from the ESA Hipparcos catalogue. The viewer uses Three.js, PeerJS and their dependencies. Notices are embedded in the built HTML. [Hipparcos catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239) · [Three.js license](Reference/viewer-src/THREE-LICENSE.txt)
