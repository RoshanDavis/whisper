// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,                               // Single connection — heartbeat always exercises THE connection, no hidden stale ones
  connectionTimeoutMillis: 30_000,       // 30 s — tolerate Supabase cold starts + pooler wake-up
  idleTimeoutMillis: 0,                  // NEVER close from our side — heartbeat keeps it alive
  allowExitOnIdle: false,                // Don't let the pool shut down while the process is alive
  keepAlive: true,                       // Enable TCP keepalive probes
  keepAliveInitialDelayMillis: 5_000,    // 5 s — start probes quickly so Render's NAT doesn't drop the socket
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
// Retries up to 4 times with backoff on connection-class errors.
// With max:1, a dead connection gets evicted on the first failure,
// and the retry opens a fresh one.
const RETRYABLE = /terminated|connection|reset|timeout|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|57P01|57P03|^08/i;

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = `${err?.code ?? ''} ${err?.message ?? ''}`;
      if (attempt < maxAttempts && RETRYABLE.test(msg)) {
        const delay = Math.min(200 * Math.pow(2, attempt - 1), 3000); // 200ms → 400ms → 800ms → 1600ms
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