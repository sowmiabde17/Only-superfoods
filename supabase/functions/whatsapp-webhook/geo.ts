/**
 * geo.ts — East Bengaluru Delivery Radar for Deno Edge Functions
 * Point-in-polygon ray-casting algorithm against the Kadugodi-Whitefield boundary.
 */

export const CORE_POLYGON_COORDS: [number, number][] = [
  [13.078, 77.798], // Hoskote apex (North-East)
  [13.042, 77.815], // Pettanahalli / Chikka Gattiganabbe (East Outer)
  [13.010, 77.818], // Near Koralur / East
  [12.985, 77.812], // Samethanahalli / Thirumalashettihalli
  [12.958, 77.792], // Thimmanahalli / Valepura / Harohalli
  [12.932, 77.765], // South of Varthur
  [12.935, 77.732], // Varthur Lake / Balagere border / Panathur
  [12.948, 77.698], // South of Marathahalli / Varthur Rd
  [12.958, 77.678], // Marathahalli junction (South-West corner)
  [12.985, 77.665], // Mahadevapura / Garudacharpalya West
  [13.002, 77.665], // KR Puram railway station West
  [13.018, 77.670], // Ramamurthy Nagar (North-West corner)
  [13.038, 77.695], // North of TC Palya & Kittaganuru
  [13.052, 77.725], // North of Avalahalli / Old Madras Road highway
  [13.070, 77.755], // North of Huskuru / Bendiganahalli
  [13.078, 77.798], // Hoskote apex (close polygon)
];

export const FARM_HUB_COORDS: [number, number] = [12.9982, 77.7609]; // Kadugodi Farm Hub

export function pointInPolygon(point: [number, number], vs = CORE_POLYGON_COORDS): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

