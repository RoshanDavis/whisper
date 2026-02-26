// backend/src/server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import our database and schema
import { db } from './db/index';
import { messages } from './db/schema';

import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('Whisper Backend is running securely!');
});

// A temporary map to link a user's Database ID to their current Socket connection
const connectedUsers = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`🔌 A new connection initialized: ${socket.id}`);

  // 1. Listen for the frontend telling us WHICH user just logged in
  socket.on('registerUser', (userId: string) => {
    connectedUsers.set(socket.id, userId);
    console.log(`👤 User ${userId} securely registered to socket ${socket.id}`);
  });

// 2. Listen for incoming ENCRYPTED messages and save them
  socket.on('sendMessage', async (data: { receiverId: string, ciphertext: string, iv: string }) => {
    try {
      const senderId = connectedUsers.get(socket.id);
      
      if (!senderId) {
         console.error('Unauthorized attempt to send a message.');
         return;
      }

      // 3. Save to Supabase using Drizzle
      const savedMessage = await db.insert(messages).values({
        senderId: senderId,
        receiverId: data.receiverId,
        ciphertext: data.ciphertext, 
        iv: data.iv, // Saving the real AES-GCM Initialization Vector!
      }).returning();

      console.log('✅ Encrypted message saved to database!');

      // 4. Broadcast the saved message back to the clients
      io.emit('receiveMessage', savedMessage[0]);

    } catch (error) {
      console.error('❌ Error saving message to database:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Connection closed: ${socket.id}`);
    connectedUsers.delete(socket.id); // Clean up memory when they leave
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
});