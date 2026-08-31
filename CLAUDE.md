# WE Bohra — Website, Seller Portal, Admin, API

## What this is

Next.js app powering three surfaces: public website, Seller Portal
(/seller), Admin Panel (/admin). Also owns every API route consumed
by this app AND by webohra-app (separate repo, see parent CLAUDE.md).

## Tech stack

- Next.js (App Router), deployed on Vercel
- Neon Postgres via Drizzle ORM
- Cloudflare R2 for listing photos
- Upstash Redis for rate limiting/cache
- MSG91 for OTP (buyer registration) and seller notifications
- JWT-based auth (not cookies) — same token mechanism the app uses

## Route structure

- app/(site)/ — public pages: browse, search, PDP/SDP
- app/seller/ — registration, listing creation, enquiry dashboard
- app/admin/ — category config, seller verification, moderation
- app/api/ — every endpoint, written as if a standalone external API

## The one non-negotiable rule

Pages never call the database directly. Every read/write goes
through /api. This is what lets webohra-app consume identical logic
with zero duplication — don't break it for a shortcut.

## Data model essentials

- users — role capabilities, not exclusive: phone_verified (buyer),
  its_verified (seller), staff_role (customer_support/admin/
  super_admin, nullable)
- categories/subcategories — admin-configurable, each subcategory
  has a listing_type: physical_product, local_service, or
  remote_service
- listings, enquiries, listing_pins

## Contact model (current, deliberately simple)

Registered buyers only can initiate contact — "Contact Seller"
(products) or "Take Consultation" (services) — opens WhatsApp
direct to the seller's own registered number. No relay, no masking,
in the current build. A fully masked relay design exists as a
documented contingency — do not build it unless explicitly asked.

## Guest vs. registered buyers

Guests: browse, search, Pin a listing. Cannot contact a seller.
Registered: everything above, plus Contact Seller/Take Consultation.
OTP verification happens once, at registration — not per request.

## Admin/staff routes

Every /admin route and /api/admin/\* endpoint must check staff_role
server-side — never just hide a UI button.

## Theming — navy, not wine

Brand tone shifted deliberately toward Al-Tijaarat Al-Raabehah's own
navy + gold, not a coincidence — check with the project owner before
reverting any color choice that looks "off."

Colors live in app/globals.css as CSS variables, and are mirrored in
tailwind.config.js under theme.extend.colors. Never hardcode a hex
value in a component — always use the semantic token
(--color-primary, --color-accent, etc.), never the raw color name,
so a future palette change stays a one-file edit.

Primary (navy): #1B3A6B · hover/pressed: #12294D
Accent (gold): #B08D3F · soft: #D9BE84
Verified/trust (teal): #1F5C55 · deep: #153F3A
Background (ivory): #F7F1E6 · surface: #EFE4CE
Text (ink): #2A1D16 · soft: #5C4C3F
Headings: Fraunces · Body: Karla — loaded via next/font/google

## Reference docs

Full functional requirements: docs/SRS.md
Business context and team plan: docs/Requirements_Brief.md
Read these when a task needs detail beyond what's summarized above
— don't assume the summary here is complete.

## Keep theme values in sync with webohra-app

If any color or font value changes here, the equivalent value in
webohra-app's theme.ts must change too, in the same session — these
two files must never quietly drift apart, same discipline as the
API contract.
