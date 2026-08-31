import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config as loadEnv } from 'dotenv';
import * as schema from './schema';

// Next.js loads .env.local into process.env itself before this module runs.
// Standalone scripts (db/seed.ts, run via tsx) don't get that for free, so
// load it here too — dotenv only fills in vars that aren't already set, so
// this is a no-op under Next.
loadEnv({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in.');
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
