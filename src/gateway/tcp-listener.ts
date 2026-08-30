/**
 * TCP Listener for GPS Trackers
 * Listens on configurable TCP ports, manages persistent tracker sockets,
 * frames packets, delegates to decoders, returns ACK bytes, and emits decoded positions.
 */
import net from 'net';
import { ProtocolRegistry, globalProtocolRegistry } from '../protocols/registry.js';
import { SessionManager, globalSessionManager } from './session-manager.js';
import { PacketDeduplicator } from './deduplicator.js';
import { TransportType, ProtocolType } from '../shared/types/enums.js';
import { GpsPacketContext, NormalizedGpsPosition } from '../shared/types/protocols.js';

export interface TcpListenerOptions {
  port: number;
  host?: string;
  protocolRegistry?: ProtocolRegistry;
  sessionManager?: SessionManager;
  onPositionDecoded?: (position: NormalizedGpsPosition) => void;
  onAlarmReceived?: (alarm: NormalizedGpsPosition) => void;
}

export class TcpListener {
  public readonly port: number;
  public readonly host: string;
  private server: net.Server | null = null;
  private registry: ProtocolRegistry;
  private sessions: SessionManager;
  private deduplicator: PacketDeduplicator;
  private onPositionDecoded?: (position: NormalizedGpsPosition) => void;
  private onAlarmReceived?: (alarm: NormalizedGpsPosition) => void;
  private activeSockets: Map<string, net.Socket> = new Map();

  constructor(options: TcpListenerOptions) {
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
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        console.error(`[TCP Listener :${this.port}] Server error:`, err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[TCP Listener] Listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;
    const sessionId = `tcp-${remoteAddress}-${remotePort}-${Date.now()}`;

    this.activeSockets.set(sessionId, socket);
    this.sessions.createOrUpdateSession(sessionId, remoteAddress, remotePort, TransportType.TCP);

    socket.setTimeout(180000); // 3 minutes timeout

    socket.on('data', async (data: Buffer) => {
      await this.processData(socket, sessionId, remoteAddress, remotePort, data);
    });

    socket.on('timeout', () => {
      console.log(`[TCP :${this.port}] Socket timeout for session ${sessionId}`);
      socket.end();
    });

    socket.on('error', (err) => {
      console.warn(`[TCP :${this.port}] Socket error on ${sessionId}:`, err.message);
      this.sessions.recordError(sessionId, err.message);
    });

    socket.on('close', () => {
      this.activeSockets.delete(sessionId);
      this.sessions.removeSession(sessionId);
    });
  }

  public async processData(
    socket: net.Socket | null,
    sessionId: string,
    remoteAddress: string,
    remotePort: number,
    data: Buffer
  ): Promise<void> {
    const session = this.sessions.getSession(sessionId);
    const context: GpsPacketContext = {
      remoteAddress,
      remotePort,
      transport: TransportType.TCP,
      sessionId,
      associatedImei: session?.imei,
      associatedDeviceId: session?.deviceId,
    };

    try {
      const { decoder, result } = await this.registry.decodePacket(data, context);

      if (!result.success) {
        this.sessions.recordError(sessionId, result.errorMessage || 'Decode failed', data.toString('hex'));
        return;
      }

      const protocol = decoder?.protocol || ProtocolType.UNKNOWN;
      this.sessions.createOrUpdateSession(sessionId, remoteAddress, remotePort, TransportType.TCP, protocol, result.identifiedImei);

      // Send ACK back to tracker if required by protocol
      if (result.responsePayload && socket && !socket.destroyed) {
        if (typeof result.responsePayload === 'string') {
          socket.write(result.responsePayload, 'ascii');
        } else {
          socket.write(result.responsePayload);
        }
      }

      // Process decoded positions
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
      const msg = err instanceof Error ? err.message : String(err);
      this.sessions.recordError(sessionId, `TCP Processing error: ${msg}`);
    }
  }

  public sendCommand(sessionId: string, payload: Buffer | string): boolean {
    const socket = this.activeSockets.get(sessionId);
    if (socket && !socket.destroyed) {
      if (typeof payload === 'string') {
        socket.write(payload, 'ascii');
      } else {
        socket.write(payload);
      }
      return true;
    }
    return false;
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const socket of this.activeSockets.values()) {
        socket.destroy();
      }
      this.activeSockets.clear();

      if (this.server) {
        this.server.close(() => {
          console.log(`[TCP Listener :${this.port}] Stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
