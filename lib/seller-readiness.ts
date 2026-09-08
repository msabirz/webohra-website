import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, sellerPayoutAccounts, sellerShipCities } from '@/db/schema';
import { resolvePickupLocation } from '@/lib/pickup';
import { isBlockedByLowWalletBalance, sellerTypeForListingType, type SellerType } from '@/lib/subscriptions';

/**
 * Item 38 (2026-09-09) — a real, unified publish gate. Before this, the
 * only things blocking "draft" -> "active" were ITS verification and GST/
 * Udyam verification (item 33) — a seller could publish with zero wallet
 * balance, no payout method on file, and no ITS card or GST/Udyam
 * certificate photo (both existed as purely optional evidence, item 37).
 * Registering and building draft listings stays completely unrestricted —
 * this only ever blocks the transition to 'active', same as the checks it
 * extends.
 */

/**
 * Her seller-level readiness — independent of any specific listing, so
 * it's the same answer everywhere: the portal-wide banner
 * (GET /api/sellers/readiness), and the first half of the publish gate
 * below. Deliberately excludes wallet balance and shipping/pickup address
 * completeness — both depend on which listing and which shipping/pickup
 * method she's actually publishing, not on her account as a whole (see
 * checkListingMandatoryInfo).
 */
export type SellerReadiness = {
  itsVerified: boolean;
  itsCardUploaded: boolean;
  taxIdSubmitted: boolean;
  taxIdVerified: boolean;
  taxIdRejectedReason: string | null;
  taxIdDocumentUploaded: boolean;
  payoutMethodSet: boolean;
  allDone: boolean;
};

export async function getSellerReadiness(sellerId: number): Promise<SellerReadiness> {
  const [user] = await db
    .select({ itsVerified: users.itsVerified, itsCardImageUrl: users.itsCardImageUrl })
    .from(users)
    .where(eq(users.id, sellerId));
  const [profile] = await db
    .select({
      taxIdType: sellerProfiles.taxIdType,
      taxIdVerified: sellerProfiles.taxIdVerified,
      taxIdRejectedReason: sellerProfiles.taxIdRejectedReason,
      taxIdDocumentUrl: sellerProfiles.taxIdDocumentUrl,
    })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, sellerId));
  const [payout] = await db
    .select({ id: sellerPayoutAccounts.id })
    .from(sellerPayoutAccounts)
    .where(eq(sellerPayoutAccounts.sellerId, sellerId));

  const itsVerified = !!user?.itsVerified;
  const itsCardUploaded = !!user?.itsCardImageUrl;
  const taxIdSubmitted = !!profile?.taxIdType;
  const taxIdVerified = !!profile?.taxIdVerified;
  const taxIdDocumentUploaded = !!profile?.taxIdDocumentUrl;
  const payoutMethodSet = !!payout;

  return {
    itsVerified,
    itsCardUploaded,
    taxIdSubmitted,
    taxIdVerified,
    taxIdRejectedReason: profile?.taxIdRejectedReason ?? null,
    taxIdDocumentUploaded,
    payoutMethodSet,
    allDone: itsVerified && itsCardUploaded && taxIdVerified && taxIdDocumentUploaded && payoutMethodSet,
  };
}

export type MandatoryGateCode =
  | 'its_not_verified'
  | 'its_card_missing'
  | 'tax_not_verified'
  | 'tax_document_missing'
  | 'payout_method_missing'
  | 'wallet_balance_low'
  | 'shipping_city_missing'
  | 'delhivery_jamaat_missing'
  | 'pickup_address_missing';

type MandatoryGateResult = { ok: true } | { ok: false; error: string; code: MandatoryGateCode };

/**
 * The seller-level half — same answer regardless of which listing she's
 * publishing, so callers publishing more than one listing at once (bulk-
 * status) only need to run this once per request, not once per listing.
 */
