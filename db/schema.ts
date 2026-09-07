import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Not mutually exclusive with buyer status — a user row can be a phone-verified
 *  buyer AND an ITS-verified seller AND staff, all at once (see site CLAUDE.md
 *  "Data model essentials"). staff_role is nullable: null means no staff access. */
export const staffRoleEnum = pgEnum('staff_role', [
  'customer_support',
  'admin',
  'super_admin',
]);

export const listingTypeEnum = pgEnum('listing_type', [
  'physical_product',
  'local_service',
  'remote_service',
]);

export const shippingMethodEnum = pgEnum('shipping_method', [
  'self_managed',
  'delhivery',
]);

/** Moderation lifecycle per FR-14 (Admin can remove/flag/restore a listing),
 *  plus 'archived' for the seller's own self-service unpublish (distinct
 *  from 'removed', which is Admin-only moderation). The DB value stays
 *  'active' for historical/API-contract reasons (see webohra-app's client)
 *  — the seller-facing UI presents it as "Published". Not enumerated
 *  verbatim in the SRS — inferred from FR-14's remove/flag/restore verbs
 *  plus a draft state for support-assisted creation (FR-16). Revisit if
 *  Admin's actual moderation UI needs finer-grained states. */
export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'active',
  'archived',
  'flagged',
  'removed',
]);

/**
 * Take Consultation's full request lifecycle, per the requester's explicit
 * redesign of FR-21's mechanism: a buyer's request no longer opens WhatsApp
 * herself — it notifies the seller (Seller Portal bell icon), and the
 * SELLER is the one who opens WhatsApp to the buyer, which IS the accept
 * action. 'initiated' = just submitted, 'viewed' = seller opened it,
 * 'accepted'/'rejected' = her decision, 'completed'/'auto_closed_no_update'
 * are unchanged from the original FR-26/FR-27 self-report / 30-day-silence
 * closeout, reachable after 'accepted'.
 */
export const enquiryStatusEnum = pgEnum('enquiry_status', [
  'initiated',
  'viewed',
  'accepted',
  'rejected',
  'completed',
  'auto_closed_no_update',
]);

/** FR-47: Customer Support (not the jamaat committee) receives and logs
 *  parcels a Delhivery-managed seller drops at her jamaat. 'issue' covers
 *  the escalation path — a seller who failed to deliver in time. */
export const pickupRequestStatusEnum = pgEnum('pickup_request_status', [
  'pending',
  'received',
  'issue',
]);

// --- Fulfillment & Subscriptions redesign (planning doc: "Fulfillment &
// Subscriptions") — schema landing ahead of the feature it backs, same
// pattern as orders/order_items originally did. Nothing below is read or
// written by any route yet; this phase is additive-only groundwork. ---

/** Where a buyer's pickup, or a Delhivery parcel, actually originates —
 *  the seller's own address, or a WeBohra office. Shared by both
 *  listings.pickupAddressSource and listings.delhiveryPickupSource since
 *  it's the same choice either way. */
// 'other' added (item 26, 2026-09-07) — a pickup spot that's neither her
// registered business address nor a WeBohra office (real use case: a
// home-based seller who doesn't want buyers at her home/registered
// address). Resolved via a listing-level override if she's set one,
// else her saved default (sellerProfiles.pickupOtherAddress*) — see
// resolvePickupLocation in lib/pickup.ts.
export const pickupAddressSourceEnum = pgEnum('pickup_address_source', [
  'seller',
  'office',
  'other',
]);

/** One row per (order, seller, method) in the new `shipments` table — see
 *  its own comment for why a seller can have more than one shipment in a
 *  single order. */
export const shipmentMethodEnum = pgEnum('shipment_method', [
  'self_managed',
  'delhivery',
  'pickup_and_pay',
]);

/** Who ended an order — a buyer cancelling herself vs. Admin stepping in
 *  after a seller missed her window (e.g. a Delhivery parcel never reached
 *  the WeBohra office in time). Kept distinct so reporting never conflates
 *  the two. Only meaningful once orders.status is 'cancelled'. */
export const cancelledByEnum = pgEnum('cancelled_by', ['buyer', 'ops']);

export const sellerTypeEnum = pgEnum('seller_type', ['product', 'service']);

/** A seller is on exactly one of these per seller_type — a flat monthly
 *  plan, or pay-as-you-go via her wallet. Never both at once for the same
 *  seller_type (see seller_subscriptions' own comment). */
export const billingModeEnum = pgEnum('billing_mode', ['plan', 'recharge']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'lapsed',
  'cancelled',
]);

/** How a buyer reaches a service seller — gated per subscription_plans
 *  tier (see the planning doc's service-tier table). 'masked_relay' is the
 *  previously-deferred contingency design (root CLAUDE.md's "documented
 *  contingency — do not build unless explicitly asked") — now scoped to
 *  Gold-tier only. */
export const contactModeEnum = pgEnum('contact_mode', [
  'whatsapp_number',
  'direct_whatsapp',
  'masked_relay',
]);

/** Every row in wallet_transactions is one of these — the whole audit
 *  trail the "no one is scamming the wallet" requirement rests on. */
export const walletTransactionTypeEnum = pgEnum('wallet_transaction_type', [
  'topup',
  'commission_deduction',
  'admin_adjustment',
  // The COD return flow (2026-09-06) — always a wallet credit, never a
  // bank transfer, per the user's own explicit decision. Fired only
  // after staff verifies a return directly with the buyer and resolves
  // the dispute that triggered it — see lib/disputes.ts's
  // resolveCodReturnDispute.
  'commission_reversal',
]);

/** How a seller receives a payout. Fulfillment & Subscriptions redesign,
 *  Phase 5c — redesigned 2026-09-03 away from RazorpayX Payouts as the
 *  actual money-mover (not affordable/usable at this stage — the user's
 *  own call) toward Admin paying her directly through her own banking/UPI
 *  app, using whichever of these two she registered. Both route through
 *  Razorpay's Contact/Fund Account APIs (confirmed working, unlike the
 *  Payouts-send API, and confirmed the 'vpa' fund-account type works just
 *  as well as 'bank_account') purely so the raw VPA/account number/IFSC
 *  never has to sit in our own database even briefly — fetched live from
 *  Razorpay only when Admin actually needs to see it. At payout time,
 *  'upi' additionally generates a fresh, amount-pre-filled QR code from
 *  the standard UPI deep-link format every UPI app already understands
 *  (lib/upi-qr.ts) — no gateway involved for that step, no extra cost.
 *  There used to be a third method, 'qr_image' (a seller-uploaded QR
 *  screenshot) — dropped 2026-09-03, user's own call, since it only
 *  duplicated what 'upi' already gets her for free, minus the correct
 *  amount being pre-filled. Do not resurrect it via Razorpay's QR Code API
 *  — that product generates a QR that credits WE Bohra's OWN account when
 *  scanned (it's a collection tool), the opposite of what a seller payout
 *  needs; confirmed it's also not enabled on this merchant anyway. */
export const payoutMethodEnum = pgEnum('payout_method', ['upi', 'bank_account']);

/** Forward-only lifecycle of one payout attempt — 'processing' the moment
 *  the real RazorpayX payout call is made, 'processed'/'failed'/'reversed'
 *  once RazorpayX resolves it (reversed covers a payout that succeeded and
 *  was later reversed by the bank, e.g. an invalid account). */
export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'processing',
  'processed',
  'failed',
  'reversed',
]);

/** Which of the two genuinely different paths actually moved (or claims to
 *  have moved) the money for a 'processed' payout — never inferred, always
 *  recorded explicitly, specifically so a non-technical admin looking at
 *  payout history can never confuse "RazorpayX really sent this" with "a
 *  staff member typed that she sent it herself." Null until a payout
 *  leaves 'pending'/'failed'. */
