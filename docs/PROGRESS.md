# RentalHub — Progress

## Current status

- **Phase 1 — Foundation & Marketplace: COMPLETE (backend + seed + API).**
- **Phase 2 — Booking System & Rental Lifecycle: COMPLETE (backend + 12 new views + seed).**
- **Phase 3 — Analytics & Intelligence: COMPLETE (4 analytics + 6 intelligence endpoints + 3 dashboards).**
- **Phase 4 — AI Vision, Innovation & Hardening: COMPLETE (AI damage comparison, dispute
  intelligence, QR condition passport, natural-language search, smart bundles, waitlist, health
  endpoint, GDPR export/delete; 12 new endpoints, 4 new models).**

The API surface, data model, RBAC, audit logging, file upload, and seed are all wired and runnable
for Phases 1–4. The SPA shell (single `/` route with `?view=` keys) renders 17 Phase 1 views and 13
new Phase 2+3 views; Phase 4 endpoints are API-ready and demonstrable via the Postman collection /
`docs/DEMO_SCRIPT.md`. See "Page Inventory" and "Known issues" below for the precise state.

---

## Features done (Phase 1 checklist)

- [x] **Auth & roles** — register, login, logout, refresh (rotating), `me`, profile update,
  avatar upload, forgot-password (dev-mail), reset-password. 3 roles with `requireAuth`/`assertOwner`.
- [x] **Models** — 11 Prisma models (User, Category, Equipment, EquipmentImage, EquipmentSpec,
  AvailabilityBlock, MaintenanceLog, MaintenanceWindow, Wishlist, Review, Notification, AuditLog).
  Soft delete on User/Category/Equipment/Review. Indexes for hot paths. Enums as String + Zod.
- [x] **Customer journey** — browse (`GET /equipment` with q, category, minPrice, maxPrice, city,
  minRating, lat/lng/radiusKm, sort, order, page, limit, status), compare (2–3 items), wishlist
  (toggle, list, is-saved), reviews (read per-equipment, create as customer).
- [x] **Owner listings** — create/update/soft-delete; dynamic pricing rules (weekend_surcharge,
  long_discount, seasonal; ≤8, Zod-validated); image upload (multipart, ≤8/5MB), set primary,
  reorder, delete (auto-promotes a new primary); specs (key/value, ordered, replace-on-update);
  availability blocks (owner_blocked/maintenance/booked); maintenance logs + maintenance windows
  (a window auto-creates a matching availability block).
- [x] **Admin oversight** — user directory (filter by role/q/suspended/verified), patch user
  (role/verify/suspend; cannot demote self), moderation queue (`status` filter), approve/reject
  equipment, audit-logs query (filter by action/resource/actorId), platform stats
  (`usersByRole`, `equipmentByStatus`, `equipmentByCategory`, totals, avgRating, auditLast7d).
- [x] **Upload** — generic `/upload` (multipart `images`), `/upload` DELETE by `publicId`.
  Local storage with type/size validation, Cloudinary-pluggable interface.
- [x] **Seed** — idempotent `bun run seed`; 11 users (1 admin, 5 owners, 5 customers), 10
  categories, 34 equipment listings across 8 cities, ~12 reviews, ~8 wishlists, maintenance logs
  + windows + availability blocks, audit seed rows. Demo accounts printed at the end.

---

## Phase 2: Booking System & Rental Lifecycle — COMPLETE

### New data model

Six new Prisma models added to `prisma/schema.prisma`:

- **`Booking`** — `equipmentId`, `customerId`, `ownerId`, `status`, `previousStatus`, `startDate`,
  `endDate`, `days`, `baseAmount`, `adjustments` (JSON), `depositAmount`, `commissionRate` (10%),
  `commissionAmount`, `totalAmount`, `cancellationPolicy` (`flexible`/`moderate`/`strict`),
  `refundAmount`, `holdExpiresAt`, `confirmedAt`, `pickedUpAt`, `returnedAt`, `inspectedAt`,
  `completedAt`, `cancelledAt`, `cancelReason`, `pickupChecklist`/`returnChecklist`/`pickupPhotos`/
  `returnPhotos` (JSON), `idempotencyKey`. Compound index on `{equipmentId, startDate, endDate,
  status}` for concurrency, secondary indexes on `customerId+status`, `ownerId+status`,
  `status`, `holdExpiresAt`, and `@@unique([idempotencyKey])`.
- **`BookingStatusHistory`** — append-only audit trail (`fromStatus`, `toStatus`, `actorId`,
  `note`).
- **`Payment`** — `bookingId`, `userId`, `type` (`hold`/`release`/`refund`/`charge`/`commission`),
  `amount`, `status` (`pending`/`completed`/`failed`/`reversed`), `reference` (simulated gateway
  ref), `idempotencyKey`.
