# WE Bohra — Software Requirements Specification (SRS)
## Phase 1

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for Phase 1 of WE Bohra — a platform connecting Bohra women-owned businesses with buyers, launching as a website, mobile app, seller portal, and admin panel. It is derived directly from the locked Requirements Brief and is the reference for design, development, and QA.

### 1.2 Scope
Phase 1 covers five categories (Food, Art & Craft, IT & Services, Textile, Beauty & Occasion), WhatsApp-based ordering for physical products and in-app "Take Consultation" requests for services (no in-app payment), India-only operation with a currency/country architecture built for future expansion, and customer-support-assisted seller onboarding. Full scope boundaries are in Section 8.

### 1.3 Definitions
- **ITS ID** — the Bohra community's individual identity number, used here for seller verification.
- **Women-owned badge** — auto-applied when a listing is registered under the seller's own ITS ID.
- **Nearby-first ranking** — the default search/discovery order: nearby sellers, then same-country, then cross-border (Phase III).
- **PDP** — Product Detail Page, the listing page for `physical_product` listings.
- **SDP** — Service Detail Page, the listing page for `local_service` and `remote_service` listings.

---

## 2. Overall Description

### 2.1 Product Perspective
A new, standalone system: one shared backend API serving four clients — public website, mobile app (React Native), seller portal, and admin panel.

### 2.2 User Classes
| User class | Description |
|---|---|
| Buyer (guest) | Anyone, anywhere — browses, searches, views listings, and can **Pin** a listing to express interest. Cannot initiate contact with a seller. |
| Buyer (registered) | All guest capabilities, plus initiating contact — **Contact Seller** (products) or **Take Consultation** (services) — via a direct WhatsApp message to the seller. Phone-verified once, at registration. |
| Seller | Bohra women only, ITS-verified, manages listings via Seller Portal |
| Admin | Manages categories, verification, moderation, analytics |
| Customer Support | Assists non-tech-savvy sellers with listing creation; handles buyer/seller queries |

### 2.3 Operating Environment
- **Website & Backend API**: Next.js, deployed on Vercel
- **Mobile App**: React Native (Expo)
- **Database**: Postgres (Neon), via Drizzle ORM
- **File/media storage**: Cloudflare R2
- **Rate limiting/cache**: Upstash Redis
- **Shipping**: Delhivery API (for platform-handled shipping option)
- **OTP & seller alerts**: **MSG91** for phone verification at registration (FR-30) and in-app/WhatsApp notification to sellers of a new enquiry — zero markup over Meta's published rates. Contact itself (FR-5) is a direct WhatsApp deep link to the seller's own number, not routed through MSG91 or any relay — no session-management backend required for Phase 1.
- **Contingency, not built**: Section 3.8a documents a fully masked relay via the same MSG91 WhatsApp Business API access, ready to build if privacy exposure becomes a real blocker.

### 2.4 Constraints
- No in-app payment in Phase 1 — WhatsApp is the sole ordering mechanism.
- India-only for buyers and sellers in Phase 1/2; architecture must not hardcode this (Section 6.4).
- No launch-city restriction — registration is open nationally from day one.

---

## 3. Functional Requirements

