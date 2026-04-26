import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import type { Server as HttpServer } from 'http';

// Load .env relative to this file so it works in both dev and packaged Electron
dotenv.config({ path: path.join(__dirname, '../.env') });

import carriersRouter from './routes/carriers';
import shipmentsRouter from './routes/shipments';
import { startEscalationEngine } from './services/escalationEngine';
import { startImapWatcher } from './services/imapWatcher';
import { initSocketServer } from './socket';

const PORT = process.env.PORT || 5000;

export async function startServer(): Promise<HttpServer> {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // In production the frontend is served from the same origin, so CORS is not needed.
  // In development, proxy is handled by Vite, but we keep CORS for direct API access.
  if (!isProduction) {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    app.use(cors({ origin: FRONTEND_URL, credentials: true }));
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files as static assets
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Routes
  app.use('/api/carriers', carriersRouter);
  app.use('/api/shipments', shipmentsRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve the built React app in production (Electron desktop mode)
  if (isProduction) {
    const distPath =
      process.env.FRONTEND_DIST_PATH ||
      path.join(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    // All non-API routes return the React app (client-side routing)
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // HTTP server (required for Socket.io)
  const httpServer = createServer(app);
  const socketCorsOrigin = isProduction
    ? `http://localhost:${PORT}`
    : process.env.FRONTEND_URL || 'http://localhost:3000';
  initSocketServer(httpServer, socketCorsOrigin);

  // Connect to MongoDB, then start listening
  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://localhost:27017/customs-freight'
  );
  console.log('Connected to MongoDB');

  return new Promise<HttpServer>((resolve, reject) => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startEscalationEngine();
      startImapWatcher();
      resolve(httpServer);
    });
    httpServer.once('error', reject);
  });
}

// Auto-start when run directly (e.g. `node dist/index.js` or `ts-node src/index.ts`)
// This block is skipped when the module is imported by Electron.
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });
}