- **`BookingMessage`** — chat between customer and owner on a booking (`senderId`, `message`,
  `attachmentUrl`).
- **`Dispute`** — `bookingId`, `raisedById`, `againstId`, `reason` (`damage`/`late_return`/
  `wrong_item`/`payment`/`other`), `description`, `evidenceUrls` (JSON), `status`
  (`open`/`owner_responded`/`admin_reviewing`/`resolved`/`closed`), `resolution`
  (`refund_customer`/`favor_owner`/`split`/`warning`), `resolutionNote`, `resolvedById`,
  `resolvedAt`.
- **`DisputeMessage`** — discussion thread for a dispute; `isStaff` flag marks admin messages.

`User` got `trustScore Int @default(50)` + booking/payment/dispute relations; `Equipment` got
`cancellationPolicy String @default("flexible")` and `autoApprove Boolean @default(false)`.

### Booking state machine (`src/lib/booking-service.ts`)

```
pending ──▶ held ──▶ confirmed ──▶ picked_up ──▶ in_use ──▶ return_pending ──▶ returned ──▶ inspected ──▶ completed
   │          │          │            │             │             │
   ▼          ▼          ▼            ▼             ▼             ▼
cancelled  cancelled  cancelled   late/        late/         late/         (inspected may go to disputed)
                      cancelled   disputed              disputed
```

Branch states:
- **`cancelled`** — terminal; the matching `booked` availability block is removed.
- **`late`** — auto-detected by cron when `endDate` passes for any active status; can transition
  back to `returned` (owner confirms late return) or to `disputed`/`cancelled`.
- **`disputed`** — set when a `Dispute` is raised against the booking; resolved back to
  `completed` (admin) or `cancelled` (admin).

Legal transitions are enforced by `assertTransition(from, to)` which throws
`INVALID_TRANSITION 422` on illegal moves. Every transition writes a `BookingStatusHistory` row.

### Availability engine

`checkAvailability(equipmentId, startDate, endDate, excludeBookingId?)` returns
`{ available, conflicts[] }`. Conflicts are checked against three sources:

1. **Active bookings** — `status in (held, confirmed, picked_up, in_use, return_pending,
   returned, inspected)`.
2. **Availability blocks** — `owner_blocked`, `maintenance`, `booked`.
3. **Maintenance windows**.

`Equipment.bufferHours` is applied as a buffer around the requested range (subtract from
`startDate`, add to `endDate`) before checking. On booking create, a `booked` availability
block is written atomically with the booking; on cancel/complete the block is removed.

### Pricing & commission

`calculateBookingPrice()` reuses the Phase 1 `calculatePrice()` (weekend surcharge, long
discount, seasonal) and adds a flat **10% platform commission** (`commissionAmount`).
`totalAmount` is the rental total (excluding deposit); `depositAmount` is held separately and
released on completion (or refunded in full/partial on cancellation/dispute resolution per
policy).

### Cancellation policies (`calculateRefund()`)

| Policy     | More than          | Within               |
| ---------- | ------------------ | -------------------- |
| `flexible` | 24h → **100%**     | 24h → **50%**        |
| `moderate`| 48h → **50%**      | 48h → **25%**        |
| `strict`  | 72h → **25%**      | 72h → **0%**         |

`completed` and `returned` bookings refund `0`.

### Checkout hold & cron jobs

- A new booking enters `held` with `holdExpiresAt = now + 10 min`. If the customer doesn't
  confirm + pay within 10 minutes, the cron job `releaseExpiredHolds()` auto-cancels the
  booking and removes the `booked` block.
- `detectLateReturns()` flips any active booking past `endDate` to `late`.
- Both jobs are exposed at `POST /api/v1/cron/run?job=release-holds|detect-late|all`. There is
  no internal scheduler yet — see Known Issues.

### New endpoints (20 routes)

Bookings: `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/confirm`,
`POST /bookings/:id/cancel`, `POST /bookings/:id/pickup`, `POST /bookings/:id/return`,
`POST /bookings/:id/inspect`, `POST /bookings/:id/complete`, `POST /bookings/:id/extend`,
`POST /bookings/:id/approve`, `POST /bookings/:id/review`, `GET|POST /bookings/:id/messages`,
`POST /bookings/:id/payments`, `POST /bookings/:id/payments/:paymentId`,
`POST /bookings/check-availability`.

Disputes: `POST /disputes`, `GET /disputes`, `GET /disputes/:id`,
`GET|POST /disputes/:id/messages`, `POST /disputes/:id/resolve`.

Cron: `POST /cron/run`.

### Seed (Phase 2)

120 bookings across 12 months with payments, status history, booking messages, disputes,
trust-score updates. Provides meaningful historical data for the Phase 3 analytics.

