import { io } from 'socket.io-client';

// Connect to the backend. In dev the Vite proxy only handles HTTP,
// so we point socket.io directly at the backend port.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: Infinity,
});

export default socket;
