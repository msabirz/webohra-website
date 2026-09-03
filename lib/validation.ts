import { z } from 'zod';

/**
 * Shared request-shape validation for API routes (and mirrored client-side
 * in the forms that post to them). Keeping these in one place is what lets
 * webohra-app build an identical client against the same contract — see the
 * root CLAUDE.md's "one rule that spans both repos."
 *
 * Every field below carries its own message so a form can show "City must
 * be at least 2 characters" instead of Zod's generic "String must contain
 * at least 2 character(s)".
 */

// Bare 10-digit local number — the UI always shows a fixed +91 flag/prefix
// beside the input (see components/phone-input.tsx), so the value this
// schema receives never includes a country code itself.
const phoneRegex = /^[6-9]\d{9}$/;
const phoneField = () =>
  z
    .string()
    .trim()
    .regex(phoneRegex, 'Enter a valid 10-digit Indian mobile number');

export const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(150, `${label} is too long`);

const emailField = () =>
  z.string().trim().toLowerCase().email('Enter a valid email address').max(200);

// India Post pincodes are always 6 digits, but kept at 5-6 per the
// requester's explicit call — lenient on the low end, never more than 6.
export const pincodeField = () =>
  z
    .string()
    .trim()
    .regex(/^\d{5,6}$/, 'Enter a valid pincode (5-6 digits)');

const passwordField = () =>
  z.string().min(8, 'Password must be at least 8 characters').max(72);

const itsIdField = () =>
  z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'ITS ID must be exactly 8 digits, numbers only');

/**
 * Seller registration — same email + password identity model as buyers
 * (see signupSchema below): she signs in with email + password afterward;
 * phone is OTP-verified once here, same mechanics as buyer signup, via
 * /api/sellers/register/verify. Business details (ITS ID, jamaat) are
 * collected up front too rather than in a second step, since there's no
 * reason to split them once phone/OTP is no longer the sign-in gate.
 */
export const sellerRegisterSchema = z
  .object({
    name: nameField('Name'),
    email: emailField(),
    phone: phoneField(),
    password: passwordField(),
    businessName: nameField('Business name'),
    itsId: itsIdField(),
    plansDelhiveryShipping: z.boolean(),
    jamaatId: z.number().int().positive().optional(),
  })
  .refine((data) => !data.plansDelhiveryShipping || !!data.jamaatId, {
    message: 'Select your nearest jamaat for Delhivery pickup',
    path: ['jamaatId'],
  });
export type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>;