### New SPA views (12)

`checkout`, `my-rentals`, `booking-detail`, `owner-bookings`, `owner-calendar`, `disputes`,
`dispute-detail`, `admin-bookings`, `admin-disputes`, `admin-analytics`, `owner-analytics`,
`pricing-suggestions`, `fraud-flags` — see Page Inventory below for roles and routes.

### Socket.IO

Mini service on **port 3003** for real-time availability updates (`availability:updated` event
per equipment) and booking chat. The Next.js app still has a 30s polling fallback; wiring the
frontend socket client is a follow-up (see Known Issues).

---

## Phase 3: Analytics & Intelligence — COMPLETE

### Analytics API (4 endpoints)

| Endpoint                              | Auth            | Description |
| ------------------------------------- | --------------- | ----------- |
| `GET /analytics/revenue?months=N`     | owner / admin   | Monthly revenue trend (default 6, max 12). Owners scoped to their own bookings; admins see platform-wide. Returns `months[]` (label, revenue, commission, bookings) and `totals` (revenue, commission, bookings, avgPerBooking). Only `completed` bookings counted. |
| `GET /analytics/utilization`          | owner / admin   | Per-item utilization rate = total days rented ÷ days since listed (capped at 100%). Returns `items[]` (id, title, baseDailyPrice, status, coverUrl, bookingCount, totalDaysRented, utilizationRate, potentialRevenue) sorted by utilization desc, plus `avgUtilization`. |
| `GET /analytics/patterns`             | owner / admin   | Booking patterns: weekday distribution, hourly distribution, `avgDuration`, `cancellationRate`, `cancelReasons[]`, `completedCount`, `cancelledCount`, `repeatRate`, `repeatCustomers`, `totalCustomers`, `totalBookings`. |
| `GET /analytics/leaderboard`          | admin           | Owner leaderboard (top 10 by revenue from completed bookings, with `businessName`/`avatarUrl`/`isVerified`) plus per-asset ROI (`revenue`, `roi` = revenue ÷ replacementValue, `monthlyRevenue`, `paybackMonths`). |

### Intelligence API (6 endpoints)

| Endpoint                              | Auth            | Description |
| ------------------------------------- | --------------- | ----------- |
| `GET /intelligence/pricing-suggestions` | owner / admin | Demand-aware pricing per active listing. Demand score = `(wishlists×2 + reviews×3 + bookings×1) ÷ monthsSinceListed`. Compares current price against category average. Returns per-equipment `suggestedPrice`, `confidence` (0–1), `reasoning`, and `inputs` (wishlistCount, reviewCount, bookingCount, monthsSinceListed, categoryAverage, demandScore). Suggestions are also persisted to `PriceSuggestion` rows. |
| `POST /intelligence/pricing-suggestions/:id` | owner / admin | Accept / dismiss / edit a suggestion. Body `{ action: 'accept'\|'dismiss'\|'edit', editedPrice? }`. Accept/edit also updates `Equipment.baseDailyPrice`. |
| `GET /intelligence/recommendations?type=…` | public (optional) | `?type=for_you` (default; personalized from wishlist categories, scored by rating×20 + reviewCount×5 + wishlistCount×3), `?type=frequently_together&id=…` (co-booking — equipment booked by the same customers who booked this item), `?type=similar&id=…` (same category, excluding current). Each result has a `reason` and `matchScore`. |
| `GET /intelligence/fraud-flags`        | admin           | Rule-based anomaly detection. Flags: `multiple_failed_payments` (≥3 failed, medium), `frequent_cancellations` (≥5 cancelled, medium), `frequent_disputes` (≥3 raised, high), `low_trust_score` (trust < 30, high), `invalid_booking_duration` (days ≤ 0, low). Returns `{ flags[], totalFlags }`. |
| `GET /intelligence/trust-score?userId=…` | customer / owner / admin | Returns `trustScore` (stored) + `computedScore` (live) and a `factors[]` breakdown: Verification (10), Completed rentals (25), Cancellation rate (15), Punctuality (20), Disputes (10), Reviews received (10), Avg rating (10) — totals 100. Customers can only query their own; admins can query anyone. |
| `GET /intelligence/late-prediction`   | owner / admin   | Active bookings with risk score = `trustRisk × 0.4 + timeRisk × 0.6` where trustRisk scales by trust < 50 and timeRisk scales by hours < 24. Returns `predictions[]` with `prediction` (`on_track`/`at_risk`/`likely_late`), `recommendation`, `riskScore`, `hoursRemaining`. Also returns `atRiskCount` and `likelyLateCount`. |
| `POST /intelligence/what-if`          | owner / admin   | Price/availability simulator. Body `{ equipmentId, dailyPrice, availableDaysPerMonth }`. Returns `current` (dailyPrice, estimatedUtilization, monthlyRevenue, annualRevenue), `simulated` (new dailyPrice, availableDaysPerMonth, estimatedUtilization, monthlyRevenue, annualRevenue, sampleBookingTotal), `comparison` (revenueDiff, revenueDiffPct, demandMultiplier). Demand multiplier applies price elasticity (price↑ → demand↓). |

