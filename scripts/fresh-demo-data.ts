/**
 * Wipes every seller, buyer, and their ITS/transaction history, then
 * reseeds a clean, realistic demo dataset: 8 sellers (2 listings per
 * category, 10 total, spread across all 5 categories), 10 buyer
 * profiles, and a new "Free" tier (both seller types) that every fresh
 * seller starts on — so plan-switching can be tested from a known
 * baseline. Master/config data (categories, subcategories,
 * subcategory_fields, jamaats, webohra_offices, existing paid
 * subscription_plans, subscription_settings, staff/admin accounts) is
 * left completely untouched.
 *
 * No transactional data is created — no orders, payouts, refunds,
 * disputes, enquiries, wallet activity. Just master data + fresh
 * sellers/listings/buyers, ready for the user to generate real activity
 * against by hand.
 *
 * Product photos: each listing's primary photo is a real, subject-matched
 * Creative Commons image, hand-picked from Wikimedia Commons (searched via
 * its public API, no key needed) — e.g. a genuine "Mango Pickle in pot"
 * photo for the mango pickle listing, not a generic stock shot. Stored as
 * the resolved, direct upload.wikimedia.org CDN URL (see ListingSeed's
 * own comment on why, not the commons.wikimedia.org/wiki/Special:FilePath
 * redirect a naive filename-based approach would use) — verified to
 * actually resolve before being hardcoded here. The second photo on each
 * listing is still a random Picsum (CC0, no keyword search) image, purely
 * for visual variety.
 *
 * Usage: npx tsx scripts/fresh-demo-data.ts
 */
import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import {
  users,
  listings,
  listingImages,
  listingFieldValues,
  sellerProfiles,
  sellerSubscriptions,
  subscriptionPlans,
  payouts,
  orders,
  otpCodes,
  banners,
} from '../db/schema';
import { hashPassword } from '../lib/password';
import { slugifyTitle } from '../lib/ids';

const PASSWORD = 'TestPass123!';

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------
async function wipe() {
  console.log('--- Wiping seller/buyer data ---');
  const deletedPayouts = await db.delete(payouts).returning({ id: payouts.id });
  console.log(`Deleted ${deletedPayouts.length} payouts.`);

  // Cascades: order_items, refunds, disputes (-> dispute_comments), shipments.
  const deletedOrders = await db.delete(orders).returning({ id: orders.id });
  console.log(`Deleted ${deletedOrders.length} orders and everything hanging off them.`);

  // Cascades (see db/schema.ts's FK graph, all onDelete:'cascade' from
  // users): seller_profiles, listings (-> listing_variants/images/field
  // values), enquiries, pickup_requests, whatsapp_contacts, listing_pins,
  // seller_ship_cities, seller_wallets (-> wallet_transactions),
  // seller_subscriptions, seller_payout_accounts, portfolio_items.
  const deletedUsers = await db
    .delete(users)
    .where(isNull(users.staffRole))
    .returning({ id: users.id, email: users.email });
  console.log(`Deleted ${deletedUsers.length} non-staff users (sellers + buyers) and everything owned by them.`);

  await db.delete(otpCodes);
  console.log('Cleared OTP codes.');

  const deletedBanners = await db
    .delete(banners)
    .where(eq(banners.heading, 'Looking something Quick??'))
    .returning({ id: banners.id });
  console.log(`Removed ${deletedBanners.length} stray test banner(s).`);
}

// ---------------------------------------------------------------------------
// Free plan (created once, reused if this script runs again)
// ---------------------------------------------------------------------------
async function ensureFreePlans() {
  const existingProduct = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.tierKey, 'free'));
  const existingProductFree = existingProduct.find((p) => p.sellerType === 'product');
  const existingServiceFree = existingProduct.find((p) => p.sellerType === 'service');

  const productFree =
    existingProductFree ??
    (
      await db
        .insert(subscriptionPlans)
        .values({
          sellerType: 'product',
          tierKey: 'free',
          name: 'Free',
          monthlyPrice: '0.00',
          maxActiveListings: 1,
          allowsPickupAndPay: false,
          pickupOfficeOption: false,
          allowsDelhivery: false,
          prioritySupport: false,
          remindersEnabled: false,
          contactMode: null,
          bonusOtherCategoryListings: 0,
          active: true,
          sortOrder: -1,
        })
        .returning()
    )[0];

  const serviceFree =
    existingServiceFree ??
    (
      await db
        .insert(subscriptionPlans)
        .values({
          sellerType: 'service',
          tierKey: 'free',
          name: 'Free',
          monthlyPrice: '0.00',
          maxActiveListings: 1,
          allowsPickupAndPay: false,
          pickupOfficeOption: false,
          allowsDelhivery: false,
          prioritySupport: false,
          remindersEnabled: false,
          // Safest default (no number exposed) for the tier with no paid
          // feature backing it — same fallback lib/subscriptions.ts's
          // callers already use when nothing else is resolved.
          contactMode: 'masked_relay',
          bonusOtherCategoryListings: 0,
          active: true,
          sortOrder: -1,
        })
        .returning()
    )[0];

  console.log(`Free plans ready: product #${productFree.id}, service #${serviceFree.id}.`);
  return { productFree, serviceFree };
}

