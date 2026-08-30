/**
 * Custom Telemetry JSON & Extensible Protocol Adapter
 * Handles structured JSON telemetry payloads for mobile trackers, IoT gateways, and simulators.
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class CustomJsonDecoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.CUSTOM_JSON;
  public readonly defaultPort = 5005;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP, TransportType.HTTP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    const text = typeof buffer === 'string' ? buffer.trim() : buffer.toString('utf-8').trim();
    return (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    const text = typeof buffer === 'string' ? buffer.trim() : buffer.toString('utf-8').trim();

    try {
      const data = JSON.parse(text);
      const positions: NormalizedGpsPosition[] = [];
      const records = Array.isArray(data) ? data : [data];

      let identifiedImei = context.associatedImei;

      for (const rec of records) {
        const imei = String(rec.imei || rec.deviceId || identifiedImei || '000000000000000');
        identifiedImei = imei;

        const pos: NormalizedGpsPosition = {
          deviceId: rec.deviceId || imei,
          imei,
          timestamp: rec.timestamp ? new Date(rec.timestamp).toISOString() : new Date().toISOString(),
          latitude: typeof rec.latitude === 'number' ? rec.latitude : parseFloat(rec.latitude || '0'),
          longitude: typeof rec.longitude === 'number' ? rec.longitude : parseFloat(rec.longitude || '0'),
          altitude: typeof rec.altitude === 'number' ? rec.altitude : undefined,
          speed: typeof rec.speed === 'number' ? Math.round(rec.speed) : parseInt(rec.speed || '0', 10),
          heading: typeof rec.heading === 'number' ? rec.heading : parseInt(rec.heading || '0', 10),
          ignition: Boolean(rec.ignition),
          door: typeof rec.door === 'boolean' ? rec.door : undefined,
          gpsValid: rec.gpsValid !== undefined ? Boolean(rec.gpsValid) : true,
          batteryVoltage: typeof rec.batteryVoltage === 'number' ? rec.batteryVoltage : 12.6,
          batteryPercentage: typeof rec.batteryPercentage === 'number' ? rec.batteryPercentage : 95,
          gsmSignal: typeof rec.gsmSignal === 'number' ? rec.gsmSignal : 90,
          odometer: typeof rec.odometer === 'number' ? rec.odometer : undefined,
          satellites: typeof rec.satellites === 'number' ? rec.satellites : 12,
          alarmType: rec.alarmType || undefined,
          rawMetadata: rec.metadata || undefined,
          originalProtocol: ProtocolType.CUSTOM_JSON,
          transport: context.transport,
        };

        positions.push(pos);
      }

      return {
        success: true,
        positions,
        identifiedImei,
        isLoginPacket: Boolean(data.login),
        isAlarmPacket: Boolean(data.alarmType),
        responsePayload: JSON.stringify({ status: 'ACK', count: positions.length }),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        positions: [],
        errorMessage: `JSON parse error in CustomJsonDecoder: ${msg}`,
      };
    }
  }
}