export async function checkSellerMandatoryVerification(sellerId: number): Promise<MandatoryGateResult> {
  const readiness = await getSellerReadiness(sellerId);

  if (!readiness.itsVerified) {
    return {
      ok: false,
      error: 'Your ITS ID needs to be verified by Admin before you can publish listings.',
      code: 'its_not_verified',
    };
  }
  if (!readiness.itsCardUploaded) {
    return {
      ok: false,
      error: 'Upload a photo of your ITS card before you can publish listings — add it from Settings.',
      code: 'its_card_missing',
    };
  }
  if (!readiness.taxIdVerified) {
    return {
      ok: false,
      error:
        'Submit your GST number or Udyam/MSME enrollment ID for verification before you can publish listings — see Tax & Business Verification in your seller portal.',
      code: 'tax_not_verified',
    };
  }
  if (!readiness.taxIdDocumentUploaded) {
    return {
      ok: false,
      error:
        'Upload a photo of your GST/Udyam certificate before you can publish listings — add it from Tax & Business Verification.',
      code: 'tax_document_missing',
    };
  }
  if (!readiness.payoutMethodSet) {
    return {
      ok: false,
      error: 'Add how you want to get paid (UPI or bank account) before you can publish listings — see Payouts in your seller portal.',
      code: 'payout_method_missing',
    };
  }

  return { ok: true };
}

/**
 * The listing-specific half — wallet balance (per sellerType, product vs
 * service) and shipping/pickup address completeness both depend on the
 * particular listing being published, so this runs once per listing.
 */
export async function checkListingMandatoryInfo(
  sellerId: number,
  listing: {
    subcategoryId: number;
    listingType: 'physical_product' | 'local_service' | 'remote_service';
    shippingMethod: 'self_managed' | 'delhivery';
    pickupEnabled: boolean;
    pickupAddressSource: 'seller' | 'office' | 'other' | null;
    pickupOtherAddressLine1?: string | null;
    pickupOtherAddressLine2?: string | null;
    pickupOtherAddressCity?: string | null;
    pickupOtherAddressState?: string | null;
    pickupOtherAddressPincode?: string | null;
  },
): Promise<MandatoryGateResult> {
  const sellerType: SellerType = sellerTypeForListingType(listing.listingType);
  if (await isBlockedByLowWalletBalance(sellerId, sellerType)) {
    return {
      ok: false,
      error: 'Your wallet balance is too low to publish — recharge from your Wallet page first.',
      code: 'wallet_balance_low',
    };
  }

  if (listing.shippingMethod === 'self_managed') {
    const [shipCity] = await db
      .select({ city: sellerShipCities.city })
      .from(sellerShipCities)
      .where(eq(sellerShipCities.sellerId, sellerId));
    if (!shipCity?.city) {
      return {
        ok: false,
        error: 'Set the city you ship to before publishing a self-managed-shipping listing — add it from Settings.',
        code: 'shipping_city_missing',
      };
    }
  }

  if (listing.shippingMethod === 'delhivery') {
    const [profile] = await db.select({ jamaatId: sellerProfiles.jamaatId }).from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId));
    if (!profile?.jamaatId) {
      return {
        ok: false,
        error: 'Select your jamaat before publishing a Delhivery-shipped listing — add it from Settings.',
        code: 'delhivery_jamaat_missing',
      };
    }
  }

  if (listing.pickupEnabled) {
    const location = await resolvePickupLocation(sellerId, listing.pickupAddressSource, {
      line1: listing.pickupOtherAddressLine1 ?? null,
      line2: listing.pickupOtherAddressLine2 ?? null,
      city: listing.pickupOtherAddressCity ?? null,
      state: listing.pickupOtherAddressState ?? null,
      pincode: listing.pickupOtherAddressPincode ?? null,
    });
    if (!location.address) {
      return {
        ok: false,
        error: 'Add a complete pickup address before publishing this listing — set it from Settings, or on the listing itself.',
        code: 'pickup_address_missing',
      };
    }
  }

  return { ok: true };
}
