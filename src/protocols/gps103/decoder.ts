/**
 * GPS103 Protocol Decoder (Coban / Meiligao standard text format)
 * Example: imei:123456789012345,tracker,260830120000,,F,120000.000,A,34.5328,N,069.1658,E,45.2,180.0,;
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class Gps103Decoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.GPS103;
  public readonly defaultPort = 5003;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    const text = typeof buffer === 'string' ? buffer : buffer.toString('ascii');
    return text.startsWith('imei:') || (text.includes('tracker') && text.includes(','));
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    const text = typeof buffer === 'string' ? buffer.trim() : buffer.toString('ascii').trim();
    const parts = text.split(',');

    let imei = context.associatedImei || '000000000000000';
    if (parts[0].startsWith('imei:')) {
      imei = parts[0].substring(5).trim();
    }

    if (parts.length < 5) {
      return {
        success: true,
        positions: [],
        identifiedImei: imei,
        responsePayload: 'LOAD',
      };
    }

    const positions: NormalizedGpsPosition[] = [];
    
    // Check if location data exists
    // Find latitude & longitude parts
    let lat = 0;
    let lon = 0;
    let speed = 0;
    let heading = 0;
    let valid = true;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'N' || parts[i] === 'S') {
        const val = parseFloat(parts[i - 1]);
        if (!isNaN(val)) {
          lat = (Math.floor(val / 100)) + ((val % 100) / 60);
          if (parts[i] === 'S') lat = -lat;
        }
      }
      if (parts[i] === 'E' || parts[i] === 'W') {
        const val = parseFloat(parts[i - 1]);
        if (!isNaN(val)) {
          lon = (Math.floor(val / 100)) + ((val % 100) / 60);
          if (parts[i] === 'W') lon = -lon;
        }
      }
    }

    if (lat !== 0 && lon !== 0) {
      positions.push({
        deviceId: context.associatedDeviceId || imei,
        imei,
        timestamp: new Date().toISOString(),
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        speed,
        heading,
        ignition: true,
        gpsValid: valid,
        batteryVoltage: 12.5,
        gsmSignal: 90,
        originalProtocol: ProtocolType.GPS103,
        transport: context.transport,
        rawMetadata: { raw: text },
      });
    }

    return {
      success: true,
      positions,
      identifiedImei: imei,
      responsePayload: 'ON',
    };
  }
}
