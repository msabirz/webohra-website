import { eq } from 'drizzle-orm';
import { db } from './index';
import { slugifyTitle } from '../lib/ids';
import { saveFieldValues } from '../lib/listing-fields';
import { hashPassword } from '../lib/password';
import {
  categories,
  subcategories,
  subcategoryFields,
  jamaats,
  users,
  sellerProfiles,
  listings,
  listingVariants,
  banners,
  webohraOffices,
  subscriptionPlans,
  subscriptionSettings,
} from './schema';

/**
 * Seed data for all 5 Phase-1 categories. Mehndi and Makeup are the two
 * local_service subcategories called out in the original spec (they live
 * under Beauty & Occasion, alongside Imitation Jewellery — the one
 * physical_product subcategory named in SRS §3.6's flow table but never
 * actually seeded until now); IT & Services' two are remote_service
 * (delivered online, not shipped or visited in person); everything else
 * here is physical_product. Art & Craft's four subcategories were the
 * "left for a later pass" — that pass is this one.
 */
export const CATEGORY_SEED: Array<{
  name: string;
  slug: string;
  subcategories: Array<{
    name: string;
    slug: string;
    listingType: 'physical_product' | 'local_service' | 'remote_service';
  }>;
}> = [
  {
    name: 'Food',
    slug: 'food',
    subcategories: [
      { name: 'Baked Goods', slug: 'baked-goods', listingType: 'physical_product' },
      { name: 'Snacks & Preserves', slug: 'snacks-preserves', listingType: 'physical_product' },
    ],
  },
  {
    name: 'Textile',
    slug: 'textile',
    subcategories: [
      { name: 'Apparel', slug: 'apparel', listingType: 'physical_product' },
      { name: 'Home Textiles', slug: 'home-textiles', listingType: 'physical_product' },
    ],
  },
  {
    name: 'Beauty & Occasion',
    slug: 'beauty-occasion',
    subcategories: [
      { name: 'Mehndi', slug: 'mehndi', listingType: 'local_service' },
      { name: 'Makeup', slug: 'makeup', listingType: 'local_service' },
      { name: 'Imitation Jewellery', slug: 'imitation-jewellery', listingType: 'physical_product' },
    ],
  },
  {
    name: 'IT & Services',
    slug: 'it-services',
    subcategories: [
      { name: 'Web Development', slug: 'web-development', listingType: 'remote_service' },
      { name: 'Graphic Design', slug: 'graphic-design', listingType: 'remote_service' },
    ],
  },
  {
    name: 'Art & Craft',
    slug: 'art-craft',
    subcategories: [
      { name: 'Handicrafts', slug: 'handicrafts', listingType: 'physical_product' },
      { name: 'Home Decor', slug: 'home-decor', listingType: 'physical_product' },
      { name: 'Paintings & Art', slug: 'paintings-art', listingType: 'physical_product' },
      { name: 'Personalized/Gift Items', slug: 'personalized-gift-items', listingType: 'physical_product' },
    ],
  },
];

/**
 * FR-17's admin-configurable field schema, seeded per subcategory — the
 * actual field spec worked out category by category with the project
 * owner (see docs/WE_Bohra_SRS_Phase1.md §3.9's sibling, this is the
 * concrete version of that design). Keyed by subcategory slug so it can
 * reuse subcategoryIdBySlug from the loop above; `required: false` is the
 * default so it can be omitted below when a field is optional.
 */
const FIELD_SEED: Record<
  string,
  Array<{
    label: string;
    fieldType: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'textarea' | 'image';
    required?: boolean;
    options?: string[];
  }>
