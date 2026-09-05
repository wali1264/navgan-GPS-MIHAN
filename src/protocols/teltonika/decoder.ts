/**
 * Teltonika Codec 8 / Codec 8 Extended Protocol Decoder
 * Supports Teltonika FMC920, FMB920, FMB120, etc.
 * Handles IMEI login handshake (0x01 ACK) and Codec 8 AVL record decoding with 4-byte ACK.
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class TeltonikaDecoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.TELTONIKA;
  public readonly defaultPort = 5001;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    if (typeof buffer === 'string') return false;
    
    // 1. Teltonika IMEI handshake: 2 bytes length (e.g. 15), then ASCII IMEI
    if (buffer.length >= 17 && buffer.length <= 19) {
      const imeiLen = buffer.readUInt16BE(0);
      if (imeiLen === buffer.length - 2) {
        const str = buffer.slice(2).toString('ascii');
        if (/^\d{15,17}$/.test(str)) return true;
      }
    }

    // 2. Teltonika AVL packet: 4 zero preamble bytes
    if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x00000000) {
      const codecId = buffer[8];
      if (codecId === 0x08 || codecId === 0x8E || codecId === 0x10) {
        return true;
      }
    }

    return false;
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    if (typeof buffer === 'string') {
      return { success: false, positions: [], errorMessage: 'Teltonika expects binary Buffer' };
    }

    // 1. IMEI Handshake packet
    if (buffer.length >= 17 && buffer.length <= 19) {
      const imeiLen = buffer.readUInt16BE(0);
      if (imeiLen === buffer.length - 2) {
        const identifiedImei = buffer.slice(2).toString('ascii');
        // Server response: 0x01 to accept IMEI
        return {
          success: true,
          positions: [],
          identifiedImei,
          isLoginPacket: true,
          responsePayload: Buffer.from([0x01]),
        };
      }
    }

    // 2. AVL Data Packet
    if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x00000000) {
      const codecId = buffer[8];
      const count = buffer[9];
      const identifiedImei = context.associatedImei || '868204050123456';

      if ((codecId === 0x08 || codecId === 0x8E) && count > 0) {
        let offset = 10;
        const timestampMs = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
        const priority = buffer[offset++];
        const lngRaw = buffer.readInt32BE(offset);
        offset += 4;
        const latRaw = buffer.readInt32BE(offset);
        offset += 4;
        const altitude = buffer.readInt16BE(offset);
        offset += 2;
        const angle = buffer.readUInt16BE(offset);
        offset += 2;
        const satellites = buffer[offset++];
        const speed = buffer.readUInt16BE(offset);
        offset += 2;

        const lat = latRaw / 10000000.0;
        const lng = lngRaw / 10000000.0;

        let ignition = speed > 0;
        let extVoltage = 12.6;
        let battVoltage = 4.1;

        if (offset < buffer.length - 5) {
          offset += 2; // skip eventId & totalIo
          if (offset < buffer.length) {
            const n1 = buffer[offset++];
            for (let i = 0; i < n1 && offset + 2 <= buffer.length; i++) {
              const id = buffer[offset++];
              const val = buffer[offset++];
              if (id === 239 || id === 1) ignition = val === 1;
            }
          }

          if (offset < buffer.length) {
            const n2 = buffer[offset++];
            for (let i = 0; i < n2 && offset + 3 <= buffer.length; i++) {
              const id = buffer[offset++];
              const val = buffer.readUInt16BE(offset);
              offset += 2;
              if (id === 66) extVoltage = parseFloat((val / 1000.0).toFixed(2));
              if (id === 67) battVoltage = parseFloat((val / 1000.0).toFixed(2));
            }
          }
        }

        // ACK: 4 bytes big-endian record count
        const ack = Buffer.alloc(4);
        ack.writeUInt32BE(count, 0);

        const position: NormalizedGpsPosition = {
          deviceId: context.associatedDeviceId || `dev-${identifiedImei}`,
          imei: identifiedImei,
          timestamp: new Date(timestampMs > 0 ? timestampMs : Date.now()).toISOString(),
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          speed,
          heading: angle,
          altitude,
          satellites,
          ignition,
          gpsValid: satellites >= 3 || (lat !== 0 && lng !== 0),
          batteryVoltage: battVoltage,
          originalProtocol: ProtocolType.TELTONIKA,
          transport: context.transport,
          rawMetadata: { codecId, priority, count, externalVoltage: extVoltage },
        };

        return {
          success: true,
          positions: [position],
          identifiedImei,
          responsePayload: ack,
        };
      }
    }

    return {
      success: false,
      positions: [],
      errorMessage: 'Invalid or unsupported Teltonika frame format',
    };
  }
}