export const payoutChannelEnum = pgEnum('payout_channel', ['razorpayx', 'manual']);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  name: varchar('name', { length: 150 }),
  // The buyer sign-in identifier (Amazon/Flipkart-style: email + password
  // to sign in; phone is collected and OTP-verified only at registration,
  // per SRS FR-30). Null for phone/OTP-only accounts (sellers via
  // /seller/register never set one) — unique when present, so it can
  // double as a login key without colliding across accounts.
  email: varchar('email', { length: 200 }).unique(),
  // Null until she sets one — required at buyer signup (see
  // /api/auth/signup), optional/settable-later for phone/OTP-first
  // accounts (sellers, or anyone who arrived before this existed).
  // Format "salt:hash" — see lib/password.ts.
  passwordHash: varchar('password_hash', { length: 250 }),
  itsId: varchar('its_id', { length: 20 }),
  itsVerified: boolean('its_verified').notNull().default(false),
  staffRole: staffRoleEnum('staff_role'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  // FR-12/FR-18: Admin can deactivate a category without deleting it (its
  // listings and history stay intact) — an inactive category just stops
  // appearing for browsing or new listing creation.
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subcategories = pgTable('subcategories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  listingType: listingTypeEnum('listing_type').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** FR-17/FR-18's "admin-configurable listing schema per subcategory" —
 *  actually built now, not just documented. Every field type a listing form
 *  can render; select/multi_select use `options`, everything else ignores
 *  it. */
export const fieldTypeEnum = pgEnum('field_type', [
  'text',
  'number',
  'select',
  'multi_select',
  'boolean',
  'textarea',
  'image',
]);

export const subcategoryFields = pgTable(
  'subcategory_fields',
  {
    id: serial('id').primaryKey(),
    subcategoryId: integer('subcategory_id')
      .notNull()
      .references(() => subcategories.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 100 }).notNull(),
    // Storage key inside a listing's field-value map — slugified from the
    // label at creation time, then stable even if an admin edits the label
    // later (so existing listing_field_values rows keep resolving).
    fieldKey: varchar('field_key', { length: 100 }).notNull(),
    fieldType: fieldTypeEnum('field_type').notNull(),
    required: boolean('required').notNull().default(false),
    // Only meaningful for select/multi_select — the admin-defined choice
    // list, in display order. Null for every other field type.
    options: jsonb('options').$type<string[]>(),
    sortOrder: integer('sort_order').notNull().default(0),
    // Archived, not deleted — same reasoning as categories.active/
    // subcategories.active. An admin "removing" a field must never cascade-
    // delete listing_field_values for every listing that already answered
    // it; archiving just stops it from being offered on new/edited
    // listings while leaving what was already collected intact and still
    // displayed on the listings that have it.
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('subcategory_fields_subcategory_key_unique').on(table.subcategoryId, table.fieldKey)],
);

/**
 * One row per (listing, field) with an actual seller-entered value. `value`
 * is jsonb rather than a typed column because the field's own fieldType
 * (looked up via fieldId) already says how to interpret it: a string for
 * text/textarea/select/image(URL), a number for number, a boolean for
 * boolean, a string[] for multi_select — one column, seven shapes, instead
 * of seven mostly-null columns.
 */
export const listingFieldValues = pgTable(
  'listing_field_values',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => subcategoryFields.id, { onDelete: 'cascade' }),
    value: jsonb('value').notNull(),
  },
  (table) => [unique('listing_field_values_listing_field_unique').on(table.listingId, table.fieldId)],
);

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  // Public URLs use this, never the raw id (see app/(site)/listing/[slug]) —
  // generated from the title at creation time, with a short random suffix
  // for uniqueness since titles can collide across sellers.
  slug: varchar('slug', { length: 220 }).notNull().unique(),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subcategoryId: integer('subcategory_id')
    .notNull()
    .references(() => subcategories.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  // Nullable — a listing is either simple (this is its one real price) or
  // variant-based (every purchasable price lives in listing_variants
  // instead, and this stays null). Never both: there is deliberately no
  // "parent price" sitting alongside variants a buyer could also buy at,
  // matching how Amazon/Flipkart/Shopify all model the same idea. See
  // listing_variants' own comment for the seller-facing side of this.
  price: numeric('price', { precision: 10, scale: 2 }),
  shippingMethod: shippingMethodEnum('shipping_method').notNull(),
  // Seller-declared estimate text, only meaningful for self_managed shipping
  // (Delhivery-managed gets a real, API-computed estimate instead — SRS §3.7).
  shippingEstimateText: varchar('shipping_estimate_text', { length: 200 }),
  status: listingStatusEnum('status').notNull().default('draft'),
  // Stock on hand — only meaningful for physical_product listings. Null
  // means "not tracked" (most service listings; also physical listings
  // created before this existed), never means zero.
  stockQuantity: integer('stock_quantity'),
  // Set when Admin flags or removes a listing (FR-14) — her reason, shown
  // back to the seller so a moderation action is never an unexplained
  // disappearance. Null the rest of the time.
  moderationNote: varchar('moderation_note', { length: 300 }),
  // --- Fulfillment & Subscriptions redesign — all nullable/defaulted so
  // every existing listing keeps behaving exactly as it does today until
  // the buyer-facing phase (Phase 3) actually reads these. ---
  // Flat fee for self-managed shipping, seller's own number — shown at
  // checkout once Phase 3 lands. Null today means "not set yet," not free.
  selfShipCharge: numeric('self_ship_charge', { precision: 10, scale: 2 }),
  // Per-listing Pickup & Pay toggle — replaces today's seller-wide (jamaat-
  // city-match) eligibility once Phase 3 switches buyer-facing checks over
  // to this. Defaults off so no existing listing silently gains Pickup &
  // Pay the moment this column exists.
  pickupEnabled: boolean('pickup_enabled').notNull().default(false),
  // Stays nullable — genuinely null (not 'seller') when pickupEnabled is
  // false, per the API routes' explicit `pickupEnabled ? (source ?? null)
  // : null` write. The default below only matters when pickupEnabled is
  // true and nothing else was chosen: 'seller' (her own address), never a
  // forced blank choice — Office pickup stays opt-in (2026-09-06).
  pickupAddressSource: pickupAddressSourceEnum('pickup_address_source').default('seller'),
  delhiveryPickupSource: pickupAddressSourceEnum('delhivery_pickup_source'),
  // Per-listing override of her saved 'other' pickup address (item 26,
  // 2026-09-07) — only meaningful when pickupAddressSource is 'other'.
  // All nullable: leaving these blank means "use my saved default from
  // Settings" (see resolvePickupLocation in lib/pickup.ts), not an
  // error — this is genuinely optional, not a required per-listing
  // field.
  pickupOtherAddressLine1: varchar('pickup_other_address_line1', { length: 200 }),
  pickupOtherAddressLine2: varchar('pickup_other_address_line2', { length: 200 }),
  pickupOtherAddressCity: varchar('pickup_other_address_city', { length: 100 }),
  pickupOtherAddressState: varchar('pickup_other_address_state', { length: 100 }),
  pickupOtherAddressPincode: varchar('pickup_other_address_pincode', { length: 10 }),
  // Minimum hours' notice before a buyer's Pickup & Pay slot picker allows
  // a date/time to be selected.
  pickupLeadTimeHours: integer('pickup_lead_time_hours'),
  // Whether her pickup address is shown on the PDP itself vs. only revealed
  // once she marks a specific order "ready for pickup" (the safer default —
  // see pickup_requests.readyForPickupAt). Off by default deliberately.
  showAddressOnPdp: boolean('show_address_on_pdp').notNull().default(false),
  // Kilograms, 3-decimal precision (gram-level). Optional — only meaningful
  // once real Delhivery rate lookups exist; listing_variants.weight can
  // override this per type.
  weight: numeric('weight', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Named, individually-priced options within one listing — "Manda ₹40,"
 * "Chapati ₹35," "Butter Naan ₹60" instead of one flat price for "Roti."
 * Only ever present when the listing is variant-based (listings.price is
 * null in that case, see its own comment) — a listing with zero rows here
 * is a plain single-price listing exactly as before this table existed.
 * Applies to both physical_product and service listings equally (a Mehndi
 * listing's "Hands only / Hands + Feet / Full Bridal" coverage tiers use
 * this same mechanism, not a separate one).
 */
export const listingVariants = pgTable('listing_variants', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  // Same meaning/nullability as listings.stockQuantity — null means not tracked.
  stockQuantity: integer('stock_quantity'),
  sortOrder: integer('sort_order').notNull().default(0),
  // Overrides listings.weight for this one variant when set (e.g. a Roti
  // listing's Butter Naan legitimately weighs more than its Chapati) — null
  // falls back to the listing's own weight. See the planning doc's Risk 2.
  weight: numeric('weight', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per product photo. A listing can have several (seller-uploaded,
 * stored in Cloudflare R2 — see lib/storage/r2.ts); sortOrder controls the
 * gallery order, with the lowest value acting as the cover image everywhere
 * a single thumbnail is shown (listing cards, cart, etc.). variantId is
 * null for a photo that belongs to the listing itself (the simple case, or
 * general photos of a variant-based listing as a whole); set when a photo
 * belongs to one specific variant instead (e.g. that variant's own swatch).
 */
export const listingImages = pgTable('listing_images', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => listingVariants.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Take Consultation request. Guest-submittable (the requester's explicit
 * call — buyerId nullable, buyerName/buyerPhone captured directly, same
 * guest-friendly shape as `orders`), with a public, non-sequential
 * requestNumber so any customer — guest or logged in — can track its status
 * without an account, same trust model as order tracking. A logged-in
 * buyer's requests also show up in her account via buyerId.
 */
export const enquiries = pgTable('enquiries', {
  id: serial('id').primaryKey(),
  // The public tracking identifier (see lib/ids.ts generateRequestNumber) —
  // never the raw id, same reasoning as orders.orderNumber.
  requestNumber: varchar('request_number', { length: 20 }).notNull().unique(),
  buyerId: integer('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  buyerName: varchar('buyer_name', { length: 150 }).notNull(),
  buyerPhone: varchar('buyer_phone', { length: 20 }).notNull(),
  // Optional context she can add when asking — shown to the seller, never required.
  message: varchar('message', { length: 500 }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  // Same reasoning as order_items.variantId/variantName — null for a
  // request against a simple listing, set (with a name snapshot) when it
  // was about one specific type of a variant-based one. onDelete: 'set
  // null' so deleting a variant later can't corrupt or fail a past request.
  variantId: integer('variant_id').references(() => listingVariants.id, { onDelete: 'set null' }),
  variantName: varchar('variant_name', { length: 100 }),
  status: enquiryStatusEnum('status').notNull().default('initiated'),
  // Set the moment the seller opens it in her Enquiries list — 'initiated' -> 'viewed'.
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  // Set on accept or reject — 'viewed' -> 'accepted'/'rejected'.
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  // Optional, only ever set alongside a 'rejected' status.
  rejectionReason: varchar('rejection_reason', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listingPins = pgTable('listing_pins', {
  id: serial('id').primaryKey(),
  // Guests pin by session id (no account); registered buyers pin by user id.
  // Kept as a single free-text column per spec rather than two nullable FKs.
  userIdOrSession: varchar('user_id_or_session', { length: 100 }).notNull(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A WeBohra-operated, volunteer-staffed location — distinct from a jamaat
 * (a community institution WeBohra doesn't run). The drop-off point for a
 * Delhivery-bound parcel a seller chooses not to have picked up from her
 * own address, and an alternate collection point for Pickup & Pay. Several
 * jamaats can share one office (see jamaats.officeId below) rather than
 * needing a 1:1 office per jamaat. Admin-managed.
 */
export const webohraOffices = pgTable('webohra_offices', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  addressLine1: varchar('address_line1', { length: 200 }).notNull(),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  pincode: varchar('pincode', { length: 10 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 20 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Fixed pickup-point list for Delhivery-managed sellers (FR-46, FR-47) — her
 * nearest jamaat becomes the shipping origin instead of her home address.
 * This is master data Admin curates (Section 3.3, FR-12-style config table),
 * not something sellers free-type — seeded with a starter set for now.
 */
export const jamaats = pgTable(
  'jamaats',
  {
    id: serial('id').primaryKey(),
    city: varchar('city', { length: 100 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    active: boolean('active').notNull().default(true),
    // Which WeBohra office serves this jamaat, admin-mapped — null until
    // Admin sets it (see the planning doc's admin capabilities section).
    officeId: integer('office_id').references(() => webohraOffices.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('jamaats_city_name_unique').on(table.city, table.name)],
);

/**
 * Seller-specific profile data, separate from `users` per SRS §4
 * ("seller_profiles — linked to verified user"). One row per seller.
 */
export const sellerProfiles = pgTable('seller_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 150 }).notNull(),
  // Seller storefront (Tier 4, item 24, 2026-09-07) — the public URL for
  // /business/[slug], generated from businessName at registration time,
  // same slugifyTitle + withUniqueSuffix pattern as listings.slug.
  // Nullable only for the transitional backfill window (existing sellers
  // predate this column — see scripts/backfill-slugs-and-order-numbers.ts);
  // a real registration always sets one going forward.
  slug: varchar('slug', { length: 220 }).unique(),
  // Set only if she registered intending to use Delhivery-managed shipping
  // for at least one listing (FR-46). Null means self-managed shipping only.
  jamaatId: integer('jamaat_id').references(() => jamaats.id, { onDelete: 'set null' }),
  // Her real address — didn't exist before the Fulfillment & Subscriptions
  // redesign (only businessName/jamaatId did). Needed as the shipping
  // origin for self-ship, Delhivery-from-seller, and Pickup & Pay's
  // seller-location option. Nullable: existing sellers have none yet, and
  // Phase 2 collects it without forcing every current seller to backfill
  // it before anything else works.
  addressLine1: varchar('address_line1', { length: 200 }),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),
  // Her saved, reusable Pickup & Pay address when she picks 'other' as
  // pickupAddressSource on a listing (item 26, 2026-09-07) — a pickup
  // spot that's neither this address (above) nor a WeBohra office. All
  // nullable: she may never set one, and a per-listing override (see
  // listings.pickupOtherAddress*) takes priority over this when both
  // exist — this is only the fallback. Editable from Seller Settings.
  pickupOtherAddressLine1: varchar('pickup_other_address_line1', { length: 200 }),
  pickupOtherAddressLine2: varchar('pickup_other_address_line2', { length: 200 }),
  pickupOtherAddressCity: varchar('pickup_other_address_city', { length: 100 }),
  pickupOtherAddressState: varchar('pickup_other_address_state', { length: 100 }),
  pickupOtherAddressPincode: varchar('pickup_other_address_pincode', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Phone OTP records for the passwordless seller sign-in/sign-up flow
 * (FR-30's mechanism, MSG91-backed once real credentials exist — see
 * lib/otp/). `codeHash` so a DB read alone never discloses a live code.
 */
export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 'pickup_and_pay' added Tier 4, item 22 (2026-09-06) — she buys, picks
// up in person, pays the seller directly then. Never enters a payment
// gateway pipeline (paymentStatus stays null, same reasoning as 'cod')
// — see shipments.pickupScheduledDate/pickupCompletedAt for the actual
// fulfillment tracking this method needs that 'cod' doesn't.
export const paymentMethodEnum = pgEnum('payment_method', ['cod', 'online', 'pickup_and_pay']);

/** Only ever meaningful for paymentMethod: 'online' — null for every COD
 *  order (see orders.paymentStatus' own comment for why null, not
 *  'pending', is the honest value there). 'refunded' (added 2026-09-03,
 *  admin refunds — see the refunds table below) is set only once the FULL
 *  paid amount has been refunded across one or more refund rows; a
 *  partial refund leaves this at 'paid' — the refunds table's own sum is
 *  the source of truth for exactly how much has actually gone back, and
 *  the admin order-detail UI always shows both figures together rather
 *  than collapsing partial refunds into a single misleading status. */
export const orderPaymentStatusEnum = pgEnum('order_payment_status', ['pending', 'paid', 'failed', 'refunded']);

/** Cancellation is only offered while an order is still 'placed' — the
 *  finer-grained fulfillment progress (packed/shipped/delivered) lives per
 *  line item on order_items instead, since one order can span multiple
 *  sellers who each fulfill independently (see orderItemStatusEnum below). */
export const orderStatusEnum = pgEnum('order_status', ['placed', 'cancelled']);

/** Per-item fulfillment progress — deliberately separate from orders.status
 *  because a single order can span several sellers (see order_items.seller_id),
 *  each fulfilling on her own timeline. Forward-only among
 *  placed/packed/shipped/delivered: the API never lets a seller or admin
 *  move an item backward once recorded, same "never fabricate progress it
 *  can't back up" rule as enquiry_status. 'cancelled' (added 2026-09-03,
 *  Admin Panel cancel-items tooling) is a side-branch, not part of that
 *  linear sequence — reachable from any of the other four EXCEPT
 *  'delivered' (a return after delivery is a refund without un-delivering
 *  it, via the plain refund action, not this), never advanced further once
 *  reached. See lib/order-item-status.ts's own comment for the full type
 *  story (ORDER_ITEM_STAGES stays the 4-value linear list; OrderItemStatus
 *  is that plus 'cancelled'). */
export const orderItemStatusEnum = pgEnum('order_item_status', [
  'placed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  // The COD return flow (2026-09-06) — a delivered COD item had no way
  // to ever be unwound before this (the plain refund tool explicitly
  // refuses COD, and 'cancelled' is unreachable from 'delivered' by
  // design, see above). Reachable ONLY from 'delivered', another
  // terminal side-branch like 'cancelled' — set by the seller herself
  // raising a dispute on her own order (lib/disputes.ts's
  // openDisputeAsSeller), never advanced further once reached.
  'returned',
]);

/**
 * Admin-manageable support-ticket categories (2026-09-06) — same "plain
 * columns, archive via active, never delete" pattern as payoutCategories.
 */
export const supportTicketCategories = pgTable('support_ticket_categories', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketStatusEnum = pgEnum('support_ticket_status', ['open', 'investigating', 'resolved']);

/**
 * A complaint or question with no order to attach it to — a seller
 * behaving badly, a broken feature, a general site issue (2026-09-06,
 * marketplace-completeness scan). Deliberately its own table, not
 * `disputes` with a nullable orderId — that would blur what disputes was
 * built to mean ("a dispute against an order"); this is what finally
 * makes /contact real instead of a bare display email. Anyone can submit
 * one (`createdByUserId` null for a guest, same "the order/ticket itself
 * already carries her contact info" reasoning as buyerAddresses/
 * disputes above) — no account required, matching how /contact never
 * required one either.
 */
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => supportTicketCategories.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 150 }).notNull(),
  email: varchar('email', { length: 200 }),
  phone: varchar('phone', { length: 20 }),
  message: varchar('message', { length: 2000 }).notNull(),
  status: supportTicketStatusEnum('status').notNull().default('open'),
  assignedToStaffId: integer('assigned_to_staff_id').references(() => users.id, { onDelete: 'set null' }),
  staffNote: varchar('staff_note', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

/**
 * Privacy / Terms / Shipping & Returns — real, admin-editable content
 * (2026-09-06, marketplace-completeness scan) instead of hardcoded pages
 * that need a deploy to change. `content` is deliberately plain text,
 * paragraphs separated by a blank line — no rich text/HTML input from an
 * admin textarea, since rendering that safely would need real
 * sanitization this doesn't otherwise have infrastructure for; plain
 * text covers everything the current placeholder pages already do.
 * Seeded with today's placeholder copy so nothing regresses to blank.
 */
export const legalPages = pgTable('legal_pages', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 150 }).notNull(),
  content: text('content').notNull(),
  updatedByStaffId: integer('updated_by_staff_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A logged-in buyer's saved/favorited listings (2026-09-06, marketplace-
 * completeness scan — didn't exist at all before this). Guest browsing is
 * unaffected; saving requires an account, same reasoning as
 * buyerAddresses below.
 */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('wishlist_items_user_listing_unique').on(table.userId, table.listingId)],
);

/**
 * A logged-in buyer's saved addresses (2026-09-06) — the marketplace-
 * completeness scan found checkout re-collects a full address fresh
 * every single time, nothing ever saved. Deliberately its own table, not
 * fields bolted onto `users` — a buyer can have several. Guest checkout
 * is unaffected; this only ever applies to an authenticated buyer.
 */
export const buyerAddresses = pgTable('buyer_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 50 }).notNull(),
  recipientName: varchar('recipient_name', { length: 150 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
  addressLine1: varchar('address_line1', { length: 200 }).notNull(),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  pincode: varchar('pincode', { length: 10 }).notNull(),
  // Exactly one true per user, enforced in application code (the insert/
  // update routes), not a DB constraint — a partial unique index would
  // need a raw SQL migration this schema-first setup doesn't otherwise
  // use elsewhere, and the enforcement here is simple enough (unset the
  // old default in the same batch as setting the new one) not to need it.
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Orders/order_items are the SRS §8 "data model layer not yet built" for
 * Buy Now/Add to Cart + Checkout — named there specifically so it wouldn't
 * be discovered mid-build. Records genuine buyer intent and a real shipping
 * address regardless of paymentMethod. `online` (Fulfillment &
 * Subscriptions redesign, Phase 5b) is real Razorpay payment against the
 * full cart total, any number of sellers included — see
 * app/api/orders/route.ts's own comment for why this no longer needs a
 * single-seller cart (lifted 2026-09-03 once Phase 5c's payout design
 * stopped depending on Razorpay Route, which never got enabled anyway).
 */
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  // The public-facing identifier (URLs, footer tracking, "My Profile" order
  // history) — never the raw sequential id, so a buyer's order number
  // doesn't reveal total order volume. See lib/order-number.ts.
  orderNumber: varchar('order_number', { length: 20 }).notNull().unique(),
  // Set only if she was signed in at checkout — guest checkout is still
  // fully supported (FR-5b), so this stays nullable rather than required.
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  // No buyer accounts are required for checkout — the SRS explicitly allows
  // guest checkout here (FR-5b) even though "Contact Seller" stays
  // registered-only — so this is collected directly, from whoever's
  // signed in or not, rather than assumed from a session.
  buyerName: varchar('buyer_name', { length: 150 }).notNull(),
  buyerPhone: varchar('buyer_phone', { length: 20 }).notNull(),
  buyerEmail: varchar('buyer_email', { length: 200 }),
  // For paymentMethod: 'pickup_and_pay' (Tier 4, item 22, 2026-09-06),
  // these deliberately hold the SELLER's own resolved pickup location
  // (via lib/pickup.ts's resolvePickupLocation), not a buyer delivery
  // destination — there is no delivery for this method, and keeping
  // these columns required rather than making the whole `orders` table's
  // address non-null (a much wider, riskier change touching every other
  // order type) was the deliberate trade-off. Same "snapshot at
  // creation time" reasoning shipments.addressLine1 already carries.
  addressLine1: varchar('address_line1', { length: 200 }).notNull(),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  pincode: varchar('pincode', { length: 10 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('cod'),
  // Fulfillment & Subscriptions redesign, Phase 5b — null for COD (never in
  // a payment pipeline to begin with, so null is the honest value, not
  // 'pending' as if something's in progress); 'pending' the instant an
  // online order is created, then 'paid'/'failed' once Razorpay resolves it
  // (see lib/order-payment.ts). Sellers/Admin never see an order here until
  // this is 'paid' — see GET /api/sellers/orders and /api/admin/orders'
  // own comments — but the buyer herself always can, on her own order page,
  // since she needs to know if her payment is still pending or failed.
  paymentStatus: orderPaymentStatusEnum('payment_status'),
  // Set once a Razorpay order exists for this order (online payment only) —
  // lets the buyer's own order page reopen the same checkout to retry a
  // pending/failed payment instead of starting an entirely new order.
  razorpayOrderId: varchar('razorpay_order_id', { length: 100 }).unique(),
  // Set only once payment actually clears — unique (nulls excepted, same
  // convention as wallet_transactions.gatewayPaymentId) so the verify call
  // and the webhook can never both credit the same payment to two different
  // orders, and so confirmOrderPayment's idempotency check has something
  // real to key off.
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }).unique(),
  status: orderStatusEnum('status').notNull().default('placed'),
  // Only ever set alongside status: 'cancelled' — distinguishes a buyer
  // cancelling herself from Admin stepping in after a seller missed her
  // fulfillment window (planning doc Decision 6), so reporting can always
  // tell the two apart.
  cancelledBy: cancelledByEnum('cancelled_by'),
  cancellationReason: varchar('cancellation_reason', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'restrict' }),
  // Denormalized from listings.sellerId at order time — this is what makes
  // the multi-seller shipment split the SRS calls out possible: each seller
  // (and admin/customer_support, as an override) advances only her own
  // items' status, independent of every other seller on the same order.
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  status: orderItemStatusEnum('status').notNull().default('placed'),
  // Set whenever status changes — null until the first update past 'placed'.
  statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),
  // Admin's required note explaining why — set only alongside status:
  // 'cancelled' (2026-09-03, Admin Panel cancel-items tooling), same "an
  // unexplained real-money-adjacent event is never acceptable" reasoning
  // as payouts.manualNote and refunds.reason. Kept here even when the same
  // cancellation also produced a real refund row (whose own `reason` is
  // this exact text) — a COD order has no refund row to fall back on for
  // "why," so the audit trail needs to live on the item itself either way.
  cancelledReason: varchar('cancelled_reason', { length: 300 }),
  // Null for an order against a simple listing (today's whole history) —
  // set when it was a specific type of a variant-based listing. onDelete:
  // 'set null' (not 'restrict' or 'cascade') deliberately: a seller
  // deleting a variant later must never fail or silently corrupt a past
  // order. variantName is a snapshot for the same reason unitPrice already
  // is one — a receipt should read the same years later even if the
  // variant is renamed or gone.
  variantId: integer('variant_id').references(() => listingVariants.id, { onDelete: 'set null' }),
  variantName: varchar('variant_name', { length: 100 }),
  // Full payout redesign (Tier 4, item 21, 2026-09-06) — set the moment
  // the weekly settlement batch actually charges commission for this
  // specific item (a payout row for 'online', a wallet deduction for
  // 'cod'). Null means "delivered but still within the buffer" OR
  // "never delivered at all" — both genuinely mean no money has moved
  // for this item yet. This is what makes the COD return flow safe under
  // the new delayed-settlement timing: a return within the buffer window
  // moves status straight to 'returned' before this ever gets set, so it
  // naturally never reaches the settlement query at all (no commission
  // was ever charged, nothing to reverse) — see
  // app/api/admin/disputes/[id]/resolve-with-credit's own check against
  // this same column for the other half of that fix.
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A refund attempt's own lifecycle — separate from orders.paymentStatus
 *  (which only ever reflects the CUMULATIVE effect across every refund row
 *  for that order). Razorpay returns 'processed' immediately for most
 *  instant refunds but can also return a real 'processing'/'failed', so
 *  this isn't collapsed down to a boolean. */
export const refundStatusEnum = pgEnum('refund_status', ['processing', 'processed', 'failed']);

/**
 * One row per refund attempt on an online-paid order — Admin Panel
 * transaction/dispute/refund tooling, 2026-09-03. Always a REAL Razorpay
 * refund (confirmed the `/v1/payments/{id}/refund` endpoint is reachable
 * on this account, unlike Route/Payouts/QR Codes) — money genuinely goes
 * back to the buyer's original payment method; there is deliberately no
 * "record-only" manual refund path, unlike payouts' manual fallback,
 * since a refund's whole point is the buyer actually getting her money
 * back, not just a bookkeeping entry. Supports partial refunds: more than
 * one row can exist per order, and the sum of 'processed' rows is the
 * source of truth for how much has actually been returned — orders.
 * paymentStatus only flips to 'refunded' once that sum reaches the
 * originally paid amount. Deliberately does NOT automatically claw back
 * or adjust any seller payout already sent for this order (user's own
 * call, 2026-09-03) — the admin refund screen just shows a clear warning
 * when one already went out, and recovering it from the seller is a
 * manual, off-platform matter for Admin to handle herself.
 */
export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  razorpayRefundId: varchar('razorpay_refund_id', { length: 100 }).unique(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  // Required, same "an unexplained real-money event is never acceptable"
  // rule as wallet_transactions' admin_adjustment rows and payouts'
  // manualNote — this is the only record of WHY money went back.
  reason: varchar('reason', { length: 300 }).notNull(),
  status: refundStatusEnum('status').notNull().default('processing'),
  failureReason: varchar('failure_reason', { length: 300 }),
  initiatedByStaffId: integer('initiated_by_staff_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'investigating', 'resolved']);

/**
 * A tracked dispute against an order — Admin Panel transaction/dispute/
 * refund tooling, 2026-09-03, built as a full status workflow per the
 * user's own choice over a plain free-text note. One order can have more
 * than one dispute row over time (a resolved issue re-opening later is a
 * new dispute, not a reopened old one — keeps each row's timeline
 * honest), but the API only ever allows ONE 'open'/'investigating'
 * dispute per order at once — see lib/disputes.ts's openDispute — so
 * duplicate active threads for the same order can't pile up.
 */
export const disputes = pgTable('disputes', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  status: disputeStatusEnum('status').notNull().default('open'),
  // The initial complaint/reason — required, same reasoning as refunds.reason.
  reason: varchar('reason', { length: 500 }).notNull(),
  assignedToStaffId: integer('assigned_to_staff_id').references(() => users.id, { onDelete: 'set null' }),
  // Nullable as of 2026-09-06 — a buyer-raised dispute (see
  // createdByBuyerId below) has no staff creator. Exactly one of
  // createdByStaffId/createdByBuyerId is set; never both, never neither.
  createdByStaffId: integer('created_by_staff_id').references(() => users.id, { onDelete: 'restrict' }),
  // Set only for a dispute she opened herself from her own order page
  // (2026-09-06, marketplace-completeness scan) — null for a guest buyer
  // (no account to attribute it to; the order itself already carries her
  // name/phone/email) and for every staff-created dispute.
  createdByBuyerId: integer('created_by_buyer_id').references(() => users.id, { onDelete: 'set null' }),
  // Which seller this is actually about — required when the order has
  // more than one (2026-09-06 precision fix). Null on a single-seller
  // order/dispute is fine; the seller-visibility query falls back to "any
  // order she's part of" in that case, same as it always has.
  sellerId: integer('seller_id').references(() => users.id, { onDelete: 'set null' }),
  // The COD return flow's own creator (2026-09-06) — she raised this on
  // her own order (see lib/disputes.ts's openDisputeAsSeller), distinct
  // from createdByBuyerId/createdByStaffId above. Exactly one of the
  // three creator columns is ever set.
  createdBySellerId: integer('created_by_seller_id').references(() => users.id, { onDelete: 'set null' }),
  // Full payout redesign (Tier 4, item 21, 2026-09-06) — set only by the
  // COD return flow (app/api/sellers/order-items/[itemId]/return), which
  // is the one dispute-creation path that always knows exactly which
  // item it's about. Lets resolveDisputeWithCredit check that specific
  // item's orderItems.settledAt before crediting anything back: under
  // the new delayed (7-day-buffer) settlement timing, a return can now
  // happen BEFORE commission was ever actually charged, and crediting a
  // "reversal" for a commission that was never taken would be a real
  // double-credit bug, not a rounding curiosity. Null for every other
  // dispute-creation path (staff, buyer) — none of them are ever
  // resolved with a credit tied to one specific item's settlement state.
  orderItemId: integer('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
  // How much was actually credited back to her wallet on resolution —
  // null until resolved-with-credit (lib/disputes.ts's
  // resolveDisputeWithCredit). The real traceability record: which
  // wallet_transactions row this produced is found via that row's own
  // orderId + type: 'commission_reversal', but this column is what lets
  // the dispute itself show "how much," not just "resolved."
  amount: numeric('amount', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

/**
 * The timeline for one dispute — every status change and every staff note
 * lands here as its own row, so "who did what, when" is never lost the way
 * a single mutable `resolutionNote` field would lose it. `note` is
 * optional on its own (a pure status change, e.g. assigning someone, can
 * carry no comment) but at least one of note/statusChangedTo is always
 * set — enforced in lib/disputes.ts, not the schema, same pattern as
 * other "at least one of X" invariants in this codebase.
 */
export const disputeComments = pgTable('dispute_comments', {
  id: serial('id').primaryKey(),
  disputeId: integer('dispute_id')
    .notNull()
    .references(() => disputes.id, { onDelete: 'cascade' }),
  // Nullable as of 2026-09-06 — her own initial reason (or a guest's, with
  // no user id at all) isn't authored by staff. Exactly one of
  // staffId/buyerId set on a given row, or neither for a true guest.
  staffId: integer('staff_id').references(() => users.id, { onDelete: 'restrict' }),
  buyerId: integer('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  note: varchar('note', { length: 1000 }),
  statusChangedTo: disputeStatusEnum('status_changed_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Reviews & Ratings (Tier 3, item 17 — 2026-09-06). Genuinely absent
 * before this: `components/listing-card.tsx` used to carry a comment
 * stating outright "this marketplace doesn't have reviews ... to back
 * [a star rating] with." One review per purchased item, not per listing
 * or per buyer — `orderItemId` unique enforces that at the DB level, and
 * it's what ties a review back to proof of a real, delivered purchase
 * (see the eligibility check in POST /api/account/reviews: item.status
 * must be 'delivered'). Requires a real buyer account — there's no
 * guest-review path, unlike disputes/pickup-requests above, since a
 * review's whole value is being attributable to someone. `sellerId` is
 * denormalized from the listing at write time (same reasoning as
 * order_items.sellerId — lets admin/seller tooling query "my reviews"
 * without joining through listings every time). `buyerName` is a
 * snapshot too, taken from her account name at submission time, so
 * display never needs a join back to `users` and stays stable even if
 * she later renames her account.
 */
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  orderItemId: integer('order_item_id')
    .notNull()
    .unique()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  buyerId: integer('buyer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  buyerName: varchar('buyer_name', { length: 150 }).notNull(),
  // 1-5, enforced at the app layer (lib/validation.ts) — same convention
  // as every other numeric constraint in this schema (wallet/payout
  // amounts are app-validated too, no DB check constraints anywhere).
  rating: integer('rating').notNull(),
  comment: varchar('comment', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Null until she edits it — she can revise her own review later (PATCH
  // /api/account/reviews/[id]), same "audit trail, don't just silently
  // overwrite" instinct as everywhere else, just via a plain nullable
  // timestamp rather than a full history table — a review edit isn't
  // money-adjacent the way a wallet/payout change is.
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

/**
 * Pickup & Pay request (SRS §3.8a-adjacent contingency) — ORIGINALLY a
 * disconnected booking-style ask (buyer picks a date + place, no real
 * order behind it at all). **Its buyer-booking role is retired as of
 * the full payout redesign's Pickup & Pay follow-up (Tier 4, item 22,
 * 2026-09-06)** — a new booking now creates a real `orders`/`orderItems`/
 * `shipments` (method: 'pickup_and_pay') row instead, via
 * POST /api/listings/[idOrSlug]/pickup-order, tracked through the same
 * /order/[orderNumber] page every other order type uses. This table and
 * its buyer-facing routes (app/api/pickup-requests,
 * app/(minimal)/pickup/[trackingNumber]) are left in place, unused by
 * any live UI, only so any pre-existing booking's tracking link keeps
 * resolving — never write a new row here for a new booking.
 *
 * What's NOT retired: this table's OTHER, unrelated role — Customer
 * Support logging whether a seller's own parcel physically arrived at a
 * WeBohra jamaat OFFICE (FR-47, `status`/`handledByStaffId` below,
 * `/admin/pickups` + `/seller/pickups`) has nothing to do with a buyer
 * collecting an order and continues exactly as before.
 */
export const pickupRequests = pgTable('pickup_requests', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  buyerName: varchar('buyer_name', { length: 150 }).notNull(),
  buyerPhone: varchar('buyer_phone', { length: 20 }).notNull(),
  requestedDate: varchar('requested_date', { length: 10 }).notNull(), // YYYY-MM-DD
  // HH:MM, 24h — added alongside requestedDate rather than replacing it, so
  // existing rows (date-only) stay valid; nullable until Phase 3's slot
  // picker starts setting it. Same varchar convention as requestedDate.
  requestedTime: varchar('requested_time', { length: 5 }),
  requestedPlace: varchar('requested_place', { length: 200 }).notNull(),
  // Public tracking identifier, same convention as orders.orderNumber /
  // enquiries.requestNumber — didn't exist before (Pickup & Pay was the one
  // gap in that pattern). Nullable + unique: NULLs don't collide under a
  // unique constraint, so existing rows are untouched until Phase 3 backfills
  // real values for new requests going forward.
  trackingNumber: varchar('tracking_number', { length: 20 }).unique(),
  // Set the moment the seller marks this request "ready for pickup" — the
  // trigger that reveals her address to this specific buyer when
  // listings.showAddressOnPdp is off (planning doc Decision 5). Null means
  // not ready yet, or the listing shows its address unconditionally instead.
  readyForPickupAt: timestamp('ready_for_pickup_at', { withTimezone: true }),
  // FR-47: Customer Support's own receiving/logging workflow, layered on
  // top of the buyer-facing request above — 'pending' until a staff member
  // logs the parcel as physically received at the jamaat, or flags an
  // 'issue' (the seller failed to deliver it in time).
  status: pickupRequestStatusEnum('status').notNull().default('pending'),
  notes: varchar('notes', { length: 300 }),
  handledByStaffId: integer('handled_by_staff_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Logs a "Buy on WhatsApp" click (FR-5's real mechanism: a direct, buyer-
 * initiated deep link to the seller's own number — see root CLAUDE.md's
 * Contact model). Tracking-only; the actual conversation happens entirely
 * in WhatsApp, outside this platform's visibility, same as every other
 * WhatsApp-mediated contact in this system.
 */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  buyerName: varchar('buyer_name', { length: 150 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * POC (2026-09-05) — WhatsApp Cloud API integration, NOT the wa.me deep
 * link whatsappContacts (above) logs. That one is tracking-only, zero
 * visibility past the click. This table is the real thing: a message sent
 * through Meta's WhatsApp Business Platform, whose delivery/read status
 * comes back from Meta's own webhook (see app/api/webhooks/whatsapp), not
 * self-reported. This is what makes a "genuine WhatsApp connect" billable
 * with real evidence behind it, instead of just a click.
 *
 * Structural note this table doesn't solve: Meta requires a phone number
 * be used exclusively for the Business API, so it can't send to/from a
 * seller's own personal WhatsApp number. This POC sends through ONE
 * WE-Bohra-owned number to a buyer/seller acting as the counterpart — a
 * real deployment needs the masked-relay redesign described in
 * [[webohra-fulfillment-subscriptions-phases]], not just this table.
 */
export const whatsappMessageStatusEnum = pgEnum('whatsapp_message_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
  sellerId: integer('seller_id').references(() => users.id, { onDelete: 'set null' }),
  // WhatsApp Connect billing (Tier 3, item 19, 2026-09-06) — which buyer's
  // click triggered this send. Null for the pre-existing POC rows (which
  // predate this column and were never tied to a real buyer or listing at
  // all — see toPhone's own comment) and stays that way; a real Connect
  // send always sets it, since dedupe/rate-limiting are keyed on it.
  buyerId: integer('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  // toPhone here is always the SELLER's number — this row is WE Bohra's
  // business number notifying HER that a buyer connected, which is what
  // makes the whole thing trackable at all (see this table's own comment
  // above: a message to a personal, non-Business-API WhatsApp number
  // can't be tracked). The buyer's own wa.me redirect to the seller's
  // personal number happens entirely outside this table, exactly as it
  // always did — unchanged, untracked, and free.
  toPhone: varchar('to_phone', { length: 20 }).notNull(),
  // Meta's own message id ("wamid...") — the join key every status
  // webhook event arrives keyed by. Nullable only for the brief window
  // between "we tried to send" and "Meta accepted it and gave us an id".
  waMessageId: varchar('wa_message_id', { length: 100 }).unique(),
  status: whatsappMessageStatusEnum('status').notNull().default('queued'),
  // Set only on a 'failed' status — Meta's own error code/message, so a
  // failure is debuggable instead of a silent dead row.
  failureReason: varchar('failure_reason', { length: 300 }),
  // The ₹20 Connect fee is charged exactly once, only once Meta's webhook
  // confirms this specific message reached delivered/read (or a genuine
  // reply) — never on send, never twice. This flag is the idempotency
  // gate itself (see lib/whatsapp-connect.ts's billConnectMessage): a
  // conditional `WHERE billed = false` update claims the right to bill
  // atomically, so a delivered event followed by a read event for the
  // same message can never double-charge.
  billed: boolean('billed').notNull().default(false),
  billedAt: timestamp('billed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Homepage hero slider — explicitly Admin-managed, not seller-managed (FR-12
 * style config, no code deploy needed to add/reorder a slide). No media
 * pipeline (R2) exists yet, so a slide is a styled color block + copy + a
 * link, not an uploaded photo — swap in a real imageUrl column once R2 is
 * wired without changing the shape callers see.
 */
export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  heading: varchar('heading', { length: 150 }).notNull(),
  subheading: varchar('subheading', { length: 250 }),
  ctaLabel: varchar('cta_label', { length: 50 }),
  ctaHref: varchar('cta_href', { length: 200 }),
  colorHex: varchar('color_hex', { length: 7 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Fulfillment & Subscriptions redesign — new tables
// ---------------------------------------------------------------------------

/**
 * Eligible self-managed-shipping cities for one seller. Modeled as its own
 * table (not a single column on seller_profiles) specifically so a future
 * "let her ship to more than one city" doesn't need a migration — v1's
 * onboarding UI just only ever inserts one row per seller. Today's launch
 * scope is still same-city-only (planning doc Decision 2).
 */
export const sellerShipCities = pgTable(
  'seller_ship_cities',
  {
    id: serial('id').primaryKey(),
    sellerId: integer('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    city: varchar('city', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('seller_ship_cities_seller_city_unique').on(table.sellerId, table.city)],
);

/**
 * One row per (order, seller, method) — deliberately not one row per
 * (order, seller). A buyer can have a self-managed item and a Delhivery
 * item from the same seller in one order; forcing one shipping method per
 * seller per order would either invent a blended charge that matches
 * neither courier's real pricing, or silently drop one method. Charge is
 * per shipment, not per item within it (planning doc's Risk 1 resolution —
 * mirrors how Amazon bills FBA/FBM items from one seller separately).
 * expectedAtOfficeBy/arrivedAtOfficeAt back the admin-escalation flow when
 * a seller's parcel needs to reach a WeBohra office before Delhivery picks
 * it up or a Pickup & Pay buyer collects it — the FR-47 concept that used
 * to live (awkwardly) on pickup_requests' own status enum lives here now.
 */
export const shipments = pgTable('shipments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  method: shipmentMethodEnum('method').notNull(),
  // Null for pickup_and_pay (no shipping charge at all — buyer pays the
  // seller directly in person).
  charge: numeric('charge', { precision: 10, scale: 2 }),
  // Resolved address snapshot for this shipment — the seller's own address
  // or the WeBohra office's, captured at shipment-creation time so it
  // reads the same later even if her address or the office mapping changes.
  addressLine1: varchar('address_line1', { length: 200 }),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),
  expectedAtOfficeBy: timestamp('expected_at_office_by', { withTimezone: true }),
  arrivedAtOfficeAt: timestamp('arrived_at_office_at', { withTimezone: true }),
  // Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — only ever
  // set for method: 'pickup_and_pay'. The slot she picked at checkout
  // (same varchar convention as the retired pickupRequests.requestedDate/
  // requestedTime), and the moment the seller actually confirms the
  // buyer collected it — the second-stage 4%/6% commission fires exactly
  // when this gets set (see app/api/sellers/orders/[orderNumber]'s own
  // comment), never through the weekly settlement batch.
  pickupScheduledDate: varchar('pickup_scheduled_date', { length: 10 }),
  pickupScheduledTime: varchar('pickup_scheduled_time', { length: 5 }),
  pickupCompletedAt: timestamp('pickup_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per pricing tier, per seller_type — the whole point being that
 * every gate here is a plain column admin can edit, not logic keyed off a
 * tier name in code (planning doc's "admin manageability" answer). Archived
 * via `active`, never deleted, same reasoning as subcategory_fields — a
 * seller already on a retired plan must keep working exactly as before.
 */
export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: serial('id').primaryKey(),
    sellerType: sellerTypeEnum('seller_type').notNull(),
    // Stable key ("basic", "silver", "gold", "diamond", ...) — display name
    // can change without breaking anything keyed off this.
    tierKey: varchar('tier_key', { length: 30 }).notNull(),
    name: varchar('name', { length: 60 }).notNull(),
    monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }).notNull(),
    // Null = unlimited.
    maxActiveListings: integer('max_active_listings'),
    allowsPickupAndPay: boolean('allows_pickup_and_pay').notNull().default(false),
    // Only meaningful when allowsPickupAndPay is true — whether she can
    // also choose the WeBohra office as the pickup address, not just her own.
    pickupOfficeOption: boolean('pickup_office_option').notNull().default(false),
    allowsDelhivery: boolean('allows_delhivery').notNull().default(false),
    prioritySupport: boolean('priority_support').notNull().default(false),
    remindersEnabled: boolean('reminders_enabled').notNull().default(false),
    // Service plans only — null for product plans.
    contactMode: contactModeEnum('contact_mode'),
    // How many free bonus listings this plan grants in the OTHER
    // seller_type, at that type's Basic-tier feature level (planning doc
    // item 11) — e.g. a product seller trying out services for free.
    bonusOtherCategoryListings: integer('bonus_other_category_listings').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('subscription_plans_seller_type_tier_key_unique').on(table.sellerType, table.tierKey)],
);

/**
 * One active row per (seller, seller_type) — not per seller. A seller who
 * lists both products and services can hold a product subscription and a
 * service subscription at the same time (planning doc item 11); this is
 * what makes that possible without a second table. Shell for now — no live
 * billing drives `status`/`renewsAt` yet, matches the rest of this build.
 */
export const sellerSubscriptions = pgTable(
  'seller_subscriptions',
  {
    id: serial('id').primaryKey(),
    sellerId: integer('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sellerType: sellerTypeEnum('seller_type').notNull(),
    billingMode: billingModeEnum('billing_mode').notNull(),
    // Null when billingMode is 'recharge' — a recharge seller has no plan
    // row, her feature set instead defaults from
    // subscription_settings.rechargeDefaultPlanId.
    planId: integer('plan_id').references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    renewsAt: timestamp('renews_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('seller_subscriptions_seller_type_unique').on(table.sellerId, table.sellerType)],
);

/**
 * Real audit trail for subscription-plan billing (item 27, 2026-09-07) —
 * one row per successful Razorpay payment for a plan. Mirrors
 * wallet_transactions' role: sellerSubscriptions.renewsAt is the LIVE
 * state a seller's current access is checked against, this table is the
 * permanent record of every real payment that state was built from —
 * "each and every information should be easily traceable via admin and
 * seller," same hard requirement that shaped payout categories and wallet
 * traceability earlier. `gatewayPaymentId` unique — the same idempotency
 * guarantee walletTransactions' own gatewayPaymentId column provides,
 * needed because both the fast client-side verify call AND the webhook
 * fallback can each try to activate the same successful payment.
 */
export const subscriptionPayments = pgTable('subscription_payments', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sellerType: sellerTypeEnum('seller_type').notNull(),
  planId: integer('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  gatewayPaymentId: varchar('gateway_payment_id', { length: 100 }).notNull().unique(),
  // The billing period this one payment covers — always exactly 30 days
  // from the moment of payment (manual pay-again model, no proration, no
  // auto-renewal mandate — user's own explicit call, 2026-09-07: simpler
  // and safer to ship first). Switching plans mid-cycle forfeits any
  // remaining days on the old plan rather than prorating — same
  // simplicity trade-off, flagged here rather than silently assumed.
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Recharge-mode balance — one row per seller. Real money in, via a real
 *  payment gateway (sandbox/test mode for now); see wallet_transactions for
 *  every movement in or out. */
export const sellerWallets = pgTable('seller_wallets', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The full audit trail behind seller_wallets.balance — nothing changes a
 * balance without a row here. Automatic top-ups (gatewayPaymentId set,
 * initiatedByStaffId null) are the normal path; admin_adjustment rows
 * (initiatedByStaffId set, reason required at the app level) are the only
 * other way a balance moves, specifically so an adjustment can never be
 * silent or unaccountable (the requester's explicit "no one is scamming"
 * requirement).
 */
export const walletTransactions = pgTable('wallet_transactions', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: walletTransactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  // Links a topup row back to the real gateway transaction it came from.
  // Unique (nulls excepted, same convention as pickup_requests.trackingNumber)
  // — Phase 5's client-side verify call and the Razorpay webhook can both
  // try to credit the same payment; this is what makes crediting it twice
  // impossible at the database level, not just by convention in the code.
  gatewayPaymentId: varchar('gateway_payment_id', { length: 100 }).unique(),
  // Set only for admin_adjustment rows — who authorized it. Null means the
  // system did it automatically (a real gateway top-up or an order's
  // commission deduction).
  initiatedByStaffId: integer('initiated_by_staff_id').references(() => users.id, { onDelete: 'set null' }),
  reason: varchar('reason', { length: 300 }),
  balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Single-row platform-wide config for the numbers that aren't per-plan —
 *  the app is expected to only ever have one row here. */
export const subscriptionSettings = pgTable('subscription_settings', {
  id: serial('id').primaryKey(),
  // Below this wallet balance, a recharge seller's listings show as Out of
  // Stock (visible, not purchasable) rather than being delisted.
  walletMinThreshold: numeric('wallet_min_threshold', { precision: 10, scale: 2 }).notNull().default('100.00'),
  // The floor on a single top-up transaction — was hardcoded at ₹100 in
  // walletTopupOrderSchema (lib/validation.ts) until 2026-09-06; made
  // admin-configurable here instead, same principle as every other
  // "don't hardcode it" fix this session (payout categories, dispute
  // categories, legal pages). Read dynamically by the topup-order route,
  // not baked into the Zod schema at build time.
  walletMinTopup: numeric('wallet_min_topup', { precision: 10, scale: 2 }).notNull().default('500.00'),
  // Which plan's feature set a recharge-mode seller gets by default —
  // admin-configurable rather than hardcoded to Basic (planning doc item 8).
  rechargeDefaultPlanId: integer('recharge_default_plan_id').references(() => subscriptionPlans.id, {
    onDelete: 'set null',
  }),
  // Cut WeBohra takes from a bonus-listing sale (planning doc item 11) —
  // e.g. 10.00 means 10%.
  bonusListingCommissionPercent: numeric('bonus_listing_commission_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('10.00'),
  // Fulfillment & Subscriptions redesign, Phase 5c — WeBohra's cut of a
  // normal (non-bonus) online order, taken out of a seller's payout (see
  // payouts.commissionAmount). Applies only to the product/service sale
  // portion of her share, never to shipping — a self-managed shipping
  // charge is her own declared cost of actually shipping the order, not
  // revenue WeBohra takes a percentage of.
  orderCommissionPercent: numeric('order_commission_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('10.00'),
  // The stakeholder-approval switch for real RazorpayX transfers —
  // deliberately separate from (and independent of) whether
  // RAZORPAYX_ACCOUNT_NUMBER is technically configured. That env var only
  // ever says the plumbing is ready; it must never be what turns real
  // money-movement on by itself. Off by default. Only a super_admin can
  // flip this (see PATCH /api/admin/subscription-settings' own comment) —
  // deliberately a narrower gate than the rest of this table, which any
  // admin can edit. lib/payouts.ts's sendPayout refuses to even attempt a
  // RazorpayX call while this is false, regardless of anything else being
  // ready.
  razorpayxPayoutsEnabled: boolean('razorpayx_payouts_enabled').notNull().default(false),
  // Toggle infrastructure only (2026-09-06) — the actual coupon/discount
  // mechanism (codes, rules, checkout wiring) is a separate, later build;
  // this just exists so that build ships behind a real off-by-default
  // switch instead of going live the moment its code merges. Same
  // "deliberately off until a decision, not the presence of code" shape
  // as razorpayxPayoutsEnabled above.
  couponsEnabled: boolean('coupons_enabled').notNull().default(false),
  // WhatsApp Connect & Lead — Meta Direct (Tier 3, item 19, 2026-09-06).
  // Verified against Meta's own India rate card (₹0.115/utility message,
  // no platform fee) — see [[webohra-fulfillment-subscriptions-phases]]
  // for the full margin writeup. Admin-configurable rather than
  // hardcoded, same principle as every other real-money number on this
  // row.
  whatsappConnectFeeRupees: numeric('whatsapp_connect_fee_rupees', { precision: 10, scale: 2 })
    .notNull()
    .default('20.00'),
  whatsappLeadFeeRupees: numeric('whatsapp_lead_fee_rupees', { precision: 10, scale: 2 })
    .notNull()
    .default('35.00'),
  // The rate-limit's own cap — the "must-do" safety guard the user called
  // out explicitly: protects against wallet-drain AND against real Meta
  // message-fee drain from a spam-clicked Connect. No specific number was
  // ever decided beyond "rate-limit it" — 10/day is a reasonable starting
  // point for a real buyer's genuine browsing session, tunable here
  // without a deploy if it turns out wrong in practice.
  whatsappConnectDailyLimitPerBuyer: integer('whatsapp_connect_daily_limit_per_buyer').notNull().default(10),
  // Full payout redesign (Tier 4, item 21, 2026-09-06) — the settlement
  // math's three components, admin-configurable rather than hardcoded,
  // same principle as every other real-money number on this row.
  // Razorpay's real effective rate (2% + 18% GST) as of this writing;
  // Delhivery's ~₹80/shipment is a round estimate (no live rate lookup
  // exists yet, same limitation shipments.charge already has for this
  // method). Both are a seller's own real cost of the sale, never
  // absorbed by WE Bohra — see lib/settlement.ts for where they're used.
  razorpayFeePercent: numeric('razorpay_fee_percent', { precision: 5, scale: 2 }).notNull().default('2.36'),
  delhiveryCostPerShipment: numeric('delhivery_cost_per_shipment', { precision: 10, scale: 2 })
    .notNull()
    .default('80.00'),
  // How long after delivery a settlement waits before charging commission
  // — the 7-day buffer the finalized design calls for (matches Flipkart's
  // actual pattern), tunable here without a deploy.
  settlementBufferDays: integer('settlement_buffer_days').notNull().default(7),
  // Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — the FIRST
  // of the two stages, charged at checkout confirmation (non-refundable,
  // framed as a lead-generation fee). Deliberately NOT a second
  // independent rate: the design's own rule is "every sale is 10%
  // total, split differently in time, never a special rate" — so the
  // second stage is always `orderCommissionPercent - this value`,
  // derived at settlement time (see lib/settlement.ts's
  // completePickupAndPay), never its own separately-configurable
  // number that could drift out of summing to the real total.
  pickupAndPayCheckoutFeePercent: numeric('pickup_and_pay_checkout_fee_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('6.00'),
  // Global kill switch for the "WeBohra office" Pickup & Pay option
  // (item 26, 2026-09-07) — sits ABOVE the existing per-plan
  // (subscriptionPlans.pickupOfficeOption) and per-office
  // (webohraOffices.active) toggles, not a replacement for either.
  // Turning this off makes office pickup unavailable everywhere in one
  // move, without touching every individual plan or office — the gap
  // the user flagged: deactivating N offices one at a time doesn't
  // scale as a way to pause the whole feature. On: falls through to the
  // existing per-plan + per-office checks exactly as before. See
  // app/api/sellers/pickup-eligibility/route.ts.
  pickupOfficeFeatureEnabled: boolean('pickup_office_feature_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per seller, at most — where her online-order earnings actually
 * go, and how Admin pays her (see payoutMethodEnum's own comment for the
 * 2026-09-03 redesign away from RazorpayX Payouts as the mover of money).
 * Both methods share the same field group — razorpayContactId/
 * razorpayFundAccountId — her raw VPA/account number/IFSC is never stored
 * here at all (confirmed 2026-09-03 that Razorpay Fund Accounts support
 * account_type: 'vpa' just as well as 'bank_account' on this merchant).
 * The moment she submits either one, it goes straight to Razorpay (a real
 * contact + fund_account) and only these opaque ids come back — same "the
 * specialized party owns the sensitive data, we only store a pointer"
 * pattern as R2 owning image bytes. Fetched live from Razorpay only at the
 * moment Admin actually needs to see it
 * (lib/razorpay-payouts.ts's getUpiFundAccountDetails /
 * getBankFundAccountDetails) — nothing sensitive sits in our database
 * even briefly. `displayLabel` is a masked summary ("HDFC Bank •••• 1000"
 * / "UPI ID on file") for HER OWN confirmation screen — never what Admin
 * uses to actually pay her.
 */
export const sellerPayoutAccounts = pgTable('seller_payout_accounts', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  method: payoutMethodEnum('method').notNull(),
  razorpayContactId: varchar('razorpay_contact_id', { length: 100 }),
  razorpayFundAccountId: varchar('razorpay_fund_account_id', { length: 100 }).unique(),
  displayLabel: varchar('display_label', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per (order, seller) — her share of settled online-order
 * earnings, and the record of actually paying it out to her. Originally
 * created the instant an order's paymentStatus became 'paid'
 * (Fulfillment & Subscriptions redesign, Phase 5c); the full payout
 * redesign (Tier 4, item 21, 2026-09-06) moved creation to
 * lib/settlement.ts's runWeeklySettlement instead — delivery + a
 * buffer, never payment alone. Not strictly one row per whole order
 * anymore either: settlement runs per order ITEM, so a multi-item order
 * can produce more than one payout row for the same (order, seller) pair
 * across separate weekly runs, as each item individually clears the
 * buffer. `grossAmount`/`commissionAmount`/`netAmount` are computed and
 * frozen at settlement time, same snapshot-at-write-time discipline as
 * order_items.unitPrice — a later change to the commission rate never
 * rewrites a payout that's already been recorded. Actually sending the
 * money (the real RazorpayX payout call) is a separate, explicit step —
 * see status.
 */

/**
 * Admin-manageable payout categories (2026-09-06) — added so a payout
 * outside the normal weekly settlement flow (e.g. releasing a held
 * amount manually after a dispute's 7-day window closes) is tagged and
 * traceable/reportable, not indistinguishable from a routine one. Same
 * "plain columns, archive via active, never delete" pattern as
 * subscriptionPlans/webohraOffices — `key` is the stable machine value
 * code reads (e.g. checking for 'regular_settlement'), `name` is what
 * admin actually sees and can rename freely.
 */
export const payoutCategories = pgTable('payout_categories', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  // Defaults every new payout to 'regular_settlement' at creation
  // (lib/settlement.ts's runWeeklySettlement) — nullable + set null on
  // delete so removing a category from the admin list never blocks or
  // corrupts a historical payout row, it just goes uncategorized.
  categoryId: integer('category_id').references(() => payoutCategories.id, { onDelete: 'set null' }),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  // Her order_items subtotal for this order, plus her own shipment's
  // charge if self-managed — what the buyer's payment actually covered
  // for her specific portion.
  grossAmount: numeric('gross_amount', { precision: 10, scale: 2 }).notNull(),
  // Computed on the product/service subtotal only, never on shipping —
  // see subscription_settings.orderCommissionPercent's own comment.
  commissionAmount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  // grossAmount - commissionAmount — what actually gets paid out to her.
  netAmount: numeric('net_amount', { precision: 10, scale: 2 }).notNull(),
  status: payoutStatusEnum('status').notNull().default('pending'),
  // Set once a real payout attempt has been made (status moves past
  // 'pending') — unique, nulls excepted, same convention as every other
  // gateway-id column in this codebase.
  razorpayPayoutId: varchar('razorpay_payout_id', { length: 100 }).unique(),
  // Set on 'failed' — e.g. "RazorpayX payouts aren't configured yet" or a
  // real bank-side rejection reason, so Admin isn't just staring at a
  // status with no explanation.
  failureReason: varchar('failure_reason', { length: 300 }),
  // Which path actually moved the money — see payoutChannelEnum's own
  // comment. Null until 'processed'.
  channel: payoutChannelEnum('channel'),
  // Who took the action that produced the current status — the RazorpayX
  // sender or the staff member recording a manual payment, either way.
  actionedByStaffId: integer('actioned_by_staff_id').references(() => users.id, { onDelete: 'set null' }),
  // Required when channel is 'manual' — her own record of how she actually
  // paid ("NEFT, ref #123456, 3 Sept"), since there's no gateway response
  // to fall back on for what happened. Same "an unexplained real-money
  // event is never acceptable" reasoning as wallet_transactions.reason on
  // an admin_adjustment row.
  manualNote: varchar('manual_note', { length: 300 }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A service seller's showcase — confirmed separate from a purchasable
 * listing (planning doc item 4), particularly relevant for IT & Services
 * sellers who have a portfolio of past work distinct from what she's
 * actually selling right now. Manageable from /seller/portfolio (any
 * seller can build one) and surfaced on the service detail page (Phase 6
 * of the Fulfillment & Subscriptions redesign) — product listing pages
 * don't show it, matching the phase's "service-page redesign" scope.
 */
export const portfolioItems = pgTable('portfolio_items', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 150 }).notNull(),
  // Phase 6 addition — a one-line note on what the piece actually was
  // ("Built a 3-day wedding mehndi package for a 40-guest event"), since a
  // bare title + link/photo often isn't enough context for a buyer
  // deciding whether to trust this seller with a booking. Optional: a
  // photo-led item can stand on its own without one.
  description: varchar('description', { length: 300 }),
  link: varchar('link', { length: 500 }),
  imageUrl: varchar('image_url', { length: 500 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'sms']);
export const notificationStatusEnum = pgEnum('notification_status', ['sent', 'failed']);

/**
 * Notifications infrastructure (Tier 3, item 20, 2026-09-06) — confirmed
 * zero infrastructure existed anywhere in this repo before this: buyers
 * and sellers only ever found out about anything (a new dispute, a
 * shipping update) by manually reloading a page. Same provider-
 * abstraction pattern as lib/otp/ and lib/whatsapp/ — dev mode logs to
 * the console, MSG91 (the same vendor already used for OTP, and already
 * confirmed to cover WhatsApp too) is the intended real provider, a pure
 * env-var swap away, no code change at any call site (see
 * lib/notifications/index.ts).
 *
 * This table is the audit trail every real send (or attempt) writes to —
 * one row per channel per event, not a single row covering "an email and
 * an SMS went out." `event`+`relatedId` are a generic pointer (an order,
 * a dispute, a shipment update — this fires from several different
 * domains, so a single typed FK column per possible source would mean a
 * pile of always-mostly-null columns instead), not a typed foreign key —
 * same reasoning as several other "could point at more than one kind of
 * thing" columns in this schema. A 'failed' row is never silently
 * dropped — same "an unexplained event is never acceptable" instinct as
 * wallet_transactions.reason.
 */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  channel: notificationChannelEnum('channel').notNull(),
  recipient: varchar('recipient', { length: 200 }).notNull(),
  // Null for SMS — a subject line is an email-only concept.
  subject: varchar('subject', { length: 200 }),
  body: text('body').notNull(),
  event: varchar('event', { length: 50 }).notNull(),
  relatedId: integer('related_id'),
  status: notificationStatusEnum('status').notNull(),
  failureReason: varchar('failure_reason', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
