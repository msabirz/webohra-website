/**
 * Fulfillment & Subscriptions redesign, Phase 4 — run once, by hand,
 * before the publish-gate enforcement in app/api/listings/[idOrSlug]/route.ts
 * goes live. Without this, every seller who already has active listings
 * would suddenly be unable to publish anything new the moment enforcement
 * ships, since none of them have ever chosen a plan (subscriptions didn't
 * exist until now).
 *
 * For every seller with at least one listing, grandfathers her onto the
 * top tier for each seller_type she actually has listings in (Diamond for
 * product, Gold for service — the most permissive plan for that type, so
 * nothing she's already doing becomes newly blocked). A seller who sells
 * both gets both. This is deliberately generous, not what she'd have
 * picked herself — it exists purely so enforcement can ship with zero
 * disruption; she can change her plan for real from /seller/subscription
 * any time after.
 *
 * Idempotent — safe to re-run. Only ever creates a subscription for a
 * seller_type she doesn't already have one for; never touches an existing
 * row (so re-running this after a real seller has already picked her own
 * plan can't silently overwrite her choice).
 *
 * Usage: npx tsx scripts/grandfather-subscriptions.ts
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { listings, subcategories, sellerSubscriptions, subscriptionPlans } from '../db/schema';
import { sellerTypeForListingType, type SellerType } from '../lib/subscriptions';

async function main() {
  const rows = await db
    .select({ sellerId: listings.sellerId, listingType: subcategories.listingType })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id));

  const neededBySeller = new Map<number, Set<SellerType>>();
  for (const row of rows) {
    const sellerType = sellerTypeForListingType(row.listingType);
    const set = neededBySeller.get(row.sellerId) ?? new Set<SellerType>();
    set.add(sellerType);
    neededBySeller.set(row.sellerId, set);
  }

  if (neededBySeller.size === 0) {
    console.log('No sellers with listings found — nothing to grandfather.');
    return;
  }

  const topPlans = await db
    .select()
    .from(subscriptionPlans)
    .where(inArray(subscriptionPlans.tierKey, ['diamond', 'gold']));
  const topPlanByType = new Map<SellerType, (typeof topPlans)[number]>();
  for (const plan of topPlans) {
    // 'diamond' only exists for product plans, 'gold' is the top tier for
    // both — take diamond for product if present, gold otherwise.
    if (plan.sellerType === 'product' && plan.tierKey === 'diamond') topPlanByType.set('product', plan);
    if (plan.sellerType === 'service' && plan.tierKey === 'gold') topPlanByType.set('service', plan);
  }
  if (!topPlanByType.get('product') || !topPlanByType.get('service')) {
    console.error('Could not find the top product/service plan — has db/seed.ts been run for Phase 1?');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  for (const [sellerId, sellerTypes] of neededBySeller) {
    for (const sellerType of sellerTypes) {
      const [existing] = await db
        .select()
        .from(sellerSubscriptions)
        .where(and(eq(sellerSubscriptions.sellerId, sellerId), eq(sellerSubscriptions.sellerType, sellerType)));
      if (existing) {
        skipped += 1;
        continue;
      }
      const plan = topPlanByType.get(sellerType)!;
      await db.insert(sellerSubscriptions).values({
        sellerId,
        sellerType,
        billingMode: 'plan',
        planId: plan.id,
        status: 'active',
      });
      created += 1;
      console.log(`Seller #${sellerId}: grandfathered onto ${plan.name} (${sellerType}).`);
    }
  }

  console.log(`\nDone. Created ${created} subscription(s), skipped ${skipped} (already had one).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
