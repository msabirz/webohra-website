/**
 * One-off: fills slug/order_number for rows created before those columns
 * existed. Run once, then a follow-up migration adds NOT NULL — see
 * listings.slug's comment in db/schema.ts.
 */
import { isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { listings, orders } from '../db/schema';
import { slugifyTitle, withUniqueSuffix, generateOrderNumber } from '../lib/ids';
import { eq } from 'drizzle-orm';

async function main() {
  const listingsToFix = await db.select().from(listings).where(isNull(listings.slug));
  for (const listing of listingsToFix) {
    const base = slugifyTitle(listing.title);
    const [collision] = await db.select().from(listings).where(eq(listings.slug, base));
    await db
      .update(listings)
      .set({ slug: collision ? withUniqueSuffix(base) : base })
      .where(eq(listings.id, listing.id));
  }
  console.log(`Backfilled ${listingsToFix.length} listing slugs.`);

  const ordersToFix = await db.select().from(orders).where(isNull(orders.orderNumber));
  for (const order of ordersToFix) {
    await db
      .update(orders)
      .set({ orderNumber: generateOrderNumber() })
      .where(eq(orders.id, order.id));
  }
  console.log(`Backfilled ${ordersToFix.length} order numbers.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
