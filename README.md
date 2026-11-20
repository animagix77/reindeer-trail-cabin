# Reindeer Trail Cabin

A furnished, walkable model of a cabin in Smallwood, New York. [Visit the public cabin](https://animagix77.github.io/reindeer-trail-cabin/).

## Visit

You arrive on the driveway at golden hour. Walk forward with **W** and back with **S**. Hold **A** to turn left or **D** to turn right. The arrow keys work the same way. Drag to look around, and use the movement pad on touchscreens. Use **View** to jump to a room or clearing. The time, weather, furnace and fire controls stay in view as you explore. Sound starts with your first interaction. You can hear your footing change from pavement to floorboards and the fire crackle as you draw near. **Sound** remembers your mute preference. Reduced Motion keeps the walking camera steady and the tree lights constant.

- At **Wood splitting** beside the driveway, click or tap the axe, then click the wood where you want the blade to land. The gold ring shows when you can swing. A tough round holds its notch between blows. Try another spot along the crack or step around the block to approach it from another angle. Stand still to regain strength. The split pieces fall and pile up, and the next round comes onto the block automatically. Choose **Carry a piece** to take one to the fire. Walking away returns the axe to the stump.
- At the **Woodpile**, gather twigs, sticks or a split log. Walk to the fire ring or choose **Fire pit** while carrying it. Face the ring and toss the wood. Twigs flare quickly, sticks last longer, and logs sustain the fire. You can lay wood in a cold ring before lighting it.
- Visit the deck grill to light it, cook steak, chicken or vegetable skewers, turn the food and serve it.
- Look for deer along the wooded edges of the property. They browse in different patches and bound away when startled. Choose **Feed deer** to open your basket in the woods or visit the meadow. Toss an apple, carrot or greens, or hold food out and stand still. Curious deer can follow it to your hand.
- On a night walk, select **Flashlight** or press **L** to shine a beam where you look. The driveway and front-entry floodlights switch on when you approach after dark.
- Visit the Christmas tree beside the loft stairs. Choose **Stargazing** for a clear night at the fire pit. Facing north, look for Polaris above the trees.
- Open **Map** for the state aerial and neighborhood satellite views. The parcel, road and historic building outlines can be switched individually. Map pins take you to the front approach and covered porch.
- Under **Follow Smallwood**, switch on **Local time** for the cabin’s Eastern clock and seasonal sunlight, or **Local weather** for conditions reported at Sullivan County International Airport. Each switch restores its previous manual setting when turned off. [National Weather Service station](https://www.weather.gov/wrh/timeseries?site=KMSV)
- Choose **Water notes → See the well** to stand beside the blue-capped casing at the driveway steps. The notes cover the cabin’s private well, pressure tank and separate 40-gallon hot-water heater. With an internet connection you can also see the latest dated groundwater observation from Woodbourne, about 12 miles northeast. The cabin’s own groundwater depth would require an on-site reading. [USGS Woodbourne well](https://waterdata.usgs.gov/monitoring-location/USGS-414525074360601/)

## Visit with friends

The public tour opens without an account. Select **Friends**, pick a name and a hiker, then create a group and share its invitation. Up to eight visitors arrive on the driveway and walk independently. Open group chat to speak. Your message appears above your avatar for nearby friends. Select a visitor’s name to meet them, or use **Place nearby** as the host to bring them to you. The group shares the time, weather, furnace and campfire, including wood added by any visitor. Each visitor keeps their own pile of split wood and food basket.

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

The WebGL viewer uses a reflection probe captured in the modeled yard, high dynamic range lighting, soft contact shadows and local color bounce. The polished entry tiles reflect the doorway as you walk down the hall. It adjusts resolution when a device needs more time to draw a frame. The website loads its model in content-addressed parts. Serve the web directory over HTTP. GitHub Pages builds the website from the checked-in GLB and viewer sources on each push to main. Include the rebuilt GLB, Blender file and standalone HTML in updates that change the modeled scene.

## Model references

The cabin footprint follows the dimensioned appraisal sketch. Owner photographs guide rooms, furnishings, finishes, outdoor structures and the gravel fire circle. Window heights, the hallway partition length, the well casing’s offset from the driveway steps, individual furniture placements and paving under tree cover are estimates. The driveway splitting block’s exact position is estimated. The string lights follow the photographed deck eave and railing, the top of the egg-chair pergola, and two spans over the clearing. Pole positions are approximate. Low growth at the rear woodland edge is illustrative. Parcel lines and historical building outlines are approximate.

New York's 2025 six-inch orthophoto and Sullivan County mapping guide the frontage. The surrounding terrain uses elevation and lidar. The wider woodland uses June 2025 Sentinel-2 vegetation measurements. Contains modified Copernicus Sentinel data 2025. [Map sources and accuracy](Reference/map-provenance.json) · [Terrain sources](Reference/terrain-provenance.json) · [Lidar sources](Reference/lidar-provenance.json)

The night sky uses stars from the ESA Hipparcos catalogue. The viewer uses Three.js for rendering, cannon-es for split-wood physics, and PeerJS for group visits. Notices are embedded in the built HTML. [Hipparcos catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239) · [Three.js license](Reference/viewer-src/THREE-LICENSE.txt)