### New SPA views (3 dashboards + 2 consoles)

`admin-analytics`, `owner-analytics`, `pricing-suggestions`, `fraud-flags` (admin).

`admin-analytics` shows revenue trend chart, weekday booking patterns, owner leaderboard with
ROI/payback. `owner-analytics` shows revenue chart + per-item utilization. `pricing-suggestions`
shows AI-driven suggestions with accept/dismiss/edit. `fraud-flags` shows the rule-based
anomaly list with severity badges.

### Seed (Phase 3)

The 120 Phase 2 bookings now produce meaningful trend / utilization / pattern / leaderboard
data; trust scores are derived from booking/review history so the fraud-flags endpoint returns
real findings (e.g. frequent-dispute and low-trust flags fire on seeded accounts).

---

## Phase 4: AI Vision, Innovation & Hardening — COMPLETE

### Status

**COMPLETE.** All Phase 4 features are implemented, API-tested, and documented in
`API_CONTRACT.md`. Phase 4 endpoints are API-ready; frontend views for the new surfaces are the
next hand-off (see Known Issues).

### Features

- [x] **AI damage comparison** — pickup-vs-return photo comparison via a pluggable
  **Vision Provider** interface. `VLMProvider` uses the `z-ai-web-dev-sdk` chat completions API
  to return structured findings (`region`, `severity` `none|minor|moderate|severe`,
  `description`, `confidence`); `RuleBasedProvider` is the always-on fallback. Each comparison
  is persisted to `DamageComparison` with `status: pending|confirmed|rejected`, `reviewedById`,
  `reviewedAt`, `providerUsed`, and a redacted `promptLog`. Every response carries a
  "Preliminary, requires human confirmation" disclaimer.
- [x] **Dispute intelligence (damage estimate)** — `GET /intelligence/damage-estimate` turns
  confirmed findings into a repair-cost estimate (minor ₹200–1000, moderate ₹1000–5000, severe
  ₹5000–20000), a `depositSufficient` flag, a `suggestedResolution` (release deposit / deduct /
  escalate to dispute), and the equipment's last-5 maintenance history for context. Used by the
  admin during dispute resolution.
- [x] **QR condition passport** — `GET /equipment/:id/condition-passport` is a public, read-only
  JSON page a customer can render at pickup: title, description, condition + conditionNotes,
  owner (name + `isVerified`), base daily price, images, specs, average rating + review count,
  completed-bookings count, last 10 maintenance logs, and a `passportGeneratedAt` timestamp.
  Designed to be linked from a QR code on the physical equipment.
- [x] **Natural-language search** — `POST /search/natural` parses a free-text query like
  *"DSLR and two lights for a weekend shoot under ₹5000"* into structured filters (`q`,
  `category` via a keyword map, `maxPrice`, `duration` for `weekend`/`week`) and runs the
  standard equipment search. Returns `{ parsed, results, resultCount }`.
- [x] **Smart bundles** — `GET /bundles` lists active bundles with computed `totalBasePrice`,
  `discountedPrice`, and `savings`; `POST /bundles` lets an owner bundle their own equipment
  (or an admin bundle any) with a `discountPercent` (0–50%) and `required` flags per item.
  Bundle items are persisted to `Bundle` + `BundleItem`.
- [x] **Waitlist** — `POST /waitlist` lets a customer join the waitlist for an unavailable date
  range on a piece of equipment; `GET /waitlist` returns the customer's own entries (or, for an
  owner, entries against their equipment); `DELETE /waitlist/:id` leaves. Status enum:
  `waiting | notified | booked | expired`. Persisted to `Waitlist`.
- [x] **Platform health endpoint** — `GET /health` returns `{ status: 'healthy'|'degraded',
  timestamp, uptime, latency: { total, database }, database: 'ok'|'error', stats: { users,
  equipment, bookings, disputes }, version, phase }`. No auth required; suitable for uptime
  monitors.
- [x] **GDPR export / delete** — `GET /gdpr/export` returns the calling user's full data bundle
  (user, bookings, wishlists, reviews, notifications, audit logs, waitlist, disputes) as a
  single JSON object. `DELETE /gdpr/delete` soft-deletes the account (admins cannot self-delete),
  removes wishlist + waitlist entries, marks notifications read, and writes an
  `GDPR_ACCOUNT_DELETED` audit row.

### New API endpoints (12 routes)

