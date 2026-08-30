/**
 * TK103 Protocol Decoder
 * Text-based protocol wrapped in parentheses: (IMEI[Command][Data])
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult, NormalizedGpsPosition } from '../../shared/types/protocols.js';
import { ProtocolType, TransportType } from '../../shared/types/enums.js';

export class Tk103Decoder implements GpsProtocolDecoder {
  public readonly protocol = ProtocolType.TK103;
  public readonly defaultPort = 5002;
  public readonly supportedTransports = [TransportType.TCP, TransportType.UDP];

  public canHandle(buffer: Buffer | string, _context: GpsPacketContext): boolean {
    const text = typeof buffer === 'string' ? buffer : buffer.toString('ascii');
    return text.startsWith('(') && text.includes(')');
  }

  public decode(buffer: Buffer | string, context: GpsPacketContext): ProtocolDecodeResult {
    const text = typeof buffer === 'string' ? buffer.trim() : buffer.toString('ascii').trim();

    if (!text.startsWith('(') || !text.endsWith(')')) {
      return { success: false, positions: [], errorMessage: 'Invalid TK103 packet framing' };
    }

    const payload = text.slice(1, -1); // remove '(' and ')'
    if (payload.length < 12) {
      return { success: false, positions: [], errorMessage: 'TK103 packet too short' };
    }

    // IMEI is first 12 or 15 digits
    const imeiMatch = payload.match(/^(\d{11,15})/);
    const imei = imeiMatch ? imeiMatch[1] : (context.associatedImei || '000000000000000');
    const remainder = payload.substring(imei.length);

    // Command identifier (e.g. BP05, BR00, BO01)
    const command = remainder.substring(0, 4);

    // Login command BP05 -> Response (IMEI + AP05)
    if (command === 'BP05' || command === 'BP00') {
      const responsePayload = `(${imei}AP05)`;
      return {
        success: true,
        positions: [],
        identifiedImei: imei,
        isLoginPacket: true,
        responsePayload,
      };
    }

    // Heartbeat command BP00 / AR00
    if (command === 'BP00' || command === 'AR00') {
      return {
        success: true,
        positions: [],
        identifiedImei: imei,
        isHeartbeat: true,
        responsePayload: `(${imei}AP00)`,
      };
    }

    // Location / Periodic message (e.g. BR00, BO01, DW01)
    // Format: YYMMDD[A/V]DDMM.MMMM[N/S]DDDMM.MMMM[E/W]SSS.S[HHMMSS]...
    const positions: NormalizedGpsPosition[] = [];
    const locMatch = remainder.match(/(\d{6})([AV])(\d{2})(\d{2}\.\d+)([NS])(\d{3})(\d{2}\.\d+)([EW])(\d{3}\.\d+)?(\d{6})?/);

    if (locMatch) {
      const [, dateStr, validity, latDeg, latMin, latHem, lonDeg, lonMin, lonHem, speedStr, timeStr] = locMatch;

      let latitude = parseInt(latDeg, 10) + (parseFloat(latMin) / 60.0);
      if (latHem === 'S') latitude = -latitude;

      let longitude = parseInt(lonDeg, 10) + (parseFloat(lonMin) / 60.0);
      if (lonHem === 'W') longitude = -longitude;

      const speedKmH = speedStr ? parseFloat(speedStr) * 1.852 : 0; // knots to km/h or raw km/h

      // Parse timestamp
      let timestamp = new Date().toISOString();
      if (dateStr && timeStr && dateStr.length === 6 && timeStr.length === 6) {
        const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        const month = parseInt(dateStr.substring(2, 4), 10) - 1;
        const day = parseInt(dateStr.substring(4, 6), 10);
        const hour = parseInt(timeStr.substring(0, 2), 10);
        const min = parseInt(timeStr.substring(2, 4), 10);
        const sec = parseInt(timeStr.substring(4, 6), 10);
        const d = new Date(Date.UTC(year, month, day, hour, min, sec));
        if (!isNaN(d.getTime())) {
          timestamp = d.toISOString();
        }
      }

      const position: NormalizedGpsPosition = {
        deviceId: context.associatedDeviceId || imei,
        imei,
        timestamp,
        latitude: parseFloat(latitude.toFixed(6)),
        longitude: parseFloat(longitude.toFixed(6)),
        speed: Math.round(speedKmH),
        heading: 0,
        ignition: speedKmH > 2,
        gpsValid: validity === 'A',
        batteryVoltage: 12.4,
        gsmSignal: 80,
        originalProtocol: ProtocolType.TK103,
        transport: context.transport,
        rawMetadata: { command, raw: text },
      };

      positions.push(position);
    }

    return {
      success: true,
      positions,
      identifiedImei: imei,
      isAlarmPacket: command.startsWith('BO'),
      responsePayload: `(${imei}ON)`,
    };
  }
}