### 3.1 Buyer-facing (Website & App)
- FR-1: Browse listings by category, with dynamic fields per category (Section 3.5) and per listing type (Section 3.6).
- FR-2: Search with filters (category, price, location) and sort options.
- FR-3: Default and search-result ranking follows nearby-first priority: buyer's location → same country → cross-border (Phase III, not built in Phase 1).
- FR-4: View listing detail pages — **PDP** (Product Detail Page) for `physical_product` listings, **SDP** (Service Detail Page) for `local_service`/`remote_service` listings — with photos, price, seller info, and, on PDPs, shipping option and delivery estimate per Section 3.7b.
- FR-5: **Contact requires registration; the seller's real number is used directly — no WE Bohra relay.** For `physical_product` listings, the registered buyer taps **"Contact Seller"**; for `local_service`/`remote_service` listings, she taps **"Take Consultation"** (Section 3.6a). Both open WhatsApp directly to the seller's registered number, pre-filled with a reference message tied to the listing — the buyer sends it herself. This is the deliberate Phase 1 default, chosen for simplicity over the fully-masked relay design (Section 3.8a, kept as a documented, ready-to-build contingency). Or, where available, a registered buyer may pay online instead (Phase 2).
- FR-5b: **Guest buyers never gain access to seller contact, at any phase — this is a firm policy, not just a Phase 1 limitation.** In Phase 1, a guest can only tap **"Pin"** on a listing to express interest (a simple save/bookmark action, no messaging, no verification required). Once online payment exists (Phase 2), a guest buyer may also use **Buy Now** or **Add to Cart + Checkout** for a direct, structured purchase — but contacting a seller through "Contact Seller" or "Take Consultation" remains registered-buyers-only regardless of phase. A guest who wants to *message* a seller must register first; a guest who wants to *pay directly* once that capability exists does not.
- FR-5a: *(merged into FR-5 — the mechanism is identical for products and services; only what happens after contact differs, per Section 3.6 and 3.7a.)*
- FR-6: On website, if the buyer prefers, prompt to download the app; deep link must open the same listing directly post-install, not the app home screen.
- FR-6a: Order tracking is available for `physical_product` orders **only once a formal order record exists on the platform** — see Section 3.7a. It is never available for a WhatsApp-negotiated sale the seller hasn't recorded, since the platform has no way to know it happened.
- FR-6b: Notifications (email, plus in-app/WhatsApp/SMS for service enquiries per Section 3.6a) are sent only for events the platform can actually verify — see Section 3.7a for the precise triggers per order path, and Section 3.6b for the services journey.

### 3.2 Seller-facing (Seller Portal)
- FR-7: Register and verify identity via ITS ID. **Two paths, depending on API access**: if the same ITS-linked verification access used in Bohra Taaruf is granted for this platform, registration prefills seller info and the women-owned badge auto-applies on ITS match, no manual step. If that access is not granted, verification falls back to **Admin manual review** — the seller submits her ITS ID, and an Admin approves before the badge applies. This dependency must be resolved before Seller Portal development begins, since it changes both the onboarding UI and the Admin Panel's scope.
- FR-8: Create, edit, and remove listings, with fields driven by the selected category's configured schema (Section 3.5).
- FR-9: Choose a shipping model per listing or account-wide: self-managed, or platform-managed via Delhivery.
- FR-10: For `physical_product` listings, view incoming "Contact Seller" requests in the Seller Portal (same mechanism as FR-10a) and respond to the buyer via WhatsApp from her own device — the platform never routes an inquiry to her externally; she sees it in-portal first.
- FR-10a: For `local_service`/`remote_service` listings, view incoming Take Consultation enquiries in the Seller Portal (Section 3.6a) and respond to the buyer via WhatsApp from her own device.
- FR-11: Request Customer Support-assisted onboarding in place of self-service listing creation.

### 3.3 Admin Panel
- FR-12: Create, edit, and deactivate categories and their listing field schemas without a code deploy (Section 6.1).
- FR-13: Review and manage seller verification status.
- FR-14: Moderate listings (remove, flag, restore).
- FR-15: View basic analytics — listings per category, active sellers, WhatsApp order handoff volume, enquiry volume, and seller response-time flags (Section 3.6a).

### 3.4 Customer Support Tooling
- FR-16: A simplified internal tool for support staff to create/edit a listing on behalf of a seller during a phone or WhatsApp-assisted session.

### 3.5 Category & Field Configuration
- FR-17: Each **subcategory** has its own admin-configurable listing schema and a configured **listing type** (`physical_product` / `local_service` / `remote_service`) — type configuration lives at the subcategory level, not the category level, since a category can mix types (Section 3.6 below).
- FR-18: New categories and subcategories can be added via the Admin Panel; this must not require developer involvement or a deployment.

### 3.6 Listing Types & Flow Branching
Not every listing is a physical product — services need a different flow entirely. Every listing's type is inherited automatically from its **subcategory's** admin-configured type — sellers never choose it directly, they simply pick the correct subcategory (which they already must do to get the right listing fields).

