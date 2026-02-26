import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS to allow your Vite frontend to talk to this server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// A simple health check route
app.get('/', (req, res) => {
  res.send('Whisper Backend is running securely!');
});

// Listen for WebSocket connections
io.on('connection', (socket) => {
  console.log(`🔌 A user connected with socket id: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
});