export const sellerRegisterVerifySchema = z.object({
  phone: phoneField(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type SellerRegisterVerifyInput = z.infer<typeof sellerRegisterVerifySchema>;

/**
 * "Become a seller" from an existing, already phone-verified buyer account
 * (session-gated, see /api/sellers/register/attach) — no email/password/OTP
 * to redo, just the business details a brand-new registration also collects.
 */
export const sellerAttachSchema = z
  .object({
    businessName: nameField('Business name'),
    itsId: itsIdField(),
    plansDelhiveryShipping: z.boolean(),
    jamaatId: z.number().int().positive().optional(),
  })
  .refine((data) => !data.plansDelhiveryShipping || !!data.jamaatId, {
    message: 'Select your nearest jamaat for Delhivery pickup',
    path: ['jamaatId'],
  });
export type SellerAttachInput = z.infer<typeof sellerAttachSchema>;

/** Seller settings — business details editable after registration (email,
 *  phone, and password have their own dedicated flows — see /account-style
 *  password endpoints, reused as-is for sellers). */
export const sellerProfileUpdateSchema = z
  .object({
    businessName: nameField('Business name'),
    plansDelhiveryShipping: z.boolean(),
    jamaatId: z.number().int().positive().optional(),
    // Her real address — added for the Fulfillment & Subscriptions redesign
    // (self-ship origin, Pickup & Pay's seller-location option). Optional:
    // she can update her business name without being forced to fill this
    // in the same request, and plenty of existing sellers have none yet.
    addressLine1: z.string().trim().min(3, 'Address must be at least 3 characters').max(200).optional(),
    addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
    city: nameField('City').optional(),
    state: nameField('State').optional(),
    pincode: pincodeField().optional(),
  })
  .refine((data) => !data.plansDelhiveryShipping || !!data.jamaatId, {
    message: 'Select your nearest jamaat for Delhivery pickup',
    path: ['jamaatId'],
  });
export type SellerProfileUpdateInput = z.infer<typeof sellerProfileUpdateSchema>;

// Fulfillment & Subscriptions redesign — self-ship city (planning doc
// Decision 2: one city for now, modeled so more can be added later without
// a migration; this endpoint only ever writes one row per seller today).
export const sellerShipCityUpdateSchema = z.object({
  city: nameField('City'),
});
export type SellerShipCityUpdateInput = z.infer<typeof sellerShipCityUpdateSchema>;

// A physical product's stock on hand — coerced from the form's text/number
// input; empty string means "not tracked", never zero.
const stockQuantityField = () =>
  z.coerce.number().int().min(0, 'Stock can\'t be negative').max(999999).nullable();

// FR-17's per-subcategory fields ride along in the same create/update
// payload as a free-form map — the actual per-field type/required/options
// validation depends on which subcategory was picked (fetched from the DB
// at request time), so it can't be expressed as a static Zod shape here;
// see lib/listing-fields.ts's validateFieldValues for that half.
const fieldValuesField = z.record(z.string(), z.unknown()).optional();

// The "self-managed shipping needs an estimate" rule only applies to
// physical_product listings — a static Zod schema has no way to know a
// given subcategoryId's listingType (that's a DB lookup), so this used to
// live here as an unconditional .refine() that fired for every listing
// regardless of type. That silently blocked every service listing from
// ever saving: the seller form always sends shippingMethod: 'self_managed'
// as a harmless default even for services (which hide the shipping UI
// entirely), and the refine had no way to tell the two cases apart. Moved
// to a subcategory-aware check in the route handlers instead — see
// requireShippingEstimateIfPhysical in app/api/listings/route.ts and
// app/api/listings/[idOrSlug]/route.ts.
// Optional, not required: a listing is either simple (price set here) or
// variant-based (price stays null forever, every real price lives in
// listing_variants instead — see that table's own comment in db/schema.ts).
// A brand-new variant-based listing is created bare, price omitted
// entirely, exactly like today's "save first, then add photos" pattern —
// variants get added afterward, once the listing has an id. Publishing
// still requires either a price or at least one variant; see the PATCH
// status handler in app/api/listings/[idOrSlug]/route.ts for that guard.
const priceField = () => z.coerce.number().positive('Enter a price greater than 0').optional();

// Fulfillment & Subscriptions redesign, Phase 2 — every field here is
// optional and defaults preserve today's behavior exactly (no charge, no
// Pickup & Pay) so an existing listing that never sets any of these keeps
// working unchanged. 'delhivery' stays a valid shippingMethod value at the
// data/API level (an existing listing already using it must stay valid) —
// only the seller-facing form stops offering it as a new choice, per
// Decision 7 (no partial "coming soon"; not offered anywhere until the
// live integration exists).
const fulfillmentFields = {
  selfShipCharge: z.coerce.number().nonnegative('Charge can’t be negative').optional(),
  pickupEnabled: z.boolean().optional(),
  pickupAddressSource: z.enum(['seller', 'office']).optional(),
  pickupLeadTimeHours: z.coerce.number().int().nonnegative().max(720, 'Keep it under 30 days').optional(),
  showAddressOnPdp: z.boolean().optional(),
  weight: z.coerce.number().positive('Weight must be greater than 0').optional(),
};

export const listingCreateSchema = z.object({
  subcategoryId: z.number({ message: 'Select a category' }).int().positive(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  price: priceField(),
  shippingMethod: z.enum(['self_managed', 'delhivery']),
  shippingEstimateText: z.string().trim().max(200).optional(),
  stockQuantity: stockQuantityField().optional(),
  fieldValues: fieldValuesField,
  ...fulfillmentFields,
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;

/** PATCH /api/listings/[id] — editing an existing product's own fields
 *  (status changes go through listingStatusUpdateSchema below instead). */
export const listingUpdateSchema = z.object({
  subcategoryId: z.number({ message: 'Select a category' }).int().positive(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  price: priceField(),
  shippingMethod: z.enum(['self_managed', 'delhivery']),
  shippingEstimateText: z.string().trim().max(200).optional(),
  stockQuantity: stockQuantityField().optional(),
  fieldValues: fieldValuesField,
  ...fulfillmentFields,
});
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;

/** 'active' is the DB value for what the seller portal calls "Published" —
 *  see listingStatusEnum's comment in db/schema.ts. */
export const listingStatusUpdateSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']),
});
export type ListingStatusUpdateInput = z.infer<typeof listingStatusUpdateSchema>;

/** Multi-select bulk actions from the products table. */
export const bulkListingStatusUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Select at least one product'),
  status: z.enum(['draft', 'active', 'archived']),
});
export type BulkListingStatusUpdateInput = z.infer<typeof bulkListingStatusUpdateSchema>;

export const bulkListingDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Select at least one product'),
});
export type BulkListingDeleteInput = z.infer<typeof bulkListingDeleteSchema>;

export const listingImageAttachSchema = z.object({
  url: z.string().trim().url('Not a valid image URL').max(500),
  // Omitted/undefined = a photo of the listing itself; set = one specific
  // variant's own photo. Same listing_images table either way.
  variantId: z.number().int().positive().optional(),
});
export type ListingImageAttachInput = z.infer<typeof listingImageAttachSchema>;

export const listingVariantCreateSchema = z.object({
  name: nameField('Type name'),
  price: z.coerce.number({ message: 'Enter a price' }).positive('Enter a price greater than 0'),
  stockQuantity: stockQuantityField().optional(),
});
export type ListingVariantCreateInput = z.infer<typeof listingVariantCreateSchema>;

export const listingVariantUpdateSchema = z.object({
  name: nameField('Type name').optional(),
  price: z.coerce.number({ message: 'Enter a price' }).positive('Enter a price greater than 0').optional(),
  stockQuantity: stockQuantityField().optional(),
});
export type ListingVariantUpdateInput = z.infer<typeof listingVariantUpdateSchema>;

export const listingVariantReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1, 'Nothing to reorder'),
});

