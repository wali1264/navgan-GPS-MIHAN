/**
 * UDP Listener for GPS Trackers
 * Listens on configurable UDP ports for datagram telemetry packets.
 */
import dgram from 'dgram';
import { ProtocolRegistry, globalProtocolRegistry } from '../protocols/registry.js';
import { SessionManager, globalSessionManager } from './session-manager.js';
import { PacketDeduplicator } from './deduplicator.js';
import { TransportType, ProtocolType } from '../shared/types/enums.js';
import { GpsPacketContext, NormalizedGpsPosition } from '../shared/types/protocols.js';

export interface UdpListenerOptions {
  port: number;
  host?: string;
  protocolRegistry?: ProtocolRegistry;
  sessionManager?: SessionManager;
  onPositionDecoded?: (position: NormalizedGpsPosition) => void;
  onAlarmReceived?: (alarm: NormalizedGpsPosition) => void;
}

export class UdpListener {
  public readonly port: number;
  public readonly host: string;
  private socket: dgram.Socket | null = null;
  private registry: ProtocolRegistry;
  private sessions: SessionManager;
  private deduplicator: PacketDeduplicator;
  private onPositionDecoded?: (position: NormalizedGpsPosition) => void;
  private onAlarmReceived?: (alarm: NormalizedGpsPosition) => void;

  constructor(options: UdpListenerOptions) {
    this.port = options.port;
    this.host = options.host || '0.0.0.0';
    this.registry = options.protocolRegistry || globalProtocolRegistry;
    this.sessions = options.sessionManager || globalSessionManager;
    this.deduplicator = new PacketDeduplicator();
    this.onPositionDecoded = options.onPositionDecoded;
    this.onAlarmReceived = options.onAlarmReceived;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (err) => {
        console.error(`[UDP Listener :${this.port}] Error:`, err);
      });

      this.socket.on('message', async (msg, rinfo) => {
        await this.handleMessage(msg, rinfo);
      });

      this.socket.bind(this.port, this.host, () => {
        console.log(`[UDP Listener] Listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  private async handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
    const sessionId = `udp-${rinfo.address}-${rinfo.port}`;
    this.sessions.createOrUpdateSession(sessionId, rinfo.address, rinfo.port, TransportType.UDP);

    const session = this.sessions.getSession(sessionId);
    const context: GpsPacketContext = {
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
      transport: TransportType.UDP,
      sessionId,
      associatedImei: session?.imei,
      associatedDeviceId: session?.deviceId,
    };

    try {
      const { decoder, result } = await this.registry.decodePacket(msg, context);

      if (!result.success) {
        this.sessions.recordError(sessionId, result.errorMessage || 'UDP decode failed', msg.toString('hex'));
        return;
      }

      const protocol = decoder?.protocol || ProtocolType.UNKNOWN;
      this.sessions.createOrUpdateSession(sessionId, rinfo.address, rinfo.port, TransportType.UDP, protocol, result.identifiedImei);

      // Send ACK back if needed
      if (result.responsePayload && this.socket) {
        const payloadBuf = typeof result.responsePayload === 'string'
          ? Buffer.from(result.responsePayload, 'ascii')
          : result.responsePayload;

        this.socket.send(payloadBuf, rinfo.port, rinfo.address);
      }

      // Process positions
      for (const pos of result.positions) {
        if (this.deduplicator.isUnique(pos)) {
          this.sessions.recordValidPosition(sessionId);
          if (this.onPositionDecoded) {
            this.onPositionDecoded(pos);
          }
        }
      }

      if (result.isAlarmPacket && result.positions.length > 0 && this.onAlarmReceived) {
        this.onAlarmReceived(result.positions[0]);
      }
    } catch (err: unknown) {
      const msgStr = err instanceof Error ? err.message : String(err);
      this.sessions.recordError(sessionId, `UDP Processing error: ${msgStr}`);
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          console.log(`[UDP Listener :${this.port}] Stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