// ---------------------------------------------------------------------------
// Seller + listing seed data
// ---------------------------------------------------------------------------
type ListingSeed = {
  subcategoryId: number;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  title: string;
  description: string;
  price: number;
  /** The real, subject-matched primary photo's direct
   *  upload.wikimedia.org CDN URL — resolved once (via Commons'
   *  imageinfo API) and hardcoded here rather than stored as a filename
   *  + Special:FilePath redirect, since that redirect endpoint is a
   *  MediaWiki app endpoint with a real per-IP rate limit (confirmed:
   *  600s cooldown after enough requests), unlike upload.wikimedia.org
   *  itself, which is the dedicated media CDN built for exactly this
   *  kind of public hotlinking at scale. */
  commonsImageUrl: string;
  /** Picsum seed for the second, purely-for-variety photo. */
  imageSeed: string;
  fields: { fieldId: number; value: unknown }[];
};

type SellerSeed = {
  name: string;
  businessName: string;
  phone: string;
  email: string;
  jamaatId: number;
  city: string;
  state: string;
  pincode: string;
  sellerType: 'product' | 'service';
  listings: ListingSeed[];
};

// Field ids resolved directly from subcategory_fields (see this script's
// own commit message / session notes for how they were looked up) —
// stable ids, cheap to hardcode for a one-shot seed script like this.
const SELLERS: SellerSeed[] = [
  {
    name: 'Zainab Burhan',
    businessName: "Zainab's Kitchen",
    phone: '9800000001',
    email: 'zainab.demo@webohra.test',
    jamaatId: 1,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400002',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 2, // Snacks & Preserves
        listingType: 'physical_product',
        title: 'Mango Pickle (500g)',
        description: 'Traditional home-style mango pickle, sun-cured with a family spice blend passed down three generations. No preservatives.',
        price: 250,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Mango_Pickle_in_pot.jpg',
        imageSeed: 'mango-pickle-demo',
        fields: [
          { fieldId: 4, value: 'Raw mango, mustard oil, fenugreek, red chilli powder, salt, turmeric' },
          { fieldId: 5, value: 'Veg' },
          { fieldId: 6, value: '6 months, refrigerate after opening' },
        ],
      },
    ],
  },
  {
    name: 'Fatema Rangwala',
    businessName: "Fatema's Sweet Treats",
    phone: '9800000002',
    email: 'fatema.demo@webohra.test',
    jamaatId: 2,
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395003',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 1, // Baked Goods
        listingType: 'physical_product',
        title: 'Assorted Mithai Box',
        description: 'A festive box of 12 handmade mithai — kaju katli, motichoor ladoo, and coconut barfi, made fresh to order.',
        price: 450,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Mithai_1.jpg',
        imageSeed: 'mithai-box-demo',
        fields: [
          { fieldId: 1, value: 'Cashew, sugar, ghee, cardamom, khoya, coconut' },
          { fieldId: 2, value: 'Veg' },
          { fieldId: 3, value: '5 days at room temperature, 2 weeks refrigerated' },
        ],
      },
    ],
  },
  {
    name: 'Rukaiya Saifee',
    businessName: "Rukaiya's Textile House",
    phone: '9800000003',
    email: 'rukaiya.demo@webohra.test',
    jamaatId: 3,
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 4, // Home Textiles
        listingType: 'physical_product',
        title: 'Block-Print Cotton Bedsheet Set',
        description: 'Hand block-printed 100% cotton bedsheet with two pillow covers, in a traditional Ajrakh-inspired indigo print.',
        price: 1200,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Pillowcase%2C_set_%28AM_1996.72.35-2%29.jpg',
        imageSeed: 'bedsheet-demo',
        fields: [
          { fieldId: 13, value: '90x108 inches (double bed) + 2x 17x27 inch pillow covers' },
          { fieldId: 14, value: '100% cotton, 180 thread count' },
        ],
      },
      {
        subcategoryId: 3, // Apparel
        listingType: 'physical_product',
        title: 'Embroidered Silk Dupatta',
        description: 'Pure silk dupatta with hand zari embroidery along the border, finished with tassels — a versatile piece for festive wear.',
        price: 1800,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/37/LWID1P2MP6071106_Grey_Hand_Embroidered_Parsi_Crepe_Multicolor_Thread_Work_Dupatta_400x.jpg',
        imageSeed: 'dupatta-demo',
        fields: [
          { fieldId: 7, value: 'Free Size' },
          { fieldId: 8, value: 'Pure silk' },
          { fieldId: 9, value: 'Maroon with gold zari' },
          { fieldId: 10, value: 'Zari' },
        ],
      },
    ],
  },
  {
    name: 'Amina Vora',
    businessName: "Amina's Art & Craft Studio",
    phone: '9800000004',
    email: 'amina.demo@webohra.test',
    jamaatId: 1,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400003',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 50, // Handicrafts
        listingType: 'physical_product',
        title: 'Hand-painted Terracotta Diya Set',
        description: 'Set of 6 terracotta diyas, hand-painted with traditional motifs in gold and red — perfect for festive décor.',
        price: 450,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Decorative_clay_lamp_during_Diwali_%28November_2018%29.jpg',
        imageSeed: 'diya-set-demo',
        fields: [{ fieldId: 29, value: 'Terracotta clay, acrylic paint' }],
      },
    ],
  },
  {
    name: 'Sakina Poonawala',
    businessName: "Sakina's Jewellery Corner",
    phone: '9800000005',
    email: 'sakina.demo@webohra.test',
    jamaatId: 4,
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 47, // Imitation Jewellery
        listingType: 'physical_product',
        title: 'Kundan Bridal Jewellery Set',
        description: 'A full Kundan bridal set — necklace, earrings, and maang tikka — with a pearl-drop finish, gift-boxed.',
        price: 3500,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Kundan_jadai_work.jpg',
        imageSeed: 'kundan-jewellery-demo',
        fields: [
          { fieldId: 20, value: 'Kundan' },
          { fieldId: 21, value: 'Full set' },
        ],
      },
    ],
  },
  {
    name: 'Zoya Kapadia',
    businessName: 'Henna by Zoya',
    phone: '9800000006',
    email: 'zoya.demo@webohra.test',
    jamaatId: 2,
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395004',
    sellerType: 'service',
    listings: [
      {
        subcategoryId: 5, // Mehndi
        listingType: 'local_service',
        title: 'Bridal Mehndi Design',
        description: 'Intricate bridal mehndi with fine detailing, personalized motifs, and a rich, long-lasting stain — booked in advance for wedding season.',
        price: 1500,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Bridal_mehndi_%28henna%29_is_a_central_wedding_tradition_01.jpg',
        imageSeed: 'bridal-mehndi-demo',
        fields: [{ fieldId: 16, value: 'Bridal' }],
      },
    ],
  },
  {
    name: 'Ruqaiya Dholkawala',
    businessName: 'Ruqaiya Web Studio',
    phone: '9800000007',
    email: 'ruqaiya.demo@webohra.test',
    jamaatId: 3,
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411002',
    sellerType: 'service',
    listings: [
      {
        subcategoryId: 31, // Web Development
        listingType: 'remote_service',
        title: 'Business Website Design',
        description: 'A complete, responsive business website — up to 5 pages, mobile-optimized, with a contact form and basic SEO setup.',
        price: 8000,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Code_on_computer_monitor_%28Unsplash%29.jpg',
        imageSeed: 'web-design-demo',
        fields: [
          { fieldId: 23, value: 'Full website' },
          { fieldId: 24, value: '2 rounds included' },
        ],
      },
      {
        subcategoryId: 32, // Graphic Design
        listingType: 'remote_service',
        title: 'Logo & Brand Kit Design',
        description: 'A complete brand identity — logo, color palette, and a starter social media kit, delivered in every format you need.',
        price: 2500,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Logo_design_branding.jpg',
        imageSeed: 'logo-design-demo',
        fields: [{ fieldId: 26, value: 'Full brand identity' }],
      },
    ],
  },
  {
    name: 'Noorbanu Electricwala',
    businessName: "Noorbanu's Wall Art",
    phone: '9800000008',
    email: 'noorbanu.demo@webohra.test',
    jamaatId: 4,
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452002',
    sellerType: 'product',
    listings: [
      {
        subcategoryId: 52, // Paintings & Art
        listingType: 'physical_product',
        title: 'Custom Calligraphy Wall Art',
        description: 'A hand-painted calligraphy piece, customizable text and color palette, ready to hang — makes a striking centerpiece.',
        price: 1800,
        commonsImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Arabic_Calligraphy_-_Mohammad_Hashem_-_Islamic_Consultative_Assembly_Museum_of_Iran.jpg',
        imageSeed: 'calligraphy-art-demo',
        fields: [
          { fieldId: 35, value: 'Calligraphy/Ink' },
          { fieldId: 36, value: '18x24 inches, canvas' },
        ],
      },
    ],
  },
];

