/**
 * Normalized GPS Protocol Definitions & Standard Models
 */
import { ProtocolType, TransportType } from './enums.js';

export interface NormalizedGpsPosition {
  deviceId: string;
  imei: string;
  timestamp: string; // ISO-8601
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number; // km/h
  heading: number; // 0-359 degrees
  ignition: boolean;
  door?: boolean;
  gpsValid: boolean;
  batteryVoltage?: number; // Volts
  batteryPercentage?: number; // 0-100%
  gsmSignal?: number; // 0-100% or CSQ 0-31
  odometer?: number; // Total km
  fuelLevel?: number; // Liters or percentage
  temperature?: number; // Celsius
  satellites?: number;
  alarmType?: string;
  rawMetadata?: Record<string, unknown>;
  originalProtocol: ProtocolType;
  transport: TransportType;
}

export interface GpsPacketContext {
  remoteAddress: string;
  remotePort: number;
  transport: TransportType;
  sessionId: string;
  associatedImei?: string;
  associatedDeviceId?: string;
}

export interface ProtocolDecodeResult {
  success: boolean;
  positions: NormalizedGpsPosition[];
  responsePayload?: Buffer | string;
  identifiedImei?: string;
  isLoginPacket?: boolean;
  isHeartbeat?: boolean;
  isAlarmPacket?: boolean;
  errorMessage?: string;
  rawLength?: number;
}

export interface GpsProtocolDecoder {
  readonly protocol: ProtocolType;
  readonly defaultPort: number;
  readonly supportedTransports: TransportType[];

  /**
   * Determine if the raw packet matches this protocol's framing/signatures
   */
  canHandle(buffer: Buffer | string, context: GpsPacketContext): boolean;

  /**
   * Parse raw packet buffer into normalized positions and acknowledgment payload
   */
  decode(buffer: Buffer | string, context: GpsPacketContext): Promise<ProtocolDecodeResult> | ProtocolDecodeResult;

  /**
   * Encode an outgoing command for this protocol
   */
  encodeCommand?(commandType: string, params: Record<string, unknown>, imei: string): Buffer | string | null;
}
