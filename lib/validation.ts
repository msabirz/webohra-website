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

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(150, `${label} is too long`);

const emailField = () =>
  z.string().trim().toLowerCase().email('Enter a valid email address').max(200);

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
  })
  .refine((data) => !data.plansDelhiveryShipping || !!data.jamaatId, {
    message: 'Select your nearest jamaat for Delhivery pickup',
    path: ['jamaatId'],
  });
export type SellerProfileUpdateInput = z.infer<typeof sellerProfileUpdateSchema>;

// A physical product's stock on hand — coerced from the form's text/number
// input; empty string means "not tracked", never zero.
const stockQuantityField = () =>
  z.coerce.number().int().min(0, 'Stock can\'t be negative').max(999999).nullable();

export const listingCreateSchema = z
  .object({
    subcategoryId: z.number({ message: 'Select a category' }).int().positive(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    price: z.coerce.number({ message: 'Enter a price' }).positive('Enter a price greater than 0'),
    shippingMethod: z.enum(['self_managed', 'delhivery']),
    shippingEstimateText: z.string().trim().max(200).optional(),
    stockQuantity: stockQuantityField().optional(),
  })
  .refine(
    (data) => data.shippingMethod !== 'self_managed' || !!data.shippingEstimateText,
    {
      message: 'Provide a delivery estimate when handling shipping yourself',
      path: ['shippingEstimateText'],
    },
  );

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;

/** PATCH /api/listings/[id] — editing an existing product's own fields
 *  (status changes go through listingStatusUpdateSchema below instead). */
export const listingUpdateSchema = z
  .object({
    subcategoryId: z.number({ message: 'Select a category' }).int().positive(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    price: z.coerce.number({ message: 'Enter a price' }).positive('Enter a price greater than 0'),
    shippingMethod: z.enum(['self_managed', 'delhivery']),
    shippingEstimateText: z.string().trim().max(200).optional(),
    stockQuantity: stockQuantityField().optional(),
  })
  .refine(
    (data) => data.shippingMethod !== 'self_managed' || !!data.shippingEstimateText,
    {
      message: 'Provide a delivery estimate when handling shipping yourself',
      path: ['shippingEstimateText'],
    },
  );
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
});
export type ListingImageAttachInput = z.infer<typeof listingImageAttachSchema>;

export const listingImagesReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1, 'Nothing to reorder'),
});
export type ListingImagesReorderInput = z.infer<typeof listingImagesReorderSchema>;

export const uploadPresignSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Only JPEG, PNG, or WEBP images are allowed',
  }),
  // Which product this photo is for — the R2 key is organized by seller and
  // product slug (see lib/storage/r2.ts), and the route verifies she
  // actually owns this listing before ever generating a presigned URL.
  listingId: z.number().int().positive(),
});
export type UploadPresignInput = z.infer<typeof uploadPresignSchema>;

// India Post pincodes are always 6 digits, but kept at 5-6 per the
// requester's explicit call — lenient on the low end, never more than 6.
const pincodeField = () =>
  z
    .string()
    .trim()
    .regex(/^\d{5,6}$/, 'Enter a valid pincode (5-6 digits)');

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
  // 'online' isn't accepted here yet — no payment gateway exists (see
  // paymentMethodEnum in db/schema.ts). Checkout only ever submits 'cod'.
  paymentMethod: z.literal('cod'),
  items: z
    .array(
      z.object({
        listingId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1, 'Your cart is empty'),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderCancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const pickupRequestSchema = z.object({
  listingId: z.number().int().positive(),
  buyerName: nameField('Full name'),
  buyerPhone: phoneField(),
  // Her current/selected location (lib/location-client.ts) — re-checked
  // server-side against the listing's seller jamaat city, same eligibility
  // rule the PDP uses to decide whether to offer Pickup & Pay at all, so
  // hitting this endpoint directly can't bypass the location match.
  buyerCity: z.string().trim().min(2, 'Set your location first').max(100),
  requestedDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  requestedPlace: z.string().trim().min(3, 'Place must be at least 3 characters').max(200),
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

export const adminJamaatCreateSchema = z.object({
  city: nameField('City'),
  name: nameField('Jamaat name'),
});
export type AdminJamaatCreateInput = z.infer<typeof adminJamaatCreateSchema>;

export const adminJamaatUpdateSchema = z.object({
  city: nameField('City').optional(),
  name: nameField('Jamaat name').optional(),
  active: z.boolean().optional(),
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
  buyerName: nameField('Full name'),
  buyerPhone: phoneField(),
  message: z.string().trim().max(500).optional(),
});
export type ConsultationRequestInput = z.infer<typeof consultationRequestSchema>;

export const enquiryRejectSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type EnquiryRejectInput = z.infer<typeof enquiryRejectSchema>;
