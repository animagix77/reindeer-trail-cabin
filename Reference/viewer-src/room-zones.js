// Use the cabin builder's plan frame: horizontal dimensions in feet and
// heights in metres above the main floor. World +Z points toward the yard.
const foot = 0.3048;
const angle = 5.4 * Math.PI / 180;
const c = Math.cos(angle), s = Math.sin(angle);
const basement = -2.72;

function anchor(x, y, height) {
  return [
    4.65 - foot * (c * x + s * y),
    2.88 + height,
    -8.5 + foot * (-s * x + c * y)
  ];
}

// Set each point on the visitor-facing side of a recognizable room feature.
export const roomAnchors = {
  entry: anchor(32.56, 7.78, 1.40),               // hall sign
  primary: anchor(15.6, 11.2, 1.06),              // queen bed
  frontBedroom: anchor(38.5, 8.7, 0.99),          // full bed
  bunk: anchor(3.65, 8.75, 1.45),                 // bunk frame
  loft: anchor(3.65, 17.0, 2.68),                 // loft mattress
  living: anchor(7.65, 22.65, 0.79),              // coffee chest
  dining: anchor(25.53, 23.52, 1.17),             // dining table
  kitchen: anchor(32.82, 20.1, 1.22),             // island
  mainBath: anchor(27.62, 0.40, 1.50),            // framed print beside the window
  basementLaundry: anchor(32.40, 18.55, basement + 0.95),
  halfBath: anchor(33.2, 21.75, basement + 1.16), // compact vanity
  utility: anchor(38.30, 14.30, basement + 1.40), // blue pressure tank
  garage: anchor(0.88, 9.40, basement + 1.45)     // first carriage door
};

const separateFloors = {
  WalkSurface_LoftLanding: 'loft',
  WalkSurface_Bathroom_pan: 'mainBath',
  WalkSurface_Bathroom_curb: 'mainBath',
  WalkSurface_BasementBathroomFloor: 'halfBath',
  WalkSurface_BasementMechanicalSlab: 'utility',
  WalkSurface_BasementGarageSlab: 'garage',
  WalkSurface_BasementDenWood: 'basementLaundry',
  WalkSurface_BasementDenWoodReturn: 'basementLaundry',
  WalkSurface_BasementEntryWoodReturn: 'basementLaundry'
};

export function roomAt(body) {
  if (!body) return null;
  const floor = body.label;
  if (Object.hasOwn(separateFloors, floor)) return separateFloors[floor];
  const main = floor === 'WalkSurface_MainFloor_east' || floor === 'WalkSurface_MainFloor_middle' ||
    floor === 'WalkSurface_MainFloor_west';
  // Stair ramps, porches and terrain can lie directly above or below a room.
  if (!main && floor !== 'WalkSurface_BasementEntryWood') return null;
  const west = (4.65 - body.x) / foot, back = (body.z + 8.5) / foot;
  const x = c * west - s * back, y = s * west + c * back;

  if (!main) {
    // The higher bathroom support overlaps continuous den floorboards.
    return x >= 30.55 && x <= 35.55 && y >= 20.17 && y <= 25.76 ? 'halfBath' : 'basementLaundry';
  }

  // Partition coordinates match Remaining interior.py, including the wider
  // rear portion of the primary bedroom and the unbroken front hall wall.
  if (x < 7.245 && y < 15.25) return 'bunk';
  if (x < (y < 10.25 ? 21.38 : 23.45) && y < 15.27) return 'primary';
  if (x < 29.04 && y < 10.25) return 'mainBath';
  if (x >= 32.75 && y < 12.49) return 'frontBedroom';
  if (x >= 29.04 && x < 32.75 && y < 10.25) return 'entry';

  if (x >= 20.75 && x < 23.45 && y >= 15.27 && y < 18.15) return null; // enclosed pier
  if (x < 20.89) return 'living';
  return x < 30 ? 'dining' : 'kitchen';
}
