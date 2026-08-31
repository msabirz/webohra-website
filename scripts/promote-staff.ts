/**
 * One-time (or occasional) bootstrap for staff accounts — there's no admin
 * UI action that can grant the *first* staff_role, since every /api/admin/*
 * route requires one already (see site CLAUDE.md's "Admin/staff routes"
 * rule). This is that one deliberate back door, run by hand from a trusted
 * machine, never exposed over HTTP.
 *
 * Usage:
 *   npx tsx scripts/promote-staff.ts <email> <role> [--phone 9XXXXXXXXX] [--password secret] [--name "Full Name"]
 *
 * role is one of: customer_support | admin | super_admin
 *
 * If the email already has an account (buyer/seller or otherwise), this
 * just grants the role — no new signup needed, and staff access stacks on
 * top of whatever she already has, per the "role capabilities, not
 * exclusive" data model. If the email is new, --phone and --password are
 * required to create the account (phone must be a unique, valid 10-digit
 * Indian mobile number — same rule as everywhere else on the site); the new
 * account is created with phoneVerified: true, since a staff hire onboarded
 * this way doesn't go through the buyer OTP flow.
 *
 * Once staff exists, promote further staff from the Admin Panel's Staff
 * page instead (super_admin only) — this script is only for the very first
 * account, or emergency recovery if every super_admin gets locked out.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users, staffRoleEnum } from '../db/schema';
import { hashPassword } from '../lib/password';

type Role = (typeof staffRoleEnum.enumValues)[number];

function parseArgs() {
  const [, , email, role, ...rest] = process.argv;
  if (!email || !role) {
    console.error(
      'Usage: npx tsx scripts/promote-staff.ts <email> <role> [--phone 9XXXXXXXXX] [--password secret] [--name "Full Name"]',
    );
    process.exit(1);
  }
  if (!staffRoleEnum.enumValues.includes(role as Role)) {
    console.error(`role must be one of: ${staffRoleEnum.enumValues.join(', ')}`);
    process.exit(1);
  }

  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    if (key) flags[key] = rest[i + 1];
  }

  return { email: email.trim().toLowerCase(), role: role as Role, flags };
}

async function main() {
  const { email, role, flags } = parseArgs();

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    await db.update(users).set({ staffRole: role }).where(eq(users.id, existing.id));
    console.log(`Granted "${role}" to existing account ${email} (user id ${existing.id}).`);
    return;
  }

  const phone = flags.phone?.replace(/\D/g, '');
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    console.error(
      `No account exists for ${email} yet — creating one needs --phone <10-digit Indian mobile number>.`,
    );
    process.exit(1);
  }
  if (!flags.password || flags.password.length < 8) {
    console.error(`Creating a new account needs --password <at least 8 characters>.`);
    process.exit(1);
  }

  const [phoneTaken] = await db.select().from(users).where(eq(users.phone, phone));
  if (phoneTaken) {
    console.error(`Phone ${phone} is already in use by another account (user id ${phoneTaken.id}).`);
    process.exit(1);
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      phone,
      phoneVerified: true,
      name: flags.name ?? null,
      passwordHash: hashPassword(flags.password),
      staffRole: role,
    })
    .returning();

  console.log(`Created a new "${role}" account for ${email} (user id ${created.id}).`);
  console.log(`Sign in at /admin/login with that email and the password you passed in.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
