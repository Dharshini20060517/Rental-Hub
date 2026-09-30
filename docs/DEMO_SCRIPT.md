# RentalHub — 10-Minute Demo Script

A guided walkthrough of the RentalHub equipment rental platform covering Phases 1–4: the
marketplace, the booking lifecycle, two-way reviews, owner/admin analytics, AI damage comparison,
dispute resolution, and the AI features (natural-language search, what-if simulator, trust score).

## Audience & setup

- **Audience:** stakeholder or new engineer.
- **Total time:** ~10 minutes (1 minute per section).
- **App URL:** the Next.js dev server on port 3000 (the single `/` route with `?view=` switching).
- **Real-time sidecar:** Socket.IO on port 3003 (optional — the SPA falls back to 30 s polling).
- **Demo accounts** (printed by `bun run seed`):

  | Role     | Email                    | Password       |
  | -------- | ------------------------ | -------------- |
  | Admin    | `admin@rentalhub.test`   | `Admin123!`    |
  | Owner    | `rohit@rentalhub.test`   | `Owner123!`    |
  | Customer | `rahul@rentalhub.test`   | `Customer123!` |

- **Tip:** open two browser windows side-by-side — one logged in as the customer, one as the owner —
  so you can show both ends of the chat and review flow.
- The SPA view switches via `?view=<key>`. Each section below names the view key and the matching
  API endpoints so you can also drive the demo through `docs/postman/RentalHub.postman_collection.json`.

---

## Step 1 — Browse equipment + search with filters  *(~1 min)*

**Open:** `?view=search` (or the home page → "Browse marketplace" button).

**Narration**
1. The landing grid renders ~30 seeded listings across 8 cities and 10 categories.
2. Filter sidebar: type `dslr` in the search box, pick **Photography** from the category dropdown,
   set `maxPrice = ₹1500/day`, sort by `Rating ↓`.
3. Watch the URL bar — filters are pushed into the query string; the same URL rehydrates the view
   on refresh (good for sharing).
4. Toggle **Compare** on two cards (the compare bar slides up at the bottom); click **Compare** to
   open `?view=compare&ids=a,b`.
5. Click the heart icon on a card to add it to the wishlist (toast confirms); visit `?view=wishlist`
   to see it persisted.

**API:** `GET /api/v1/equipment?q=…&category=…&minPrice=…&maxPrice=…&sort=…&page=…&limit=…`,
`GET /api/v1/equipment/compare?ids=a,b,c`, `POST /api/v1/wishlist`, `GET /api/v1/wishlist`.

---

## Step 2 — Equipment detail (gallery, pricing, calendar, reviews)  *(~1 min)*

**Open:** any card → `?view=equipment&id=…`.

**Narration**
1. **Image gallery** at the top — click thumbnails to switch; the primary image has a badge.
2. **Pricing calculator** (right column) — pick a 3-day weekend range (Sat–Mon). Watch the line
   items update live: `Base × 3`, `Weekend +15%` (Saturday/Sunday), `Long-rental -10%` (≥7 days),
   `Platform commission 10%`, `Deposit`, and the **total**. The same math runs server-side in
   `POST /bookings`.
3. **Availability calendar** (FullCalendar v6) — green = bookable, grey = owner-blocked, red =
   maintenance window, blue = existing booking. Select a date range → it pre-fills the checkout.
   If the Socket.IO sidecar is up, a booking created by *another* user shows up here in real time.
4. **Reviews** section at the bottom — average rating, rating distribution bars, and the latest
   reviews with reviewer name + date. Helpful-vote toggle works for logged-in customers.
5. **Recommendation widget** ("Frequently rented together") appears under the gallery — uses the
   `?type=frequently_together&id=…` recommendation engine.

**API:** `GET /api/v1/equipment/:id`, `GET /api/v1/equipment/:id/availability`,
`GET /api/v1/equipment/:id/reviews`, `GET /api/v1/intelligence/recommendations?type=frequently_together&id=…`,
`GET /api/v1/equipment/:id/price-insight` (Phase 3 AI badge).

---

## Step 3 — Create a booking (checkout: hold → pay → confirm)  *(~1 min)*

**Open:** from the equipment detail, click **Book now** with a chosen date range.
View: `?view=checkout&equipmentId=…&start=…&end=…`.

**Narration**
1. **Step 1 — Review:** the 3-step checkout opens on the review panel. Show the line items, the
   `flexible` cancellation policy badge (100% refund >24h, 50% within 24h), and the
   `holdExpiresAt` countdown ("Hold expires in 9:59").
2. **Step 2 — Payment:** click **Pay & confirm**. The simulated gateway returns
   `sim_charge_…` + `sim_hold_…` Payment rows; the booking flips `held → confirmed` and a
   `BookingStatusHistory` row is written.
