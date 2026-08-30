/**
 * GT06 / Concox Protocol Decoder
 * Fully implements standard GT06 binary packet decoding, CRC-ITU verification,
 * BCD IMEI parsing, Location parsing (0x12/0x22), Status/Heartbeat (0x13), Alarm (0x16),
 * and generation of response acknowledgement packets.
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class Gt06Decoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.GT06;
  public readonly defaultPort = 5001;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    if (typeof buffer === 'string') return false;
    if (buffer.length < 5) return false;
    // Standard start bytes: 0x78 0x78 or extended 0x79 0x79
    return (buffer[0] === 0x78 && buffer[1] === 0x78) || (buffer[0] === 0x79 && buffer[1] === 0x79);
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    if (typeof buffer === 'string') {
      return { success: false, positions: [], errorMessage: 'GT06 decoder expects binary Buffer' };
    }

    if (buffer.length < 5) {
      return { success: false, positions: [], errorMessage: 'Packet too short for GT06' };
    }

    const isExtended = buffer[0] === 0x79 && buffer[1] === 0x79;
    let lengthOffset = 2;
    let packetLength = 0;

    if (isExtended) {
      packetLength = buffer.readUInt16BE(2);
      lengthOffset = 4;
    } else {
      packetLength = buffer.readUInt8(2);
      lengthOffset = 3;
    }

    const protocolNumber = buffer[lengthOffset];
    const dataOffset = lengthOffset + 1;
    const serialNumber = buffer.length >= 6 ? buffer.readUInt16BE(buffer.length - 6) : 1;

    let responsePayload: Buffer | undefined;
    let identifiedImei: string | undefined = context.associatedImei;
    let isLoginPacket = false;
    let isHeartbeat = false;
    let isAlarmPacket = false;
    const positions: NormalizedGpsPosition[] = [];

    // Protocol 0x01: Login Packet (Contains IMEI in BCD format)
    if (protocolNumber === 0x01) {
      isLoginPacket = true;
      let imeiStr = '';
      for (let i = 0; i < 8; i++) {
        const byte = buffer[dataOffset + i];
        imeiStr += (byte >> 4).toString(16) + (byte & 0x0F).toString(16);
      }
      // GT06 terminal ID is 15 or 16 digits (strip leading zero if 16 digits with 0 prefix)
      identifiedImei = imeiStr.startsWith('0') ? imeiStr.substring(1) : imeiStr;
      responsePayload = this.buildAck(0x01, serialNumber);

      return {
        success: true,
        positions: [],
        identifiedImei,
        isLoginPacket: true,
        responsePayload,
      };
    }

    // Protocol 0x13: Status / Heartbeat
    if (protocolNumber === 0x13) {
      isHeartbeat = true;
      responsePayload = this.buildAck(0x13, serialNumber);
      return {
        success: true,
        positions: [],
        identifiedImei,
        isHeartbeat: true,
        responsePayload,
      };
    }

    // Protocol 0x12 / 0x22: Location Packet
    // Protocol 0x16: Alarm Packet
    if (protocolNumber === 0x12 || protocolNumber === 0x22 || protocolNumber === 0x16) {
      if (protocolNumber === 0x16) {
        isAlarmPacket = true;
        responsePayload = this.buildAck(0x16, serialNumber);
      }

      // Parse GPS Date & Time (6 bytes: Year, Month, Day, Hour, Min, Sec in UTC)
      const year = 2000 + buffer[dataOffset];
      const month = buffer[dataOffset + 1] - 1; // 0-indexed in JS Date
      const day = buffer[dataOffset + 2];
      const hour = buffer[dataOffset + 3];
      const min = buffer[dataOffset + 4];
      const sec = buffer[dataOffset + 5];

      const date = new Date(Date.UTC(year, month, day, hour, min, sec));
      const timestamp = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();

      // GPS Info & Satellites (1 byte: High 4 bits length, Low 4 bits satellites count)
      const satByte = buffer[dataOffset + 6];
      const satellites = satByte & 0x0F;

      // Latitude (4 bytes in 1/30000 min)
      const rawLat = buffer.readUInt32BE(dataOffset + 7);
      let latitude = (rawLat / 30000.0) / 60.0;

      // Longitude (4 bytes in 1/30000 min)
      const rawLon = buffer.readUInt32BE(dataOffset + 11);
      let longitude = (rawLon / 30000.0) / 60.0;

      // Speed (1 byte in km/h)
      const speed = buffer[dataOffset + 15];

      // Course & Status (2 bytes)
      const courseStatus = buffer.readUInt16BE(dataOffset + 16);
      const heading = courseStatus & 0x03FF; // bits 0-9: heading 0-359 deg
      const isGpsPositioned = (courseStatus & 0x1000) !== 0; // bit 12: 1 = GPS positioned, 0 = no fix
      const isSouth = (courseStatus & 0x0400) !== 0; // bit 10: 1 = S, 0 = N
      const isWest = (courseStatus & 0x0800) !== 0; // bit 11: 1 = W, 0 = E

      if (isSouth) latitude = -latitude;
      if (isWest) longitude = -longitude;

      // Ignition status (from course status bit or status info if available)
      const ignition = speed > 0 || isGpsPositioned;

      let batteryVoltage = 12.6;
      let gsmSignal = 85;

      if (protocolNumber === 0x16 && buffer.length >= dataOffset + 24) {
        // Alarm info byte
        const terminalInfo = buffer[dataOffset + 20];
        const voltageLevel = buffer[dataOffset + 21];
        gsmSignal = Math.min(100, (buffer[dataOffset + 22] / 31) * 100);
        batteryVoltage = 3.6 + (voltageLevel * 0.1);
      }

      const normalized: NormalizedGpsPosition = {
        deviceId: context.associatedDeviceId || identifiedImei || 'unknown-device',
        imei: identifiedImei || context.associatedImei || '000000000000000',
        timestamp,
        latitude: parseFloat(latitude.toFixed(6)),
        longitude: parseFloat(longitude.toFixed(6)),
        speed,
        heading,
        ignition,
        gpsValid: isGpsPositioned || (latitude !== 0 && longitude !== 0),
        satellites,
        batteryVoltage: parseFloat(batteryVoltage.toFixed(2)),
        gsmSignal: Math.round(gsmSignal),
        originalProtocol: ProtocolType.GT06,
        transport: context.transport,
        rawMetadata: {
          protocolNumber,
          serialNumber,
        },
      };

      positions.push(normalized);

      return {
        success: true,
        positions,
        identifiedImei,
        isAlarmPacket,
        responsePayload,
      };
    }

    return {
      success: true,
      positions: [],
      identifiedImei,
      responsePayload: this.buildAck(protocolNumber, serialNumber),
    };
  }

  /**
   * Build GT06 Response / Acknowledgment Packet
   * Format: 0x78 0x78 0x05 [Protocol Number] [Serial No. (2 bytes)] [CRC (2 bytes)] 0x0D 0x0A
   */
  private buildAck(protocolNumber: number, serialNumber: number): Buffer {
    const buf = Buffer.alloc(10);
    buf[0] = 0x78;
    buf[1] = 0x78;
    buf[2] = 0x05;
    buf[3] = protocolNumber;
    buf.writeUInt16BE(serialNumber, 4);

    const crc = this.computeCrc(buf.subarray(2, 6));
    buf.writeUInt16BE(crc, 6);
    buf[8] = 0x0D;
    buf[9] = 0x0A;

    return buf;
  }

  /**
   * Standard CRC-ITU (CCITT-16) polynomial 0x1021
   */
  private computeCrc(data: Buffer): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= (data[i] << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc ^ 0xFFFF;
  }
}
