/**
 * Wipes every bit of accumulated test/dev data (listings, orders,
 * enquiries, pickup requests, and the users/sellers behind them) so the
 * DB can be reseeded clean for UAT — see db/seed.ts, run right after this.
 * Deliberately narrow about what it keeps: the three persistent QA
 * credentials (admin/seller/buyer — see project memory) survive by email,
 * and reference/config data (categories, subcategories, fields, jamaats)
 * is never touched here at all — this only clears transactional data and
 * the ad hoc accounts that generated it. Same DB as production (there is
 * only one), so this is deliberately a stand-alone script run by hand, not
 * something wired into any automated flow.
 *
 * Usage: npx tsx scripts/reset-test-data.ts
 */
import { eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db/index';
import {
  users,
  sellerProfiles,
  listings,
  orders,
  enquiries,
  pickupRequests,
  whatsappContacts,
  listingPins,
  listingFieldValues,
  listingImages,
  listingVariants,
  banners,
} from '../db/schema';

const KEEP_EMAILS = ['admin@webohra.com', 'zainab.test@webohra.test', 'buyer.test@webohra.test'];

async function main() {
  const keepRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, KEEP_EMAILS));
  const keepIds = keepRows.map((r) => r.id);
  console.log(`Keeping ${keepRows.length} accounts: ${keepRows.map((r) => r.email).join(', ')}`);
  if (keepIds.length !== KEEP_EMAILS.length) {
    console.warn(
      `Warning: expected ${KEEP_EMAILS.length} accounts to keep, found ${keepIds.length} — ` +
        `missing ones will simply not exist after this runs, nothing else changes.`,
    );
  }

  // Orders first — order_items.listing_id is onDelete:'restrict', so any
  // leftover order_items would block deleting listings below. Deleting
  // orders cascades to order_items automatically (see db/schema.ts).
  const deletedOrders = await db.delete(orders).returning({ id: orders.id });
  console.log(`Deleted ${deletedOrders.length} orders (and their order_items via cascade).`);

  const deletedEnquiries = await db.delete(enquiries).returning({ id: enquiries.id });
  console.log(`Deleted ${deletedEnquiries.length} enquiries.`);

  const deletedPickups = await db.delete(pickupRequests).returning({ id: pickupRequests.id });
  console.log(`Deleted ${deletedPickups.length} pickup requests.`);

  const deletedWhatsapp = await db.delete(whatsappContacts).returning({ id: whatsappContacts.id });
  console.log(`Deleted ${deletedWhatsapp.length} WhatsApp contact logs.`);

  const deletedPins = await db.delete(listingPins).returning({ id: listingPins.id });
  console.log(`Deleted ${deletedPins.length} listing pins.`);

  // These three cascade from listings too, but deleting them explicitly
  // first keeps the listings delete below simple and fast either way.
  await db.delete(listingFieldValues);
  await db.delete(listingImages);
  await db.delete(listingVariants);

  const deletedListings = await db.delete(listings).returning({ id: listings.id });
  console.log(`Deleted ${deletedListings.length} listings (and their variants/images/field values).`);

  const deletedSellerProfiles = keepIds.length
    ? await db.delete(sellerProfiles).where(notInArray(sellerProfiles.userId, keepIds)).returning({ id: sellerProfiles.id })
    : await db.delete(sellerProfiles).returning({ id: sellerProfiles.id });
  console.log(`Deleted ${deletedSellerProfiles.length} seller profiles.`);

  const deletedUsers = keepIds.length
    ? await db.delete(users).where(notInArray(users.id, keepIds)).returning({ id: users.id })
    : await db.delete(users).returning({ id: users.id });
  console.log(`Deleted ${deletedUsers.length} users.`);

  // The one stray banner created by hand through the Admin panel during
  // testing, not part of BANNER_SEED — matched by its actual test copy so
  // this never accidentally deletes a real banner someone adds later.
  const deletedBanners = await db
    .delete(banners)
    .where(eq(banners.heading, 'Looking something Quick??'))
    .returning({ id: banners.id });
  console.log(`Deleted ${deletedBanners.length} stray test banner(s).`);

  console.log('\nDone. Now run: npx tsx db/seed.ts');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
