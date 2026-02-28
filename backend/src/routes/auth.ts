import express from 'express';
import bcrypt from 'bcrypt';
import { eq, or, and } from 'drizzle-orm';
import { db } from '../db/index';
import { users, messages } from '../db/schema';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    // 1. Extract the new cryptographic fields from the request
    const { username, password, publicKey, encryptedPrivateKey, keyIv, keySalt } = req.body;

    // 2. Validate the incoming data
    if (!username || !password || !publicKey || !encryptedPrivateKey || !keyIv || !keySalt) {
      return res.status(400).json({ error: 'All cryptographic fields are required.' });
    }

    // 3. Check if the username is already taken
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists. Please choose another.' });
    }

    // 4. Securely hash the password for authentication (using 10 salt rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Save the new user, Public Key, and Wrapped Private Key data to Supabase
    const newUser = await db.insert(users).values({
      username,
      passwordHash,
      publicKey,
      encryptedPrivateKey,
      keyIv,
      keySalt,
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

    // Send back the token AND the Wrapped Key data so the frontend can decrypt it!
    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
        encryptedPrivateKey: user.encryptedPrivateKey,
        keyIv: user.keyIv,
        keySalt: user.keySalt,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Fetch a user's Public Key by their ID
router.get('/users/:id/key', async (req, res) => {
  try {
    const targetUser = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({ publicKey: targetUser[0].publicKey });
  } catch (error) {
    console.error('Error fetching public key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all registered users (so we can populate the chat sidebar)
router.get('/users', async (req, res) => {
  try {
    // We only select the id and username. We DO NOT send password hashes!
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
    }).from(users);
    
    res.status(200).json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch chat history between two specific users
router.get('/messages/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    
    // Find all messages where User1 sent to User2, OR User2 sent to User1
    const chatHistory = await db.select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, user1), eq(messages.receiverId, user2)),
          and(eq(messages.senderId, user2), eq(messages.receiverId, user1))
        )
      );
    
    res.status(200).json(chatHistory);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;