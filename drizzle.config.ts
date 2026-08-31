import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next.js loads .env.local itself; drizzle-kit is a standalone CLI, so load it here too.
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in.');
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
