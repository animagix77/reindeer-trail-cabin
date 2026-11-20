# Reindeer Trail Cabin

A furnished, walkable model of a cabin in Smallwood, New York. [Visit the public cabin](https://animagix77.github.io/reindeer-trail-cabin/).

## Visit

You arrive on the driveway at golden hour. Walk with WASD, the arrow keys or the movement pad, and drag to look around. Use **View** to jump to a room or clearing. The time, weather, furnace and fire controls stay in view as you explore. Sound starts with your first interaction. You can hear your footing change from pavement to floorboards and the fire crackle as you draw near. **Sound** remembers your mute preference. Reduced Motion keeps the walking camera steady and the tree lights constant.

- At **Wood splitting** beside the driveway, click or tap the axe to pick it up. At full strength, click the round to take a swing. Stand still to catch your breath while the strength meter refills. A clean split earns two pieces for the fire pit. Walk away and the axe returns to the block. You can also use the on-screen controls or choose a timed swing under **Swing options**.
- At the **Woodpile**, gather twigs, sticks or a split log. Walk to the fire ring or choose **Fire pit** while carrying it. Face the ring and toss the wood. Twigs flare quickly, sticks last longer, and logs sustain the fire. You can lay wood in a cold ring before lighting it.
- Visit the deck grill to light it, cook steak, chicken or vegetable skewers, turn the food and serve it.
- Choose **Feed deer** to visit the meadow. Walk too close and the herd scatters. Stand still with an apple, carrot or greens and a curious deer may take it from your hand. You can also toss food and refill the basket.
- Visit the Christmas tree beside the loft stairs. Choose **Stargazing** for a clear night at the fire pit. Facing north, look for Polaris above the trees.
- Open **Map** for the state aerial and neighborhood satellite views. The parcel, road and historic building outlines can be switched individually. Map pins take you to the front approach and covered porch.

## Visit with friends

The public tour opens without an account. Select **Friends**, pick a name and a hiker, then create a group and share its invitation. Up to eight visitors arrive on the driveway and walk independently. Open group chat to speak. Your message appears above your avatar for nearby friends. Select a visitor’s name to meet them, or use **Place nearby** as the host to bring them to you. The group shares the time, weather, furnace and campfire, including wood added by any visitor. Each visitor keeps their own splitting score, wood stack and food basket.

Keep the host's tab open. Chat and membership last for the session. A visitor with the invitation can join. The invitation key stays in the link fragment. The app uses PeerJS Cloud for connection setup and WebRTC data channels for the group. A network that blocks WebRTC can prevent a connection. [PeerJS Cloud](https://peerjs.com/server/cloud)

## Download and rebuild

Download **Explore the property.html** to tour offline in a browser with WebGL 2. Shared visits need the hosted site and an internet connection. **Reindeer Trail.blend** contains the editable scene with packed textures, cameras and navigation geometry. **Reindeer Trail.glb** contains the geometry and materials for other glTF viewers. Interactions, the night sky and sound live in the browser viewer.

With Blender 5.2, Node.js 22 or later and npm installed, run these commands from the repository root.

```sh
blender --background --python-exit-code 1 --python "Reference/Build cabin.py" -- --geometry-only build
npm ci --prefix Reference/viewer-src
node Reference/viewer-src/check-geometry.mjs "build/Reindeer Trail.glb"
node Reference/viewer-src/check-wildlife.mjs "build/Reindeer Trail.glb"
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" "build/Explore the property.html" Reference
mkdir -p build/web
node Reference/viewer-src/build.mjs "build/Reindeer Trail.glb" build/web/index.html Reference --web
```

The WebGL viewer uses a reflection probe captured in the modeled yard, high dynamic range lighting, depth-based contact shadows and filtered highlights. It adjusts resolution when a device needs more time to draw a frame. The website loads its model in content-addressed parts. Serve the web directory over HTTP. GitHub Pages builds the website from the checked-in GLB and viewer sources on each push to main. Include the rebuilt GLB, Blender file and standalone HTML in updates that change the modeled scene.

## Model references

The cabin footprint follows the dimensioned appraisal sketch. Owner photographs guide rooms, furnishings, finishes, outdoor structures and the gravel fire circle. Window heights, individual furniture placements and paving under tree cover are estimates. The driveway splitting block’s exact position is estimated. The string lights follow the photographed deck eave and railing, the top of the egg-chair pergola, and two spans over the clearing. Pole positions are approximate. Low growth at the rear woodland edge is illustrative. Parcel lines and historical building outlines are approximate.

New York's 2025 six-inch orthophoto and Sullivan County mapping guide the frontage. The surrounding terrain uses elevation and lidar. The wider woodland uses June 2025 Sentinel-2 vegetation measurements. Contains modified Copernicus Sentinel data 2025. [Map sources and accuracy](Reference/map-provenance.json) · [Terrain sources](Reference/terrain-provenance.json) · [Lidar sources](Reference/lidar-provenance.json)

The night sky uses stars from the ESA Hipparcos catalogue. The viewer uses Three.js, PeerJS and their dependencies. Notices are embedded in the built HTML. [Hipparcos catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239) · [Three.js license](Reference/viewer-src/THREE-LICENSE.txt)
