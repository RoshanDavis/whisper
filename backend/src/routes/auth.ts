// backend/src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey } = req.body;

    // 1. Validate the incoming data
    if (!username || !password || !publicKey) {
      return res.status(400).json({ error: 'Username, password, and public key are required.' });
    }

    // 2. Check if the username is already taken
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists. Please choose another.' });
    }

    // 3. Securely hash the password (using 10 salt rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Save the new user and their Public Key to Supabase
    const newUser = await db.insert(users).values({
      username,
      passwordHash,
      publicKey,
    }).returning({
      id: users.id,
      username: users.username,
    });

    // 5. Send back a success response (without the password hash!)
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

    // 1. Find the user in the database
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = existingUser[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // 2. Check if the password matches the hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // 3. Ensure the JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET in environment variables.');
      return res.status(500).json({ error: 'Internal server configuration error.' });
    }

    // 4. Generate a JWT token that expires in 24 hours
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 5. Send back the token and user data
    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

export default router;