const BUYERS = [
  { name: 'Ayesha Merchant', phone: '9700000001', email: 'ayesha.demo@webohra.test' },
  { name: 'Bilkis Contractor', phone: '9700000002', email: 'bilkis.demo@webohra.test' },
  { name: 'Farida Kapasi', phone: '9700000003', email: 'farida.demo@webohra.test' },
  { name: 'Gulnaz Batliwala', phone: '9700000004', email: 'gulnaz.demo@webohra.test' },
  { name: 'Husaina Najmi', phone: '9700000005', email: 'husaina.demo@webohra.test' },
  { name: 'Imtiaz Lokhandwala', phone: '9700000006', email: 'imtiaz.demo@webohra.test' },
  { name: 'Juzer Saifuddin', phone: '9700000007', email: 'juzer.demo@webohra.test' },
  { name: 'Khadija Attarwala', phone: '9700000008', email: 'khadija.demo@webohra.test' },
  { name: 'Liyakat Kadiwala', phone: '9700000009', email: 'liyakat.demo@webohra.test' },
  { name: 'Mustafa Vhora', phone: '9700000010', email: 'mustafa.demo@webohra.test' },
];

async function seedSellers(productFreeId: number, serviceFreeId: number) {
  console.log('\n--- Creating sellers + listings ---');
  const passwordHash = hashPassword(PASSWORD);

  for (const seller of SELLERS) {
    const [user] = await db
      .insert(users)
      .values({
        phone: seller.phone,
        phoneVerified: true,
        name: seller.name,
        email: seller.email,
        passwordHash,
        itsId: `10${seller.phone.slice(-6)}`,
        itsVerified: true,
      })
      .returning();

    await db.insert(sellerProfiles).values({
      userId: user.id,
      businessName: seller.businessName,
      jamaatId: seller.jamaatId,
      addressLine1: `${seller.businessName}, Shop 1`,
      city: seller.city,
      state: seller.state,
      pincode: seller.pincode,
    });

    await db.insert(sellerSubscriptions).values({
      sellerId: user.id,
      sellerType: seller.sellerType,
      billingMode: 'plan',
      planId: seller.sellerType === 'product' ? productFreeId : serviceFreeId,
      status: 'active',
    });

    for (const l of seller.listings) {
      const slug = slugifyTitle(l.title) + '-' + user.id;
      const [listing] = await db
        .insert(listings)
        .values({
          slug,
          sellerId: user.id,
          subcategoryId: l.subcategoryId,
          title: l.title,
          description: l.description,
          price: l.price.toFixed(2),
          shippingMethod: 'self_managed',
          selfShipCharge: l.listingType === 'physical_product' ? '60.00' : '0.00',
          status: 'active',
          stockQuantity: l.listingType === 'physical_product' ? 20 : null,
        })
        .returning();

      await db.insert(listingImages).values([
        { listingId: listing.id, url: l.commonsImageUrl, sortOrder: 0 },
        { listingId: listing.id, url: `https://picsum.photos/seed/${l.imageSeed}-2/800/600`, sortOrder: 1 },
      ]);

      if (l.fields.length > 0) {
        await db.insert(listingFieldValues).values(l.fields.map((f) => ({ listingId: listing.id, ...f })));
      }
    }

    console.log(`  ${seller.businessName} (${seller.email}) — ${seller.listings.length} listing(s)`);
  }
}

async function seedBuyers() {
  console.log('\n--- Creating buyer profiles ---');
  const passwordHash = hashPassword(PASSWORD);
  for (const buyer of BUYERS) {
    await db.insert(users).values({
      phone: buyer.phone,
      phoneVerified: true,
      name: buyer.name,
      email: buyer.email,
      passwordHash,
    });
    console.log(`  ${buyer.name} (${buyer.email})`);
  }
}

async function main() {
  await wipe();
  const { productFree, serviceFree } = await ensureFreePlans();
  await seedSellers(productFree.id, serviceFree.id);
  await seedBuyers();

  console.log('\n=== DONE ===');
  console.log(`Shared password for every account below: ${PASSWORD}\n`);

  console.log('SELLERS (login at /seller/login with email + password):');
  for (const s of SELLERS) {
    console.log(`  ${s.businessName.padEnd(28)} ${s.email.padEnd(30)} ${s.sellerType}, Free plan, ${s.city}`);
  }

  console.log('\nBUYERS (login at /login with email + password):');
  for (const b of BUYERS) {
    console.log(`  ${b.name.padEnd(24)} ${b.email}`);
  }

  console.log('\nAdmin/staff accounts were left untouched — sign in as before.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