| Listing type | Subcategories | Flow after contact |
|---|---|---|
| `physical_product` (PDP) | Food, Art & Craft, Textile, Beauty & Occasion → Imitation Jewellery | Order → **Delivery** (self-managed or Delhivery) → Completion |
| `local_service` (SDP) | Beauty & Occasion → Mehndi, Makeup | **Take Consultation** request (in-app, Section 3.6a) → seller responds via WhatsApp → Completion |
| `remote_service` (SDP) | IT & Services (web/app/logo design, and similar) | **Take Consultation** request (in-app, Section 3.6a) → seller responds via WhatsApp → Completion |

**Beauty & Occasion is the clearest example of why type lives at the subcategory level**: its Jewellery subcategory is configured as `physical_product`, while its Mehndi and Makeup subcategories are configured as `local_service`, all within the same parent category. This is the general mechanism, not a special case — any category could mix types in the same way if admin configures it that way.

- FR-19: The Delivery stage (Section 3.7b) applies only to `physical_product` listings. `local_service` and `remote_service` listings have no intermediate tracked stage — everything between the seller's response and completion (scoping, scheduling, file sharing, discussion) happens directly between buyer and seller over WhatsApp, which the platform does not track or need to track.
- FR-20: Listing type requires zero seller-facing decisions anywhere in Phase 1 — including Beauty & Occasion. The seller's subcategory choice alone determines it, via admin configuration.

### 3.6a Take Consultation & Enquiry Tracking (all service listings, Phase 1 onward)
**"Take Consultation" replaces a direct WhatsApp click as the request mechanism for `local_service` and `remote_service` listings.** This was a deliberate design decision: a WhatsApp deep-link click cannot be verified — the buyer may be redirected and never actually send a message, giving no genuine signal that a real request occurred. An in-app action solves this at the source, since the request itself, not an external chat, is the trackable event.

- FR-21: Buyer taps **"Take Consultation"** on the listing — this logs an **enquiry record** (buyer, seller, listing, timestamp) as the platform's proof a genuine request occurred, then opens WhatsApp directly to the seller's registered number with a reference-coded message, which the buyer sends herself.
- FR-22: The seller is notified two ways for every new enquiry: an **in-app notification**, and the buyer's WhatsApp message itself, sent directly to her — she does not need the app or portal open to see a request arrived.
- FR-23: **The conversation continues directly between buyer and seller** on WhatsApp, from that point on — the platform's role ends at logging the enquiry and opening the chat.
- FR-24: The Seller Portal displays an enquiry count/analytics view — e.g., "12 enquiries this month" — as a concrete, visible proof of value, independent of whether those enquiries convert to a sale.
- FR-25: **Seller response-time tracking.** If a seller has not replied on WhatsApp within 24–48 hours of a request, the enquiry is flagged as slow/no-response — visible to her in the Seller Portal, and to Admin. This is a visibility flag, not an auto-completion — the platform never fabricates a "service happened" status from silence.
- FR-26: Either buyer or seller may mark an enquiry **Completion** — self-reported, not platform-verified, since the actual engagement happens entirely on WhatsApp, outside the platform's visibility (Section 3.6b).
- FR-27: **Stale-enquiry handling**: a reminder nudge is sent to the seller if an enquiry has no update after 7 days. If still untouched after 30 days, the enquiry is auto-closed with a status of `auto_closed_no_update` — explicitly *not* `completed` — so the data never overstates what actually happened.
- FR-28 (**Phase 2**): date/time slot picking and a nominal consultation charge are added **on top of the same Take Consultation flow** — not a separate mechanism. The direct-contact model in FR-21–23 does not change; Phase 2 adds scheduling and payment to it.

**Note on seller web-only access**: no native seller app is planned. FR-22's direct WhatsApp message is the seller's real-time notification channel — the primary reason apps are built for push notifications is already covered without one. The Seller Portal remains a mobile-responsive website, which also keeps the single-developer build scope (Section 10 of the Requirements Brief) from growing further.

### 3.6b Services Journey (who does what, at each stage)
Deliberately shorter than the product journey (Section 3.7a) — services genuinely only have two tracked stages, since everything in between happens over WhatsApp, outside the platform's visibility.

