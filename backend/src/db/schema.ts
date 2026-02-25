// backend/src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  // The permanent public key generated at registration
  publicKey: text('public_key').notNull(), 
  
  createdAt: timestamp('created_at').defaultNow().notNull(), 
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id).notNull(),
  
  // The AES-256-GCM encrypted message and Initialization Vector
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});