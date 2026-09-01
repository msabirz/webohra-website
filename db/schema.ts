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
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per product photo. A listing can have several (seller-uploaded,
 * stored in Cloudflare R2 — see lib/storage/r2.ts); sortOrder controls the
 * gallery order, with the lowest value acting as the cover image everywhere
 * a single thumbnail is shown (listing cards, cart, etc.).
 */
export const listingImages = pgTable('listing_images', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
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
 * be discovered mid-build. Built now as a real, working *shell*: it records
 * genuine buyer intent, a real shipping address, and seller-facing order
 * data, but "placing an order" never actually charges anything — no
 * Razorpay integration exists yet, so `payment_method` only ever accepts
 * 'cod' today; 'online' is modeled for when that integration lands, but the
 * checkout UI keeps it visibly disabled rather than pretending it works.
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
  status: orderStatusEnum('status').notNull().default('placed'),
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
  requestedPlace: varchar('requested_place', { length: 200 }).notNull(),
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
