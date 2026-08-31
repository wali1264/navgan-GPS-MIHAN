/**
 * Universal GPS Super-Gateway
 * High-performance, self-healing TCP/UDP server with Auto-Protocol Detection,
 * Session Tracking, ACK generation, and Adaptive Database Persistence.
 */
import net from 'net';
import dgram from 'dgram';
import { UniversalParser, ParseResult } from '../protocols/universal-parser.js';
import { globalAdaptiveDbAdapter } from '../server/adaptive-db-adapter.js';

export interface DeviceSessionInfo {
  imei?: string;
  protocol: string;
  remoteAddress: string;
  connectedAt: string;
  lastPacketAt: string;
  packetCount: number;
}

export class UniversalGpsSuperGateway {
  private static instance: UniversalGpsSuperGateway;
  private tcpServer: net.Server | null = null;
  private udpServer: dgram.Socket | null = null;
  private sessions: Map<net.Socket, DeviceSessionInfo> = new Map();
  private imeiSessionMap: Map<string, DeviceSessionInfo> = new Map();

  // Metrics
  private totalPacketsReceived = 0;
  private totalPacketsDecoded = 0;
  private totalBytesReceived = 0;
  private protocolCounts: Record<string, number> = {};
  private startTime = new Date();

  private constructor() {}

  public static getInstance(): UniversalGpsSuperGateway {
    if (!UniversalGpsSuperGateway.instance) {
      UniversalGpsSuperGateway.instance = new UniversalGpsSuperGateway();
    }
    return UniversalGpsSuperGateway.instance;
  }

  /**
   * Start listeners safely on specified ports
   */
  public async start(tcpPort = 5001, udpPort = 5002): Promise<void> {
    this.startTcpListener(tcpPort);
    this.startUdpListener(udpPort);
  }

  private startTcpListener(port: number): void {
    this.tcpServer = net.createServer({ pauseOnConnect: false }, (socket) => {
      const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
      const sessionInfo: DeviceSessionInfo = {
        protocol: 'DETECTING',
        remoteAddress: clientAddr,
        connectedAt: new Date().toISOString(),
        lastPacketAt: new Date().toISOString(),
        packetCount: 0,
      };
      this.sessions.set(socket, sessionInfo);

      socket.on('data', async (data: Buffer) => {
        try {
          await this.handleIncomingBuffer(data, socket, clientAddr);
        } catch (err: any) {
          console.error(`[SuperGateway] TCP Error from ${clientAddr}:`, err.message);
        }
      });

      socket.on('close', () => {
        this.sessions.delete(socket);
      });

      socket.on('error', (err) => {
        console.warn(`[SuperGateway] TCP Socket Notice (${clientAddr}):`, err.message);
      });
    });

    this.tcpServer.on('error', (err: any) => {
      console.warn(`[SuperGateway] TCP Listener notice on port ${port}:`, err.message);
    });

    this.tcpServer.listen(port, '0.0.0.0', () => {
      console.log(`[SuperGateway] 🚀 Universal TCP Gateway listening on 0.0.0.0:${port}`);
    });
  }

  private startUdpListener(port: number): void {
    try {
      this.udpServer = dgram.createSocket('udp4');

      this.udpServer.on('message', async (msg: Buffer, rinfo) => {
        const clientAddr = `${rinfo.address}:${rinfo.port}`;
        try {
          await this.handleIncomingBuffer(msg, undefined, clientAddr, rinfo);
        } catch (err: any) {
          console.error(`[SuperGateway] UDP Error from ${clientAddr}:`, err.message);
        }
      });

      this.udpServer.on('error', (err) => {
        console.warn(`[SuperGateway] UDP Listener notice on port ${port}:`, err.message);
      });

      this.udpServer.bind(port, '0.0.0.0', () => {
        console.log(`[SuperGateway] 🚀 Universal UDP Gateway listening on 0.0.0.0:${port}`);
      });
    } catch (err: any) {
      console.warn(`[SuperGateway] UDP Socket bind notice:`, err.message);
    }
  }

  /**
   * Main Ingestion pipeline for any incoming buffer (TCP, UDP, or HTTP)
   */
  public async handleIncomingBuffer(
    buffer: Buffer | string,
    socket?: net.Socket,
    remoteAddress = 'direct-http',
    udpRinfo?: dgram.RemoteInfo
  ): Promise<ParseResult> {
    const rawBuf = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    this.totalPacketsReceived++;
    this.totalBytesReceived += rawBuf.length;

    // 1. Universal Parse
    const result = UniversalParser.parse(rawBuf, remoteAddress);

    // Update protocol stats
    this.protocolCounts[result.protocol] = (this.protocolCounts[result.protocol] || 0) + 1;

    // 2. Manage Session
    let session = socket ? this.sessions.get(socket) : undefined;
    if (session) {
      session.lastPacketAt = new Date().toISOString();
      session.packetCount++;
      session.protocol = result.protocol;
      if (result.imei) {
        session.imei = result.imei;
        this.imeiSessionMap.set(result.imei, session);
      }
    } else if (result.imei) {
      const activeSession: DeviceSessionInfo = {
        imei: result.imei,
        protocol: result.protocol,
        remoteAddress,
        connectedAt: new Date().toISOString(),
        lastPacketAt: new Date().toISOString(),
        packetCount: 1,
      };
      this.imeiSessionMap.set(result.imei, activeSession);
    }

    // 3. Send ACK back to device
    if (result.ackBuffer) {
      if (socket && !socket.destroyed) {
        socket.write(result.ackBuffer);
      } else if (udpRinfo && this.udpServer) {
        this.udpServer.send(result.ackBuffer, udpRinfo.port, udpRinfo.address);
      }
    }

    // 4. Save Location Telemetry
    if (result.isLocation && result.record) {
      this.totalPacketsDecoded++;
      
      // If session had a logged-in IMEI, ensure it's attached
      if (session?.imei && (!result.record.device_imei || result.record.device_imei === '868204050123456')) {
        result.record.device_imei = session.imei;
      }

      await globalAdaptiveDbAdapter.saveTelemetry(result.record);
    }

    return result;
  }

  /**
   * Diagnostic statistics for web UI
   */
  public getStatus() {
    const uptimeSec = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    const packetsPerSec = uptimeSec > 0 ? (this.totalPacketsReceived / uptimeSec).toFixed(2) : '0.00';
    const activeSessions = Array.from(this.imeiSessionMap.values());

    return {
      status: 'ONLINE',
      uptimeSeconds: uptimeSec,
      totalPacketsReceived: this.totalPacketsReceived,
      totalPacketsDecoded: this.totalPacketsDecoded,
      totalBytesReceived: this.totalBytesReceived,
      packetsPerSec,
      activeConnectionsCount: this.sessions.size || activeSessions.length,
      protocolBreakdown: this.protocolCounts,
      activeDevices: activeSessions.slice(0, 50),
      dbStatus: globalAdaptiveDbAdapter.getStats(),
    };
  }
}

export const globalSuperGateway = UniversalGpsSuperGateway.getInstance();
