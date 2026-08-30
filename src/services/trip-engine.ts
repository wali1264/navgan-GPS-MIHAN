/**
 * Trip & Stop Detection Engine
 * Analyzes continuous GPS points to compute trips, stops, idle time, and mileage.
 */
import { Trip, VehicleStop, PositionRecord } from '../shared/types/models.js';
import { GeofenceEngine } from './geofence-engine.js';

export class TripEngine {
  private activeTrips: Map<string, Trip> = new Map();
  private activeStops: Map<string, VehicleStop> = new Map();

  /**
   * Process a new incoming position and update trip/stop state
   */
  public processPosition(pos: PositionRecord): { newTrip?: Trip; completedTrip?: Trip; newStop?: VehicleStop } {
    let newTrip: Trip | undefined;
    let completedTrip: Trip | undefined;
    let newStop: VehicleStop | undefined;

    const currentTrip = this.activeTrips.get(pos.vehicleId);
    const isMoving = pos.speed > 3 && pos.ignition;

    if (isMoving) {
      // Vehicle is moving: if a stop was active, close it
      const currentStop = this.activeStops.get(pos.vehicleId);
      if (currentStop) {
        currentStop.endTime = pos.timestamp;
        const start = new Date(currentStop.startTime).getTime();
        const end = new Date(pos.timestamp).getTime();
        currentStop.durationMinutes = Math.round((end - start) / 60000);
        newStop = { ...currentStop };
        this.activeStops.delete(pos.vehicleId);
      }

      if (!currentTrip) {
        // Start a new trip
        const trip: Trip = {
          id: `trip-${pos.vehicleId}-${Date.now()}`,
          vehicleId: pos.vehicleId,
          deviceId: pos.deviceId,
          startTime: pos.timestamp,
          startLatitude: pos.latitude,
          startLongitude: pos.longitude,
          distanceKm: 0,
          durationMinutes: 0,
          averageSpeedKmH: pos.speed,
          maxSpeedKmH: pos.speed,
          stopCount: 0,
          idleDurationMinutes: 0,
          status: 'ONGOING',
        };
        this.activeTrips.set(pos.vehicleId, trip);
        newTrip = trip;
      } else {
        // Update ongoing trip
        const distKm = GeofenceEngine.calculateDistanceMeters(
          currentTrip.endLatitude || currentTrip.startLatitude,
          currentTrip.endLongitude || currentTrip.startLongitude,
          pos.latitude,
          pos.longitude
        ) / 1000.0;

        currentTrip.distanceKm = parseFloat((currentTrip.distanceKm + distKm).toFixed(2));
        currentTrip.endLatitude = pos.latitude;
        currentTrip.endLongitude = pos.longitude;
        currentTrip.maxSpeedKmH = Math.max(currentTrip.maxSpeedKmH, pos.speed);

        const start = new Date(currentTrip.startTime).getTime();
        const now = new Date(pos.timestamp).getTime();
        currentTrip.durationMinutes = Math.max(1, Math.round((now - start) / 60000));
        currentTrip.averageSpeedKmH = Math.round((currentTrip.distanceKm / (currentTrip.durationMinutes / 60)) || pos.speed);
      }
    } else {
      // Vehicle is stopped or idle
      if (currentTrip && !pos.ignition) {
        // Ignition turned off -> Complete the ongoing trip
        currentTrip.endTime = pos.timestamp;
        currentTrip.endLatitude = pos.latitude;
        currentTrip.endLongitude = pos.longitude;
        currentTrip.status = 'COMPLETED';
        completedTrip = { ...currentTrip };
        this.activeTrips.delete(pos.vehicleId);
      }

      // Record or update stop
      let stop = this.activeStops.get(pos.vehicleId);
      if (!stop) {
        stop = {
          id: `stop-${pos.vehicleId}-${Date.now()}`,
          vehicleId: pos.vehicleId,
          tripId: currentTrip?.id,
          startTime: pos.timestamp,
          durationMinutes: 0,
          latitude: pos.latitude,
          longitude: pos.longitude,
          ignition: pos.ignition,
        };
        this.activeStops.set(pos.vehicleId, stop);
      } else {
        const start = new Date(stop.startTime).getTime();
        const now = new Date(pos.timestamp).getTime();
        stop.durationMinutes = Math.round((now - start) / 60000);
      }
    }

    return { newTrip, completedTrip, newStop };
  }

  public getActiveTrip(vehicleId: string): Trip | undefined {
    return this.activeTrips.get(vehicleId);
  }
}