export const listingImagesReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1, 'Nothing to reorder'),
});
export type ListingImagesReorderInput = z.infer<typeof listingImagesReorderSchema>;

// `purpose` defaults to 'listing' so every caller that predates Phase 6
// (product photos, variant photos, image-type custom fields) keeps working
// unchanged with just { contentType, listingId } — 'portfolio'
// (Fulfillment & Subscriptions redesign, Phase 6) is the one purpose that
// doesn't need a listingId at all, since a portfolio item belongs to the
// seller, not any one listing. There was briefly a third purpose,
// 'payout_qr' (Phase 5c payout redesign, 2026-09-03), for a seller-
// uploaded payout QR code — dropped the same day once the 'qr_image'
// payout method itself was dropped (see payoutMethodEnum's own comment in
// db/schema.ts) in favor of Admin paying via UPI/bank details fetched live
// from Razorpay. Nothing to reconcile from it here.
export const uploadPresignSchema = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
      message: 'Only JPEG, PNG, or WEBP images are allowed',
    }),
    purpose: z.enum(['listing', 'portfolio']).default('listing'),
    // Which product this photo is for — the R2 key is organized by seller
    // and product slug (see lib/storage/r2.ts), and the route verifies she
    // actually owns this listing before ever generating a presigned URL.
    // Required only when purpose is 'listing' (the refine below).
    listingId: z.number().int().positive().optional(),
  })
  .refine((data) => data.purpose !== 'listing' || data.listingId !== undefined, {
    message: 'listingId is required for a product photo',
    path: ['listingId'],
  });
export type UploadPresignInput = z.infer<typeof uploadPresignSchema>;

