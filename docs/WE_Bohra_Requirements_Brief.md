# WE Bohra — Phase 1 Requirements Brief

**WE Bohra** (Women Entrepreneurs) — a platform built for Bohra women-owned businesses, open to the whole community as buyers.

This document is the single source of truth for the SRS, the investment plan, and the leadership deck. Everything downstream is derived from what's locked here.

---

## 1. Mission

Give Bohra women running home businesses and skilled trades — currently found only through Instagram DMs and word of mouth — a real, trusted platform to be discovered and sell, without losing the modesty and privacy norms the community expects.

---

## 2. Audience

- **Buyers** — anyone, anywhere in the world. Buying is fully open, no community restriction.
- **Sellers** — Bohra women only. A listing is eligible for the "women-owned" badge only when registered under the seller's own ITS ID — no manual review, no exceptions process in Phase 1.

---

## 3. Phase 1 Categories

| Category | Includes |
|---|---|
| Food | Home cooking, tiffin, baking, catering |
| Art & Craft | Crochet, handmade gifts, hampers, other handicrafts |
| IT & Services | Freelance/professional services — e.g. designers, developers, and similar skilled services offered by women in the community |
| Textile | Rida and wardrobe, stitching, tailoring, alterations |
| Beauty & Occasion | Mehndi artists, makeup artists, home-based beauty services, imitation jewellery |

Categories and their listing fields must be **admin-configurable**, not hardcoded — see Section 6.

---

## 4. Platforms — Phase 1

| Platform | Scope |
|---|---|
| **Website** | Browse, search, filter, sort, listing detail pages, and WhatsApp order handoff (see below). No in-app-style checkout on web. |
| **Mobile App** (React Native) | Full experience — browse, search, listing detail, and WhatsApp order handoff, same as web. Web traffic is directed here for a fuller browsing experience. |
| **Seller Portal** (web) | Sellers create and manage listings, view inquiries. |
| **Admin Panel** | Category/module management, seller verification, moderation, basic analytics. |

**Website purchase handoff — priority order**:
1. **Primary** — buyer is redirected to the seller's WhatsApp with the listing pre-filled, same as the in-app flow.
2. **Secondary** — buyer is prompted to download the app from the App Store / Play Store for the fuller experience.

App handoff still requires deep-linking so the specific listing opens directly in the app after install, not just the home screen — flag this for the SRS as a real requirement, not a nice-to-have.

---

## 4a. Search & Discovery Priority

Search and default listing order rank sellers in this priority, for every buyer:

1. **Nearby** — sellers closest to the buyer's location, first.
2. **Same country** — sellers elsewhere in the buyer's country, next.
3. **Outside the buyer's country** — lowest priority in Phase 1/2, and full cross-border discovery is a **Phase III** feature (see Section 4c).

This requires location capture from the buyer (with consent) and from every seller listing — a real requirement for the SRS's data model, not just a sort-order preference.

---

## 4b. Shipping & Logistics (within the same country)

Two shipping models, selectable per seller or per listing:

1. **Seller-handled** — the seller manages her own shipping/delivery entirely.
2. **Platform-handled** — fulfilled via **Delhivery** integration for sellers who prefer the platform to manage logistics.

Both models must coexist — this is a per-listing or per-seller configuration, not a platform-wide either/or choice.

---

## 4c. Country & Currency Handling

- **Phase 1/2**: country selector is fixed to **India**; currency displayed is **INR** only. Cross-border buying (Section 4a, priority 3) is **out of scope until Phase III**.
- **Architecture requirement**: country and currency must be built as a **configurable system**, not hardcoded to India — enabling a new country/currency in Phase III should be a configuration change, not a rebuild. Currency displayed should automatically follow whatever country the buyer selects once more countries are enabled.

---

## 5. Purchase Flow — Phase 1 vs Phase 2

- **Phase 1**: no in-app checkout. Buyer taps "Order" in the app, which opens a pre-filled WhatsApp message to the seller with the listing details. All payment happens directly between buyer and seller, outside the platform.
- **Phase 2**: in-app payment introduced as an *additional* option — WhatsApp ordering remains available, it is not removed. Razorpay integration is a stretch goal for Phase 2, timeline-permitting, not a Phase 1 or guaranteed Phase 2 commitment.

