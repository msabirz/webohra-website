import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, jamaats, webohraOffices } from '@/db/schema';

export type ResolvedPickupLocation = {
  city: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; pincode: string } | null;
};

/**
 * Resolves where a Pickup & Pay buyer actually collects from, given a
 * listing's own pickupAddressSource choice — either the seller's own
 * address (seller_profiles, added in Phase 2) or the WeBohra office her
 * jamaat maps to (jamaats.officeId, set by Admin). Returns nulls
 * throughout when the chain can't be resolved yet — she hasn't filled in
 * her address, hasn't set a jamaat, or her jamaat has no office mapped —
 * callers treat that as "not eligible", never as a guess at a location
 * that might be wrong. Shared by the listing detail route (buyer-facing
 * eligibility/display) and the pickup-request route (server-side
 * validation), so the two can never disagree about where "here" is.
 */
export async function resolvePickupLocation(
  sellerId: number,
  source: 'seller' | 'office' | null,
): Promise<ResolvedPickupLocation> {
  if (!source) return { city: null, address: null };

  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId));
  if (!profile) return { city: null, address: null };

  if (source === 'seller') {
    if (!profile.addressLine1 || !profile.city || !profile.state || !profile.pincode) {
      return { city: null, address: null };
    }
    return {
      city: profile.city,
      address: {
        line1: profile.addressLine1,
        line2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
      },
    };
  }

  // source === 'office'
  if (!profile.jamaatId) return { city: null, address: null };
  const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, profile.jamaatId));
  if (!jamaat?.officeId) return { city: null, address: null };
  const [office] = await db.select().from(webohraOffices).where(eq(webohraOffices.id, jamaat.officeId));
  if (!office || !office.active) return { city: null, address: null };
  return {
    city: office.city,
    address: {
      line1: office.addressLine1,
      line2: office.addressLine2,
      city: office.city,
      state: office.state,
      pincode: office.pincode,
    },
  };
}
