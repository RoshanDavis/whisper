// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,                               // 2 connections — enough concurrency, within free tier limits
  connectionTimeoutMillis: 30_000,       // 30 s — tolerate cold start of Supabase pooler
  idleTimeoutMillis: 0,                  // NEVER close from our side — heartbeat keeps them alive on Supavisor's side
  allowExitOnIdle: false,                // NEVER drain the pool — keep connections ready at all times
  keepAlive: true,                       // TCP keepalive probes
  keepAliveInitialDelayMillis: 10_000,   // Probe after 10 s of silence
  ssl: {
    rejectUnauthorized: false,
  },
});

// Mandatory: discard broken idle clients instead of crashing the process
pool.on('error', (err) => {
  console.error('⚠️ Idle client error (discarded):', err.message);
});

// Log every fresh TCP connection for observability
pool.on('connect', () => {
  console.log('🔗 New pool connection established');
});

// Log when a connection is removed (will show why connections die)
pool.on('remove', () => {
  console.log(`🗑️ Pool connection removed (total: ${pool.totalCount}, idle: ${pool.idleCount})`);
});

export const db = drizzle(pool, { schema });
export { pool };

// ── Resilient query helper ──
// Retries up to 3 times with backoff on connection-class errors.
// Each failed attempt causes pg.Pool to evict the dead client;
// the next attempt gets a fresh connection.
const RETRYABLE = /terminated|connection|reset|timeout|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|57P01|57P03|^08/i;

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = `${err?.code ?? ''} ${err?.message ?? ''}`;
      if (attempt < maxAttempts && RETRYABLE.test(msg)) {
        const delay = Math.min(200 * Math.pow(2, attempt - 1), 2000); // 200ms → 400ms
        console.warn(`⚠️ DB error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms …`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  // TypeScript: unreachable, but satisfies the return type
  throw new Error('withRetry: exhausted all retries');
}