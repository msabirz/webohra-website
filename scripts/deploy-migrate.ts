/**
 * Migration-on-deploy wiring (item 35, 2026-09-08) — the 2026-09-07 QA
 * sweep's M-5 finding: Vercel's build step never ran `npm run db:migrate`
 * automatically, so a deploy could ship code expecting a new column/table
 * before anyone remembered to apply the migration that creates it,
 * producing real 500s on missing columns. This runs BEFORE `next build`
 * (see package.json's `build` script) so that's no longer possible.
 *
 * Gated on `VERCEL_ENV` (set automatically by Vercel, unset everywhere
 * else) rather than running unconditionally — a plain local
 * `npm run build` on a developer's own machine has no Vercel context at
 * all and must never touch a real database as a side effect of building.
 *
 * Runs for BOTH 'production' AND 'preview' — Preview deployments are this
 * project's staging environment (per the user, 2026-09-08), so schema
 * changes need to land there too, not just on production. Genuinely
 * skips only when VERCEL_ENV is unset (a local build) or 'development'.
 *
 * ⚠️ Real assumption worth confirming, not something this script can see:
 * this only does the right thing if Preview deploys point at their OWN
 * database (e.g. Neon's Vercel integration, which can create a separate
 * Neon branch/database per preview deployment) rather than sharing
 * production's `DATABASE_URL`. If Preview currently points at the SAME
 * database as production, this makes every preview deploy (including an
 * unmerged PR's branch) apply pending migrations straight to production
 * — migrations are idempotent so that's not unsafe exactly, but it does
 * mean a not-yet-reviewed PR's schema change lands on production the
 * moment its preview build runs, not at merge time. Worth checking in
 * the Vercel project settings / Neon integration before relying on this.
 */
import { execSync } from 'node:child_process';

const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv === 'production' || vercelEnv === 'preview') {
  console.log(`[deploy-migrate] VERCEL_ENV=${vercelEnv} — running migrations before build...`);
  execSync('npm run db:migrate', { stdio: 'inherit' });
} else {
  console.log(`[deploy-migrate] VERCEL_ENV=${vercelEnv ?? '(unset)'} — not a Vercel deploy, skipping migration.`);
}
