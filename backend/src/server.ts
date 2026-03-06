// backend/src/server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Import our database and schema
import { db, pool, withRetry } from './db/index';
import { messages, conversations, contacts } from './db/schema';

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

// Health check — try once, fail fast. The frontend polls every 4 s so there's
// no need for retries here; a quick 503 lets the next poll try again.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    console.error('Health Check Error:', (err as Error).message);
    res.status(503).json({ status: 'waking_up' });
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

// ── DB keep-alive heartbeat ──
// Render’s NAT gateway silently drops idle TCP sockets after ~30–60 s.
// The heartbeat pings ALL idle pool connections every 8 s so they never
// appear “idle” to Render or Supavisor.  If a ping fails the pool evicts
// the dead client and the next checkout opens a fresh replacement.
const DB_HEARTBEAT_MS = 8_000;
let dbHeartbeat: ReturnType<typeof setInterval> | null = null;

async function heartbeatPing() {
  // Ping once per idle client so EVERY connection stays warm.
  // With max:2, this is at most 2 parallel SELECT 1 queries.
  const count = pool.idleCount || 1;
  const pings: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    pings.push(
      pool.query('SELECT 1').then(() => {}).catch((err) => {
        console.warn('💔 Heartbeat: dead client evicted:', (err as Error).message);
      })
    );
  }
  await Promise.allSettled(pings);
}

// Grace period: when last user disconnects, wait 30 s before stopping heartbeat.
// This avoids thrashing if a user briefly disconnects (network blip, tab reload).
let heartbeatStopTimer: ReturnType<typeof setTimeout> | null = null;

function startDbHeartbeat() {
  // Cancel any pending stop
  if (heartbeatStopTimer) { clearTimeout(heartbeatStopTimer); heartbeatStopTimer = null; }
  if (dbHeartbeat) return;
  heartbeatPing(); // immediate first ping
  dbHeartbeat = setInterval(heartbeatPing, DB_HEARTBEAT_MS);
  console.log(`💓 DB heartbeat started (every ${DB_HEARTBEAT_MS / 1000}s)`);
}

function stopDbHeartbeat() {
  // Defer actual stop by 30 s so brief disconnects don't kill the pool
  if (heartbeatStopTimer) return; // already scheduled
  heartbeatStopTimer = setTimeout(() => {
    heartbeatStopTimer = null;
    // Re-check: a new user may have connected during the grace period
    if (connectedUsers.size > 0) return;
    if (!dbHeartbeat) return;
    clearInterval(dbHeartbeat);
    dbHeartbeat = null;
    console.log('💤 DB heartbeat stopped (no connected users for 30 s)');
  }, 30_000);
}

io.on('connection', (socket) => {
  const userId = socket.data.userId as string;
  if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
  connectedUsers.get(userId)!.add(socket.id);
  console.log(`🔌 User ${userId} connected on socket ${socket.id}`);

  // Start the heartbeat as soon as the first user connects
  startDbHeartbeat();

  // Keep registerUser for backward compat but ignore the userId param (use authenticated one)
  socket.on('registerUser', () => {
    // userId already set from JWT middleware
    console.log(`👤 User ${userId} registered on socket ${socket.id}`);
  });

// 2. Listen for incoming ENCRYPTED messages and save them
  // ---> NEW: Added signature to the expected data payload!
  socket.on('sendMessage', async (data: { receiverId: string, ciphertext: string, iv: string, signature: string, tempId?: string }) => {
    try {
      const senderId = socket.data.userId as string;
      
      if (!senderId) {
         console.error('Unauthorized attempt to send a message.');
         socket.emit('messageError', { tempId: data.tempId, error: 'Unauthorized' });
         return;
      }

      // Canonical pair ordering: user1Id < user2Id (matches CHECK constraint)
      const [user1Id, user2Id] = senderId < data.receiverId
        ? [senderId, data.receiverId]
        : [data.receiverId, senderId];

      // Transactional write with automatic retry on dead-connection errors
      const savedMessage = await withRetry(() =>
        db.transaction(async (tx) => {
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
        })
      );

      console.log('✅ Encrypted and signed message saved to database!');

      // Acknowledge success to the sending socket so it can confirm the optimistic entry
      socket.emit('messageSaved', { tempId: data.tempId, message: savedMessage });

      // Resolve connected sockets early so both auto-contact and broadcast can use them
      const senderSockets = connectedUsers.get(senderId);
      const receiverSockets = connectedUsers.get(data.receiverId);

      // Auto-create a pending contact for the receiver so the sender appears in their inbox.
      // Uses onConflictDoNothing so an existing relationship is silently skipped.
      // Wrapped in withRetry so a dead connection doesn't silently swallow the insert.
      const insertResult = await withRetry(() =>
        db.insert(contacts).values({
          ownerId: data.receiverId,
          contactId: senderId,
          status: 'pending',
        }).onConflictDoNothing({ target: [contacts.ownerId, contacts.contactId] })
      );

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
      // Tell the sender so the frontend can roll back the optimistic entry
      socket.emit('messageError', { tempId: data.tempId, error: 'Message failed to send — please try again.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Connection closed: ${socket.id}`);
    const sockets = connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) connectedUsers.delete(userId);
    }
    // Stop the heartbeat when no users are connected (let the pool + server idle naturally)
    if (connectedUsers.size === 0) stopDbHeartbeat();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);

  // Pre-warm the pool immediately so the first health check doesn't pay the
  // full TCP + TLS handshake cost.  pg.Pool is lazy — it creates zero
  // connections until something asks for one.  This fire-and-forget query
  // forces the first connection open while Render is still routing traffic.
  pool.query('SELECT 1')
    .then(() => console.log('✅ Pool pre-warmed — DB connection ready'))
    .catch((err: Error) => console.warn('⚠️ Pool pre-warm failed (will retry on first query):', err.message));
});