import { eq } from 'drizzle-orm';
import { db } from './index';
import { slugifyTitle } from '../lib/ids';
import {
  categories,
  subcategories,
  subcategoryFields,
  jamaats,
  users,
  sellerProfiles,
  listings,
  banners,
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
const CATEGORY_SEED: Array<{
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

// A verified demo seller so the site has real, browsable listings out of the
// box. its_verified: true here simulates a completed Admin review — real
// self-registered sellers start unverified (see /api/sellers/register).
const DEMO_SELLER = {
  phone: '9999999999',
  businessName: "Zainab's Kitchen",
};

const DEMO_LISTINGS: Array<{
  subcategorySlug: string;
  title: string;
  description: string;
  price: string;
  shippingMethod: 'self_managed' | 'delhivery';
  shippingEstimateText?: string;
}> = [
  {
    subcategorySlug: 'baked-goods',
    title: 'Assorted Khari Biscuits (500g)',
    description: 'Freshly baked, flaky khari biscuits — a family recipe, made to order.',
    price: '299.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 2-3 business days',
  },
  {
    subcategorySlug: 'snacks-preserves',
    title: 'Homemade Mango Pickle (1kg jar)',
    description: 'Traditional Bohra-style mango pickle, sun-cured and hand-packed.',
    price: '450.00',
    shippingMethod: 'delhivery',
  },
  {
    subcategorySlug: 'apparel',
    title: 'Hand-Embroidered Rida (Made to Order)',
    description: 'Custom-fit rida with fine hand embroidery, delivered in 2-3 weeks.',
    price: '4500.00',
    shippingMethod: 'self_managed',
    shippingEstimateText: 'Ships within 2-3 weeks (made to order)',
  },
  {
    subcategorySlug: 'home-textiles',
    title: 'Block-Print Cotton Bedsheet Set',
    description: 'King-size, hand block-printed cotton bedsheet with two pillow covers.',
    price: '1200.00',
    shippingMethod: 'delhivery',
  },
  {
    subcategorySlug: 'mehndi',
    title: 'Bridal Mehndi (Both Hands & Feet)',
    description: 'Traditional bridal mehndi design, home visit within city limits.',
    price: '3500.00',
    shippingMethod: 'self_managed',
  },
  {
    subcategorySlug: 'makeup',
    title: 'Party Makeup & Hairstyling',
    description: 'Full party makeup with draping and hairstyling, at your venue.',
    price: '2500.00',
    shippingMethod: 'self_managed',
  },
  {
    subcategorySlug: 'web-development',
    title: 'WordPress Website Setup',
    description: 'Custom WordPress website, up to 5 pages, mobile-responsive, delivered remotely.',
    price: '8000.00',
    shippingMethod: 'self_managed',
  },
  {
    subcategorySlug: 'graphic-design',
    title: 'Logo & Brand Kit Design',
    description: 'Custom logo, color palette, and social media templates, delivered remotely.',
    price: '3500.00',
    shippingMethod: 'self_managed',
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
      await db
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
        });
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

  const [demoSeller] = await db
    .insert(users)
    .values({
      phone: DEMO_SELLER.phone,
      phoneVerified: true,
      itsId: '10000001',
      itsVerified: true,
    })
    .onConflictDoUpdate({
      target: users.phone,
      set: { itsVerified: true, phoneVerified: true },
    })
    .returning();

  // Gives the demo seller a Mumbai pickup point so /nearby has something
  // real to show out of the box, rather than every city coming up empty.
  const demoJamaatId = jamaatIdByCity.get('Mumbai') ?? null;

  await db
    .insert(sellerProfiles)
    .values({ userId: demoSeller.id, businessName: DEMO_SELLER.businessName, jamaatId: demoJamaatId })
    .onConflictDoUpdate({
      target: sellerProfiles.userId,
      set: { businessName: DEMO_SELLER.businessName, jamaatId: demoJamaatId },
    });

  for (const listing of DEMO_LISTINGS) {
    const subcategoryId = subcategoryIdBySlug.get(listing.subcategorySlug);
    if (!subcategoryId) continue;

    const [alreadyExists] = await db
      .select()
      .from(listings)
      .where(eq(listings.title, listing.title));
    if (alreadyExists) continue;

    await db.insert(listings).values({
      slug: slugifyTitle(listing.title),
      sellerId: demoSeller.id,
      subcategoryId,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      shippingMethod: listing.shippingMethod,
      shippingEstimateText: listing.shippingEstimateText,
      status: 'active',
    });
  }
  console.log(`Seeded ${DEMO_LISTINGS.length} demo listings for "${DEMO_SELLER.businessName}".`);

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
