// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,                               // Supabase free tier: keep pool tiny to avoid exhausting server-side limits
  connectionTimeoutMillis: 30_000,       // 30 s — tolerate Supabase cold starts + pooler wake-up on free tier
  idleTimeoutMillis: 10_000,             // 10 s — close idle connections BEFORE PgBouncer kills them
  allowExitOnIdle: false,                // Don't let the pool shut down while the process is alive
  keepAlive: true,                       // Enable TCP keepalive probes
  keepAliveInitialDelayMillis: 10_000,   // 10 s — send probes before cloud LBs consider the socket idle
  ssl: {
    rejectUnauthorized: false,
  },
});

// Mandatory: discard broken idle clients instead of crashing the process
pool.on('error', (err) => {
  console.error('⚠️ Idle client error (discarded):', err.message);
});

export const db = drizzle(pool, { schema });
export { pool };

// ── Resilient query helper ──
// Retries up to 3 times with exponential backoff on connection-class errors.
// This handles the case where PgBouncer/Supavisor kills ALL idle pool clients
// simultaneously — each retry evicts one dead client and tries a fresh one.
const RETRYABLE = /terminated|connection|reset|timeout|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|57P01|57P03|^08/i;

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = `${err?.code ?? ''} ${err?.message ?? ''}`;
      if (attempt < maxAttempts && RETRYABLE.test(msg)) {
        const delay = Math.min(150 * Math.pow(2, attempt - 1), 2000); // 150ms → 300ms → 600ms …
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