| Stage | Buyer | Seller | Customer Care | Notification |
|---|---|---|---|---|
| 1. Consultation requested | Taps "Take Consultation" — opens WhatsApp direct to the seller | Notified in-app + receives the buyer's WhatsApp message directly | Monitors seller response-time flags (FR-25) | "New enquiry" sent to seller, in-app |
| 2. Completion | May mark complete (self-reported) | May mark complete (self-reported) | Follows up on any unresolved issue; handles stale-enquiry nudges | "Marked complete" sent to buyer & seller |


### 3.7a Product Journey — the honest version (who does what, and what the platform actually knows)

**The core principle stakeholders will probe on**: WE Bohra cannot send a notification about something it has no way of knowing happened. Once the seller reaches out and the actual conversation happens on WhatsApp, it's invisible to the platform — for Phase 1, WE Bohra's role in a WhatsApp-negotiated sale is introduction only, nothing more, until the seller herself brings it back onto the platform.

**Path A — WhatsApp order (Phase 1, live from day one)**

| Stage | What actually happens | What the platform notifies |
|---|---|---|
| 1. Request | Registered buyer taps **"Contact Seller,"** which logs an enquiry (buyer, seller, listing, timestamp) and opens WhatsApp directly to the seller's registered number, pre-filled with a reference message — the buyer sends it herself. | Seller notified in-app, and receives the buyer's WhatsApp message directly. |
| 2. Negotiation & sale | Buyer and seller agree on item, price, and delivery entirely over WhatsApp | **Nothing.** The platform has no visibility into this and cannot claim otherwise. |
| 3. Seller records it (optional) | The seller may choose to formalize the sale by manually creating an order record in the Seller Portal — this is the *only* way a WhatsApp deal becomes visible to the platform | On this action: buyer receives an "Order confirmed" email for the first time — not before. |
| 4. Shipping (only if Stage 3 happened) | Self-managed: seller manually updates status (Packed/Shipped/Delivered); no live tracking exists for any courier except Delhivery. Delhivery: real, automatic tracking via API. | Self-managed: an email fires each time the seller manually updates status — nothing automatic in between. Delhivery: automatic status emails via API. |

**Deliberately the simpler design, not an oversight**: a fully masked relay (Section 3.8a) was designed and is documented as a ready contingency, but direct contact is the Phase 1 default — chosen for lower engineering risk and faster delivery, with registration (FR-5) as the safeguard actually being shipped now.

**Path B — Portal order with online payment (Phase 2, not live in Phase 1)**

| Stage | What actually happens | What the platform notifies |
|---|---|---|
| 1. Checkout | Buyer pays in-app via Razorpay | This is a **real, platform-verified event** — payment gateway confirms it. Buyer and seller are both notified immediately (email + in-app). |
| 2. Shipping | Same self-managed vs. Delhivery split as Path A | Same trigger logic as Path A Stage 3 |
| 3. Completion | Delhivery: platform has genuine delivery-confirmation data. Self-managed: still self-reported by the seller. | "Order completed" sent once the relevant status is recorded |

**The one-line answer for the stakeholder room**: *in Phase 1, WE Bohra connects buyer and seller — we do not automatically know a WhatsApp deal became a real order unless the seller records it herself. Phase 2's in-app payment removes this gap entirely, because the platform then has direct proof an order occurred.*

### 3.7b Delivery & Shipping Estimates (physical products only)
Two distinct mechanisms — they are not interchangeable, and the UI must label which one is shown:

- **Delhivery-managed**: a real, computed estimate and **real, live tracking**. The system queries Delhivery's Serviceability, Cost & TAT API using buyer and seller pincodes and displays an actual estimated delivery date, with automatic status updates end to end.
- **Seller-managed**: **no live tracking exists, for any courier, because WE Bohra has no third-party integration beyond Delhivery.** The seller manually updates discrete status milestones (e.g., Packed, Shipped, Delivered) in the Seller Portal, and may optionally enter a tracking number and courier name for the buyer's own reference — the buyer can check that number directly on the courier's own site, but WE Bohra does not call any API to verify or display it live. This must be labeled plainly to the buyer as seller-reported, not platform-tracked.
- FR-29: Listing creation requires the seller to choose a shipping model (Section 4b of the Requirements Brief) and, if self-managed, provide the estimate text above.