| Group | Endpoint |
| --- | --- |
| Damage comparison | `POST /bookings/:id/damage-comparison`, `GET /bookings/:id/damage-comparison`, `PATCH /bookings/:id/damage-comparison/:comparisonId` |
| Intelligence | `GET /intelligence/damage-estimate?bookingId=…` |
| QR passport | `GET /equipment/:id/condition-passport` |
| NL search | `POST /search/natural` |
| Bundles | `GET /bundles`, `POST /bundles` |
| Waitlist | `POST /waitlist`, `GET /waitlist`, `DELETE /waitlist/:id` |
| Hardening | `GET /health`, `GET /gdpr/export`, `DELETE /gdpr/delete` |

### New models (4)

Added to `prisma/schema.prisma` under the `// ===== Phase 4: AI Vision & Innovation =====`
section:

- **`DamageComparison`** — `bookingId` (cascade), `pickupPhotoUrl`, `returnPhotoUrl`, `angle`
  (`front|back|left|right|top`), `findings Json?` (`[{ region, severity, description, confidence }]`),
  `status` (`pending|confirmed|rejected`), `reviewedById`, `reviewedAt`, `providerUsed`
  (`vlm|rule_based|manual`), `promptLog` (redacted), `createdAt`. Indexes on `bookingId` +
  `status`.
- **`Bundle`** — `name`, `description?`, `discountPercent Float @default(10)`, `status
  @default("active")`, `createdAt`, `updatedAt`, `items BundleItem[]`. Index on `status`.
- **`BundleItem`** — `bundleId` (cascade), `equipmentId`, `required Boolean @default(false)`.
  Indexes on `bundleId` + `equipmentId`.
- **`Waitlist`** — `equipmentId` (cascade), `userId` (cascade), `startDate`, `endDate`,
  `notifiedAt?`, `expiresAt?`, `status @default("waiting")` (`waiting|notified|booked|expired`),
  `createdAt`. Indexes on `equipmentId`, `userId`, `status`.

`User` and `Equipment` gained the matching back-relations (`waitlist Waitlist[]`,
`bundleItems BundleItem[]`, `waitlists Waitlist[]`); `Booking` gained
`damageComparisons DamageComparison[]`.

### Phase 4 known issues

(see also Known Issues §23–28 below)

- The VLM provider is wired but only fires when `z-ai-web-dev-sdk` can be dynamically imported
  with valid credentials; in the sandbox it transparently falls back to the rule-based provider,
  so the API shape is identical but the findings are conservative.
- Damage-comparison findings are always returned with the disclaimer "Preliminary, requires
  human confirmation" — never auto-applied to a deposit refund.
- Phase 4 has **no SPA views yet** — bundles, waitlist, condition passport, NL search, GDPR
  export/delete, and the AI damage comparison UI are API-only in this build. They are
  demonstrable via the Postman collection and the 10-minute `DEMO_SCRIPT.md`.
- The natural-language parser is keyword + regex based (not an LLM); it understands a fixed set
  of category keywords and `under/below/upto ₹N` price phrases. An LLM parser can be plugged in
  behind the same `{ parsed, results }` shape.

---

## Page Inventory (SPA views, served from `/`)

The single Next.js route renders a SPA shell that switches views via a `?view=<key>` query param
(client-side). The table below is the Phase 1–3 view contract the API supports.

### Phase 1 views

| View name        | Route (`?view=`)            | Role                  | Status                          |
| ---------------- | --------------------------- | --------------------- | ------------------------------- |
| home             | `?view=home` (default)       | public                | Shell ready / UI pending         |
| search           | `?view=search`               | public                | API ready / UI pending           |
| equipment        | `?view=equipment&id=…`        | public                | API ready / UI pending           |
| compare          | `?view=compare&ids=a,b,c`     | public                | API ready / UI pending           |
| wishlist         | `?view=wishlist`              | customer              | API ready / UI pending           |
| login            | `?view=login`                 | public                | API ready / UI pending           |
| register         | `?view=register`              | public                | API ready / UI pending           |
| reset-password   | `?view=reset-password&token=…`| public                | API ready / UI pending           |
| profile          | `?view=profile`               | customer              | API ready / UI pending           |
| owner-listings   | `?view=owner-listings`        | owner                 | API ready / UI pending           |
| listing-form     | `?view=listing-form&id=…`      | owner                 | API ready / UI pending           |
| maintenance      | `?view=maintenance&id=…`       | owner                 | API ready / UI pending           |
| admin-users      | `?view=admin-users`           | admin                 | API ready / UI pending           |
| admin-categories | `?view=admin-categories`      | admin                 | API ready / UI pending           |
| admin-moderation | `?view=admin-moderation`      | admin                 | API ready / UI pending           |
| admin-audit      | `?view=admin-audit`           | admin                 | API ready / UI pending           |