This keeps Phase 1 free of payment-gateway complexity, dispute handling, and escrow logic entirely — those are deferred until the platform has real usage data to design around.

WhatsApp is the primary ordering channel uniformly across both web and app in Phase 1 — the app is not a payment mechanism in Phase 1, it's a fuller browsing and ordering *experience* that still ends in WhatsApp.

---

## 6. Non-Technical Seller Support — Phase 1 vs Phase 2

- **Phase 1**: sellers who are not comfortable with the app or portal are supported directly by the Customer Support team — phone or WhatsApp assisted listing. No in-app simplified wizard yet.
- **Phase 2 (if time allows)**: a simplified, low-literacy-friendly onboarding flow (e.g., voice-note product descriptions, guided step-by-step wizard) to reduce dependency on manual support as seller volume grows.

---

## 7. Roles & Permissions

| Role | Access |
|---|---|
| Buyer | Browse, search, view listings, initiate WhatsApp order (web and app) |
| Seller | Manage own listings and profile via Seller Portal |
| Admin | Manage categories/modules, verify sellers, moderate listings, view analytics |
| Customer Support | Assisted seller onboarding, buyer/seller query handling |

---

## 8. Non-Functional Requirements

- **Modularity**: categories, their listing fields, and major features must be configurable from the Admin Panel — adding a new category (e.g., a future category beyond the five in Section 3) should not require a developer or a deploy.
- **Data privacy**: ITS ID and other identity data handled with the same care as the existing Bohra Taaruf platform's verification system — this is sensitive data and must be treated accordingly in the SRS's security section.
- **Scalability**: architecture should not assume Phase 1's five categories are the ceiling — schema and API design should anticipate category growth from day one.
- **Localization**: country and currency must be config-driven per Section 4c — not hardcoded to India, even though only India is enabled in Phase 1/2.

---

## 9. Out of Scope for Phase 1 (explicit, to prevent scope creep)

- In-app payment / Razorpay (Phase 2, and Razorpay specifically is a stretch goal even within Phase 2)
- Simplified/voice-note seller onboarding wizard (Phase 2, time-permitting)
- Rida rental (deposit-hold logic), thaal catering, and other previously discussed categories beyond the five listed in Section 3 (imitation jewellery is now included under Beauty & Occasion, not out of scope)
- Ratings/reviews system (to be scoped separately once order volume exists)
- Cross-border/international buyer discovery and multi-country currency (Phase III — see Section 4c)

---

## 10. Team Structure — Phase 1

| Role | Count |
|---|---|
| Project Lead | 1 |
| Manager / Admin | 1 |
| Developer — Website & Backend | 1 |
| Developer — Mobile App | 1 |
| QA | 1 |
| Designer | 1 |
| Customer Support | 1–2 |

Detailed responsibilities and cost modeling to be developed in the Investment Plan (Step 5).

---

## 11. Validation & Purpose of the Pilot

- **Demand validation**: confirmed directly by Tasneem Akbari Kutubuddin, based on 8+ years and ~8,000 members' worth of lived experience running Bohra Women Entrepreneurs — this is the validation, not a separate data-gathering exercise.
- **Purpose of the pilot app and website**: not to test interest, but to give the leadership pitch a real, working product to show — not slides and promises. It's built to demo directly to the Head of Al-Tijaarat Al-Raabehah as part of the approval ask.
- **After approval**: the pilot is not thrown away — it becomes the live foundation the team continues to build on and improve, not a disposable prototype.
- Advisor: Tasneem Akbari Kutubuddin, engaged at advisor level per the agreement reached in the August meeting

---

## 12. Open Items Before SRS Drafting

- [x] Final confirmation of the five Phase 1 categories — locked
- [x] Launch city — none; registration is open to any eligible seller, no city restriction
- [ ] Pilot app and website built and demo-ready ahead of the leadership pitch