**This is a deliberate scope boundary, not a gap to apologize for**: building live tracking for every possible courier a seller might use is a significant integration effort with no clear payoff in Phase 1 — Delhivery is the one integration that earns its complexity because it's also the platform-managed shipping option.

### 3.7c Jamaat as the Delhivery Pickup Point (Phase 1 operational model)
**A real privacy benefit, worth stating explicitly, not just a logistics convenience**: for Delhivery-managed sellers, the pickup address used is her nearest jamaat, selected during Seller Portal registration — never her home address. This means a seller's personal address is never part of the shipping chain at all, protecting the same category of privacy this whole platform has been designed around, just applied to a courier this time instead of a buyer.

- FR-46: During registration, a Delhivery-managed seller selects her nearest jamaat from a fixed list as her designated pickup point — this becomes the origin address Delhivery's API uses for cost and tracking on every one of her shipments.
- FR-47: **WE Bohra's own Customer Support team, not the jamaat committee, is responsible for receiving parcels dropped off at that jamaat and logging receipt** — this is a real, concrete addition to Customer Support's role, beyond the seller-onboarding and query-handling originally scoped for it. Customer Support only escalates a pickup issue when a seller has *failed* to deliver her item to the jamaat in time — routine receipt and logging is the normal task, not an exception path.
- FR-48: Because the pickup origin is now a small, fixed set of jamaat addresses rather than each seller's individual location, Delhivery's quoted shipping cost is **consistent for any sellers sharing the same jamaat** — genuinely simplifying multi-seller cost display (Section 8, multi-seller cart splitting) within that shared catchment. This consistency holds *within* a jamaat's catchment, not universally — a buyer ordering from sellers registered to different cities' jamaats still sees different origins and different costs.

**Honest operational scaling caveat**: this is workable with 1–2 Customer Support staff while the pilot stays concentrated in one or a few cities — physically receiving and logging parcels doesn't scale for free as more jamaats and cities come online. Worth monitoring as a real staffing question if the pilot expands, not assuming it holds indefinitely at the same headcount.

---

### 3.8 Buyer Verification & Anti-Exploitation Safeguards
**This section exists because of a specific, known failure mode**: a prior community attempt at this idea produced verified women sellers who were then exploited by random, non-genuine messaging rather than real buyers. Buyers being fully open (Section 2, "anyone in the world") makes this risk structural, not incidental — it must be designed against directly, not left to trust and hope.

- FR-30: **Phone number verification (OTP) happens once, at registration** — not per contact request. Only a registered, phone-verified buyer can send a "Contact Seller" or "Take Consultation" request (FR-5); a guest cannot reach this action at all (FR-5b), so there is no per-request OTP gate to design around — registration itself is the gate.
- FR-31: **Rate limiting per phone number**: a cap on the number of contact/consultation requests a single buyer can send per day, to prevent spam or harassment campaigns from a single source.
- FR-32: **Seller-initiated reporting**: a seller can report a specific buyer contact as inappropriate or non-genuine directly from the Seller Portal. Repeated reports against the same phone number result in that number being blocked from initiating further contact.
- FR-33 (**optional, Phase 2**): buyers who are themselves ITS-verified community members may carry a "Verified Buyer" badge — not required to use the platform, but a trust signal sellers can see, since a portion of buyer traffic will genuinely be community members.

**This is the platform's honest answer to "what's different this time"**: the previous attempt had seller verification but no buyer-side accountability at all. This closes that specific gap.

### Privacy & data-sharing safeguards
**A real exposure, not a hypothetical one, and accepted deliberately for Phase 1**: for the seller to reach out on WhatsApp, or for the buyer's message to reach her (FR-5), the seller's real number is used directly, and once the buyer messages her, her seller's number is now able to see the buyer's number too. This is not eliminated in Phase 1 — it's managed around, with a fully masked alternative already designed and ready if it's ever needed (Section 3.8a).