3. **Step 3 — Success:** toast + redirect to the booking detail. Show the timeline stepper
   (Pending → Held → ✓ Confirmed → Picked up → …) with the confirmed step lit.
4. Switch to the **owner window** (rohit@rentalhub.test) and open `?view=owner-bookings` — the new
   booking appears at the top with an **Approve / Reject** action pair.

**API:** `POST /api/v1/bookings`, `POST /api/v1/bookings/:id/payments`,
`POST /api/v1/bookings/:id/confirm`, `POST /api/v1/bookings/:id/approve`.

---

## Step 4 — Full rental lifecycle (pickup → in_use → return → inspect → complete)  *(~1 min)*

**Open:** `?view=booking-detail&id=…` (the booking from Step 3, after approval).

**Narration** — drive the state machine one transition at a time. Each click updates the timeline
stepper on the right and writes a `BookingStatusHistory` row that you can show in the **History**
accordion.

1. **Pickup** (owner) — opens a checklist dialog (`fuel_full`, `clean`, `accessories_present`)
   + an optional photo URL field. Submit → status becomes `picked_up`. Mention the **QR
   condition passport** at `GET /equipment/:id/condition-passport` — the public read-only page
   that a customer can scan at pickup to verify condition + maintenance history.
2. **Start use** (customer) — `POST /bookings/:id/start-use` → `in_use`.
3. **Initiate return** (customer) — `POST /bookings/:id/return { action:'initiate' }` →
   `return_pending`.
4. **Confirm return** (owner) — `POST /bookings/:id/return { action:'confirm', checklist, photos }`
   → `returned`.
5. **Inspect** (owner) — `POST /bookings/:id/inspect { pass:true }` → `inspected`. (If `pass:false`,
   the booking flips to `disputed` instead — see Step 9.)
6. **Complete** (either party) — `POST /bookings/:id/complete` → `completed`. The matching
   `booked` availability block is removed; the deposit is released via
   `POST /bookings/:id/payments/:paymentId { action:'release' }`.

**API:** `POST /bookings/:id/pickup`, `POST /bookings/:id/start-use`, `POST /bookings/:id/return`,
`POST /bookings/:id/inspect`, `POST /bookings/:id/complete`,
`POST /bookings/:id/payments/:paymentId`, `GET /equipment/:id/condition-passport`.

---

## Step 5 — Two-way reviews  *(~1 min)*

**Open:** `?view=booking-detail&id=…` on a `completed` booking (or complete the one from Step 4).

**Narration**
1. After `completed`, the booking detail shows a **Leave a review** dialog button.
2. **Customer → Owner/Equipment:** the customer (rahul) opens the dialog, picks 5★, writes a title
   and body, and submits. The review is persisted with `equipmentId` set; the equipment's
   `rating-distribution` updates.
3. **Owner → Customer:** switch to the owner window (rohit), open the same booking, and submit a
   4★ review of the customer (`equipmentId` is null on this one). The customer's `User.trustScore`
   is nudged by `±(rating-3)×2` — show the trust score before/after on `?view=profile`.
4. Switch back to the customer window and refresh the equipment detail — the new review appears
   in the list and the average rating ticks up.

**API:** `POST /api/v1/bookings/:id/review`, `GET /api/v1/equipment/:id/reviews`,
`GET /api/v1/equipment/:id/rating-distribution`,
`GET /api/v1/intelligence/trust-score?userId=<customerId>`.

---

## Step 6 — Owner dashboard (health, activity, revenue, pricing suggestions)  *(~1 min)*

**Open:** log in as rohit (owner), then `?view=owner-analytics`, `?view=owner-listings`,
and `?view=pricing-suggestions`.

**Narration**
1. **Health scores** — `?view=owner-listings` shows a per-listing **health score** badge (good /
   needs-attention / at-risk) derived from utilization, rating, and dispute rate (uses the
   Phase 1 `health-tips-card` and `eco-badge` components).
2. **Activity feed** — the owner dashboard surfaces the latest booking, review, and dispute
   events for the owner's listings.
3. **Revenue chart** — `?view=owner-analytics` shows a 6-month revenue trend (only `completed`
   bookings), commission, and average-per-booking; below it a per-item **utilization** table
   (`bookingCount`, `totalDaysRented`, `utilizationRate`, `potentialRevenue`).
4. **Pricing suggestions** — `?view=pricing-suggestions` shows the AI-driven demand-aware
   suggestions: each card lists `currentPrice`, `suggestedPrice`, `confidence` (0–1), the
   `reasoning` string, and the inputs (wishlistCount, reviewCount, bookingCount, demandScore,
   categoryAverage). Click **Accept** to update `Equipment.baseDailyPrice`, **Dismiss**, or
   **Edit** to set a custom price.
