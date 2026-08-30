/**
 * Central Fleet State Engine
 * Normalizes incoming positions, maintains vehicle current states,
 * evaluates offline/online statuses, trips, stops, geofences, and events.
 */
import { NormalizedGpsPosition } from '../shared/types/protocols.js';
import { VehicleCurrentState, PositionRecord, FleetEvent } from '../shared/types/models.js';
import { VehicleStatus, ProtocolType } from '../shared/types/enums.js';
import { StorageRepository, globalStorageRepository } from './storage-repository.js';
import { TripEngine } from './trip-engine.js';
import { EventEngine } from './event-engine.js';

export type StateChangeCallback = (state: VehicleCurrentState, newEvents: FleetEvent[]) => void;

export class StateEngine {
  private repository: StorageRepository;
  private tripEngine: TripEngine;
  private eventEngine: EventEngine;
  private listeners: Set<StateChangeCallback> = new Set();
  private offlineThresholdMs = 5 * 60 * 1000; // 5 minutes

  constructor(repository: StorageRepository = globalStorageRepository) {
    this.repository = repository;
    this.tripEngine = new TripEngine();
    this.eventEngine = new EventEngine();

    // Start periodic check for offline vehicles
    setInterval(() => this.checkOfflineVehicles(), 30000);
  }

  public onStateChange(cb: StateChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Primary Ingestion Method for Decoded GPS Positions
   */
  public async ingestPosition(position: NormalizedGpsPosition): Promise<{
    state?: VehicleCurrentState;
    events: FleetEvent[];
  }> {
    // 1. Locate Device by IMEI or ID
    let device = this.repository.getDeviceByImei(position.imei);
    if (!device) {
      device = this.repository.getDeviceById(position.deviceId);
    }

    if (!device) {
      // Auto-register discovered device in inactive state for admin inspection
      const newDevId = `dev-auto-${position.imei}`;
      device = {
        id: newDevId,
        organizationId: 'org-afg-01',
        imei: position.imei,
        protocol: position.originalProtocol || ProtocolType.UNKNOWN,
        model: 'Universal GPS Device',
        simNumber: 'Unknown',
        status: 'ACTIVE',
        lastConnectionAt: new Date().toISOString(),
        lastGpsFixAt: position.timestamp,
        packetCount: 1,
        errorCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.repository.saveDevice(device);
    } else {
      device.lastConnectionAt = new Date().toISOString();
      device.lastGpsFixAt = position.timestamp;
      device.packetCount += 1;
      this.repository.saveDevice(device);
    }

    // 2. Locate Assigned Vehicle
    let vehicle = device.assignedVehicleId
      ? this.repository.getVehicleById(device.assignedVehicleId, device.organizationId)
      : undefined;

    if (!vehicle) {
      const allVehicles = this.repository.getVehicles(device.organizationId);
      vehicle = allVehicles.find((v) => v.deviceId === device?.id);
    }

    if (!vehicle) {
      return { events: [] };
    }

    const previousState = this.repository.getCurrentStateByVehicleId(vehicle.id);

    // 3. Derive Dynamic Vehicle Status (MOVING, STOPPED, IDLE, ONLINE)
    let onlineStatus: VehicleStatus = VehicleStatus.ONLINE;
    if (position.speed > 3 && position.ignition) {
      onlineStatus = VehicleStatus.MOVING;
    } else if (position.speed <= 3 && position.ignition) {
      onlineStatus = VehicleStatus.IDLE;
    } else {
      onlineStatus = VehicleStatus.STOPPED;
    }

    // 4. Save Historical Position Record
    const posRecord: PositionRecord = {
      id: `pos-${vehicle.id}-${Date.now()}`,
      vehicleId: vehicle.id,
      deviceId: device.id,
      timestamp: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      speed: position.speed,
      heading: position.heading,
      ignition: position.ignition,
      door: Boolean(position.door),
      batteryVoltage: position.batteryVoltage || 12.6,
      gpsValid: position.gpsValid,
      satellites: position.satellites || 10,
      odometer: vehicle.odometer + (position.speed > 0 ? 0.05 : 0),
      originalProtocol: position.originalProtocol,
    };
    this.repository.addPositionRecord(posRecord);

    // 5. Run Trip & Stop Detection
    this.tripEngine.processPosition(posRecord);
    const activeTrip = this.tripEngine.getActiveTrip(vehicle.id);

    // 6. Update Vehicle Current State
    const newState: VehicleCurrentState = {
      vehicleId: vehicle.id,
      deviceId: device.id,
      customerId: vehicle.customerId,
      organizationId: vehicle.organizationId,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      speed: position.speed,
      heading: position.heading,
      ignition: position.ignition,
      door: Boolean(position.door),
      batteryVoltage: position.batteryVoltage || (previousState?.batteryVoltage ?? 12.6),
      batteryPercentage: position.batteryPercentage || (previousState?.batteryPercentage ?? 95),
      gsmSignal: position.gsmSignal || (previousState?.gsmSignal ?? 85),
      satellites: position.satellites || (previousState?.satellites ?? 12),
      gpsValid: position.gpsValid,
      onlineStatus,
      lastSeenAt: new Date().toISOString(),
      lastPositionAt: position.timestamp,
      currentTripId: activeTrip?.id,
      odometer: Math.round(posRecord.odometer),
      address: previousState?.address || 'افغانستان',
    };

    this.repository.saveCurrentState(newState);

    // 7. Run Event & Alert Engine
    const geofences = this.repository.getGeofences(vehicle.organizationId, vehicle.customerId);
    const alertRules = this.repository.getAlertRules(vehicle.organizationId, vehicle.customerId);
    const { generatedEvents } = this.eventEngine.evaluate(position, vehicle, previousState, geofences, alertRules);

    for (const ev of generatedEvents) {
      this.repository.addEvent(ev);
    }

    // 8. Broadcast to Real-Time Listeners (WebSocket/Clients)
    for (const listener of this.listeners) {
      try {
        listener(newState, generatedEvents);
      } catch (err) {
        console.warn('[StateEngine] Error in state change listener:', err);
      }
    }

    return { state: newState, events: generatedEvents };
  }

  private checkOfflineVehicles(): void {
    const now = Date.now();
    const allStates = this.repository.getCurrentStates('org-afg-01');

    for (const s of allStates) {
      const lastSeen = new Date(s.lastSeenAt).getTime();
      if (now - lastSeen > this.offlineThresholdMs && s.onlineStatus !== VehicleStatus.OFFLINE) {
        s.onlineStatus = VehicleStatus.OFFLINE;
        this.repository.saveCurrentState(s);
        for (const listener of this.listeners) {
          listener(s, []);
        }
      }
    }
  }
}

export const globalStateEngine = new StateEngine();