- FR-37: A seller's number is used **only for the specific listing a buyer is contacting her about** — the platform does not publish it as a browsable directory entry; it's surfaced only through the "Contact Seller" / "Take Consultation" action itself.
- FR-38: **Explicit, plain-language consent** is shown to the buyer at the moment she sends a request — stating that this action opens a direct WhatsApp conversation with the seller. Not buried in a general terms-of-service page.
- FR-39: **Buyer-side reporting, mirroring FR-32 in reverse**: a buyer can report a seller for an inappropriate message. Repeated reports trigger Admin review of the seller account, the same as repeated reports against a buyer do.
- FR-40: Sellers are **encouraged in Phase 1, and required from Phase 2**, to register a dedicated business WhatsApp number, separate from her personal number — the one mitigation fully within her own control regardless of platform design.
- FR-41: **Data retention limits**: the enquiry record (not message content, since Phase 1 doesn't see it) is retained only as long as needed for dispute resolution (e.g., 90 days after completion or auto-close), then purged. Buyers may request earlier deletion of their own contact record.
- FR-42: The privacy policy must disclose the direct-contact mechanism in plain language, shown before a buyer's first request — not just referenced in fine print. At minimum, this must comply with India's Digital Personal Data Protection Act, 2023.

**The honest limit to state if asked directly**: this is a real, accepted exposure, not a solved problem — registration and reporting reduce risk, they do not eliminate it. This was a deliberate simplicity-over-completeness choice for Phase 1, made with a fully designed fix already on hand (Section 3.8a) rather than no answer at all.

### 3.8a Contingency: Fully Masked Relay (designed, not built — deploy only if needed)
**This is a complete, ready-to-build alternative to FR-5's direct contact model, kept here specifically so a real privacy concern — raised by the stakeholder, or surfaced by real usage — has an immediate, credible answer rather than a scramble.** It is not part of the Phase 1 build plan.

- Every buyer and seller would message a single WE Bohra WhatsApp Business number instead of each other directly. A buyer's message is relayed to the seller by the platform's backend; her reply is relayed back the same way. Neither party ever sees the other's real number — genuine masking, not just tighter consent around a real exposure.
- Technically feasible via WhatsApp's Business API (through a provider like MSG91): a user-initiated message opens a free 24-hour service window, and reopening a lapsed conversation costs a small utility-template fee (roughly ₹0.13–0.21/message) — this fits inside the infrastructure budget already planned, no cost surprise if activated.
- **The real engineering cost, and the reason this stays a contingency, not the default**: every buyer and seller shares one WhatsApp number, so a buyer with two simultaneous enquiries has two logically separate conversations inside one physical thread. This requires deliberate session-matching (WhatsApp's reply-to/quoted-message threading as the primary signal, with a disambiguation prompt when that's ambiguous) — a real, scoped piece of backend work, not a simple API connection. A message routed to the wrong party would be a severe trust failure, so this would need its own dedicated QA coverage before ever going live.
- **When to actually build this**: if the stakeholder raises privacy exposure as a blocking concern, or if real Phase 1 usage surfaces genuine harassment or exploitation despite FR-30–42's safeguards. Not before — building it speculatively would be exactly the kind of premature complexity Phase 1 has otherwise deliberately avoided.

---

## 4. Data Requirements (core entities)

- `users` — role, ITS ID (sellers), registration status, phone-verified timestamp (buyers, at registration per FR-30), location
- `listing_pins` — guest or registered buyer (session or account), listing, timestamp — the lightweight interest-expression record (FR-5b), entirely separate from seller contact
- `seller_profiles` — linked to verified user
- `categories` / `category_fields` — admin-configurable schema per category, including default `listing_type`
- `listings` — category, `listing_type` (`physical_product` / `local_service` / `remote_service`), dynamic field values, media, shipping option, delivery estimate (self-declared text, or Delhivery-computed), location
- `media` — R2-backed, presigned upload URLs
- `shipping_options` — self-managed (with seller-declared estimate) vs. Delhivery-managed (with API-computed estimate), per listing/seller
- `order_stages` — tracks progress for `physical_product` listings only (Delivery); `local_service` and `remote_service` listings have no intermediate stage
- `enquiries` — the Take Consultation request record (Section 3.6a): buyer, seller, listing, timestamp, status (`pending` / `responded` / `completed` / `auto_closed_no_update`), seller response timestamp (drives the 24–48hr response-time flag, FR-25) — created on every consultation request, all phases
- `buyer_contacts` — phone number, OTP-verified timestamp, daily contact count (for FR-31 rate limiting), report count and block status (FR-32), data retention expiry (FR-41)
- `relay_sessions` — *(not built in Phase 1 — reserved for Section 3.8a's contingency design if ever activated)*
- `support_sessions` — record of Customer Support-assisted listing creation

---

## 5. External Interface Requirements

| Interface | Purpose |
|---|---|
| WhatsApp Click-to-Chat | Direct, buyer-initiated deep link to the seller's own registered number (FR-5) — no relay, no masking in Phase 1 |
| MSG91 (WhatsApp + SMS) | OTP delivery at registration (FR-30) and in-app/WhatsApp notification to sellers of a new enquiry (FR-22) |
| Delhivery Serviceability, Cost & TAT API | Real delivery estimate and pincode serviceability for platform-managed shipping |
| Delhivery Order/Tracking API | Automatic order tracking for Delhivery-managed shipments (FR-6a) |
| Email delivery service (e.g. transactional email provider) | Stage notifications to buyer/seller (FR-6b) |
| App Store / Play Store deep linking | Website-to-app handoff, listing-specific |
| Cloudflare R2 | Listing photo storage |
| (Reserved, not built in Phase 1) Razorpay | Stretch goal for Phase 2 in-app payment |

---

## 6. Non-Functional Requirements

### 6.1 Modularity
Categories and their fields, and major features, must be configurable from the Admin Panel. This is a hard architectural requirement, not a preference — it determines the data model design (Section 4) from the start.

### 6.2 Data Privacy & Security
ITS ID and identity data require the same handling standard as the existing Bohra Taaruf platform's verification system. No ITS data exposed in buyer-facing views beyond the derived women-owned badge.

### 6.3 Scalability
Schema and API design must anticipate category growth beyond the five in Phase 1 without structural rework.

### 6.4 Localization
Country and currency are configuration values, not hardcoded constants — India/INR is Phase 1's only enabled configuration, but the system must support enabling additional country/currency pairs in Phase III via configuration, not redevelopment.

### 6.5 Availability
Standard commercial availability expectations for a production consumer app; no specific SLA defined for Phase 1 pilot.

---

## 7. Assumptions & Dependencies

- Demand is validated via Tasneem Akbari Kutubuddin's direct confirmation (8+ years, ~8,000-member Bohra Women Entrepreneurs group) — not a pre-build survey.
- The pilot app and website, once built, serve as the working demonstration for the leadership approval pitch, and become the live foundation post-approval rather than a disposable prototype.
- Team composition: 1 Project Lead, 1 Manager/Admin, 2 Developers (Website & Backend; Mobile App), 1 QA, 1 Designer, 1–2 Customer Support. Splitting the developer role in two directly addresses the single-developer delivery risk flagged during planning — one person credibly covering backend, web, seller portal, admin panel, *and* a React Native app in parallel was an unrealistic scope for one hire.

---

## 8. Out of Scope — Phase 1

- In-app payment / Razorpay (Phase 2; Razorpay itself remains a stretch goal even within Phase 2)
- Simplified/voice-note seller onboarding wizard (Phase 2, time-permitting)
- Date/time slot picking and nominal consultation charges on the Take Consultation flow (Phase 2 — FR-28; Phase 1 uses the request-and-notify model only, with enquiry tracking already active)
- Verified Buyer badge for ITS-verified community members (Phase 2 — FR-33)
- Tiered membership plans (Silver/Gold/Diamond) — explored during planning, deliberately not adopted for Phase 1 in favor of a single flat fee (Section 9); may be revisited only if a validated need emerges from real usage
- **"Pickup & Pay"** (Phase 2, unscoped) — a local-only path for a nearby buyer to scan a QR code, pay, and collect directly from the seller with no shipping involved at all. Deliberately kept separate from QR-as-a-payment-method inside the standard Buy Now/Checkout flow (which is just a faster on-ramp to the same Phase 2 payment integration, shipping unchanged). Not scoped in detail — a candidate for its own requirements pass when Phase 2 planning begins, not assumed to be a quick addition.
- **Multi-seller cart splitting** (Phase 2, must-address, not detailed here) — when Buy Now/Add to Cart + Checkout ships, a single buyer payment must split into **one shipment per seller**, not one shipment per order, since sellers ship from independent physical locations. Each seller's shipping cost is calculated independently (her self-declared estimate, or a real Delhivery quote for her own pincode-to-buyer route) and summed into the one checkout total — never a single blended cart-wide shipping figure. This requires a data model layer not yet built: `orders` (one payment event) → `order_shipments` (one per seller, own cost/status/tracking) → `order_items` (per-listing detail within a shipment). Named now specifically so it isn't discovered mid-build when Phase 2 checkout is actually scoped — not fully specified here since Phase 2's cart/checkout itself isn't yet designed in detail.
- Rida rental deposit-hold logic, thaal catering, and other categories beyond the five locked in this document
- Ratings/reviews system
- Cross-border buyer discovery and multi-country currency (Phase III)

---

## 9. Business Model — Membership Fee

**The subscription model exists partly to solve a problem named in Section 3.8 and earlier planning: the platform cannot track a sale that happens entirely over WhatsApp.** Rather than chase that visibility, revenue is decoupled from it entirely — sellers pay for platform access, not per transaction. Whether a specific sale closes on WhatsApp or never closes at all doesn't change what the platform earns. This also means disintermediation (a seller and buyer moving off-platform after first contact) stops being a revenue risk, even though it remains a real dynamic worth watching.

### Starting model: nominal flat fee, real trial first

**3 months free, then ₹153/month, flat, for every seller — this is the Phase 1 price, and it doesn't change mid-Phase-1 for anyone already on it.** No tiers in Phase 1 — every verified seller gets the same access and features, whether she joins on day one or month five. Tiered plans (Silver/Gold/Diamond, differentiated by listing limits and visibility) were explored earlier in planning and remain a possible future direction, but are explicitly **not** part of the Phase 1 launch — they added complexity and a real accessibility risk without a validated need for them yet.

**Phase 2 fee increase to ₹253/month**: justified specifically by the jamaat-based pickup logistics service (Section 3.7c) becoming a real, staffed operational value — WE Bohra actively receiving, logging, and coordinating Delhivery pickup on a seller's behalf is meaningfully more than a listing platform, and the price should reflect that. This increase lands alongside Phase 2's other additions (in-app payment, consultation booking) rather than as a standalone mid-Phase-1 change — sellers see new value arrive at the same time the price does.

- FR-34: Every verified seller account begins a **3-month free trial** from the date of ITS verification (Section 3.2). No payment method is required to start.
- FR-35: Billing begins automatically at the start of month 4, at a flat **₹153/month**, unless the seller cancels before then. No proration, no tier selection — one number, for everyone.
- FR-36: A seller who cancels retains her listings in a paused (not deleted) state, and can resume by re-subscribing — this avoids punishing a seller for a temporary lapse.

### Why nominal, why flat, why a real trial
- **Nominal**: ₹153/month is closer to a symbolic commitment than a real cost barrier — deliberately low enough that price is unlikely to be the reason a genuine seller doesn't join.
- **Flat, not tiered**: a single number is far easier to explain honestly to a stakeholder and to a first-time seller alike, and it avoids the accessibility problem of "better features cost more" on a platform whose whole premise is opening doors, not gatekeeping them.
- **A real trial, not a teaser**: three full months is long enough for a seller to actually experience enquiries and real use before being asked to pay anything — the fee only ever meets someone who has already seen value, not someone guessing whether it's worth it.

### Honest revenue expectations for Phase 1
At a modest pilot scale (~100–150 sellers by the end of Phase 1, many still inside their free trial window), steady-state revenue lands around **₹15,000–23,000/month** once trial cohorts convert — a small fraction of the ~₹1.7L–2.5L monthly team and infrastructure cost. **This is stated plainly, not softened**: Phase 1's fee is not designed to cover running costs. Its purpose is to prove that sellers will pay *something* once they've seen real value, and to establish the habit of paying before any larger pricing conversation happens in a later phase. Full sustainability remains a scale question beyond Phase 1.
