import { pgTable, uuid, text, timestamp, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
}, (table) => [
  index('messages_sender_receiver_idx').on(table.senderId, table.receiverId),
  index('messages_receiver_created_idx').on(table.receiverId, table.createdAt),
]);

// Add this to the bottom of backend/src/db/schema.ts

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // The person who owns the contact list
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  
  // The friend they are adding
  contactId: uuid('contact_id').references(() => users.id).notNull(),

  // 'accepted' = manually added or approved; 'pending' = auto-created on incoming message
  status: text('status').notNull().default('accepted'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('owner_contact_unique').on(table.ownerId, table.contactId),
  index('contacts_owner_idx').on(table.ownerId),
]);

// --- READ-OPTIMIZED UNIFIED INBOX ---
// Upserted transactionally on every message send; one row per unique pair.
// Canonical ordering: user1Id < user2Id (enforced by CHECK constraint).
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user1Id: uuid('user1_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  user2Id: uuid('user2_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lastMessageAt: timestamp('last_message_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  unique('conversations_pair_unique').on(table.user1Id, table.user2Id),
  index('conversations_last_message_idx').on(table.lastMessageAt),
  check('user1_lt_user2', sql`${table.user1Id} < ${table.user2Id}`),
]);