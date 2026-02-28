// backend/src/db/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  publicKey: text('public_key').notNull(),
  
  // --- NEW KEY WRAPPING COLUMNS ---
  encryptedPrivateKey: text('encrypted_private_key').notNull(),
  keyIv: text('key_iv').notNull(),
  keySalt: text('key_salt').notNull(),
  // --------------------------------
  
  createdAt: timestamp('created_at').defaultNow(),
});

// ... (Your messages table stays exactly the same)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id).notNull(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});