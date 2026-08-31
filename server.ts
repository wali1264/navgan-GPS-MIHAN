/**
 * Master Application Server
 * Integrates Express REST API, WebSocket Realtime Engine, GPS Gateway Listeners,
 * and Vite Frontend Middleware.
 */
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api-router';
import { globalRealtimeServer } from './src/server/realtime-server';
import { globalGpsGateway } from './src/gateway/gateway-service';
import { globalSuperGateway } from './src/gateway/super-gateway';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  // Mount Realtime WebSocket Server
  globalRealtimeServer.attach(httpServer);

  // API Routes
  app.use('/api', apiRouter);

  // Start Universal GPS Super-Gateway Ingestion (TCP / UDP listeners on VPS)
  try {
    const tcpPort = parseInt(process.env.GPS_TCP_PORT || '5001', 10);
    const udpPort = parseInt(process.env.GPS_UDP_PORT || '5002', 10);
    await globalSuperGateway.start(tcpPort, udpPort);
    await globalGpsGateway.start([tcpPort], [udpPort]);
    console.log(`[Super-Gateway] Listeners fully initialized on TCP ${tcpPort}, UDP ${udpPort}`);
  } catch (err) {
    console.warn('[Super-Gateway] Notice:', err);
  }

  // Vite middleware in development / static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] GPS Fleet Tracking Platform running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

