/**
 * Device Session Manager
 * Maintains active GPS hardware connections, telemetry statistics, and authentication associations.
 */
import { DeviceSession } from '../shared/types/models.js';
import { ProtocolType, TransportType } from '../shared/types/enums.js';

export class SessionManager {
  private sessions: Map<string, DeviceSession> = new Map();
  private imeiToSessionId: Map<string, string> = new Map();

  public createOrUpdateSession(
    sessionId: string,
    remoteAddress: string,
    remotePort: number,
    transport: TransportType,
    protocol: ProtocolType = ProtocolType.UNKNOWN,
    imei?: string
  ): DeviceSession {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        remoteAddress,
        remotePort,
        transport,
        protocol,
        imei,
        connectedAt: new Date().toISOString(),
        lastPacketAt: new Date().toISOString(),
        packetCount: 1,
        errorCount: 0,
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastPacketAt = new Date().toISOString();
      session.packetCount += 1;
      if (protocol !== ProtocolType.UNKNOWN) {
        session.protocol = protocol;
      }
      if (imei && !session.imei) {
        session.imei = imei;
      }
    }

    if (imei) {
      this.imeiToSessionId.set(imei, sessionId);
    }

    return session;
  }

  public recordValidPosition(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastValidPositionAt = new Date().toISOString();
    }
  }

  public recordError(sessionId: string, error: string, rawPayloadSample?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errorCount += 1;
      session.lastDecoderError = error;
      if (rawPayloadSample) {
        session.lastRawPayloadSample = rawPayloadSample.substring(0, 200);
      }
    }
  }

  public associateImei(sessionId: string, imei: string, deviceId?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.imei = imei;
      session.deviceId = deviceId;
      this.imeiToSessionId.set(imei, sessionId);
    }
  }

  public getSession(sessionId: string): DeviceSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getSessionByImei(imei: string): DeviceSession | undefined {
    const sessionId = this.imeiToSessionId.get(imei);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  public removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.imei) {
      this.imeiToSessionId.delete(session.imei);
    }
    this.sessions.delete(sessionId);
  }

  public getAllSessions(): DeviceSession[] {
    return Array.from(this.sessions.values());
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }
}

export const globalSessionManager = new SessionManager();