5. Mention the **what-if simulator** — `POST /intelligence/what-if { equipmentId, dailyPrice,
   availableDaysPerMonth }` projects monthly/annual revenue at a new price using a price-elasticity
   demand multiplier.

**API:** `GET /api/v1/owner/stats`, `GET /api/v1/owner/activity`, `GET /api/v1/owner/revenue`,
`GET /api/v1/analytics/revenue`, `GET /api/v1/analytics/utilization`,
`GET /api/v1/intelligence/pricing-suggestions`, `POST /api/v1/intelligence/what-if`.

---

## Step 7 — Admin analytics (growth, revenue, overview, fraud flags)  *(~1 min)*

**Open:** log in as admin (`admin@rentalhub.test`), then `?view=admin-analytics`,
`?view=fraud-flags`, `?view=admin-overview`.

**Narration**
1. **Platform overview** — `?view=admin-overview` (or `GET /admin/overview`) shows KPI tiles:
   total users by role, equipment by status/category, avg rating, audit events in the last 7 days.
2. **Growth charts** — `GET /admin/growth` returns monthly new users + new equipment listings;
   the admin analytics view renders a dual-axis line chart.
3. **Revenue** — `GET /admin/revenue` returns platform-wide monthly revenue + commission; the
   same revenue chart renders but with the full platform total.
4. **Booking patterns** — weekday distribution + hourly distribution + cancellation rate +
   repeat-customer rate (uses `GET /analytics/patterns`).
5. **Owner leaderboard** — top-10 owners by completed-booking revenue with per-asset ROI
   (`roi = revenue / replacementValue`) and `paybackMonths`.
6. **Fraud flags** — `?view=fraud-flags` opens the rule-based anomaly console. Each row shows
   type (`multiple_failed_payments`, `frequent_cancellations`, `frequent_disputes`,
   `low_trust_score`, `invalid_booking_duration`), severity (`high`/`medium`/`low`),
   description, and the offending user/booking. Show the one high-severity row that fires on
   the seeded data (a frequent-disputes or low-trust account).

**API:** `GET /api/v1/admin/overview`, `GET /api/v1/admin/growth`,
`GET /api/v1/admin/revenue`, `GET /api/v1/admin/stats`,
`GET /api/v1/analytics/revenue`, `GET /api/v1/analytics/patterns`,
`GET /api/v1/analytics/leaderboard`, `GET /api/v1/intelligence/fraud-flags`.

---

## Step 8 — AI damage comparison (pickup vs return photos)  *(~1 min)*

**Open:** `?view=booking-detail&id=…` on a booking that has reached `returned` or `inspected`
(or use Postman to drive the API directly).

**Narration**
1. On the booking detail, the **AI Damage Comparison** card (or the Postman folder
   `Bookings → damage-comparison`) lets the owner upload **pickup** and **return** photo URLs and
   pick an angle (`front`/`back`/`left`/`right`/`top`).
2. Submit → `POST /bookings/:id/damage-comparison`. Behind the scenes the **Vision Provider**
   picks the VLM implementation (z-ai-web-dev-sdk) and falls back to the rule-based comparator
   if the SDK is unavailable. The result is a `DamageComparison` row with `findings[]`
   (`{ region, severity: none|minor|moderate|severe, description, confidence }`), `providerUsed`
   (`vlm` or `rule_based`), `promptLog` (redacted), and a `summary`. A disclaimer banner reminds
   the reviewer that findings are **preliminary**.
3. The owner reviews each finding row and **confirms** or **rejects** it via
   `PATCH /bookings/:id/damage-comparison/:comparisonId { status: 'confirmed'|'rejected' }`.
4. Once at least one finding is confirmed, open `GET /intelligence/damage-estimate?bookingId=…` —
   it returns a **cost estimate** (minor ₹200–1000, moderate ₹1000–5000, severe ₹5000–20000),
   `depositSufficient` flag, and a **suggested resolution** (release deposit / deduct from deposit
   / escalate to dispute). This is what an admin uses during dispute resolution in Step 9.

**API:** `POST /api/v1/bookings/:id/damage-comparison`, `GET /api/v1/bookings/:id/damage-comparison`,
`PATCH /api/v1/bookings/:id/damage-comparison/:comparisonId`,
`GET /api/v1/intelligence/damage-estimate?bookingId=…`.

---

## Step 9 — Raise a dispute and admin resolution  *(~1 min)*

**Open:** `?view=disputes` (customer or owner) → `?view=dispute-detail&id=…`, then admin
`?view=admin-disputes`.

