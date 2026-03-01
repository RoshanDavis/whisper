import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  
  // --- ECDH ENCRYPTION KEYS (For locking/unlocking) ---
  publicKey: text('public_key').notNull(),
  encryptedPrivateKey: text('encrypted_private_key').notNull(),
  keyIv: text('key_iv').notNull(),
  keySalt: text('key_salt').notNull(), // We will reuse this master salt for both wrappers!

  // --- NEW: ECDSA SIGNING KEYS (For digital signatures) ---
  publicSigningKey: text('public_signing_key').notNull(),
  encryptedSigningPrivateKey: text('encrypted_signing_private_key').notNull(),
  signingKeyIv: text('signing_key_iv').notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id).notNull(),
  
  // --- ENCRYPTED PAYLOAD ---
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),

  // --- NEW: DIGITAL SIGNATURE ---
  signature: text('signature').notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
});