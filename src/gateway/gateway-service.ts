/**
 * Master GPS Gateway Service
 * Orchestrates multi-port TCP & UDP listeners, collects telemetry stats,
 * and distributes decoded packets to state/trip/event processors.
 */
import { TcpListener } from './tcp-listener.js';
import { UdpListener } from './udp-listener.js';
import { SessionManager, globalSessionManager } from './session-manager.js';
import { ProtocolRegistry, globalProtocolRegistry } from '../protocols/registry.js';
import { NormalizedGpsPosition } from '../shared/types/protocols.js';
import { DiagnosticMetrics } from '../shared/types/models.js';

export interface GpsGatewayConfig {
  tcpPorts?: number[];
  udpPorts?: number[];
  listenHost?: string;
  onPosition?: (pos: NormalizedGpsPosition) => void;
  onAlarm?: (pos: NormalizedGpsPosition) => void;
}

export class GpsGatewayService {
  private tcpListeners: Map<number, TcpListener> = new Map();
  private udpListeners: Map<number, UdpListener> = new Map();
  private sessionManager: SessionManager;
  private protocolRegistry: ProtocolRegistry;
  private onPosition?: (pos: NormalizedGpsPosition) => void;
  private onAlarm?: (pos: NormalizedGpsPosition) => void;

  private totalPacketsReceived = 0;
  private totalPositionsDecoded = 0;
  private totalErrors = 0;
  private startTime = Date.now();

  constructor(config?: GpsGatewayConfig) {
    this.sessionManager = globalSessionManager;
    this.protocolRegistry = globalProtocolRegistry;
    this.onPosition = config?.onPosition;
    this.onAlarm = config?.onAlarm;
  }

  public setCallbacks(onPosition: (pos: NormalizedGpsPosition) => void, onAlarm: (pos: NormalizedGpsPosition) => void): void {
    this.onPosition = onPosition;
    this.onAlarm = onAlarm;
  }

  public async start(tcpPorts: number[] = [5001, 5002], udpPorts: number[] = [5002, 5003], host: string = '0.0.0.0'): Promise<void> {
    for (const port of tcpPorts) {
      try {
        const listener = new TcpListener({
          port,
          host,
          protocolRegistry: this.protocolRegistry,
          sessionManager: this.sessionManager,
          onPositionDecoded: (pos) => this.handlePosition(pos),
          onAlarmReceived: (alarm) => this.handleAlarm(alarm),
        });
        await listener.start();
        this.tcpListeners.set(port, listener);
      } catch (err) {
        console.warn(`[GPS Gateway] Could not start TCP on port ${port}:`, err);
      }
    }

    for (const port of udpPorts) {
      try {
        const listener = new UdpListener({
          port,
          host,
          protocolRegistry: this.protocolRegistry,
          sessionManager: this.sessionManager,
          onPositionDecoded: (pos) => this.handlePosition(pos),
          onAlarmReceived: (alarm) => this.handleAlarm(alarm),
        });
        await listener.start();
        this.udpListeners.set(port, listener);
      } catch (err) {
        console.warn(`[GPS Gateway] Could not start UDP on port ${port}:`, err);
      }
    }
  }

  private handlePosition(position: NormalizedGpsPosition): void {
    this.totalPositionsDecoded += 1;
    this.totalPacketsReceived += 1;
    if (this.onPosition) {
      this.onPosition(position);
    }
  }

  private handleAlarm(position: NormalizedGpsPosition): void {
    if (this.onAlarm) {
      this.onAlarm(position);
    }
  }

  /**
   * Directly ingest a normalized GPS position (used by API / simulator / HTTP trackers)
   */
  public ingestDirectPosition(position: NormalizedGpsPosition): void {
    this.handlePosition(position);
  }

  public getMetrics(): DiagnosticMetrics {
    return {
      activeSessions: this.sessionManager.getActiveCount(),
      totalPacketsReceived: this.totalPacketsReceived,
      totalPositionsDecoded: this.totalPositionsDecoded,
      totalErrors: this.totalErrors,
      bytesReceived: this.totalPacketsReceived * 64, // approximate
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      listenerPorts: {
        tcp: Array.from(this.tcpListeners.keys()),
        udp: Array.from(this.udpListeners.keys()),
      },
    };
  }

  public async stop(): Promise<void> {
    for (const l of this.tcpListeners.values()) {
      await l.stop();
    }
    for (const l of this.udpListeners.values()) {
      await l.stop();
    }
    this.tcpListeners.clear();
    this.udpListeners.clear();
  }
}

export const globalGpsGateway = new GpsGatewayService();