**Narration**
1. The customer (or owner) opens `?view=disputes` and clicks **Raise a dispute** against the
   booking from Step 8. They pick `reason: 'damage'`, write a description, optionally attach
   evidence URLs. `POST /disputes` flips the booking to `disputed`.
2. Both parties land in the dispute thread (`?view=dispute-detail&id=…`). Each message has a
   sender avatar + `isStaff` badge for admin messages. The customer sends one; the owner
   replies — the dispute status auto-flips from `open` to `owner_responded`.
3. Switch to the admin window and open `?view=admin-disputes`. The dispute shows up at the
   top of the queue. Open it; the admin sees the full thread + the AI damage estimate from
   Step 8 in the side panel (`estimatedCostMin`/`Max`, `depositSufficient`,
   `suggestedResolution`).
4. The admin picks a **resolution** (`refund_customer` / `favor_owner` / `split` / `warning`),
   writes a `resolutionNote`, and submits `POST /disputes/:id/resolve`. `refund_customer`
   also writes a `refund` Payment row; the booking is flipped back to `completed`; the
   dispute status becomes `resolved`.

**API:** `POST /api/v1/disputes`, `GET /api/v1/disputes`, `GET /api/v1/disputes/:id`,
`GET|POST /api/v1/disputes/:id/messages`, `POST /api/v1/disputes/:id/resolve`,
`GET /api/v1/intelligence/damage-estimate?bookingId=…`.

---

## Step 10 — AI features (NL search, what-if simulator, trust score)  *(~1 min)*

**Open:** drive each via the API client / Postman (these are the Phase 4 innovation surfaces).

**Narration**
1. **Natural-language search** — `POST /api/v1/search/natural` with body
   `{ query: "DSLR and two lights for a weekend shoot under ₹5000" }`. The server parses
   keywords, category ("DSLR" → `photography`), price (₹5000), and duration (`weekend` → 2 days)
   into structured filters, then runs the standard equipment search. Returns `{ parsed, results,
   resultCount }`. Show how the parsed filter object matches the natural-language input.
2. **What-if simulator** — `POST /api/v1/intelligence/what-if` with
   `{ equipmentId, dailyPrice: 3000, availableDaysPerMonth: 20 }`. Returns `current`
   (current price + projected revenue) vs `simulated` (new price + new availability) with
   `comparison.revenueDiff`, `revenueDiffPct`, and `demandMultiplier` from the price-elasticity
   model. Demonstrate the classic "raise price 50% → demand drops 15% → net revenue +28%" story.
3. **Trust score** — `GET /api/v1/intelligence/trust-score?userId=<id>` returns the live
   `computedScore` + 7-factor breakdown (Verification 10, Completed 25, Cancellation 15,
   Punctuality 20, Disputes 10, Reviews 10, Avg rating 10). Show the seeded customer at 82 with
   the factors laid out as bars.
4. **Health + GDPR wrap-up** (hardening):
   - `GET /api/v1/health` returns `{ status: 'healthy', latency: { total, database }, database:
     'ok', stats: { users, equipment, bookings, disputes }, version, phase }` — useful for
     uptime monitors.
   - `GET /api/v1/gdpr/export` returns the calling user's full data bundle (user, bookings,
     wishlists, reviews, notifications, audit logs, waitlist, disputes) as a single JSON object.
   - `DELETE /api/v1/gdpr/delete` soft-deletes the account (admin cannot self-delete),
     removes wishlist + waitlist entries, and writes an `GDPR_ACCOUNT_DELETED` audit row.

**API:** `POST /api/v1/search/natural`, `POST /api/v1/intelligence/what-if`,
`GET /api/v1/intelligence/trust-score`, `GET /api/v1/health`,
`GET /api/v1/gdpr/export`, `DELETE /api/v1/gdpr/delete`.

---

## Wrap-up  *(~30 s)*

- **Phase 1** — marketplace: auth/RBAC, equipment CRUD, search/filter/compare/wishlist, owner
  listings, admin oversight, audit logs, seed.
- **Phase 2** — booking lifecycle, payments (simulated), disputes, real-time Socket.IO.
- **Phase 3** — analytics + intelligence: revenue/utilization/patterns/leaderboard,
  pricing-suggestions, recommendations, fraud-flags, trust-score, late-prediction, what-if.
- **Phase 4** — AI vision (damage comparison + cost estimate), QR condition passport,
  natural-language search, smart bundles, waitlist, platform health endpoint, GDPR export/delete.

Point the audience at [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system diagram,
[`API_CONTRACT.md`](./API_CONTRACT.md) for the full endpoint reference, and
[`PROGRESS.md`](./PROGRESS.md) for the per-phase status + known issues.