### Phase 2 views — Booking System & Rental Lifecycle

| View name        | Route (`?view=`)                 | Role                  | Status                          |
| ---------------- | -------------------------------- | --------------------- | ------------------------------- |
| checkout         | `?view=checkout&equipmentId=…&start=…&end=…` | customer | API ready / UI pending |
| my-rentals       | `?view=my-rentals`                | customer              | API ready / UI pending           |
| booking-detail   | `?view=booking-detail&id=…`       | customer / owner      | API ready / UI pending           |
| owner-bookings   | `?view=owner-bookings`            | owner                 | API ready / UI pending           |
| owner-calendar   | `?view=owner-calendar`            | owner                 | API ready / UI pending           |
| disputes         | `?view=disputes`                  | customer / owner      | API ready / UI pending           |
| dispute-detail   | `?view=dispute-detail&id=…`       | customer / owner / admin | API ready / UI pending        |
| admin-bookings   | `?view=admin-bookings`            | admin                 | API ready / UI pending           |
| admin-disputes   | `?view=admin-disputes`            | admin                 | API ready / UI pending           |

### Phase 3 views — Analytics & Intelligence

| View name           | Route (`?view=`)                | Role                  | Status                          |
| ------------------- | ------------------------------- | --------------------- | ------------------------------- |
| admin-analytics     | `?view=admin-analytics`         | admin                 | API ready / UI pending           |
| owner-analytics     | `?view=owner-analytics`         | owner                 | API ready / UI pending           |
| pricing-suggestions | `?view=pricing-suggestions`     | owner                 | API ready / UI pending           |
| fraud-flags         | `?view=fraud-flags`             | admin                 | API ready / UI pending           |

> "API ready / UI pending" = the matching `/api/v1/*` endpoints are implemented, tested, and
> documented in `API_CONTRACT.md`; the React view component is the next hand-off.

---

## Endpoints implemented

See **`docs/API_CONTRACT.md`** for the full table. Summary:

- **Auth (9):** register, login, logout, refresh, me, profile (PATCH), avatar (POST), forgot-password,
  reset-password.
- **Categories (5):** list, create, get, update, soft-delete.
- **Equipment (8):** list (search), create, my, compare, get, update, soft-delete, images POST/PATCH/DELETE.
- **Availability (3):** list, block, unblock.
- **Maintenance (7):** logs list/create/update/delete; windows list/create/delete.
- **Reviews (3):** list-by-equipment (paged), create (customer), helpful vote toggle.
- **Wishlist (5):** list (paged), add, toggle, remove, is-in-wishlist.
- **Upload (2):** POST (multipart), DELETE (by publicId).
- **Admin (9):** users list, user patch, equipment moderation queue, equipment moderate, audit-logs,
  stats, growth, revenue, overview.
- **Customer/Owner dashboards (5):** customer stats, owner stats, owner activity, owner revenue,
  owner profile, price insight, rating distribution, equipment trending.
- **Notifications (3):** list (with `x-unread-count` header), mark-one-read, mark-all-read.
- **Phase 2 Bookings (20):** create, list, get, confirm, cancel, pickup, return, inspect, complete,
  extend, approve, review, messages (list+send), payments (charge+hold, release, refund),
  check-availability.
- **Phase 2 Disputes (5):** raise, list, get, messages (list+send), resolve.
- **Phase 2 Cron (1):** `POST /cron/run?job=release-holds|detect-late|all`.
- **Phase 3 Analytics (4):** revenue, utilization, patterns, leaderboard.
- **Phase 3 Intelligence (6):** pricing-suggestions (list + accept/dismiss/edit), recommendations,
  fraud-flags, trust-score, late-prediction, what-if.
- **Phase 4 Damage comparison (3):** `POST /bookings/:id/damage-comparison`,
  `GET /bookings/:id/damage-comparison`, `PATCH /bookings/:id/damage-comparison/:comparisonId`.
- **Phase 4 Dispute intelligence (1):** `GET /intelligence/damage-estimate?bookingId=…`.
- **Phase 4 QR passport (1):** `GET /equipment/:id/condition-passport`.
- **Phase 4 NL search (1):** `POST /search/natural`.
- **Phase 4 Bundles (2):** `GET /bundles`, `POST /bundles`.
- **Phase 4 Waitlist (3):** `POST /waitlist`, `GET /waitlist`, `DELETE /waitlist/:id`.
- **Phase 4 Hardening (3):** `GET /health`, `GET /gdpr/export`, `DELETE /gdpr/delete`.

---

## Known issues / limitations

### Phase 1

1. **SQLite has no native geo index.** Distance filtering & `sort=distance` use the Haversine
   formula computed in JS over the candidate set (`src/lib/geo.ts`). Fine for the seeded catalog
   (~30 listings); will revisit with PostGIS or an FTS5 table in a later phase.
