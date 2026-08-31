/**
 * One-off runner to apply a single drizzle-kit generated migration file
 * directly, statement by statement — used instead of `drizzle-kit push`
 * when push's live-diff introspection proposes unrelated, incorrect
 * changes (seen once against this DB: spurious NOT NULL drops on existing
 * columns untouched by the actual migration). Safe here because this
 * migration is purely additive (CREATE TABLE IF NOT EXISTS + new FKs).
 *
 * Usage: npx tsx scripts/apply-migration.ts drizzle/0001_thin_jasper_sitwell.sql
 */
import { readFileSync } from 'fs';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/apply-migration.ts <path-to-migration.sql>');
    process.exit(1);
  }

  const contents = readFileSync(file, 'utf-8');
  const statements = contents
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const [i, statement] of statements.entries()) {
    console.log(`[${i + 1}/${statements.length}] Executing…`);
    await db.execute(sql.raw(statement));
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
