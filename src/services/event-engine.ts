/**
 * Event Evaluation & Alert Generation Engine
 * Evaluates telemetry against threshold rules, geofences, and alarms.
 */
import { NormalizedGpsPosition } from '../shared/types/protocols.js';
import { Vehicle, VehicleCurrentState, FleetEvent, AlertRule, Geofence } from '../shared/types/models.js';
import { EventType, EventSeverity } from '../shared/types/enums.js';
import { GeofenceEngine } from './geofence-engine.js';

export interface EventEvaluationResult {
  generatedEvents: FleetEvent[];
}

export class EventEngine {
  private vehicleGeofenceStates: Map<string, Set<string>> = new Map(); // vehicleId -> Set of geofenceIds inside

  public evaluate(
    position: NormalizedGpsPosition,
    vehicle: Vehicle,
    previousState: VehicleCurrentState | undefined,
    geofences: Geofence[],
    alertRules: AlertRule[]
  ): EventEvaluationResult {
    const generatedEvents: FleetEvent[] = [];
    const timestamp = position.timestamp;

    // 1. Overspeed Check
    const speedLimit = vehicle.speedLimit || 100;
    if (position.speed > speedLimit) {
      generatedEvents.push({
        id: `evt-spd-${vehicle.id}-${Date.now()}`,
        organizationId: vehicle.organizationId,
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        deviceId: vehicle.deviceId || position.deviceId,
        type: EventType.OVERSPEED,
        severity: EventSeverity.WARNING,
        timestamp,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        description: `سرعت غیرمجاز: ${position.speed} کیلومتر/ساعت (حد مجاز: ${speedLimit})`,
        metadata: { speed: position.speed, limit: speedLimit },
        isAcknowledged: false,
      });
    }

    // 2. Ignition Toggle
    if (previousState && previousState.ignition !== position.ignition) {
      const type = position.ignition ? EventType.IGNITION_ON : EventType.IGNITION_OFF;
      generatedEvents.push({
        id: `evt-ign-${vehicle.id}-${Date.now()}`,
        organizationId: vehicle.organizationId,
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        deviceId: vehicle.deviceId || position.deviceId,
        type,
        severity: EventSeverity.INFO,
        timestamp,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        description: position.ignition ? 'سویچ موتر روشن شد' : 'سویچ موتر خاموش شد',
        isAcknowledged: true,
      });
    }

    // 3. SOS / Alarm from tracker
    if (position.alarmType || position.rawMetadata?.alarm) {
      generatedEvents.push({
        id: `evt-sos-${vehicle.id}-${Date.now()}`,
        organizationId: vehicle.organizationId,
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        deviceId: vehicle.deviceId || position.deviceId,
        type: EventType.SOS,
        severity: EventSeverity.CRITICAL,
        timestamp,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        description: 'هشدار اضطراری (SOS) از ردیاب دریافت شد!',
        isAcknowledged: false,
      });
    }

    // 4. Low Battery
    if (position.batteryVoltage !== undefined && position.batteryVoltage < 11.2 && position.batteryVoltage > 2) {
      generatedEvents.push({
        id: `evt-bat-${vehicle.id}-${Date.now()}`,
        organizationId: vehicle.organizationId,
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        deviceId: vehicle.deviceId || position.deviceId,
        type: EventType.LOW_BATTERY,
        severity: EventSeverity.WARNING,
        timestamp,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        description: `ولتاژ بطری ضعیف است: ${position.batteryVoltage} ولت`,
        isAcknowledged: false,
      });
    }

    // 5. Geofence Evaluation (Enter / Exit)
    let currentInside = this.vehicleGeofenceStates.get(vehicle.id);
    if (!currentInside) {
      currentInside = new Set<string>();
      this.vehicleGeofenceStates.set(vehicle.id, currentInside);
    }

    for (const gf of geofences) {
      // Check if geofence monitors this vehicle
      if (gf.assignedVehicleIds.length > 0 && !gf.assignedVehicleIds.includes(vehicle.id)) {
        continue;
      }

      const isInside = GeofenceEngine.isPointInside(position.latitude, position.longitude, gf);
      const wasInside = currentInside.has(gf.id);

      if (isInside && !wasInside) {
        currentInside.add(gf.id);
        if (gf.notifyOnEnter) {
          generatedEvents.push({
            id: `evt-gfe-${vehicle.id}-${gf.id}-${Date.now()}`,
            organizationId: vehicle.organizationId,
            customerId: vehicle.customerId,
            vehicleId: vehicle.id,
            deviceId: vehicle.deviceId || position.deviceId,
            type: EventType.GEOFENCE_ENTER,
            severity: EventSeverity.INFO,
            timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            heading: position.heading,
            description: `ورود موتر به ساحه محدوده: ${gf.name}`,
            metadata: { geofenceId: gf.id, geofenceName: gf.name },
            isAcknowledged: false,
          });
        }
      } else if (!isInside && wasInside) {
        currentInside.delete(gf.id);
        if (gf.notifyOnExit) {
          generatedEvents.push({
            id: `evt-gfx-${vehicle.id}-${gf.id}-${Date.now()}`,
            organizationId: vehicle.organizationId,
            customerId: vehicle.customerId,
            vehicleId: vehicle.id,
            deviceId: vehicle.deviceId || position.deviceId,
            type: EventType.GEOFENCE_EXIT,
            severity: EventSeverity.WARNING,
            timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            heading: position.heading,
            description: `خروج موتر از ساحه محدوده: ${gf.name}`,
            metadata: { geofenceId: gf.id, geofenceName: gf.name },
            isAcknowledged: false,
          });
        }
      }
    }

    return { generatedEvents };
  }
}