> = {
  'baked-goods': [
    { label: 'Ingredients', fieldType: 'textarea', required: true },
    { label: 'Veg / Non-veg / Egg', fieldType: 'select', required: true, options: ['Veg', 'Non-veg', 'Contains egg'] },
    { label: 'Shelf life', fieldType: 'text', required: true },
  ],
  'snacks-preserves': [
    { label: 'Ingredients', fieldType: 'textarea', required: true },
    { label: 'Veg / Non-veg / Egg', fieldType: 'select', required: true, options: ['Veg', 'Non-veg', 'Contains egg'] },
    { label: 'Shelf life', fieldType: 'text', required: true },
  ],
  apparel: [
    { label: 'Size', fieldType: 'select', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'] },
    { label: 'Fabric/Material', fieldType: 'text', required: true },
    { label: 'Color', fieldType: 'text', required: true },
    {
      label: 'Embroidery/Work type',
      fieldType: 'select',
      required: true,
      options: ['Hand embroidery', 'Zari', 'Mirror work', 'Machine embroidery', 'Plain/None'],
    },
    { label: 'Swatch/close-up photo', fieldType: 'image' },
    { label: 'Care instructions', fieldType: 'textarea' },
  ],
  'home-textiles': [
    { label: 'Dimensions', fieldType: 'text', required: true },
    { label: 'Fabric/Material', fieldType: 'text', required: true },
    { label: 'Set contents', fieldType: 'text' },
  ],
  mehndi: [
    { label: 'Style', fieldType: 'select', required: true, options: ['Arabic', 'Indian/Traditional', 'Bridal', 'Minimalist'] },
    {
      label: 'Coverage area',
      fieldType: 'select',
      options: ['Hands only', 'Hands + Feet', 'Full Bridal (arms + legs)'],
    },
  ],
  makeup: [
    { label: 'Products used', fieldType: 'select', options: ['HD/Airbrush', 'Regular'] },
    { label: 'Trial available', fieldType: 'boolean' },
  ],
  'imitation-jewellery': [
    {
      label: 'Material',
      fieldType: 'select',
      required: true,
      options: ['Kundan', 'Pearl', 'Oxidized silver-tone', 'Stone-studded', 'American Diamond'],
    },
    { label: 'Type', fieldType: 'select', required: true, options: ['Earrings', 'Necklace set', 'Bangles', 'Ring', 'Full set'] },
    { label: 'Occasion', fieldType: 'select', options: ['Bridal', 'Party', 'Daily wear'] },
  ],
  'web-development': [
    {
      label: 'Deliverable type',
      fieldType: 'select',
      required: true,
      options: ['Landing page', 'Full website', 'E-commerce site', 'Web app'],
    },
    { label: 'Revisions included', fieldType: 'text' },
    { label: 'Tech stack', fieldType: 'text' },
  ],
  'graphic-design': [
    {
      label: 'Deliverable type',
      fieldType: 'select',
      required: true,
      options: ['Logo', 'Social media kit', 'Brochure/Flyer', 'Full brand identity'],
    },
    { label: 'File formats delivered', fieldType: 'multi_select', options: ['PNG', 'SVG', 'AI', 'PDF'] },
    { label: 'Revisions included', fieldType: 'text' },
  ],
  handicrafts: [
    { label: 'Material used', fieldType: 'text', required: true },
    { label: 'Craft technique', fieldType: 'text' },
    { label: 'Customizable', fieldType: 'boolean' },
  ],
  'home-decor': [
    { label: 'Dimensions', fieldType: 'text', required: true },
    { label: 'Material', fieldType: 'text', required: true },
    { label: 'Placement', fieldType: 'select', options: ['Wall', 'Tabletop', 'Floor'] },
  ],
  'paintings-art': [
    { label: 'Medium', fieldType: 'select', required: true, options: ['Acrylic', 'Oil', 'Watercolor', 'Calligraphy/Ink'] },
    { label: 'Dimensions', fieldType: 'text', required: true },
    { label: 'Framed', fieldType: 'boolean' },
  ],
  'personalized-gift-items': [
    { label: 'Customization details', fieldType: 'text', required: true },
    { label: 'Turnaround time', fieldType: 'text', required: true },
    { label: 'Material', fieldType: 'text' },
  ],
};

// Starter master list — a placeholder set until Admin curates the real one
// (see app/api/admin/jamaats). One per major city for now.
const JAMAAT_SEED = [
  { city: 'Mumbai', name: 'Saifee Masjid Jamaat' },
  { city: 'Surat', name: 'Central Jamaat' },
  { city: 'Pune', name: 'Camp Jamaat' },
  { city: 'Indore', name: 'Central Jamaat' },
];

// One WeBohra office per jamaat city — Fulfillment & Subscriptions redesign
// (Phase 1). A real deployment would likely have fewer offices than
// jamaats (several jamaats sharing one), but one-per-city is the simplest
// starter mapping until Admin curates a real one, same reasoning as
// JAMAAT_SEED itself.
const WEBOHRA_OFFICE_SEED = [
  { city: 'Mumbai', name: 'WeBohra Office — Mumbai', addressLine1: 'Shop 4, Bohra Bazaar', state: 'Maharashtra', pincode: '400003', contactPhone: '9820000001' },
  { city: 'Surat', name: 'WeBohra Office — Surat', addressLine1: '12 Vohra Sheri', state: 'Gujarat', pincode: '395003', contactPhone: '9820000002' },
  { city: 'Pune', name: 'WeBohra Office — Pune', addressLine1: '3rd Floor, Camp Complex', state: 'Maharashtra', pincode: '411001', contactPhone: '9820000003' },
  { city: 'Indore', name: 'WeBohra Office — Indore', addressLine1: '22 Jaora Compound', state: 'Madhya Pradesh', pincode: '452001', contactPhone: '9820000004' },
];

// The actual tier design from the Fulfillment & Subscriptions planning
// doc — every gate here is a real, admin-editable column (see
// subscription_plans in db/schema.ts), this is just its starting values.
const SUBSCRIPTION_PLAN_SEED: Array<{
  sellerType: 'product' | 'service';
  tierKey: string;
  name: string;
  monthlyPrice: string;
  maxActiveListings?: number;
  allowsPickupAndPay?: boolean;
  pickupOfficeOption?: boolean;
  allowsDelhivery?: boolean;
  prioritySupport?: boolean;
  remindersEnabled?: boolean;
  contactMode?: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay';
  bonusOtherCategoryListings?: number;
  sortOrder: number;
}> = [
  { sellerType: 'product', tierKey: 'basic', name: 'Basic', monthlyPrice: '253.00', sortOrder: 0, bonusOtherCategoryListings: 1 },
  { sellerType: 'product', tierKey: 'silver', name: 'Silver', monthlyPrice: '553.00', allowsPickupAndPay: true, sortOrder: 1, bonusOtherCategoryListings: 1 },
  {
    sellerType: 'product',
    tierKey: 'gold',
    name: 'Gold',
    monthlyPrice: '786.00',
    allowsPickupAndPay: true,
    pickupOfficeOption: true,
    prioritySupport: true,
    remindersEnabled: true,
    sortOrder: 2,
    bonusOtherCategoryListings: 2,
  },
  {
    sellerType: 'product',
    tierKey: 'diamond',
    name: 'Diamond',
    monthlyPrice: '1071.00',
    allowsPickupAndPay: true,
    pickupOfficeOption: true,
    allowsDelhivery: true,
    prioritySupport: true,
    remindersEnabled: true,
    sortOrder: 3,
    bonusOtherCategoryListings: 2,
  },
  {
    sellerType: 'service',
    tierKey: 'basic',
    name: 'Basic',
    monthlyPrice: '153.00',
    maxActiveListings: 1,
    contactMode: 'whatsapp_number',
    sortOrder: 0,
    bonusOtherCategoryListings: 1,
  },
  {
    sellerType: 'service',
    tierKey: 'silver',
    name: 'Silver',
    monthlyPrice: '553.00',
    maxActiveListings: 4,
    contactMode: 'direct_whatsapp',
    sortOrder: 1,
    bonusOtherCategoryListings: 1,
  },
  {
    sellerType: 'service',
    tierKey: 'gold',
    name: 'Gold',
    monthlyPrice: '786.00',
    maxActiveListings: 6,
    contactMode: 'masked_relay',
    prioritySupport: true,
    sortOrder: 2,
    bonusOtherCategoryListings: 2,
  },
];

/**
 * Five verified demo sellers, one per category (roughly), so the site
 * reads as a real multi-seller marketplace rather than one business
 * repeated everywhere. its_verified: true simulates a completed Admin
 * review — real self-registered sellers start unverified (see
 * /api/sellers/register). Every one of them is also a real, persistent
 * QA login (email + password, see project memory) so any of the five
 * Seller Portals can be tested directly, not just Zainab's — "zainab"
 * is the one with no `password` here because her passwordHash was set by
 * hand outside this script; the seeding loop below deliberately leaves
 * passwordHash untouched when `password` is omitted, so reseeding can
 * never clobber it. The other four always reset to the same known
 * password on every reseed, which is the point (predictable QA creds).
 */
const DEMO_SELLERS: Array<{
  key: string;
  phone: string;
  email?: string;
  password?: string;
  businessName: string;
  itsId: string;
  jamaatCity?: string;
}> = [
  { key: 'zainab', phone: '9999999999', email: 'zainab.test@webohra.test', businessName: "Zainab's Kitchen", itsId: '10000001', jamaatCity: 'Mumbai' },
  { key: 'sakina', phone: '9888800001', email: 'sakina.test@webohra.test', password: 'TestPass123!', businessName: "Sakina's Threads", itsId: '10000002', jamaatCity: 'Surat' },
  { key: 'fatema', phone: '9888800002', email: 'fatema.test@webohra.test', password: 'TestPass123!', businessName: 'Fatema Beauty Studio', itsId: '10000003', jamaatCity: 'Pune' },
  { key: 'amina', phone: '9888800003', email: 'amina.test@webohra.test', password: 'TestPass123!', businessName: "Amina's Art & Craft Studio", itsId: '10000004', jamaatCity: 'Indore' },
  { key: 'ruqaiya', phone: '9888800004', email: 'ruqaiya.test@webohra.test', password: 'TestPass123!', businessName: 'Ruqaiya Web Studio', itsId: '10000005' },
];

type DemoListing = {
  sellerKey: string;
  subcategorySlug: string;
  title: string;
  description: string;
  shippingMethod: 'self_managed' | 'delhivery';
  shippingEstimateText?: string;
  // Simple listings set `price`; variant-based listings set `variants`
  // instead and leave price undefined — mirrors the seller UI's own
  // branching question (see listings.price's comment in db/schema.ts).
  price?: string;
  variants?: Array<{ name: string; price: string; stockQuantity?: number }>;
  // Keyed by the field's slugified label (same key subcategoryFields.fieldKey
  // uses) — only fields with a value here get seeded; anything omitted is
  // left blank, same as a real seller skipping an optional field.
  fieldValues?: Record<string, string | number | boolean | string[]>;
};

// One listing per subcategory (14 total — Baked Goods gets two, one of them
// the variant-based "choose your type" demo), covering every category and
// both variant-listing shapes (product + service) with real field values so
// a buyer's Details section is never empty during UAT.
const DEMO_LISTINGS: DemoListing[] = [
  {
    sellerKey: 'zainab',
    subcategorySlug: 'baked-goods',
    title: 'Assorted Khari Biscuits (500g)',
    description: 'Freshly baked, flaky khari biscuits — a family recipe, made to order.',
    price: '299.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 2-3 business days',
    fieldValues: {
      ingredients: 'Refined flour, ghee, salt, cumin seeds',
      'veg-non-veg-egg': 'Veg',
      'shelf-life': '15 days at room temperature',
    },
  },
  {
    sellerKey: 'zainab',
    subcategorySlug: 'baked-goods',
    title: 'Roti Basket — Choose Your Type',
    description: 'Fresh-made rotis, priced by type — mix and match Manda, Chapati, and Butter Naan in one order.',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Made fresh to order — delivered within 1-2 days',
    variants: [
      { name: 'Manda', price: '15.00' },
      { name: 'Chapati', price: '12.00' },
      { name: 'Butter Naan', price: '25.00' },
    ],
    fieldValues: {
      ingredients: 'Whole wheat flour, ghee, butter',
      'veg-non-veg-egg': 'Veg',
      'shelf-life': 'Best consumed fresh, within 24 hours',
    },
  },
  {
    sellerKey: 'zainab',
    subcategorySlug: 'snacks-preserves',
    title: 'Homemade Mango Pickle (1kg jar)',
    description: 'Traditional Bohra-style mango pickle, sun-cured and hand-packed.',
    price: '450.00',
    shippingMethod: 'delhivery',
    fieldValues: {
      ingredients: 'Raw mango, mustard oil, fenugreek, red chilli, spices',
      'veg-non-veg-egg': 'Veg',
      'shelf-life': '12 months, unrefrigerated',
    },
  },
  {
    sellerKey: 'sakina',
    subcategorySlug: 'apparel',
    title: 'Hand-Embroidered Rida (Made to Order)',
    description: 'Custom-fit rida with fine hand embroidery, delivered in 2-3 weeks.',
    price: '4500.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 2-3 weeks (made to order)',
    fieldValues: {
      size: 'Free Size',
      'fabric-material': 'Georgette with satin lining',
      color: 'Emerald green',
      'embroidery-work-type': 'Hand embroidery',
      'care-instructions': 'Dry clean only',
    },
  },
  {
    sellerKey: 'sakina',
    subcategorySlug: 'home-textiles',
    title: 'Block-Print Cotton Bedsheet Set',
    description: 'King-size, hand block-printed cotton bedsheet with two pillow covers.',
    price: '1200.00',
    shippingMethod: 'delhivery',
    fieldValues: {
      dimensions: 'King size, 90x108 in + 2 pillow covers',
      'fabric-material': '100% cotton',
      'set-contents': '1 bedsheet + 2 pillow covers',
    },
  },
  {
    sellerKey: 'fatema',
    subcategorySlug: 'mehndi',
    title: 'Mehndi Design — Choose Your Coverage',
    description: 'Traditional and bridal mehndi, priced by how much coverage you need — home visit within city limits.',
    shippingMethod: 'self_managed',
    variants: [
      { name: 'Hands Only', price: '800.00' },
      { name: 'Hands + Feet', price: '1500.00' },
      { name: 'Full Bridal (arms + legs)', price: '3500.00' },
    ],
    fieldValues: {
      style: 'Bridal',
      'coverage-area': 'Full Bridal (arms + legs)',
    },
  },
  {
    sellerKey: 'fatema',
    subcategorySlug: 'makeup',
    title: 'Party Makeup & Hairstyling',
    description: 'Full party makeup with draping and hairstyling, at your venue.',
    price: '2500.00',
    shippingMethod: 'self_managed',
    fieldValues: {
      'products-used': 'HD/Airbrush',
      'trial-available': true,
    },
  },
  {
    sellerKey: 'fatema',
    subcategorySlug: 'imitation-jewellery',
    title: 'Kundan Bridal Jewellery Set',
    description: 'Handcrafted Kundan necklace and earring set, ideal for bridal and reception wear.',
    price: '1800.00',
    shippingMethod: 'delhivery',
    fieldValues: {
      material: 'Kundan',
      type: 'Full set',
      occasion: 'Bridal',
    },
  },
  {
    sellerKey: 'ruqaiya',
    subcategorySlug: 'web-development',
    title: 'Website Package — Choose Your Tier',
    description: 'A website built to fit your budget — from a single landing page to a full e-commerce store, delivered remotely.',
    shippingMethod: 'self_managed',
    variants: [
      { name: 'Landing Page', price: '3000.00' },
      { name: 'Full Website', price: '8000.00' },
      { name: 'E-commerce Site', price: '15000.00' },
    ],
    fieldValues: {
      'deliverable-type': 'Full website',
      'revisions-included': '2 rounds of revisions',
      'tech-stack': 'WordPress / Next.js',
    },
  },
  {
    sellerKey: 'ruqaiya',
    subcategorySlug: 'graphic-design',
    title: 'Logo & Brand Kit Design',
    description: 'Custom logo, color palette, and social media templates, delivered remotely.',
    price: '3500.00',
    shippingMethod: 'self_managed',
    fieldValues: {
      'deliverable-type': 'Full brand identity',
      'file-formats-delivered': ['PNG', 'SVG', 'PDF'],
      'revisions-included': '3 rounds of revisions',
    },
  },
  {
    sellerKey: 'amina',
    subcategorySlug: 'handicrafts',
    title: 'Hand-painted Terracotta Diya Set',
    description: 'Set of 6 hand-painted terracotta diyas, festival-ready.',
    price: '450.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 3-5 business days',
    fieldValues: {
      'material-used': 'Terracotta clay, acrylic paint',
      'craft-technique': 'Hand-painted, sun-dried',
      customizable: true,
    },
  },
  {
    sellerKey: 'amina',
    subcategorySlug: 'home-decor',
    title: 'Macrame Wall Hanging',
    description: 'Handwoven cotton-cord macrame wall hanging with a wooden dowel.',
    price: '950.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 4-6 business days',
    fieldValues: {
      dimensions: '24 x 36 inches',
      material: 'Cotton cord, wooden dowel',
      placement: 'Wall',
    },
  },
  {
    sellerKey: 'amina',
    subcategorySlug: 'paintings-art',
    title: 'Mughal Miniature-Style Canvas Painting',
    description: 'Original acrylic painting on canvas, inspired by Mughal miniature art.',
    price: '2200.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 5-7 business days, carefully packed',
    fieldValues: {
      medium: 'Acrylic',
      dimensions: '16 x 20 inches',
      framed: true,
    },
  },
  {
    sellerKey: 'amina',
    subcategorySlug: 'personalized-gift-items',
    title: 'Personalized Name Calligraphy Frame',
    description: 'A custom calligraphy print of any name or date, in Arabic or English, framed and ready to gift.',
    price: '650.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 5-7 business days (made to order)',
    fieldValues: {
      'customization-details': 'Any name or date, Arabic or English calligraphy',
      'turnaround-time': '5-7 business days',
      material: 'Wood frame, matte print',
    },
  },
];

// Admin-managed homepage slider (see /api/admin/banners) — starter set.
const BANNER_SEED: Array<{
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  colorHex: string;
  sortOrder: number;
}> = [
  {
    heading: 'Discover Bohra Women-Owned Businesses',
    subheading: 'Food, Textile, Beauty & Occasion, IT & Services, and more.',
    ctaLabel: 'Shop now',
    ctaHref: '/search',
    colorHex: '#1B3A6B',
    sortOrder: 0,
  },
  {
    heading: 'Pickup & Pay Near You',
    subheading: 'Skip shipping — arrange to collect and pay the seller in person.',
    ctaLabel: 'Learn more',
    ctaHref: '/faq',
    colorHex: '#1F5C55',
    sortOrder: 1,
  },
];

async function seed() {
  const subcategoryIdBySlug = new Map<string, number>();
  const jamaatIdByCity = new Map<string, number>();
  // fieldId lookup, keyed "<subcategoryId>:<fieldKey>" — filled in as fields
  // are seeded below, then used to resolve DEMO_LISTINGS' fieldValues.
  const fieldIdByKey = new Map<string, number>();

  for (const cat of CATEGORY_SEED) {
    const [category] = await db
      .insert(categories)
      .values({ name: cat.name, slug: cat.slug })
      .onConflictDoUpdate({ target: categories.slug, set: { name: cat.name } })
      .returning();

    for (const sub of cat.subcategories) {
      const [subcategory] = await db
        .insert(subcategories)
        .values({
          categoryId: category.id,
          name: sub.name,
          slug: sub.slug,
          listingType: sub.listingType,
        })
        .onConflictDoUpdate({
          target: subcategories.slug,
          set: { name: sub.name, listingType: sub.listingType, categoryId: category.id },
        })
        .returning();
      subcategoryIdBySlug.set(sub.slug, subcategory.id);
    }

    console.log(`Seeded "${cat.name}" with ${cat.subcategories.length} subcategories.`);
  }

  let fieldCount = 0;
  for (const [slug, fields] of Object.entries(FIELD_SEED)) {
    const subcategoryId = subcategoryIdBySlug.get(slug);
    if (!subcategoryId) continue; // subcategory wasn't in CATEGORY_SEED — skip rather than fail the whole run
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const fieldKey = slugifyTitle(field.label);
      const [row] = await db
        .insert(subcategoryFields)
        .values({
          subcategoryId,
          label: field.label,
          fieldKey,
          fieldType: field.fieldType,
          required: field.required ?? false,
          options: field.options ?? null,
          sortOrder: i,
        })
        .onConflictDoUpdate({
          target: [subcategoryFields.subcategoryId, subcategoryFields.fieldKey],
          set: {
            label: field.label,
            required: field.required ?? false,
            options: field.options ?? null,
            sortOrder: i,
          },
        })
        .returning();
      fieldIdByKey.set(`${subcategoryId}:${fieldKey}`, row.id);
      fieldCount += 1;
    }
  }
  console.log(`Seeded ${fieldCount} subcategory fields across ${Object.keys(FIELD_SEED).length} subcategories.`);

  for (const jamaat of JAMAAT_SEED) {
    // onConflictDoUpdate (rather than DoNothing) so .returning() always gives
    // back the row's id, whether this run inserted or already existed.
    const [row] = await db
      .insert(jamaats)
      .values(jamaat)
      .onConflictDoUpdate({ target: [jamaats.city, jamaats.name], set: { active: true } })
      .returning();
    jamaatIdByCity.set(jamaat.city, row.id);
  }
  console.log(`Seeded ${JAMAAT_SEED.length} jamaats.`);

  // webohra_offices has no natural unique key (no city+name constraint like
  // jamaats), so idempotency here is "does one with this exact name already
  // exist" — same check-then-skip pattern DEMO_LISTINGS/BANNER_SEED already
  // use below for the same reason.
  let officeCount = 0;
  for (const office of WEBOHRA_OFFICE_SEED) {
    let officeId: number;
    const [existingOffice] = await db.select().from(webohraOffices).where(eq(webohraOffices.name, office.name));
    if (existingOffice) {
      officeId = existingOffice.id;
    } else {
      const [created] = await db.insert(webohraOffices).values(office).returning();
      officeId = created.id;
      officeCount += 1;
    }
    const jamaatId = jamaatIdByCity.get(office.city);
    if (jamaatId) {
      await db.update(jamaats).set({ officeId }).where(eq(jamaats.id, jamaatId));
    }
  }
  console.log(`Seeded ${officeCount} WeBohra offices, mapped to their city's jamaat.`);

  const subscriptionPlanIdByKey = new Map<string, number>();
  for (const plan of SUBSCRIPTION_PLAN_SEED) {
    const { sellerType, tierKey, maxActiveListings, ...rest } = plan;
    const [row] = await db
      .insert(subscriptionPlans)
      .values({ sellerType, tierKey, maxActiveListings: maxActiveListings ?? null, ...rest })
      .onConflictDoUpdate({
        target: [subscriptionPlans.sellerType, subscriptionPlans.tierKey],
        set: { maxActiveListings: maxActiveListings ?? null, ...rest },
      })
      .returning();
    subscriptionPlanIdByKey.set(`${sellerType}:${tierKey}`, row.id);
  }
  console.log(`Seeded ${SUBSCRIPTION_PLAN_SEED.length} subscription plans.`);

  const [existingSettings] = await db.select().from(subscriptionSettings).limit(1);
  const productBasicPlanId = subscriptionPlanIdByKey.get('product:basic') ?? null;
  if (existingSettings) {
    await db
      .update(subscriptionSettings)
      .set({ rechargeDefaultPlanId: productBasicPlanId, updatedAt: new Date() })
      .where(eq(subscriptionSettings.id, existingSettings.id));
  } else {
    await db.insert(subscriptionSettings).values({ rechargeDefaultPlanId: productBasicPlanId });
  }
  console.log('Seeded subscription settings (recharge defaults to Product Basic).');

  const sellerIdByKey = new Map<string, number>();
  for (const seller of DEMO_SELLERS) {
    const passwordHash = seller.password ? hashPassword(seller.password) : undefined;
    const [row] = await db
      .insert(users)
      .values({
        phone: seller.phone,
        email: seller.email,
        passwordHash,
        phoneVerified: true,
        itsId: seller.itsId,
        itsVerified: true,
      })
      .onConflictDoUpdate({
        target: users.phone,
        // passwordHash is only ever included in the update when this
        // seller actually has a `password` above — omitting the key
        // entirely (rather than setting it to undefined) leaves an
        // existing hash alone, which is what keeps zainab's untouched.
        set: {
          itsVerified: true,
          phoneVerified: true,
          email: seller.email,
          ...(passwordHash && { passwordHash }),
        },
      })
      .returning();
    sellerIdByKey.set(seller.key, row.id);

    const jamaatId = seller.jamaatCity ? (jamaatIdByCity.get(seller.jamaatCity) ?? null) : null;
    await db
      .insert(sellerProfiles)
      .values({ userId: row.id, businessName: seller.businessName, jamaatId })
      .onConflictDoUpdate({
        target: sellerProfiles.userId,
        set: { businessName: seller.businessName, jamaatId },
      });
  }
  console.log(`Seeded ${DEMO_SELLERS.length} demo sellers.`);

  let listingCount = 0;
  let variantCount = 0;
  for (const listing of DEMO_LISTINGS) {
    const subcategoryId = subcategoryIdBySlug.get(listing.subcategorySlug);
    const sellerId = sellerIdByKey.get(listing.sellerKey);
    if (!subcategoryId || !sellerId) continue;

    const [alreadyExists] = await db
      .select()
      .from(listings)
      .where(eq(listings.title, listing.title));
    if (alreadyExists) continue;

    const [created] = await db
      .insert(listings)
      .values({
        slug: slugifyTitle(listing.title),
        sellerId,
        subcategoryId,
        title: listing.title,
        description: listing.description,
        // undefined here means "variant-based, no single price" — same
        // convention as POST /api/listings.
        price: listing.price ?? null,
        shippingMethod: listing.shippingMethod,
        shippingEstimateText: listing.shippingMethod === 'self_managed' ? listing.shippingEstimateText : null,
        status: 'active',
      })
      .returning();
    listingCount += 1;

    if (listing.variants) {
      for (let i = 0; i < listing.variants.length; i++) {
        const variant = listing.variants[i];
        await db.insert(listingVariants).values({
          listingId: created.id,
          name: variant.name,
          price: variant.price,
          stockQuantity: variant.stockQuantity ?? null,
          sortOrder: i,
        });
        variantCount += 1;
      }
    }

    if (listing.fieldValues) {
      const values = Object.entries(listing.fieldValues)
        .map(([fieldKey, value]) => {
          const fieldId = fieldIdByKey.get(`${subcategoryId}:${fieldKey}`);
          return fieldId ? { fieldId, value } : null;
        })
        .filter((v): v is { fieldId: number; value: string | number | boolean | string[] } => v !== null);
      await saveFieldValues(created.id, subcategoryId, values);
    }
  }
  console.log(`Seeded ${listingCount} demo listings (${variantCount} variants) across ${DEMO_SELLERS.length} sellers.`);

  for (const banner of BANNER_SEED) {
    const [alreadyExists] = await db
      .select()
      .from(banners)
      .where(eq(banners.heading, banner.heading));
    if (alreadyExists) continue;
    await db.insert(banners).values(banner);
  }
  console.log(`Seeded ${BANNER_SEED.length} banners.`);

  console.log('Done.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