2. **No full-text search.** Keyword search uses Prisma `contains` (SQL `LIKE '%q%'`). No
   relevance ranking, no stop-words. A later phase may add SQLite FTS5 or an external index.
3. **Local uploads only.** Files land in `public/uploads/`. The upload interface is
   Cloudinary-pluggable; swapping means re-implementing three functions in `src/lib/upload.ts`.
   No image resizing/optimization is done yet (`sharp` is a dependency but not yet wired).
4. **Upload validation surfaces as 500.** `parseAndSaveImages` throws plain `Error`s with a `.code`
   (`NO_FILES`/`BAD_TYPE`/`TOO_LARGE`/`TOO_MANY`) which currently flow through `handleError` as
   `INTERNAL_ERROR` (500). The API contract documents these as `VALIDATION_ERROR` (400) for client
   semantics; a small `handler.ts` patch will map them explicitly.
5. **Email is dev-console only.** Reset links are printed to the server log; no SMTP in sandbox.
6. **`Equipment.moderatedById` and `AvailabilityBlock.ownerId` / `MaintenanceWindow.ownerId` /
   `MaintenanceLog.ownerId` are denormalized** — not declared as Prisma relations to avoid circular
   cascades; referential integrity is enforced in app code.
7. **Rate limiting is in-memory.** Correct for single-server sandbox; swap to Redis in production
   behind the same `rateLimit()` signature.
8. **`next-auth` is installed but unused.** Custom HS256 JWT was chosen for fine-grained control
   (see `DECISIONS.md §2`). The dependency can be removed in a cleanup pass.

### Phase 2

9. **Payments are simulated.** `POST /bookings/:id/payments` writes a `charge` + a `hold`
   `Payment` row with `status='completed'` and a `sim_*` reference. There is no real gateway
   integration; the `Payment` interface is Stripe/Razorpay-pluggable behind the same route shape.
10. **Cron is API-callable but not auto-scheduled.** `POST /cron/run?job=…` works, but an
    external scheduler (e.g. Vercel Cron, node-cron, or a k8s CronJob) needs to invoke it for
    hold-release + late-detection to actually run on a clock.
11. **Socket.IO is server-side only.** The mini socket service runs on port 3003 and emits
    `availability:updated` + booking chat events, but the frontend still polls every 30s.
    Wiring a frontend socket client is a follow-up.
12. **No FullCalendar.** The owner-calendar and equipment-detail availability calendar use a
    custom month-grid component instead of FullCalendar (the library was not installed).
13. **Idempotency keys are optional.** `POST /bookings` accepts an `idempotencyKey` and
    `POST /bookings/:id/payments` synthesises one from the booking id; clients that omit the
    key can still create duplicate bookings on retry.
14. **`Equipment.autoApprove` is not yet surfaced in the listing form.** The booking flow
    honours it (auto-approve → straight to `confirmed`), but there is no UI toggle to set it.
15. **Two-way review.** `POST /bookings/:id/review` allows both customer → owner/equipment and
    owner → customer reviews after `completed`; the existing `POST /reviews` endpoint remains
    for general equipment reviews. Trust score is nudged by ±2 per star above/below 3.

### Phase 3

16. **Pricing suggestions are rule-based, not ML.** The demand score is a weighted formula
    (`(wishlists×2 + reviews×3 + bookings×1) ÷ monthsSinceListed`) with three threshold rules
    (raise 15%, lower 10%, align to category). The `reasoning` string is human-readable; an ML
    model could be plugged in behind the same response shape.
17. **Recommendations are co-booking + content-based.** No matrix factorization or embeddings;
    `frequently_together` counts co-occurring bookings by the same customers. Adequate for the
    seeded catalog; revisit with a real model at scale.
18. **Fraud detection is rule-based.** Five rules with fixed thresholds (`≥3` failed payments,
    `≥5` cancellations, `≥3` disputes, trust `<30`, days `≤0`). No ML anomaly model.
19. **Trust score factors are deterministic.** The 7-factor breakdown is computed live; the
    stored `User.trustScore` is updated only on review creation (`±(rating-3)*2`).
20. **Late prediction uses a 40/60 trust/time risk blend.** The weights are hard-coded; tuning
    should be data-driven once real late-return outcomes exist.
21. **What-if uses a price-elasticity heuristic.** `demandMultiplier = max(0.5, 1 - (priceChangeRatio - 1) * 0.3)` for price increases; `1 + (1 - priceChangeRatio) * 0.2` for decreases. Real
    elasticity should be derived from booking history per category.
22. **Utilization caps at 100%.** `utilizationRate = min(100, totalDaysRented ÷ daysSinceListed × 100)`. Multi-booking overlap on the same day is not subtracted.

