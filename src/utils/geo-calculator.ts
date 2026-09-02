/**
 * High-Precision Geodesic & Speed Engine (Haversine Formula)
 * Calculates accurate distances, speeds, and cleans GPS jitter for fleet telemetry.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates geodesic distance between two GPS coordinates in kilometers
 * using the Haversine spherical formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates speed in km/h based on distance and elapsed time between two points.
 */
export function calculateSpeedKmH(
  lat1: number,
  lon1: number,
  time1: string | Date,
  lat2: number,
  lon2: number,
  time2: string | Date
): number {
  const t1 = typeof time1 === 'string' ? new Date(time1).getTime() : time1.getTime();
  const t2 = typeof time2 === 'string' ? new Date(time2).getTime() : time2.getTime();

  const elapsedSeconds = Math.abs(t2 - t1) / 1000;
  if (elapsedSeconds <= 0) return 0;

  const distanceKm = calculateHaversineDistanceKm(lat1, lon1, lat2, lon2);

  // If distance is negligible (under 5 meters), vehicle is stationary (GPS drift)
  if (distanceKm < 0.005) return 0;

  const hours = elapsedSeconds / 3600;
  const calculatedSpeed = distanceKm / hours;

  // Filter out impossible GPS jumps (> 180 km/h)
  if (calculatedSpeed > 180) return 0;

  return Math.round(calculatedSpeed);
}

/**
 * Computes the total cumulative road distance for an array of position records in km
 */
export function calculateTotalRouteDistance(
  points: { latitude: number; longitude: number }[]
): number {
  if (!points || points.length < 2) return 0;

  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = calculateHaversineDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    // Ignore small GPS jitter (under 3 meters)
    if (dist >= 0.003) {
      totalKm += dist;
    }
  }

  return Number(totalKm.toFixed(2));
}
