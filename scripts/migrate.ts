/**
 * Applies any not-yet-applied files in drizzle/ using drizzle-orm's own
 * migrator (tracked via drizzle.__drizzle_migrations — see
 * scripts/backfill-migration-history.ts for how existing migrations were
 * registered there). Run this after `npm run db:generate` instead of
 * `drizzle-kit push`: push does a live schema diff against the introspected
 * DB and once proposed dropping NOT NULL constraints on unrelated existing
 * columns for no reason tied to the actual change — this runs the exact,
 * reviewable SQL files in drizzle/ instead.
 */
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '../db/index';

migrate(db, { migrationsFolder: './drizzle' })
  .then(() => {
    console.log('Migrations applied.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