### Phase 4

23. **VLM provider degrades to rule-based in the sandbox.** `VLMProvider` is wired with
    `z-ai-web-dev-sdk` and the correct damage-assessment prompt, but the SDK only fires when
    credentials are present and the dynamic import resolves. In the sandbox the
    `RuleBasedProvider` fallback is used — same response shape, conservative findings, the
    "preliminary" disclaimer is always attached. Findings are never auto-applied to a deposit.
24. **Phase 4 has no SPA views.** Bundles, waitlist, condition-passport rendering, NL search box,
    GDPR export/delete UI, and the AI damage-comparison reviewer are API-only in this build.
    They are demonstrable via the Postman collection and `docs/DEMO_SCRIPT.md`.
25. **NL search parser is keyword + regex, not an LLM.** A fixed keyword → category map and
    `under/below/upto ₹N` price regex extract structured filters. Swapping in an LLM function-call
    parser is a drop-in behind the same `{ parsed, results }` shape.
26. **Damage estimate uses fixed severity → cost bands.** Minor ₹200–1000, moderate ₹1000–5000,
    severe ₹5000–20000 are hard-coded. They are a starting point for the admin, not a final
    repair quote.
27. **Waitlist is not yet auto-notified.** The `Waitlist.status` enum has `notified`/`booked`/
    `expired` values, but no cron job flips entries yet — that needs an external scheduler just
    like the Phase 2 cron (Known Issue #10).
28. **GDPR export is a single JSON dump.** No ZIP / machine-readable manifest; `GET /gdpr/export`
    returns the raw `{ user, bookings, wishlists, reviews, notifications, auditLogs, waitlist,
    disputes }` object. `DELETE /gdpr/delete` is a soft delete (`User.deletedAt = now()`) plus
    cleanup of wishlist/waitlist; bookings and reviews are retained for record-keeping.

---

## Integration checkpoint notes

- **Seed works end-to-end:** `bun run db:push && bun run seed` produces a fully populated DB
  (Phase 1 marketplace + 120 Phase 2 bookings across 12 months + Phase 3 trust scores) and
  prints the demo accounts.
- **RBAC tested:** every protected route enforces `requireAuth(roles)` + `assertOwner(...)` where
  applicable; admin endpoints reject non-admin callers with `FORBIDDEN 403`; owner endpoints
  reject non-owning owners with `FORBIDDEN 403`.
- **Auth round-trip:** register → cookies set → `GET /auth/me` returns the user → access expires →
  `POST /auth/refresh` rotates refresh and returns the user → original request retries.
- **Audit trail:** every state-changing action writes a `AuditLog` row; booking transitions also
  write `BookingStatusHistory` rows. Phase 4 audits `AI_DAMAGE_COMPARISON`,
  `AI_FINDING_REVIEWED`, `BUNDLE_CREATED`, `WAITLIST_JOINED`, and `GDPR_ACCOUNT_DELETED`.
- **Envelope:** all endpoints return the documented `{ success, data, error, meta }` envelope;
  Prisma `P2002`/`P2025` are auto-mapped to `CONFLICT 409` / `NOT_FOUND 404`.
- **Postman collection** ships at `docs/postman/RentalHub.postman_collection.json` with folders
  matching the API groups (Auth, Categories, Equipment, Availability, Maintenance, Reviews,
  Wishlist, Upload, Admin, Bookings, Disputes, Analytics, Intelligence); uses `{{base_url}}`
  and example bodies for the happy paths.

---

## Next phase — Phase 5 (post-launch hardening)

1. **SPA views for Phase 4 surfaces** — bundles catalog, waitlist management, condition-passport
   QR rendering, NL search box, GDPR self-service page, AI damage-comparison reviewer.
2. **Waitlist auto-notify cron** — a scheduled job (Vercel Cron / node-cron / k8s CronJob) that
   flips `Waitlist.status` to `notified` and emits a `Notification` row when an equipment's
   calendar opens up.
3. **Real VLM credentials in production** — wire the live `z-ai-web-dev-sdk` key so
   `VLMProvider.compare()` runs the multimodal chat completion instead of the rule-based fallback.
4. **Real payment gateway** (Stripe/Razorpay) behind the existing `Payment` interface.
5. **Cloudinary / Redis / SMTP** — flip the pluggable adapters (`src/lib/upload.ts`,
   `src/lib/rateLimit.ts`, the forgot-password mailer) to their production backends.
6. **External scheduler** for the Phase 2 + Phase 4 cron jobs (`POST /cron/run` + waitlist notify).
7. **LLM-backed NL search** — replace the regex/keyword parser with an LLM function-call parser
   behind the same `{ parsed, results }` shape.
8. **Conversational assistant** for booking, search, and dispute help.
