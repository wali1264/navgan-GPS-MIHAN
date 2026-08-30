/**
 * Database Models and Entity Interfaces
 */
import {
  UserRole,
  VehicleStatus,
  VehicleType,
  EventType,
  EventSeverity,
  CommandStatus,
  CommandType,
  ProtocolType,
  TransportType,
  GeofenceType
} from './enums.js';

export interface Organization {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  city: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  customerId?: string; // If customer role
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  companyName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string; // e.g. Kabul, Herat, Mazar, Kandahar
  activeVehiclesCount: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  organizationId: string;
  customerId?: string;
  name: string;
  phone: string;
  licenseNumber: string;
  assignedVehicleId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  notes?: string;
  createdAt: string;
}

export interface Device {
  id: string;
  organizationId: string;
  imei: string;
  protocol: ProtocolType;
  model: string;
  simNumber: string;
  simOperator?: string; // e.g. Roshan, Afghan Wireless, Etisalat, MTN, Salaam
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  assignedVehicleId?: string;
  lastConnectionAt?: string;
  lastGpsFixAt?: string;
  packetCount: number;
  errorCount: number;
  firmwareVersion?: string;
  notes?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  organizationId: string;
  customerId: string;
  deviceId?: string;
  driverId?: string;
  plateNumber: string; // e.g. "کابل 4 - 82910"
  vehicleName: string; // e.g. "تویوتا کرولا سفید"
  vehicleType: VehicleType;
  brand: string; // e.g. Toyota
  model: string; // e.g. Corolla / Hilux / Prado
  year: number;
  color: string;
  vin?: string;
  fuelType?: 'PETROL' | 'DIESEL' | 'CNG' | 'HYBRID';
  speedLimit: number; // km/h (default e.g. 100)
  odometer: number; // km
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
}

export interface VehicleCurrentState {
  vehicleId: string;
  deviceId: string;
  customerId: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading: number;
  ignition: boolean;
  door: boolean;
  batteryVoltage: number;
  batteryPercentage: number;
  gsmSignal: number;
  satellites: number;
  gpsValid: boolean;
  onlineStatus: VehicleStatus; // ONLINE, OFFLINE, MOVING, STOPPED, IDLE
  lastSeenAt: string;
  lastPositionAt: string;
  currentTripId?: string;
  odometer: number;
  address?: string;
}

export interface PositionRecord {
  id: string;
  vehicleId: string;
  deviceId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading: number;
  ignition: boolean;
  door: boolean;
  batteryVoltage: number;
  gpsValid: boolean;
  satellites: number;
  odometer: number;
  originalProtocol: ProtocolType;
}

export interface Trip {
  id: string;
  vehicleId: string;
  deviceId: string;
  driverId?: string;
  startTime: string;
  endTime?: string;
  startLatitude: number;
  startLongitude: number;
  startAddress?: string;
  endLatitude?: number;
  endLongitude?: number;
  endAddress?: string;
  distanceKm: number;
  durationMinutes: number;
  averageSpeedKmH: number;
  maxSpeedKmH: number;
  stopCount: number;
  idleDurationMinutes: number;
  status: 'ONGOING' | 'COMPLETED';
}

export interface VehicleStop {
  id: string;
  vehicleId: string;
  tripId?: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  address?: string;
  ignition: boolean;
}

export interface Geofence {
  id: string;
  organizationId: string;
  customerId: string;
  name: string; // e.g. "دفتر مرکزی کابل"
  description?: string;
  type: GeofenceType;
  // For circle
  centerLatitude?: number;
  centerLongitude?: number;
  radiusMeters?: number;
  // For polygon
  coordinates?: Array<[number, number]>; // [lat, lng] array
  color: string;
  assignedVehicleIds: string[]; // Vehicles monitored
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  createdAt: string;
}

export interface FleetEvent {
  id: string;
  organizationId: string;
  customerId: string;
  vehicleId: string;
  deviceId: string;
  type: EventType;
  severity: EventSeverity;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  description: string;
  metadata?: Record<string, unknown>;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: string;
  organizationId: string;
  customerId: string;
  name: string;
  eventType: EventType;
  severity: EventSeverity;
  vehicleIds: string[]; // Empty for all
  isEnabled: boolean;
  speedThreshold?: number;
  idleThresholdMinutes?: number;
  geofenceIds?: string[];
  channels: Array<'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL' | 'TELEGRAM' | 'WHATSAPP'>;
  recipients: string[];
  createdAt: string;
}

export interface DeviceCommand {
  id: string;
  organizationId: string;
  deviceId: string;
  vehicleId: string;
  commandType: CommandType;
  rawCommandText?: string;
  parameters: Record<string, unknown>;
  status: CommandStatus;
  sentAt?: string;
  acknowledgedAt?: string;
  errorMessage?: string;
  createdById: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  organizationId: string;
  vehicleId: string;
  serviceType: string; // e.g. تعویض روغن، تعویض تایر، سرویس بریک
  date: string;
  odometerAtService: number;
  costAfghani: number; // Cost in AFN
  serviceProvider?: string;
  notes?: string;
  nextServiceOdometer?: number;
  nextServiceDate?: string;
  status: 'COMPLETED' | 'SCHEDULED';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DeviceSession {
  sessionId: string;
  deviceId?: string;
  imei?: string;
  remoteAddress: string;
  remotePort: number;
  transport: TransportType;
  protocol: ProtocolType;
  connectedAt: string;
  lastPacketAt: string;
  lastValidPositionAt?: string;
  packetCount: number;
  errorCount: number;
  lastRawPayloadSample?: string;
  lastDecoderError?: string;
}

export interface DiagnosticMetrics {
  activeSessions: number;
  totalPacketsReceived: number;
  totalPositionsDecoded: number;
  totalErrors: number;
  bytesReceived: number;
  uptimeSeconds: number;
  listenerPorts: {
    tcp: number[];
    udp: number[];
  };
}