export const orderCreateSchema = z.object({
  // Checkout collects contact info directly rather than requiring an
  // account — the SRS explicitly allows guest Buy Now/Add to Cart (FR-5b),
  // unlike Contact Seller/Take Consultation which stay registered-only.
  buyerName: nameField('Full name'),
  buyerPhone: phoneField(),
  buyerEmail: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(200)
    .optional()
    .or(z.literal('')),
  addressLine1: z.string().trim().min(3, 'Address must be at least 3 characters').max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'City must be at least 2 characters').max(100),
  state: z.string().trim().min(2, 'State must be at least 2 characters').max(100),
  pincode: pincodeField(),
  // Fulfillment & Subscriptions redesign, Phase 5b — 'online' is real
  // Razorpay payment against the full cart total, any number of sellers
  // included (see app/api/orders/route.ts's own comment — this used to be
  // single-seller-only while payout-splitting depended on Razorpay Route,
  // lifted once that dependency turned out not to exist).
  paymentMethod: z.enum(['cod', 'online']),
  items: z
    .array(
      z.object({
        listingId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
        // Present only for a line that's a specific type of a variant-based
        // listing — absent/undefined for a simple listing, same as
        // everywhere else this pairing shows up (cart, order_items).
        variantId: z.number().int().positive().optional(),
      }),
    )
    .min(1, 'Your cart is empty'),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

// Fulfillment & Subscriptions redesign, Phase 5b — the buyer's browser
// confirming a Razorpay payment against a specific order, same shape as
// walletTopupVerifySchema (that one's seller-authenticated; this one is
// guest-friendly, same trust model as the rest of checkout — ownership is
// established by orderNumber + the order's own stored razorpayOrderId
// matching, not a session).
export const orderPaymentVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
export type OrderPaymentVerifyInput = z.infer<typeof orderPaymentVerifySchema>;

export const orderCancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const pickupRequestSchema = z.object({
  listingId: z.number().int().positive(),
  buyerName: nameField('Full name'),
  buyerPhone: phoneField(),
  // Her current/selected location (lib/location-client.ts) — re-checked
  // server-side against the listing's resolved pickup city (see
  // lib/pickup.ts), same eligibility rule the PDP uses to decide whether
  // to offer Pickup & Pay at all, so hitting this endpoint directly can't
  // bypass the location match.
  buyerCity: z.string().trim().min(2, 'Set your location first').max(100),
  requestedDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  // Fulfillment & Subscriptions redesign, Phase 3 — HH:MM, 24h. The actual
  // "at least N hours from now" check is listing-dependent
  // (pickupLeadTimeHours), so it happens in the route, not here.
  requestedTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a valid time'),
  // requestedPlace is no longer buyer-entered free text — where pickup
  // actually happens is resolved server-side from the listing's own
  // pickupAddressSource (seller's address or a WeBohra office), same
  // reasoning as never trusting a client-supplied price at checkout.
});
export type PickupRequestInput = z.infer<typeof pickupRequestSchema>;

export const whatsappContactSchema = z.object({
  buyerName: nameField('Your name'),
});
export type WhatsappContactInput = z.infer<typeof whatsappContactSchema>;

export const profileUpdateSchema = z.object({
  name: nameField('Name').optional(),
  email: emailField().optional().or(z.literal('')),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const passwordSetSchema = z.object({
  password: passwordField(),
});
export type PasswordSetInput = z.infer<typeof passwordSetSchema>;

/**
 * Buyer registration — Amazon/Flipkart-style: name, email, phone, and a
 * password all collected up front. Email + password is how she signs in
 * afterward (see loginSchema); phone still gets OTP-verified once here per
 * SRS FR-30, via /api/auth/signup/verify, but never becomes the sign-in
 * credential itself.
 */
export const signupSchema = z.object({
  name: nameField('Name'),
  email: emailField(),
  phone: phoneField(),
  password: passwordField(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signupVerifySchema = z.object({
  phone: phoneField(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type SignupVerifyInput = z.infer<typeof signupVerifySchema>;

export const loginSchema = z.object({
  email: emailField(),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailField(),
});
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

export const passwordResetSchema = z.object({
  email: emailField(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: passwordField(),
});
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// ---------------------------------------------------------------------------
// Admin Panel (FR-12–FR-16) — every route these back also re-checks
// staff_role server-side per site CLAUDE.md; these schemas only validate
// shape, never authorize.
// ---------------------------------------------------------------------------

const slugField = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')
    .max(100);

/** FR-13: approve/reject a seller's ITS verification. `reset` un-verifies
 *  (e.g. a prior approval turns out to be wrong) without deleting anything —
 *  her existing listings just can't newly publish until she's re-approved. */
export const adminSellerVerifySchema = z.object({
  itsVerified: z.boolean(),
});
export type AdminSellerVerifyInput = z.infer<typeof adminSellerVerifySchema>;

/** FR-14: moderate any listing, not just the owner's own draft<->active<->
 *  archived toggle (see listingStatusUpdateSchema) — Admin can also flag or
 *  remove, and restore either back to draft. A note is required for
 *  flag/remove so the seller isn't left guessing why. */
export const adminListingModerationSchema = z
  .object({
    status: z.enum(['draft', 'active', 'archived', 'flagged', 'removed']),
    moderationNote: z.string().trim().max(300).optional(),
  })
  .refine((data) => data.status !== 'flagged' && data.status !== 'removed' ? true : !!data.moderationNote, {
    message: 'Explain why you\'re flagging or removing this listing',
    path: ['moderationNote'],
  });
export type AdminListingModerationInput = z.infer<typeof adminListingModerationSchema>;

export const adminCategoryCreateSchema = z.object({
  name: nameField('Category name'),
  slug: slugField().optional(),
});
export type AdminCategoryCreateInput = z.infer<typeof adminCategoryCreateSchema>;

export const adminCategoryUpdateSchema = z.object({
  name: nameField('Category name').optional(),
  active: z.boolean().optional(),
});
export type AdminCategoryUpdateInput = z.infer<typeof adminCategoryUpdateSchema>;

export const adminSubcategoryCreateSchema = z.object({
  categoryId: z.number().int().positive(),
  name: nameField('Subcategory name'),
  slug: slugField().optional(),
  listingType: z.enum(['physical_product', 'local_service', 'remote_service']),
});
export type AdminSubcategoryCreateInput = z.infer<typeof adminSubcategoryCreateSchema>;

export const adminSubcategoryUpdateSchema = z.object({
  name: nameField('Subcategory name').optional(),
  listingType: z.enum(['physical_product', 'local_service', 'remote_service']).optional(),
  active: z.boolean().optional(),
});
export type AdminSubcategoryUpdateInput = z.infer<typeof adminSubcategoryUpdateSchema>;

const fieldTypeValue = z.enum(['text', 'number', 'select', 'multi_select', 'boolean', 'textarea', 'image']);

export const adminSubcategoryFieldCreateSchema = z
  .object({
    label: nameField('Field label'),
    fieldType: fieldTypeValue,
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1)).max(30).optional(),
  })
  .refine((data) => (data.fieldType === 'select' || data.fieldType === 'multi_select' ? !!data.options?.length : true), {
    message: 'Select fields need at least one option',
    path: ['options'],
  });
export type AdminSubcategoryFieldCreateInput = z.infer<typeof adminSubcategoryFieldCreateSchema>;

export const adminSubcategoryFieldUpdateSchema = z.object({
  label: nameField('Field label').optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).max(30).optional(),
  active: z.boolean().optional(),
});
export type AdminSubcategoryFieldUpdateInput = z.infer<typeof adminSubcategoryFieldUpdateSchema>;

export const adminSubcategoryFieldReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

export const adminJamaatCreateSchema = z.object({
  city: nameField('City'),
  name: nameField('Jamaat name'),
});
export type AdminJamaatCreateInput = z.infer<typeof adminJamaatCreateSchema>;

export const adminJamaatUpdateSchema = z.object({
  city: nameField('City').optional(),
  name: nameField('Jamaat name').optional(),
  active: z.boolean().optional(),
  // Which WeBohra office serves this jamaat — null explicitly clears the
  // mapping (not the same as omitting the key, which leaves it untouched).
  officeId: z.number().int().positive().nullable().optional(),
});
export type AdminJamaatUpdateInput = z.infer<typeof adminJamaatUpdateSchema>;

export const adminBannerCreateSchema = z.object({
  heading: z.string().trim().min(2, 'Heading must be at least 2 characters').max(150),
  subheading: z.string().trim().max(250).optional(),
  ctaLabel: z.string().trim().max(50).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1B3A6B'),
  sortOrder: z.number().int().min(0).default(0),
});
export type AdminBannerCreateInput = z.infer<typeof adminBannerCreateSchema>;

export const adminBannerUpdateSchema = z.object({
  heading: z.string().trim().min(2, 'Heading must be at least 2 characters').max(150).optional(),
  subheading: z.string().trim().max(250).optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(50).optional().or(z.literal('')),
  ctaHref: z.string().trim().max(200).optional().or(z.literal('')),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1B3A6B').optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type AdminBannerUpdateInput = z.infer<typeof adminBannerUpdateSchema>;

/** FR-47: Customer Support logging a jamaat parcel receipt, or escalating
 *  a seller who failed to deliver it in time. */
export const adminPickupUpdateSchema = z.object({
  status: z.enum(['pending', 'received', 'issue']),
  notes: z.string().trim().max(300).optional(),
});
export type AdminPickupUpdateInput = z.infer<typeof adminPickupUpdateSchema>;

/** Staff management (super_admin only) — grant/change/revoke staff_role.
 *  role: null revokes staff access entirely without touching her buyer/
 *  seller account underneath. */
export const adminStaffUpdateSchema = z.object({
  role: z.enum(['customer_support', 'admin', 'super_admin']).nullable(),
});
export type AdminStaffUpdateInput = z.infer<typeof adminStaffUpdateSchema>;

export const adminStaffInviteSchema = z.object({
  email: emailField(),
  role: z.enum(['customer_support', 'admin', 'super_admin']),
});
export type AdminStaffInviteInput = z.infer<typeof adminStaffInviteSchema>;

// ---------------------------------------------------------------------------
// Take Consultation requests — redesigned per the requester's explicit call:
// submitting one no longer opens WhatsApp for the buyer directly (see
// enquiryStatusEnum's comment in db/schema.ts). Guest-submittable, same
// guest-friendly shape as orderCreateSchema.
// ---------------------------------------------------------------------------

export const consultationRequestSchema = z.object({
  listingId: z.number().int().positive(),
  // Present only when asking about one specific type of a variant-based
  // service (e.g. Mehndi's "Hands only" vs "Full Bridal" coverage tiers).
  variantId: z.number().int().positive().optional(),
  buyerName: nameField('Full name'),
  buyerPhone: phoneField(),
  message: z.string().trim().max(500).optional(),
});
export type ConsultationRequestInput = z.infer<typeof consultationRequestSchema>;

export const enquiryRejectSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type EnquiryRejectInput = z.infer<typeof enquiryRejectSchema>;

// ---------------------------------------------------------------------------
// Fulfillment & Subscriptions redesign — Phase 1 (admin config)
// ---------------------------------------------------------------------------

export const adminWebohraOfficeCreateSchema = z.object({
  name: nameField('Office name'),
  addressLine1: z.string().trim().min(3, 'Address must be at least 3 characters').max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: nameField('City'),
  state: nameField('State'),
  pincode: pincodeField(),
  contactPhone: phoneField().optional(),
});
export type AdminWebohraOfficeCreateInput = z.infer<typeof adminWebohraOfficeCreateSchema>;

export const adminWebohraOfficeUpdateSchema = z.object({
  name: nameField('Office name').optional(),
  addressLine1: z.string().trim().min(3, 'Address must be at least 3 characters').max(200).optional(),
  addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
  city: nameField('City').optional(),
  state: nameField('State').optional(),
  pincode: pincodeField().optional(),
  contactPhone: phoneField().optional().or(z.literal('')),
  active: z.boolean().optional(),
});
export type AdminWebohraOfficeUpdateInput = z.infer<typeof adminWebohraOfficeUpdateSchema>;

const sellerTypeValue = z.enum(['product', 'service']);
const contactModeValue = z.enum(['whatsapp_number', 'direct_whatsapp', 'masked_relay']);

// tierKey is a stable, code-facing slug ("basic", "gold", ...) — display
// name can change freely without breaking anything keyed off this.
const tierKeyField = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only')
    .min(2)
    .max(30);

export const adminSubscriptionPlanCreateSchema = z.object({
  sellerType: sellerTypeValue,
  tierKey: tierKeyField(),
  name: nameField('Plan name'),
  monthlyPrice: z.number().nonnegative('Price can’t be negative'),
  // Absent/undefined = unlimited listings. Explicit null isn't accepted
  // here — omit the key instead, so "unlimited" is a deliberate choice,
  // not a typo that silently became one.
  maxActiveListings: z.number().int().positive().optional(),
  allowsPickupAndPay: z.boolean().default(false),
  pickupOfficeOption: z.boolean().default(false),
  allowsDelhivery: z.boolean().default(false),
  prioritySupport: z.boolean().default(false),
  remindersEnabled: z.boolean().default(false),
  // Service plans only — validated against sellerType in the route itself
  // (a product plan with a contactMode set would be silently meaningless,
  // better to reject it outright than accept dead data).
  contactMode: contactModeValue.optional(),
  bonusOtherCategoryListings: z.number().int().min(0).max(10).default(0),
  sortOrder: z.number().int().min(0).default(0),
});
export type AdminSubscriptionPlanCreateInput = z.infer<typeof adminSubscriptionPlanCreateSchema>;

export const adminSubscriptionPlanUpdateSchema = z.object({
  name: nameField('Plan name').optional(),
  monthlyPrice: z.number().nonnegative('Price can’t be negative').optional(),
  maxActiveListings: z.number().int().positive().nullable().optional(),
  allowsPickupAndPay: z.boolean().optional(),
  pickupOfficeOption: z.boolean().optional(),
  allowsDelhivery: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
  contactMode: contactModeValue.nullable().optional(),
  bonusOtherCategoryListings: z.number().int().min(0).max(10).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type AdminSubscriptionPlanUpdateInput = z.infer<typeof adminSubscriptionPlanUpdateSchema>;

export const adminSubscriptionSettingsUpdateSchema = z.object({
  walletMinThreshold: z.number().nonnegative('Threshold can’t be negative').optional(),
  rechargeDefaultPlanId: z.number().int().positive().nullable().optional(),
  bonusListingCommissionPercent: z
    .number()
    .min(0, 'Commission can’t be negative')
    .max(100, 'Commission can’t exceed 100%')
    .optional(),
  // Fulfillment & Subscriptions redesign, Phase 5c.
  orderCommissionPercent: z
    .number()
    .min(0, 'Commission can’t be negative')
    .max(100, 'Commission can’t exceed 100%')
    .optional(),
  // The stakeholder-approval switch for real RazorpayX transfers — see its
  // own comment on subscription_settings in db/schema.ts. Accepted here at
  // the schema level, but the route additionally requires super_admin
  // specifically (not just isAdmin, unlike every other field in this
  // object) to actually change it.
  razorpayxPayoutsEnabled: z.boolean().optional(),
});
export type AdminSubscriptionSettingsUpdateInput = z.infer<typeof adminSubscriptionSettingsUpdateSchema>;

// Fulfillment & Subscriptions redesign, Phase 4/5 — a seller choosing/
// switching her own plan, or switching to pay-as-you-go (Phase 5's wallet
// top-up is what makes the recharge branch a real, usable choice instead of
// leaving her stuck at ₹0 the moment she picks it).
export const sellerSubscriptionChooseSchema = z.discriminatedUnion('billingMode', [
  z.object({
    sellerType: z.enum(['product', 'service']),
    billingMode: z.literal('plan'),
    planId: z.number().int().positive(),
  }),
  z.object({
    sellerType: z.enum(['product', 'service']),
    billingMode: z.literal('recharge'),
  }),
]);
export type SellerSubscriptionChooseInput = z.infer<typeof sellerSubscriptionChooseSchema>;

// Fulfillment & Subscriptions redesign, Phase 5 — a seller topping up her
// recharge wallet via Razorpay. Bounds match the planning doc's sandbox
// strategy (real payments, small real amounts) rather than an arbitrary
// guess: ₹100 floor keeps a top-up meaningfully above Razorpay's own
// minimum-order rules, ₹25,000 ceiling is just a sane guard against a
// fat-fingered amount, not a business rule — Admin can always adjust a
// wallet manually for anything genuinely larger.
export const walletTopupOrderSchema = z.object({
  amountRupees: z
    .number()
    .min(100, 'Minimum top-up is ₹100')
    .max(25000, 'For amounts over ₹25,000, contact WeBohra support directly'),
});
export type WalletTopupOrderInput = z.infer<typeof walletTopupOrderSchema>;

export const walletTopupVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
export type WalletTopupVerifyInput = z.infer<typeof walletTopupVerifySchema>;

// Admin manually correcting a seller's wallet balance — the one non-gateway
// path into wallet_transactions (see lib/wallet.ts's adjustWalletBalance).
// `reason` is required at the schema level, not just "nice to have" at the
// app level, since an unexplained balance change is exactly what the audit
// trail exists to prevent. `amountRupees` can be negative (a correction can
// go either way); `refine` blocks a no-op zero adjustment, which would
// otherwise create a confusing "why does this row exist" audit entry.
export const adminWalletAdjustmentSchema = z.object({
  amountRupees: z
    .number()
    .min(-100000, 'Adjustment is too large — check the amount')
    .max(100000, 'Adjustment is too large — check the amount')
    .refine((v) => v !== 0, 'Adjustment amount can\'t be zero'),
  reason: z
    .string()
    .trim()
    .min(5, 'Explain the reason for this adjustment')
    .max(300),
});
export type AdminWalletAdjustmentInput = z.infer<typeof adminWalletAdjustmentSchema>;

// Fulfillment & Subscriptions redesign, Phase 6 — a seller's past-work
// showcase item (portfolio_items). `link` accepts an empty string from a
// cleared form field as well as omission — both mean "no link" — since a
// controlled <input> always sends a string, never undefined, when a field
// is simply left blank.
export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  link: z.string().trim().url('Enter a valid URL (starting with https://)').max(500).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(500).optional().or(z.literal('')),
});
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

export const portfolioReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});
export type PortfolioReorderInput = z.infer<typeof portfolioReorderSchema>;

// Fulfillment & Subscriptions redesign, Phase 5c — a seller registering
// where her online-order payouts go. Discriminated on method: a bank
// account needs the holder name/IFSC/account number, a UPI account needs
// just the VPA. ifsc/vpa format checks mirror lib/razorpay-payouts.ts's
// own regexes (kept in sync manually — small, stable formats, not worth a
// shared import across a validation-schema/server-lib boundary).
// Fulfillment & Subscriptions redesign, Phase 5c — redesigned 2026-09-03
// (see payoutMethodEnum's own comment in db/schema.ts). 'upi' is listed
// first since it's the preferred method — it's the one Admin can pay
// against with an amount-pre-filled QR code, rather than typing anything
// by hand. A third 'qr_image' method (seller uploads her own QR
// screenshot) existed briefly and was dropped the same day — it only
// duplicated what 'upi' already gets her for free.
export const sellerPayoutAccountSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('upi'),
    vpa: z
      .string()
      .trim()
      .regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID (e.g. name@bank)'),
  }),
  z.object({
    method: z.literal('bank_account'),
    accountHolderName: nameField('Account holder name'),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid 11-character IFSC code'),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{9,18}$/, 'Enter a valid account number (9-18 digits)'),
  }),
]);
export type SellerPayoutAccountInput = z.infer<typeof sellerPayoutAccountSchema>;

// Admin Panel transaction/dispute/refund tooling, 2026-09-03.
export const adminRefundSchema = z.object({
  amountRupees: z.number().positive('Refund amount must be greater than zero'),
  reason: z.string().trim().min(5, 'Explain why this order is being refunded').max(300),
});
export type AdminRefundInput = z.infer<typeof adminRefundSchema>;

// "Cancel whole order" is just this called with every item id on the
// order — no separate schema needed for that case.
export const adminCancelItemsSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1, 'Select at least one item to cancel'),
  reason: z.string().trim().min(5, 'Explain why these items are being cancelled').max(300),
});
export type AdminCancelItemsInput = z.infer<typeof adminCancelItemsSchema>;

export const adminOpenDisputeSchema = z.object({
  reason: z.string().trim().min(5, 'Describe the issue').max(500),
});
export type AdminOpenDisputeInput = z.infer<typeof adminOpenDisputeSchema>;

export const adminUpdateDisputeSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
    status: z.enum(['open', 'investigating', 'resolved']).optional(),
    assignedToStaffId: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => data.note !== undefined || data.status !== undefined || data.assignedToStaffId !== undefined, {
    message: 'Provide at least a note, a status change, or an assignment',
    path: ['note'],
  });
export type AdminUpdateDisputeInput = z.infer<typeof adminUpdateDisputeSchema>;
