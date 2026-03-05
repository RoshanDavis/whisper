// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                          // Supabase free tier allows ~15 total; stay well under the limit
  connectionTimeoutMillis: 20_000, // 20 s — tolerate Supabase cold starts on free tier
  idleTimeoutMillis: 10_000,       // 10 s — aggressively release idle connections before cloud routers drop them
  statement_timeout: 10_000,       // 10 s — force-kill hung queries/transactions to release clients
  keepAlive: true,                 // Prevent cloud networks from silently killing idle TCP sockets
  ssl: {
    rejectUnauthorized: false, // Required for managed providers like Supabase
  },
});

// Mandatory: discard broken idle clients instead of crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

export const db = drizzle(pool, { schema });