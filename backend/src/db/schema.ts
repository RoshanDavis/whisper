import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';

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

// Add this to the bottom of backend/src/db/schema.ts

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // The person who owns the contact list
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  
  // The friend they are adding
  contactId: uuid('contact_id').references(() => users.id).notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('owner_contact_unique').on(table.ownerId, table.contactId),
]);