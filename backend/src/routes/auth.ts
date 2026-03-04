import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { eq, or, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { users, messages, contacts } from '../db/schema';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ==========================================
// JWT AUTH MIDDLEWARE
// ==========================================
interface AuthenticatedRequest extends Request {
  user?: { userId: string; username: string };
}

function parseCookieToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find(c => c.trim().startsWith('whisper_token='));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=').trim();
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Try HttpOnly cookie first, then Authorization header as fallback
  let token = parseCookieToken(req);

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: 'Internal server configuration error.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; username: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }
};

router.post('/register', async (req, res) => {
  try {
    const { 
      username, 
      password, 
      publicKey, 
      encryptedPrivateKey, 
      keyIv, 
      keySalt,
      publicSigningKey,
      encryptedSigningPrivateKey,
      signingKeyIv
    } = req.body;

    if (!username || !password || !publicKey || !encryptedPrivateKey || !keyIv || !keySalt || !publicSigningKey || !encryptedSigningPrivateKey || !signingKeyIv) {
      return res.status(400).json({ error: 'All cryptographic fields are required.' });
    }

    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists. Please choose another.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await db.insert(users).values({
      username,
      passwordHash,
      publicKey,
      encryptedPrivateKey,
      keyIv,
      keySalt,
      publicSigningKey,
      encryptedSigningPrivateKey,
      signingKeyIv
    }).returning({
      id: users.id,
      username: users.username,
    });

    res.status(201).json({ 
      message: 'User registered successfully!', 
      user: newUser[0] 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = existingUser[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET in environment variables.');
      return res.status(500).json({ error: 'Internal server configuration error.' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HttpOnly cookie so the token is not accessible to client-side JS
    res.cookie('whisper_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user.id,
        username: user.username,
        
        // ECDH Encryption Keys
        publicKey: user.publicKey,
        encryptedPrivateKey: user.encryptedPrivateKey,
        keyIv: user.keyIv,
        keySalt: user.keySalt,

        // ECDSA Signing Keys
        publicSigningKey: user.publicSigningKey,
        encryptedSigningPrivateKey: user.encryptedSigningPrivateKey,
        signingKeyIv: user.signingKeyIv,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Session check: returns the authenticated user's info + encrypted key material
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = existingUser[0];

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
        encryptedPrivateKey: user.encryptedPrivateKey,
        keyIv: user.keyIv,
        keySalt: user.keySalt,
        publicSigningKey: user.publicSigningKey,
        encryptedSigningPrivateKey: user.encryptedSigningPrivateKey,
        signingKeyIv: user.signingKeyIv,
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout: clear the HttpOnly cookie and disconnect active sockets
router.post('/logout', (req, res) => {
  // Identify the user from the cookie so we can disconnect their sockets
  const token = parseCookieToken(req);
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
      const io = req.app.get('io');
      if (io) {
        for (const [, socket] of io.sockets.sockets) {
          if (socket.data.userId === decoded.userId) {
            socket.disconnect(true);
          }
        }
      }
    } catch (_) {
      // Token invalid/expired — no active sockets to disconnect
    }
  }

  res.clearCookie('whisper_token', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully.' });
});

// Fetch BOTH Public Keys (Encryption & Signing) by user ID
router.get('/users/:id/key', async (req, res) => {
  try {
    const targetUser = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({ 
      publicKey: targetUser[0].publicKey,
      publicSigningKey: targetUser[0].publicSigningKey 
    });
  } catch (error) {
    console.error('Error fetching public keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// backend/src/routes/auth.ts

// ==========================================
// CONTACTS DIRECTORY
// ==========================================

// 1. Add a new contact by exact username
router.post('/contacts/add', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ownerId = req.user!.userId; // Use authenticated user's ID, not client-supplied
    const { contactUsername } = req.body;

    // Normalize and validate the username
    const normalized = typeof contactUsername === 'string' ? contactUsername.trim() : '';
    if (!normalized) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    // Step A: Find the user they are trying to add
    const targetUser = await db.select().from(users).where(eq(users.username, normalized)).limit(1);

    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found. Check the username.' });
    }

    const contactId = targetUser[0].id;

    if (ownerId === contactId) {
      return res.status(400).json({ error: 'You cannot add yourself as a contact.' });
    }

    // Step B+C: Insert the contact, relying on the UNIQUE constraint to prevent duplicates
    try {
      await db.insert(contacts).values({ ownerId, contactId });
    } catch (err: any) {
      // Postgres unique-violation (23505) or our named constraint
      if (err?.code === '23505' || err?.constraint === 'owner_contact_unique') {
        return res.status(409).json({ error: 'This user is already in your contacts.' });
      }
      throw err; // re-throw unexpected errors to be caught by the outer catch
    }

    // Step D: Return the friend's info (including their public keys!) 
    // so the React UI can update immediately
    res.status(201).json({
      message: 'Contact added successfully!',
      contact: {
        id: targetUser[0].id,
        username: targetUser[0].username,
        publicKey: targetUser[0].publicKey,
        publicSigningKey: targetUser[0].publicSigningKey
      }
    });

  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Fetch the authenticated user's contact list
router.get('/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId; // Use authenticated user's ID from JWT

    // We do an Inner Join here to get the friend's actual username and keys,
    // rather than just returning their UUID from the contacts table.
    const userContacts = await db
      .select({
        id: users.id,
        username: users.username,
        publicKey: users.publicKey,
        publicSigningKey: users.publicSigningKey
      })
      .from(contacts)
      .innerJoin(users, eq(contacts.contactId, users.id))
      .where(eq(contacts.ownerId, userId));

    res.status(200).json(userContacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Strict UUID v4 format check
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fetch chat history between two specific users
router.get('/messages/:user1/:user2', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user1, user2 } = req.params;

    if (!UUID_RE.test(user1) || !UUID_RE.test(user2)) {
      res.status(400).json({ error: 'Invalid user id.' });
      return;
    }

    const authenticatedUserId = req.user!.userId;

    // Ensure the authenticated user is one of the two parties
    if (authenticatedUserId !== user1 && authenticatedUserId !== user2) {
      res.status(403).json({ error: 'You are not authorized to view this conversation.' });
      return;
    }

    // Find all messages where User1 sent to User2, OR User2 sent to User1
    const chatHistory = await db.select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, user1), eq(messages.receiverId, user2)),
          and(eq(messages.senderId, user2), eq(messages.receiverId, user1))
        )
      )
      .orderBy(asc(messages.createdAt), asc(messages.id));
    
    res.status(200).json(chatHistory);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;