/**
 * One-off: records 0000 and 0001 as already-applied in drizzle's own
 * bookkeeping table (drizzle.__drizzle_migrations), using the exact hash
 * algorithm drizzle-orm's migrator uses (sha256 of the raw file contents —
 * see node_modules/drizzle-orm/migrator.ts's readMigrationFiles).
 *
 * Needed because both migrations were applied by hand (apply-migration.ts)
 * before this bookkeeping table existed, rather than via `migrate()`. Run
 * once; after this, `npm run db:migrate` works normally for every future
 * migration.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import journal from '../drizzle/meta/_journal.json';

async function main() {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existing = await db.execute(
    sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
  );
  const count = (existing.rows[0] as { count: number }).count;

  if (count > 0) {
    console.log('Bookkeeping table already has entries — nothing to backfill.');
    return;
  }

  for (const entry of journal.entries) {
    const filePath = `drizzle/${entry.tag}.sql`;
    const contents = readFileSync(filePath, 'utf-8');
    const hash = createHash('sha256').update(contents).digest('hex');
    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`,
    );
    console.log(`Recorded ${entry.tag} as applied.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
