import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, jamaats, webohraOffices } from '@/db/schema';

export type ResolvedPickupLocation = {
  city: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; pincode: string } | null;
};

/** A listing's own per-listing override for the 'other' source — see
 *  resolvePickupLocation's own comment for how this interacts with her
 *  saved default. */
export type ListingOtherAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
} | null;

/**
 * Resolves where a Pickup & Pay buyer actually collects from, given a
 * listing's own pickupAddressSource choice — the seller's own address
 * (seller_profiles, added in Phase 2), the WeBohra office her jamaat
 * maps to (jamaats.officeId, set by Admin), or (item 26, 2026-09-07) a
 * genuinely different address she's named herself. Returns nulls
 * throughout when the chain can't be resolved yet — she hasn't filled in
 * her address, hasn't set a jamaat, her jamaat has no office mapped, or
 * (for 'other') she's set neither a per-listing override nor a saved
 * default — callers treat that as "not eligible", never as a guess at a
 * location that might be wrong. Shared by the listing detail route
 * (buyer-facing eligibility/display), the pickup-order route (server-side
 * validation), and the superseded pickup-requests routes (kept only for
 * historical tracking links), so none of them can ever disagree about
 * where "here" is.
 *
 * `listingOtherAddress`, when the source is 'other', is the listing's own
 * override — pass the listing's own pickupOtherAddress* columns straight
 * through. When it's fully filled in, it WINS over her saved default
 * (sellerProfiles.pickupOtherAddress*); when it's absent, partial, or
 * simply omitted by an older caller, this falls back to her saved
 * default instead — the user's own scoping call was "let the seller
 * decide" whether it's one reusable address or a per-listing one, so
 * both have to work, and a listing-level override always takes priority
 * when she's deliberately set one.
 */
export async function resolvePickupLocation(
  sellerId: number,
  source: 'seller' | 'office' | 'other' | null,
  listingOtherAddress?: ListingOtherAddress,
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

  if (source === 'other') {
    if (
      listingOtherAddress?.line1 &&
      listingOtherAddress.city &&
      listingOtherAddress.state &&
      listingOtherAddress.pincode
    ) {
      return {
        city: listingOtherAddress.city,
        address: {
          line1: listingOtherAddress.line1,
          line2: listingOtherAddress.line2,
          city: listingOtherAddress.city,
          state: listingOtherAddress.state,
          pincode: listingOtherAddress.pincode,
        },
      };
    }
    if (
      !profile.pickupOtherAddressLine1 ||
      !profile.pickupOtherAddressCity ||
      !profile.pickupOtherAddressState ||
      !profile.pickupOtherAddressPincode
    ) {
      return { city: null, address: null };
    }
    return {
      city: profile.pickupOtherAddressCity,
      address: {
        line1: profile.pickupOtherAddressLine1,
        line2: profile.pickupOtherAddressLine2,
        city: profile.pickupOtherAddressCity,
        state: profile.pickupOtherAddressState,
        pincode: profile.pickupOtherAddressPincode,
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
