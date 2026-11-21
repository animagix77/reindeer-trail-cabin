# Reindeer Trail Cabin

A furnished, walkable model of a cabin in Smallwood, New York. [Visit the public cabin](https://animagix77.github.io/reindeer-trail-cabin/).

## Visit

You arrive on the driveway at golden hour. Walk forward or back with **W / S** and sidestep left or right with **A / D**. Drag to look around, or use **← / →** to turn. **↑ / ↓** also walk forward and back. On a touchscreen, use the movement pad and drag to look. Use **Start at** to choose among **Driveway**, **Front of house**, **Back yard** and **Inside**. Inside starts just past the front door. From any starting point you can walk through the cabin and grounds. **Guide → Return to start** takes you back to your selected starting point. Time, weather and sound stay in view as you explore. Walk up to the furnace, grill or fire ring and click or tap the object, or press **E** when its action appears. **Page Up** and **Page Down** let you aim with the keyboard. Sound starts with your first interaction. You can hear your footing change from pavement to floorboards and the fire crackle as you draw near. **Sound** remembers your mute preference. Reduced Motion keeps the walking camera steady, the tree lights constant, and the tall grass and egg swings still.

- At **Wood splitting** beside the driveway, click or tap the axe, then click the wood where you want the blade to land. The gold ring shows when you can swing. The steel head trails your hands on the lift. A clean strike follows the grain, while a tough hit leaves a notch and kicks the head back. Aim along the crack or step around the block to change the angle. Chop a piece that settles on the stump again for finer kindling, even if it lands on its side. Choose **Clear block** to sweep cut pieces onto the ground and make room for another round. Let the loose wood pile up as you chop. Choose **Stack wood** to move the settled pieces to the shared woodpile behind the egg swings. The first three swings from full strength keep their power and speed. Further swings gradually slow until you rest. Choose **Carry a piece** to take the wood you cut to the fire. Walking away returns the axe to the stump.
- At the woodpile, look at the twigs, sticks or split logs and pick up a piece. Carry it to the fire ring. Face the ring and toss the wood. Each piece rebounds briefly and rolls to rest among the coals. Twigs flare quickly, sticks last longer, and logs sustain the fire. You can lay wood in a cold ring before lighting it.
- Approach an Adirondack chair and select **Sit by the fire**. You can look around, stargaze and chat from your seat. Choose **Stand up** to continue walking.
- Visit the deck grill to light it, cook steak, chicken or vegetable skewers, turn the food and serve it.
- Step through the dining-room slider and turn left to see the black hoop firewood rack beneath the window. The patio stove is at that end of the deck.
- Look for a doe and yearling browsing together near the wooded property line, with a buck farther along the trees. Food can draw them into the yard. A sudden approach sends them bounding for cover. Choose **Feed deer** when it appears along the wooded edge to open your basket. Toss an apple, carrot or greens, or hold food out and stand still. Curious deer can follow it to your hand.
- On a night walk, select **Flashlight** or press **L** to shine a beam where you look. Motion lights come on as you approach the driveway, front door or back deck after dark. The string lights cast steady, warm light across the deck, pergola and picnic area.
- Visit the Christmas tree beside the loft stairs. Choose **Stargaze** for a clear night wherever you’re standing. Facing north, look for Polaris above the trees.
- Open **Map** for the state aerial and neighborhood satellite views. The parcel, road and historic building outlines can be switched individually. Map pins take you to **Front of house** and **Back yard**.
- In **Guide**, under **Follow Smallwood**, switch on **Local time** for the cabin’s Eastern clock and seasonal sunlight, or **Local weather** for conditions reported at Sullivan County International Airport. Each switch restores its previous manual setting when turned off. [National Weather Service station](https://www.weather.gov/wrh/timeseries?site=KMSV)
- For the basement, follow the driveway past the garage to the paved area beside the back deck. Face the basement door and walk straight down two steps to enter. The half bath and graphite all-in-one washer-dryer sit beside the service aisle. Along the utility wall are two blue well-pressure tanks, a separate 40-gallon electric water heater and the breaker panel.
- Walk to the driveway steps to see the blue-capped well casing. Open **Guide → Water notes** to read about the cabin’s private well. With an internet connection you can also see the latest dated groundwater observation from Woodbourne, about 12 miles northeast. The cabin’s own groundwater depth would require an on-site reading. [USGS Woodbourne well](https://waterdata.usgs.gov/monitoring-location/USGS-414525074360601/)

## Open house

Once the 3D walkthrough has loaded, enter a first name or nickname, choose a hiker, and select **Start 3D walkthrough**. You can meet up to seven other visitors on the driveway. Share the public cabin link to meet friends in the same space. **Cabin chat** shows who is here. Select a name to walk over to that visitor, or send a message to the room. Messages also appear above the speaker’s avatar. New arrivals see messages sent during their visit.

Visitors restock one shared woodpile. The count updates when someone chooses **Stack wood** at the chopping block. Up to 150 fresh billets fit on the visible stack, and the tally continues beyond that. The device keeps a local checkpoint. Joining an occupied cabin uses its current total. Starting a new open house uses the first visitor’s saved total. Visitors also share the time, weather and campfire, while each carries their own wood and food basket. If the first visitor leaves, the others reconnect automatically. A full room or a network that blocks the connection offers a retry or a solo walk. The online tour uses PeerJS Cloud to connect visitors through WebRTC. [PeerJS Cloud](https://peerjs.com/server/cloud)

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

The cabin footprint follows the dimensioned appraisal sketch. Owner photographs guide rooms, furnishings, finishes, outdoor structures and the gravel fire circle. The welcome and loading screens use the owner’s enhanced winter photograph of the backyard. Window heights, the hallway partition length, the well casing’s offset from the driveway steps, individual furniture placements and paving under tree cover are estimates. The driveway splitting block’s exact position is estimated. The string lights follow the photographed deck eave and railing, the top of the egg-chair pergola, and two spans over the clearing. Pole positions are approximate. The two suspended baskets sway slightly from their individual chain mounts. Fine gravel relief, embedded fieldstones and small hollows on the woodland banks are estimated from the photos. Low growth at the rear woodland edge is illustrative. Parcel lines and historical building outlines are approximate.

New York’s 2025 six-inch aerial image locates the driveway, rear deck and clearing relative to the cabin. Sullivan County mapping guides the road and parcel. Eight nearby homes use state building footprints checked against the 2025 aerial and county rooftop points. Their heights, roof shapes and colors are approximate. [Neighboring home outlines and sources](Reference/Woodland%20context/Neighboring%20homes.json) The surrounding terrain uses elevation and lidar. June 2025 Sentinel-2 vegetation measurements guide the density of low growth around the clearing and in the surrounding woods. Contains modified Copernicus Sentinel data 2025. [Map sources and accuracy](Reference/map-provenance.json) · [Terrain sources](Reference/terrain-provenance.json) · [Lidar sources](Reference/lidar-provenance.json)

Basement photos guide the half bath fixtures, laundry appliance and equipment finishes. The owner confirmed the straight, two-step basement entrance and the two pressure tanks. The inspection identified copper water distribution, polyethylene well supply, PVC drainage, a 40-gallon electric water heater and 100-amp service. Stair dimensions, partition lengths, pipe routing and the breaker arrangement are estimated from the available views.

The night sky uses stars from the ESA Hipparcos catalogue. The viewer uses Three.js for rendering, cannon-es for split-wood physics, and PeerJS for group visits. Notices are embedded in the built HTML. [Hipparcos catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239) · [Three.js license](Reference/viewer-src/THREE-LICENSE.txt)
