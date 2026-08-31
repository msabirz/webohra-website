import { eq } from 'drizzle-orm';
import { db } from './index';
import {
  categories,
  subcategories,
  jamaats,
  users,
  sellerProfiles,
  listings,
  banners,
} from './schema';
import { slugifyTitle } from '../lib/ids';

/**
 * Seed data for 4 of the 5 Phase-1 categories: Food, Textile, Beauty &
 * Occasion, and IT & Services, each with 2 subcategories. Mehndi and Makeup
 * are the two local_service subcategories called out in the original spec
 * (they live under Beauty & Occasion); IT & Services' two are remote_service
 * (delivered online, not shipped or visited in person); everything else here
 * is physical_product.
 *
 * Art & Craft is intentionally left for a later pass.
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
];

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
