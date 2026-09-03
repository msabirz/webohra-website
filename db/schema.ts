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
export const pickupAddressSourceEnum = pgEnum('pickup_address_source', [
  'seller',
  'office',
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
]);

/** How a seller receives a payout — a real bank account, or a UPI VPA.
 *  Fulfillment & Subscriptions redesign, Phase 5c. */
export const payoutMethodEnum = pgEnum('payout_method', ['bank_account', 'upi']);

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
  pickupAddressSource: pickupAddressSourceEnum('pickup_address_source'),
  delhiveryPickupSource: pickupAddressSourceEnum('delhivery_pickup_source'),
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

export const paymentMethodEnum = pgEnum('payment_method', ['cod', 'online']);

/** Only ever meaningful for paymentMethod: 'online' — null for every COD
 *  order (see orders.paymentStatus' own comment for why null, not
 *  'pending', is the honest value there). */
export const orderPaymentStatusEnum = pgEnum('order_payment_status', ['pending', 'paid', 'failed']);

/** Cancellation is only offered while an order is still 'placed' — the
 *  finer-grained fulfillment progress (packed/shipped/delivered) lives per
 *  line item on order_items instead, since one order can span multiple
 *  sellers who each fulfill independently (see orderItemStatusEnum below). */
export const orderStatusEnum = pgEnum('order_status', ['placed', 'cancelled']);

/** Per-item fulfillment progress — deliberately separate from orders.status
 *  because a single order can span several sellers (see order_items.seller_id),
 *  each fulfilling on her own timeline. Forward-only: the API never lets a
 *  seller or admin move an item backward once recorded, same "never
 *  fabricate progress it can't back up" rule as enquiry_status. */
export const orderItemStatusEnum = pgEnum('order_item_status', [
  'placed',
  'packed',
  'shipped',
  'delivered',
]);

/**
 * Orders/order_items are the SRS §8 "data model layer not yet built" for
 * Buy Now/Add to Cart + Checkout — named there specifically so it wouldn't
 * be discovered mid-build. Records genuine buyer intent and a real shipping
 * address regardless of paymentMethod. `online` (Fulfillment &
 * Subscriptions redesign, Phase 5b) is real Razorpay payment, but only ever
 * offered when every item in the cart is from the same seller — Phase 5c's
 * Route integration is what will let a multi-seller cart pay online too, by
 * splitting the payout at the gateway; until then a multi-seller cart stays
 * COD-only, same as before this phase.
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
  // Null for an order against a simple listing (today's whole history) —
  // set when it was a specific type of a variant-based listing. onDelete:
  // 'set null' (not 'restrict' or 'cascade') deliberately: a seller
  // deleting a variant later must never fail or silently corrupt a past
  // order. variantName is a snapshot for the same reason unitPrice already
  // is one — a receipt should read the same years later even if the
  // variant is renamed or gone.
  variantId: integer('variant_id').references(() => listingVariants.id, { onDelete: 'set null' }),
  variantName: varchar('variant_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Pickup & Pay request (SRS §3.8a-adjacent contingency, reshaped at the
 * requester's direction into a booking-style ask rather than the QR/mark-
 * paid flow this replaced): buyer picks a date + place, seller follows up
 * off-platform within 24h. No payment happens here at all — this is a
 * request to arrange one, same "never fabricate what didn't happen" rule as
 * everywhere else (enquiryStatusEnum, shippingEstimateText). Deliberately
 * has no buyer account requirement, matching the eligibility rule that a
 * guest can request this too.
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
  walletMinThreshold: numeric('wallet_min_threshold', { precision: 10, scale: 2 }).notNull().default('0'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per seller, at most — where her online-order earnings actually
 * go. Fulfillment & Subscriptions redesign, Phase 5c. Deliberately never
 * stores her real bank account number or UPI VPA: the moment she submits
 * one, it goes straight to RazorpayX (a real contact + fund_account) and
 * only their opaque ids come back here — same "the specialized third
 * party owns the sensitive data, we only ever store a pointer to it"
 * pattern as R2 owning image bytes and this codebase only storing the
 * resulting URL. `displayLabel` is the one human-readable trace of it
 * left in our own database, and it's deliberately masked
 * ("HDFC Bank •••• 1000" / "seller@upi"), built at submission time from
 * what Razorpay's fund_account response hands back.
 */
export const sellerPayoutAccounts = pgTable('seller_payout_accounts', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  method: payoutMethodEnum('method').notNull(),
  razorpayContactId: varchar('razorpay_contact_id', { length: 100 }).notNull(),
  razorpayFundAccountId: varchar('razorpay_fund_account_id', { length: 100 }).notNull().unique(),
  displayLabel: varchar('display_label', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per (order, seller) — her share of one paid online order, and
 * the record of actually paying it out to her. Fulfillment &
 * Subscriptions redesign, Phase 5c. Created the moment an order's
 * paymentStatus becomes 'paid' (see lib/payouts.ts's createPayoutsForOrder)
 * — one row per seller represented in that order, whether it's one seller
 * or several; the split logic here has never depended on Route, which is
 * exactly what makes it work the same regardless of how many sellers are
 * in the order. `grossAmount`/`commissionAmount`/`netAmount` are computed
 * and frozen at that moment, same snapshot-at-write-time discipline as
 * order_items.unitPrice — a later change to the commission rate or her
 * listings never rewrites a payout that's already been recorded.
 * Actually sending the money (the real RazorpayX payout call) is a
 * separate, explicit step — see status.
 */
export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
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
 * actually selling right now. The service pages themselves still need a
 * redesign to surface this; this table just makes the data storable.
 */
export const portfolioItems = pgTable('portfolio_items', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 150 }).notNull(),
  link: varchar('link', { length: 500 }),
  imageUrl: varchar('image_url', { length: 500 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
