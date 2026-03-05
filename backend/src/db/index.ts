// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30_000, // 30 s — tolerate slow cold-start routes to Supabase
  idleTimeoutMillis: 30_000,       // 30 s — release idle connections before cloud LBs kill them
  ssl: {
    rejectUnauthorized: false, // Required for managed providers like Supabase
  },
});

export const db = drizzle(pool, { schema });