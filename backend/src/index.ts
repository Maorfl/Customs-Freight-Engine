import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

dotenv.config();

import carriersRouter from './routes/carriers';
import shipmentsRouter from './routes/shipments';
import { startEscalationEngine } from './services/escalationEngine';
import { startImapWatcher } from './services/imapWatcher';
import { initSocketServer } from './socket';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
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

// HTTP server (required for Socket.io)
const httpServer = createServer(app);
initSocketServer(httpServer, FRONTEND_URL);

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/customs-freight')
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startEscalationEngine();
      startImapWatcher();
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

export default app;
