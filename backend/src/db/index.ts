// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 7,                          // Reasonable ceiling — avoids overwhelming Supavisor
  connectionTimeoutMillis: 10_000,       // Fail fast so retries get fresh connections sooner
  idleTimeoutMillis: 15_000,             // Cycle out idle connections aggressively before they go stale
  keepAlive: true,                       // OS-level TCP keep-alive probes
  keepAliveInitialDelayMillis: 10_000,   // Probe after 10 s of silence (Linux default is 2 h — way too late for Render)
  query_timeout: 10000,
  statement_timeout: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Mandatory: discard broken idle clients instead of crashing the process
pool.on('error', (err) => {
  console.error('⚠️ Idle client error (handled natively by pg):', err.message);
});

// Log every fresh TCP connection for observability
pool.on('connect', (client) => {
  console.log('🔗 New pool connection established');

  // Catch orphaned socket errors so they don't crash the Node process
  client.on('error', (err) => {
    console.warn('⚠️ Orphaned client error caught:', err.message);
  });
});

// Log when a connection is removed and keep the pool warm
pool.on('remove', () => {
  console.log(`🗑️ Pool connection removed (total: ${pool.totalCount}, idle: ${pool.idleCount})`);

  // Guarantee there is ALWAYS at least 1 warm connection ready to go.
  // If the total drops below 2, immediately spin one up in the background.
  if (pool.totalCount < 2) {
    console.log('🔥 Spawning background replacement to keep pool warm...');
    pool.query('SELECT 1').catch((err) => {
      console.warn('⚠️ Background warmup skipped (network down):', err.message);
    });
  }
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
      const msg = `${err?.code ?? ''} ${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
      if (attempt < maxAttempts && RETRYABLE.test(msg)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s → 2s → 4s
        console.warn(
          `⚠️ DB error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms …`,
          `[pool: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}]`,
          err?.cause?.message || err.message,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  // TypeScript: unreachable, but satisfies the return type
  throw new Error('withRetry: exhausted all retries');
}