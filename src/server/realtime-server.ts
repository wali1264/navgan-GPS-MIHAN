/**
 * Real-Time WebSocket Server
 * Streams live vehicle state changes and fleet alerts to connected web & mobile clients.
 */
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { globalStateEngine } from '../services/state-engine';
import { VehicleCurrentState, FleetEvent } from '../shared/types/models';

export class RealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/api/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial welcome
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Realtime GPS telemetry stream connected' }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.warn('[WebSocket Server] Client error:', err);
        this.clients.delete(ws);
      });
    });

    // Hook into StateEngine
    globalStateEngine.onStateChange((state: VehicleCurrentState, newEvents: FleetEvent[]) => {
      this.broadcast({
        type: 'STATE_UPDATE',
        state,
        events: newEvents,
      });
    });

    console.log('[RealtimeServer] WebSocket server mounted at /api/ws');
  }

  public broadcast(payload: Record<string, unknown>): void {
    const data = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const globalRealtimeServer = new RealtimeServer();
