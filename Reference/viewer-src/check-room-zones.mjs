// Exercise room selection against the same exported navigation mesh used by visitors.
import assert from 'node:assert/strict';
import {roomAt, roomAnchors} from './room-zones.js';
import {roomDetails} from './room-details.js';
import {STANDING_EYE_HEIGHT} from './walking.js';

export function checkRoomZones(walks, at) {
  function guest(x, y, floorHeight = 0.017) {
    const floor = at(x, y, floorHeight);
    const body = walks.spawn(floor.x, floor.z, floor.y + STANDING_EYE_HEIGHT, floor.y);
    assert.ok(body, `Visitor cannot stand at (${x}, ${y}, ${floorHeight})`);
    assert.ok(Math.abs(body.y - floor.y) < 0.12, `Visitor landed on ${body.label} at the wrong height`);
    return body;
  }

  const lower = -2.693;
  const spots = {
    entry: [30.99, 1.3],
    frontBedroom: [36.95, 2.25],
    primary: [19.75, 6.13],
    bunk: [3.55, 12.4],
    mainBath: [26.55, 9.14],
    living: [19.9, 19.56],
    dining: [25.35, 20.16],
    kitchen: [36.5, 16.78],
    loft: [7.85, 19.55, 2.21],
    garage: [16.5, 21.4, lower],
    basementLaundry: [29.1, 18.55, lower],
    halfBath: [32.2, 23.1, lower],
    utility: [37.45, 14.3, lower]
  };

  const rooms = Object.keys(spots).sort();
  assert.deepEqual(Object.keys(roomAnchors).sort(), rooms);
  assert.deepEqual(Object.keys(roomDetails).sort(), rooms);
  for (const [id, spot] of Object.entries(spots)) {
    const body = guest(...spot);
    assert.equal(roomAt(body), id, `Wrong room at ${spot} on ${body.label}`);
    const [x, y, z] = roomAnchors[id];
    assert.ok(y > body.y && y < body.y + 2.3, `${id} marker is on the wrong level`);
    // Even markers placed over furniture must be above their own room's floor.
    const support = walks.heights(x, z).sort((a, b) => Math.abs(a.y - body.y) - Math.abs(b.y - body.y))[0];
    assert.ok(support && Math.abs(support.y - body.y) < 0.15, `${id} marker has no indoor floor beneath it`);
    assert.equal(roomAt({x, z, label: support.label}), id, `${id} marker crosses a partition`);
  }

  // Doorways, the stepped primary suite wall and overlapping floors are poor
  // matches for nearest-marker distance but must work when walking either way.
  for (const [id, spot] of [
    ['living', [3.55, 16.6]], ['bunk', [3.55, 14.35]],
    ['entry', [31, 4.3]], ['frontBedroom', [33.72, 4.3]],
    ['mainBath', [26.55, 9.14]], ['dining', [26.55, 12.0]],
    ['primary', [22.28, 12.75]], ['dining', [24.70, 12.75]],
    ['living', [7.85, 19.55]], ['loft', [7.85, 19.55, 2.21]],
    ['garage', [7.85, 19.55, lower]],
    ['basementLaundry', [29.1, 23.1, lower]], ['halfBath', [32.2, 23.1, lower]]
  ]) assert.equal(roomAt(guest(...spot)), id, `Wrong room at ${spot}`);

  for (const label of ['WalkSurface_CoveredDeck', 'WalkSurface_LoftStair', 'WalkSurface_ParcelGround',
    'WalkSurface_ExteriorServiceLanding', 'WalkSurface_LowerServiceStep0']) {
    assert.equal(roomAt({...guest(...spots.living), label}), null);
  }
  assert.equal(roomAt(null), null);
}
