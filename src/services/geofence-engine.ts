/**
 * Geofencing Engine
 * High-performance spatial evaluation for circle and polygon geofences.
 */
import { Geofence } from '../shared/types/models.js';
import { GeofenceType } from '../shared/types/enums.js';

export class GeofenceEngine {
  /**
   * Calculates distance in meters between two lat/lng coordinates (Haversine Formula)
   */
  public static calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates if a point [lat, lon] is inside a Geofence
   */
  public static isPointInside(lat: number, lon: number, geofence: Geofence): boolean {
    if (geofence.type === GeofenceType.CIRCLE) {
      if (geofence.centerLatitude === undefined || geofence.centerLongitude === undefined || geofence.radiusMeters === undefined) {
        return false;
      }
      const dist = this.calculateDistanceMeters(lat, lon, geofence.centerLatitude, geofence.centerLongitude);
      return dist <= geofence.radiusMeters;
    }

    if (geofence.type === GeofenceType.POLYGON) {
      if (!geofence.coordinates || geofence.coordinates.length < 3) {
        return false;
      }
      return this.isPointInPolygon(lat, lon, geofence.coordinates);
    }

    return false;
  }

  /**
   * Ray-casting point-in-polygon algorithm
   */
  private static isPointInPolygon(lat: number, lon: number, polygon: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
