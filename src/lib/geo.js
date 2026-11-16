/**
 * src/lib/geo.js — Hyper-Local Geofencing & Zone Evaluation Engine
 * Single source of truth for East Bengaluru Delivery Radar:
 * 1. Core Express Zone (Polygon: Kadugodi, Whitefield, Hoodi, Varthur, Ramamurthy Nagar, TC Palya, Hoskote)
 * 2. Extended Delivery Zone (Perimeter buffer up to 2.0 km)
 * 3. Point-in-polygon & distance-to-segment math
 */

// Core polygon coordinates (validated against Bangalore road network)
export const CORE_POLYGON_COORDS = [
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

// Kadugodi Farm Hub coordinates
export const FARM_HUB_COORDS = [12.9982, 77.7609];

/**
 * Standard ray-casting point-in-polygon test
 * @param {[number, number]} point [lat, lng]
 * @param {Array<[number, number]>} vs polygon vertices
 * @returns {boolean}
 */
export function pointInPolygon(point, vs = CORE_POLYGON_COORDS) {
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

/**
 * Distance from point P to line segment AB in kilometers (local flat projection)
 * @param {[number, number]} p [lat, lng]
 * @param {[number, number]} a [lat, lng]
 * @param {[number, number]} b [lat, lng]
 * @returns {number} Distance in km
 */
export function distToSegmentKm(p, a, b) {
  const midLat = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const mPerLat = 111132.954;
  const mPerLng = 111412.84 * Math.cos(midLat);

  const px = p[1] * mPerLng;
  const py = p[0] * mPerLat;
  const ax = a[1] * mPerLng;
  const ay = a[0] * mPerLat;
  const bx = b[1] * mPerLng;
  const by = b[0] * mPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return Math.hypot(px - ax, py - ay) / 1000;

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY) / 1000;
}

/**
 * Minimum distance in kilometers from a point to the polygon boundary
 * @param {[number, number]} point [lat, lng]
 * @param {Array<[number, number]>} polygon
 * @returns {number}
 */
export function getDistanceToPerimeterKm(point, polygon = CORE_POLYGON_COORDS) {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const d = distToSegmentKm(point, p1, p2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Evaluates whether a coordinate falls into:
 * - CORE: Inside polygon (Morning Harvest Delivery 7-10 AM)
 * - EXTENDED: Within 2.0 km of boundary (Deliveries Available)
 * - OUTSIDE: > 2.0 km from boundary (WhatsApp Custom Delivery)
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {{
 *   status: 'CORE' | 'EXTENDED' | 'OUTSIDE',
 *   label: string,
 *   badge: string,
 *   description: string,
 *   distanceKm: number,
 *   canOrder: boolean,
 *   tagClass: string,
 *   pillBg: string
 * }}
 */
export function evaluateDeliveryZone(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      status: 'CORE',
      label: 'Whitefield & East Bengaluru Zone',
      badge: 'Local Delivery',
      description: 'Morning harvest drops daily across Whitefield & surrounding areas.',
      distanceKm: 0,
      canOrder: true,
      tagClass: 'bg-[#EBF7DC] text-[#2B5A16] border-[#A8D632]',
      pillBg: '#2B5A16',
    };
  }

  const pt = [lat, lng];
  const isInside = pointInPolygon(pt, CORE_POLYGON_COORDS);

  if (isInside) {
    return {
      status: 'CORE',
      label: 'Prime Harvest Zone',
      badge: 'Morning Harvest Drop',
      description: 'You are inside our core delivery radar! Fresh morning harvest drop (7:00 AM – 10:00 AM).',
      distanceKm: 0,
      canOrder: true,
      tagClass: 'bg-[#EBF7DC] text-[#2B5A16] border-[#A8D632]',
      pillBg: '#2B5A16',
    };
  }

  const distToEdge = getDistanceToPerimeterKm(pt, CORE_POLYGON_COORDS);
  const roundedDist = Math.round(distToEdge * 10) / 10;

  if (distToEdge <= 2.0) {
    return {
      status: 'EXTENDED',
      label: 'Extended 2 km Zone',
      badge: `~${roundedDist} km from border`,
      description: `Deliveries available! You are within our 2 km extended buffer (~${roundedDist} km from core boundary).`,
      distanceKm: roundedDist,
      canOrder: true,
      tagClass: 'bg-[#FFF8E6] text-[#B45309] border-[#FCD34D]',
      pillBg: '#D97706',
    };
  }

  return {
    status: 'OUTSIDE',
    label: 'Outside Regular Morning Zone',
    badge: `~${roundedDist} km away`,
    description: `You are ~${roundedDist} km outside our morning route. Connect with the Only Superfoods team for express delivery (Porter, Rapido, etc.) within Bangalore.`,
    distanceKm: roundedDist,
    canOrder: false,
    tagClass: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]',
    pillBg: '#DC2626',
  };
}

/**
 * Pre-computed 2 km outer buffer polygon coordinates
 * Generates an expanded ring ~2 km outward from the core polygon
 * for visual layer display on Leaflet.
 */
export const EXTENDED_BUFFER_POLYGON = [
  [13.095, 77.810], // North of Hoskote
  [13.055, 77.835], // East of Pettanahalli
  [13.010, 77.840], // East of Koralur
  [12.980, 77.832], // East of Samethanahalli
  [12.945, 77.810], // South-East of Harohalli
  [12.915, 77.780], // South of Varthur
  [12.918, 77.720], // South of Balagere / Panathur
  [12.935, 77.680], // South of Marathahalli
  [12.945, 77.660], // Outer Marathahalli
  [12.975, 77.645], // West of Mahadevapura / Indiranagar border
  [13.000, 77.645], // West of KR Puram / Kasturi Nagar
  [13.030, 77.652], // North-West of Ramamurthy Nagar / Kalkere
  [13.055, 77.680], // North of TC Palya / Horamavu
  [13.072, 77.715], // North of Avalahalli / Budigere cross
  [13.088, 77.745], // North of Huskuru / Mandur
  [13.095, 77.810], // Close buffer polygon
];

