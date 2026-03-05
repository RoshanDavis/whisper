// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                               // Supabase free tier allows ~15 total; stay well under the limit
  connectionTimeoutMillis: 20_000,       // 20 s — tolerate Supabase cold starts on free tier
  idleTimeoutMillis: 60_000,             // 60 s — keep connections alive long enough for the heartbeat to reuse them
  statement_timeout: 10_000,             // 10 s — force-kill hung queries/transactions to release clients
  keepAlive: true,                       // Enable TCP keepalive probes
  keepAliveInitialDelayMillis: 10_000,   // 10 s — send probes early so cloud LBs don't consider the connection idle
  ssl: {
    rejectUnauthorized: false, // Required for managed providers like Supabase
  },
});

// Mandatory: discard broken idle clients instead of crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

export const db = drizzle(pool, { schema });