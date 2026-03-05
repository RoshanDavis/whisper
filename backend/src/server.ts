// backend/src/server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Import our database and schema
import { db } from './db/index';
import { messages, conversations, contacts } from './db/schema';
import { sql } from 'drizzle-orm';

import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/api/auth', authRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

app.get('/', (req, res) => {
  res.send('Whisper Backend is running securely!');
});

// Lightweight health check — wakes the DB connection pool on cold starts
app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ status: 'unavailable' });
  }
});

// Expose io to route handlers via req.app.get('io')
app.set('io', io);

// Map each userId to a Set of active socket IDs (supports multi-tab / reconnect)
const connectedUsers = new Map<string, Set<string>>();

// Socket.IO authentication middleware: verify JWT before allowing connection
io.use((socket, next) => {
  // Try cookie-based auth first
  const cookieHeader = socket.handshake.headers.cookie;
  let token: string | undefined;

  if (cookieHeader) {
    const match = cookieHeader.split(';').find(c => c.trim().startsWith('whisper_token='));
    if (match) {
      token = match.split('=').slice(1).join('=').trim();
    }
  }

  // Fallback to auth handshake object
  if (!token && socket.handshake.auth?.token) {
    token = socket.handshake.auth.token as string;
  }

  if (!token || !process.env.JWT_SECRET) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; username: string };
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId as string;
  if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
  connectedUsers.get(userId)!.add(socket.id);
  console.log(`🔌 User ${userId} connected on socket ${socket.id}`);

  // Keep registerUser for backward compat but ignore the userId param (use authenticated one)
  socket.on('registerUser', () => {
    // userId already set from JWT middleware
    console.log(`👤 User ${userId} registered on socket ${socket.id}`);
  });

// 2. Listen for incoming ENCRYPTED messages and save them
  // ---> NEW: Added signature to the expected data payload!
  socket.on('sendMessage', async (data: { receiverId: string, ciphertext: string, iv: string, signature: string }) => {
    try {
      const senderId = socket.data.userId as string;
      
      if (!senderId) {
         console.error('Unauthorized attempt to send a message.');
         return;
      }

      // Canonical pair ordering: user1Id < user2Id (matches CHECK constraint)
      const [user1Id, user2Id] = senderId < data.receiverId
        ? [senderId, data.receiverId]
        : [data.receiverId, senderId];

      // Transactional write: insert message + upsert conversation in one atomic op
      const savedMessage = await db.transaction(async (tx) => {
        const [msg] = await tx.insert(messages).values({
          senderId: senderId,
          receiverId: data.receiverId,
          ciphertext: data.ciphertext,
          iv: data.iv,
          signature: data.signature,
        }).returning();

        await tx
          .insert(conversations)
          .values({ user1Id, user2Id, lastMessageAt: msg.createdAt! })
          .onConflictDoUpdate({
            target: [conversations.user1Id, conversations.user2Id],
            set: { lastMessageAt: msg.createdAt! },
          });

        return msg;
      });

      console.log('✅ Encrypted and signed message saved to database!');

      // Resolve connected sockets early so both auto-contact and broadcast can use them
      const senderSockets = connectedUsers.get(senderId);
      const receiverSockets = connectedUsers.get(data.receiverId);

      // Auto-create a pending contact for the receiver so the sender appears in their inbox.
      // Uses onConflictDoNothing so an existing relationship is silently skipped.
      const insertResult = await db.insert(contacts).values({
        ownerId: data.receiverId,
        contactId: senderId,
        status: 'pending',
      }).onConflictDoNothing({ target: [contacts.ownerId, contacts.contactId] });

      // Notify receiver only when a new pending contact was actually created
      if (insertResult.rowCount && insertResult.rowCount > 0 && receiverSockets) {
        for (const sid of receiverSockets) {
          io.to(sid).emit('inboxUpdated');
        }
      }

      // 4. Send the saved message privately to sender and receiver
      // Skip the socket that sent the message (it already has an optimistic entry);
      // other tabs of the same sender still receive the echo.
      if (senderSockets) {
        for (const sid of senderSockets) {
          if (sid !== socket.id) io.to(sid).emit('receiveMessage', savedMessage);
        }
      }
      if (receiverSockets) {
        for (const sid of receiverSockets) {
          io.to(sid).emit('receiveMessage', savedMessage);
        }
      }

    } catch (error) {
      console.error('❌ Error saving message to database:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Connection closed: ${socket.id}`);
    const sockets = connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) connectedUsers.delete(userId);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
});