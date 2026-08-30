/**
 * Eelink Protocol Decoder
 * Binary protocol with 0x67 0x67 header
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class EelinkDecoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.EELINK;
  public readonly defaultPort = 5004;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    if (typeof buffer === 'string') return false;
    return buffer.length >= 5 && buffer[0] === 0x67 && buffer[1] === 0x67;
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    if (typeof buffer === 'string' || buffer.length < 5) {
      return { success: false, positions: [], errorMessage: 'Invalid Eelink packet' };
    }

    const type = buffer[2];
    const length = buffer.readUInt16BE(3);
    const serial = buffer.length >= 7 ? buffer.readUInt16BE(5) : 1;

    let identifiedImei = context.associatedImei;
    const positions: NormalizedGpsPosition[] = [];

    // Type 0x01: Login
    if (type === 0x01 && buffer.length >= 15) {
      let imeiStr = '';
      for (let i = 7; i < 15; i++) {
        imeiStr += buffer[i].toString(16).padStart(2, '0');
      }
      identifiedImei = imeiStr.substring(0, 15);
      const ack = Buffer.from([0x67, 0x67, 0x01, 0x00, 0x02, (serial >> 8) & 0xFF, serial & 0xFF]);
      return {
        success: true,
        positions: [],
        identifiedImei,
        isLoginPacket: true,
        responsePayload: ack,
      };
    }

    // Type 0x02: Location Report
    if ((type === 0x02 || type === 0x12) && buffer.length >= 24) {
      const timestampSeconds = buffer.readUInt32BE(7);
      const latRaw = buffer.readInt32BE(11);
      const lonRaw = buffer.readInt32BE(15);
      const speed = buffer[19];
      const course = buffer.readUInt16BE(20);

      const timestamp = new Date(timestampSeconds * 1000).toISOString();
      const latitude = latRaw / 1800000.0;
      const longitude = lonRaw / 1800000.0;

      positions.push({
        deviceId: context.associatedDeviceId || identifiedImei || 'unknown',
        imei: identifiedImei || '000000000000000',
        timestamp,
        latitude: parseFloat(latitude.toFixed(6)),
        longitude: parseFloat(longitude.toFixed(6)),
        speed,
        heading: course,
        ignition: speed > 0,
        gpsValid: true,
        batteryVoltage: 12.6,
        gsmSignal: 85,
        originalProtocol: ProtocolType.EELINK,
        transport: context.transport,
      });

      const ack = Buffer.from([0x67, 0x67, 0x02, 0x00, 0x02, (serial >> 8) & 0xFF, serial & 0xFF]);
      return {
        success: true,
        positions,
        identifiedImei,
        responsePayload: ack,
      };
    }

    return {
      success: true,
      positions,
      identifiedImei,
    };
  }
}
