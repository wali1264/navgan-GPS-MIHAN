/**
 * Core Domain Enums for GPS Fleet Tracking Platform
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  OPERATOR = 'OPERATOR',
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
}

export enum VehicleStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MOVING = 'MOVING',
  STOPPED = 'STOPPED',
  IDLE = 'IDLE',
  UNKNOWN = 'UNKNOWN',
}

export enum VehicleType {
  CAR = 'CAR',                 // موتر سواری
  TRUCK = 'TRUCK',             // لاری / موتر باربری
  MOTORCYCLE = 'MOTORCYCLE',   // موترسایکل
  BUS = 'BUS',                 // بس / ملی‌بس
  VAN = 'VAN',                 // ون / هایس
  TAXI = 'TAXI',               // تکسی
  PICKUP = 'PICKUP',           // پیک‌اپ
  HEAVY_EQUIPMENT = 'HEAVY',   // ماشین‌آلات سنگین
  OTHER = 'OTHER',             // سایر
}

export enum EventType {
  OVERSPEED = 'OVERSPEED',
  IGNITION_ON = 'IGNITION_ON',
  IGNITION_OFF = 'IGNITION_OFF',
  GEOFENCE_ENTER = 'GEOFENCE_ENTER',
  GEOFENCE_EXIT = 'GEOFENCE_EXIT',
  LONG_STOP = 'LONG_STOP',
  GPS_OFFLINE = 'GPS_OFFLINE',
  GPS_ONLINE = 'GPS_ONLINE',
  LOW_BATTERY = 'LOW_BATTERY',
  POWER_CUT = 'POWER_CUT',
  DOOR_OPEN = 'DOOR_OPEN',
  DOOR_CLOSED = 'DOOR_CLOSED',
  SOS = 'SOS',
  HARSH_BRAKING = 'HARSH_BRAKING',
  HARSH_ACCELERATION = 'HARSH_ACCELERATION',
}

export enum EventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export enum CommandType {
  POSITION_SINGLE = 'POSITION_SINGLE',
  SET_REPORT_INTERVAL = 'SET_REPORT_INTERVAL',
  ENGINE_STOP = 'ENGINE_STOP',
  ENGINE_RESUME = 'ENGINE_RESUME',
  REBOOT_DEVICE = 'REBOOT_DEVICE',
  CUSTOM = 'CUSTOM',
}

export enum ProtocolType {
  GT06 = 'GT06',
  TK103 = 'TK103',
  GPS103 = 'GPS103',
  EELINK = 'EELINK',
  CUSTOM_JSON = 'CUSTOM_JSON',
  TELTONIKA = 'TELTONIKA',
  UNKNOWN = 'UNKNOWN',
}

export enum TransportType {
  TCP = 'TCP',
  UDP = 'UDP',
  HTTP = 'HTTP',
}

export enum GeofenceType {
  CIRCLE = 'CIRCLE',
  POLYGON = 'POLYGON',
}
