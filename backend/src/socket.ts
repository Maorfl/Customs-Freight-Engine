import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server | null = null;

/**
 * Initialise the Socket.io server attached to the existing HTTP server.
 * Must be called once before getIo() is used.
 */
export function initSocketServer(httpServer: HttpServer, corsOrigin: string): Server {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected:  ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Returns the Socket.io server instance, or null if not yet initialised.
 * Services call getIo()?.emit(...) so they stay safe before startup.
 */
export function getIo(): Server | null {
  return io;
}
