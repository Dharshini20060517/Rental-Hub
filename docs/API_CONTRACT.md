# RentalHub — API Contract (v1)

All RentalHub REST endpoints live under the versioned prefix **`/api/v1`**. They are implemented as
Next.js 16 Route Handlers (`src/app/api/v1/**/route.ts`) and return a single, consistent JSON envelope.

---

## 1. Envelope

Every response — success or failure — uses this shape:

```json
{
  "success": true | false,
  "data":    <T | null>,
  "error":   { "code": "...", "message": "...", "details": {} } | null,
  "meta":    { "page": 1, "limit": 12, "total": 0, "totalPages": 0 } | undefined
}
```

| Field    | Type                       | Notes                                                                          |
| -------- | -------------------------- | ------------------------------------------------------------------------------ |
| success  | boolean                    | `true` on 2xx, `false` on 4xx/5xx                                               |
| data     | `T \| null`                 | The payload on success; `null` on failure                                       |
| error    | `ApiError \| null`         | `{ code, message, details? }` on failure; `null` on success                    |
| meta     | `ApiMeta \| undefined`     | Pagination info — only present on paged collection endpoints                    |

`meta` shape: `{ page, limit, total, totalPages }`. `totalPages = ceil(total / limit) || 0`.

Helpers (see `src/lib/api.ts`): `ok(data, status, meta?)`, `paged(rows, page, limit, total)`,
`fail(code, message, status, details?)`, `failFromZod(zodError)`.

---

## 2. Authentication Model

- **Mechanism:** custom HS256 JWT (hand-rolled with Node `crypto`, no extra deps) — see `src/lib/auth.ts`.
- **Tokens:** short-lived **access** token (default `900s`) + long-lived **refresh** token
  (default `604800s`, 7 days). Refresh tokens carry a `jti` and are **rotated on every refresh**.
- **Transport:** **httpOnly cookies** — `rh_access` (access) and `rh_refresh` (refresh).
  - `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: true` only in production.
  - No tokens are returned in the JSON body and clients never read them via JS.
- **Payload:** `{ sub, role, type: 'access'|'refresh', iat, exp, jti? }`.
- **Session helper:** `getSession()` resolves `{ id, role }` from the access cookie; if the access
  token is missing/expired it falls back to the refresh cookie (so SSR/SPA reads still work mid-session).

### 401 → Refresh → Retry flow (client)

1. Any protected request that returns `401 UNAUTHENTICATED` (access token expired/missing) is
   intercepted by the Axios client.
2. The client POSTs to `/api/v1/auth/refresh` (same-site cookies are sent automatically).
3. On `200`, the server sets new `rh_access` + rotated `rh_refresh` cookies and returns the safe user.
4. The client **retries** the original request once. On a second `401` the user is logged out.

### Role model (RBAC)

Roles: `customer`, `owner`, `admin` (stored as String on `User.role`, validated by Zod).

- `requireAuth(roles?)` — throws `UNAUTHENTICATED` (401) if no session, `FORBIDDEN` (403) if role not allowed.
- `assertOwner(resourceOwnerId, actorId, isAdmin)` — admin bypasses; otherwise the actor must own the
  resource or `FORBIDDEN` (403) is thrown. Used for all owner-scoped mutations (listings, images,
  availability, maintenance, etc.).
- `optionalAuth()` — returns session or `null` (used by `GET /wishlist/:equipmentId`).

---

## 3. Error Codes

| Code                     | HTTP | Meaning                                                                                  |
| ------------------------ | ---- | ---------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`        | 401  | No valid access/refresh token supplied.                                                  |
| `NO_REFRESH_TOKEN`      | 401  | Refresh endpoint called without a `rh_refresh` cookie.                                   |
| `INVALID_REFRESH_TOKEN`  | 401  | Refresh token signature/expiry invalid — user must log in again.                         |
| `INVALID_CREDENTIALS`    | 401  | Login email/password mismatch.                                                            |
| `INVALID_TOKEN`          | 400  | Password-reset token invalid or expired.                                                  |
| `FORBIDDEN`              | 403  | Authenticated but role/ownership check failed.                                           |
| `ACCOUNT_SUSPENDED`      | 403  | `user.isSuspended === true`.                                                              |
| `ACCOUNT_DISABLED`       | 403  | Account has been soft-deleted (`deletedAt` set).                                          |
| `BAD_REQUEST`            | 400  | Generic client error (e.g. admin self-demotion, paying a non-`held` booking).              |
| `VALIDATION_ERROR`       | 422  | Zod schema rejected the body/query; `details` is the array of Zod issues.                 |
| `INVALID_TRANSITION`     | 422  | Booking state-machine move not in the legal transition table.                            |
| `SLOT_UNAVAILABLE`       | 409  | Requested booking range overlaps an existing booking, availability block, or maintenance window; `details.conflicts[]` lists each conflict. |
| `NOT_FOUND`              | 404  | Resource missing or soft-deleted.                                                         |
| `CONFLICT`               | 409  | Unique-constraint violation (Prisma `P2002`) or logical duplicate (e.g. "already in wishlist", "already reviewed this booking"). |
| `EMAIL_TAKEN`            | 409  | Registration email already exists.                                                        |
| `RATE_LIMITED`           | 429  | Per-IP+route bucket exceeded; `Retry-After` header + `details.retryAfter` (seconds).       |
| `INTERNAL_ERROR`         | 500  | Unhandled error path.                                                                    |

> **Note on uploads:** the multipart validator (`src/lib/upload.ts`) classifies failures as
> `NO_FILES`, `BAD_TYPE`, `TOO_LARGE`, `TOO_MANY`. In the current build these propagate via the
> generic handler as `INTERNAL_ERROR` (500). The contract treats them as `VALIDATION_ERROR` (400)
> for client semantics; a future patch will map them explicitly (see PROGRESS.md → Known Issues).

---

## 4. Rate Limiting

Per-IP+route in-memory token bucket (`src/lib/rateLimit.ts`). Default `120 req / 60s`. Routes with
explicit overrides:

| Route                                    | Limit          |
| ---------------------------------------- | -------------- |
| `POST /auth/register`                    | 10 / 60s       |
| `POST /auth/login`                       | 12 / 60s       |
| `POST /auth/forgot-password`             | 6  / 60s       |
| `POST /auth/reset-password`              | 10 / 60s       |
| `POST /upload`                           | 30 / 60s       |
| everything else                          | 120 / 60s      |

A 429 response includes `Retry-After: <seconds>` and `error.details.retryAfter`.

---

## 5. Endpoints

> Auth column: **public** (no session) · **customer** (any authenticated user) · **owner** (owner/admin) · **admin**.
> Body shapes are summarized; see `src/lib/validators.ts` for the canonical Zod schema.

### Auth (`/api/v1/auth`)

| Method | Path                | Auth     | Description                                        | Body / Query                                                        | Response `data`                          |
| ------ | ------------------- | -------- | -------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| POST   | `/auth/register`    | public   | Create account; sets auth cookies                  | `{ name, email, password, role?, accountType?, businessName?, registrationNumber?, phone? }` | `SafeUser` (201)                         |
| POST   | `/auth/login`       | public   | Email + password; sets auth cookies                | `{ email, password }`                                               | `SafeUser`                               |
| POST   | `/auth/logout`      | public*  | Clears `rh_access` / `rh_refresh`; audits if session | —                                                                | `{ success: true }`                      |
| POST   | `/auth/refresh`     | cookie   | Rotates refresh, issues new access; returns user   | (cookie only)                                                       | `SafeUser`                               |
| GET    | `/auth/me`          | customer | Current authenticated user                         | —                                                                   | `SafeUser`                               |
| PATCH  | `/auth/profile`     | customer | Update name/phone/bio/business fields; sets `isOnboarded=true` | `{ name?, phone?, bio?, accountType?, businessName?, registrationNumber? }` | `SafeUser`                |
| POST   | `/auth/avatar`      | customer | Upload avatar (multipart, field `avatar`)         | `multipart/form-data` (1 file, ≤5MB)                                | `SafeUser`                               |
| POST   | `/auth/forgot-password` | public | Generate reset token (1h); dev-console mail       | `{ email }`                                                         | `{ sent: true }`                         |
| POST   | `/auth/reset-password`  | public | Reset password using token                        | `{ token, password }`                                              | `{ success: true }`                      |

\* Logout is technically public (no `requireAuth`) — it clears cookies regardless.

### Categories (`/api/v1/categories`)

| Method | Path             | Auth  | Description                                        | Body / Query                                            | Response `data`              |
| ------ | ---------------- | ----- | -------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| GET    | `/categories`    | public | List categories (excludes soft-deleted)           | `?includeDeleted=true`                                  | `Category[]`                 |
| POST   | `/categories`    | admin | Create category                                   | `{ name, slug, description?, iconUrl?, parentId? }`     | `Category` (201)             |
| GET    | `/categories/:id`| public | Get one category                                  | —                                                       | `Category`                   |
| PATCH  | `/categories/:id`| admin | Update category                                   | partial of POST body                                    | `Category`                   |
| DELETE | `/categories/:id`| admin | Soft-delete (fails if equipment in use)            | —                                                       | `{ success: true }`          |

### Equipment (`/api/v1/equipment`)

| Method | Path                              | Auth      | Description                                                                 | Body / Query                                                                                                                                                                                                                                          | Response `data`/`meta`                          |
| ------ | --------------------------------- | --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| GET    | `/equipment`                      | public    | Search/filter/sort/paginate marketplace                                     | `?q &category &minPrice &maxPrice &city &minRating &lat &lng &radiusKm &sort=createdAt\|price\|rating\|distance\|title &order=asc\|desc &page &limit &status` (`status` defaults to `active`; `all`/`active_paused` include paused) | `Equipment[]` + meta                            |
| POST   | `/equipment`                      | owner     | Create a listing (status: draft/active/paused; admin-moderated to active)   | see `equipmentSchema` (title, description, categoryId, status?, condition?, baseDailyPrice, baseHourlyPrice?, baseDeposit, replacementValue?, pricingRules?, lat?, lng?, city?, address?, bufferHours?, purchaseDate?, conditionNotes?, specs[]) | `EquipmentWithRelations` (201) |
| GET    | `/equipment/my`                   | owner     | Owner's own listings (any status)                                          | `?page &limit &status?`                                                                                                                                                                                                                              | `Equipment[]` + meta                            |
| GET    | `/equipment/compare`              | public    | Compare 2–3 items                                                           | `?ids=a,b,c` (2–3 ids)                                                                                                                                                                                                                                | `Equipment[]` + meta (page=1, limit=3)          |
| GET    | `/equipment/:id`                  | public    | Detail incl. reviews/wishlist counts, optional distance from `?lat&lng`    | `?lat &lng`                                                                                                                                                                                                                                          | `EquipmentWithComputed`                         |
| PATCH  | `/equipment/:id`                 | owner     | Update own listing (admin bypasses)                                        | partial of POST body; `specs` replaces all specs                                                                                                                                                                                                     | `EquipmentWithRelations`                        |
| DELETE | `/equipment/:id`                  | owner     | Soft-delete own listing                                                    | —                                                                                                                                                                                                                                                    | `{ success: true }`                             |
| POST   | `/equipment/:id/images`           | owner     | Upload images (multipart field `images`, ≤8 files, ≤5MB each)             | `multipart/form-data`                                                                                                                                                                                                                                | `EquipmentImage[]` (201)                        |
| PATCH  | `/equipment/:id/images`           | owner     | Set primary / reorder a single image                                       | `{ imageId, isPrimary?, order? }`                                                                                                                                                                                                                    | `EquipmentImage`                                |
| DELETE | `/equipment/:id/images/:imageId`  | owner     | Remove image + file; promotes a new primary if needed                      | —                                                                                                                                                                                                                                                    | `{ success: true }`                             |

### Availability (`/api/v1/equipment/:id/availability`)

| Method | Path                                          | Auth  | Description                                              | Body                                                        | Response `data`            |
| ------ | --------------------------------------------- | ----- | -------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| GET    | `/equipment/:id/availability`                 | public | List all availability blocks for an equipment           | —                                                          | `AvailabilityBlock[]`      |
| POST   | `/equipment/:id/availability`                 | owner  | Block a date range                                       | `{ startDate, endDate, reason?: 'owner_blocked'\|'maintenance'\|'booked' }` | `AvailabilityBlock` (201) |
| DELETE | `/equipment/:id/availability/:blockId`        | owner  | Remove a block                                           | —                                                          | `{ success: true }`        |

### Maintenance (`/api/v1/equipment/:id/maintenance*`)

| Method | Path                                                  | Auth  | Description                                              | Body                                                                  | Response `data`            |
| ------ | ----------------------------------------------------- | ----- | -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| GET    | `/equipment/:id/maintenance`                          | public | List maintenance logs (newest first)                    | —                                                                     | `MaintenanceLog[]`          |
| POST   | `/equipment/:id/maintenance`                          | owner  | Log a maintenance event                                 | `{ title, description?, cost?=0, performedAt? }`                     | `MaintenanceLog` (201)     |
| PATCH  | `/equipment/:id/maintenance/:logId`                   | owner  | Update a log                                            | `{ title?, description?, cost? }`                                     | `MaintenanceLog`            |
| DELETE | `/equipment/:id/maintenance/:logId`                   | owner  | Delete a log                                            | —                                                                     | `{ success: true }`        |
| GET    | `/equipment/:id/maintenance-windows`                  | public | List scheduled maintenance windows                     | —                                                                     | `MaintenanceWindow[]`       |
| POST   | `/equipment/:id/maintenance-windows`                 | owner  | Schedule a window (also creates an availability block with `reason:'maintenance'`) | `{ startDate, endDate, notes? }`                       | `MaintenanceWindow` (201)  |
| DELETE | `/equipment/:id/maintenance-windows/:windowId`        | owner  | Remove a window + its matching maintenance availability block | —                                              | `{ success: true }`        |

### Reviews

| Method | Path                            | Auth      | Description                                              | Body                                                              | Response `data`/`meta`            |
| ------ | ------------------------------- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| GET    | `/equipment/:id/reviews`        | public    | Paginated published reviews for an equipment            | `?page &limit`                                                    | `Review[]` + meta                 |
| POST   | `/reviews`                       | customer  | Create a review (one per reviewer+receiver+equipment)    | `{ receiverId, equipmentId?, rating:1-5, title?, body? }`         | `Review` (201)                    |

### Wishlist (`/api/v1/wishlist`)

| Method | Path                          | Auth      | Description                                              | Body / Query                                  | Response `data`/`meta`            |
| ------ | ----------------------------- | --------- | -------------------------------------------------------- | --------------------------------------------- | --------------------------------- |
| GET    | `/wishlist`                   | customer  | Current user's wishlist (with equipment + ratings)       | `?page &limit`                                | `WishlistItem[]` + meta           |
| POST   | `/wishlist`                   | customer  | Add to wishlist (fails if already present)              | `{ equipmentId }`                             | `Wishlist` (201)                  |
| POST   | `/wishlist/:equipmentId`      | customer  | Toggle in wishlist                                       | —                                             | `{ inWishlist: boolean }`         |
| DELETE | `/wishlist/:equipmentId`      | customer  | Remove from wishlist                                     | —                                             | `{ inWishlist: false }`           |
| GET    | `/wishlist/:equipmentId`      | public*   | Is it in my wishlist? (returns false if not logged in)   | —                                             | `{ inWishlist: boolean }`         |

\* `GET /wishlist/:equipmentId` uses `optionalAuth` — anonymous callers get `{ inWishlist: false }`.

### Upload (`/api/v1/upload`)

| Method | Path      | Auth      | Description                                              | Body                                                            | Response `data`           |
| ------ | --------- | --------- | -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| POST   | `/upload` | customer  | Generic image upload (multipart `images`, ≤8, ≤5MB)      | `multipart/form-data`                                          | `{ url, publicId }[]` (201)|
| DELETE | `/upload` | customer  | Delete an uploaded file by `publicId`                    | `{ publicId }`                                                  | `{ success: true }`       |

### Admin (`/api/v1/admin`)

| Method | Path                                 | Auth  | Description                                              | Body / Query                                                              | Response `data`/`meta`            |
| ------ | ------------------------------------ | ----- | -------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| GET    | `/admin/users`                       | admin | Paginated user directory with filters                   | `?page &limit &role &q &suspended=true\|false &verified=true\|false`     | `SafeUser[]` (+ `lastLoginAt`) + meta |
| PATCH  | `/admin/users/:id`                    | admin | Verify / suspend / change role (cannot demote self)    | `{ role?, isVerified?, isSuspended? }`                                     | `SafeUser`                        |
| GET    | `/admin/equipment`                   | admin | Moderation queue                                        | `?page &limit &status? &q`                                                | `Equipment[]` + meta              |
| PATCH  | `/admin/equipment/:id/moderate`      | admin | Approve (`→active`) or reject (`→rejected`)             | `{ action: 'approve'\|'reject', notes? }`                                 | `EquipmentWithRelations`          |
| GET    | `/admin/audit-logs`                  | admin | Paginated audit log                                     | `?page &limit &action &resource &actorId`                                 | `AuditLog[]` + meta               |
| GET    | `/admin/stats`                       | admin | Platform analytics (groupBy aggregates)                 | —                                                                          | see `Stats` shape below            |

`Stats` shape returned by `/admin/stats`:

```json
{
  "totals":   { "users": N, "equipment": N, "reviews": N, "avgRating": 4.2, "auditLast7d": N, "wishlists": N },
  "usersByRole":        [{ "role": "customer", "count": 5 }, { "role": "owner", "count": 5 }, { "role": "admin", "count": 1 }],
  "equipmentByStatus":  [{ "status": "active", "count": 26 }, { "status": "draft", "count": 4 }, { "status": "paused", "count": 2 }],
  "equipmentByCategory":[{ "categoryId": "...", "name": "Power Tools", "count": 6 }, /* … */]
}
```

### Bookings (`/api/v1/bookings`) — Phase 2

The booking lifecycle is driven by a state machine (see **§5.1 Booking State Machine** below).
Every transition is audited into `BookingStatusHistory`; every mutation that the actor is
allowed to make is exposed as a single-purpose `POST /bookings/:id/<action>` route. Active
bookings (status `held`/`confirmed`/`picked_up`/`in_use`/`return_pending`/`returned`/
`inspected`) block the equipment's date range via a `booked` `AvailabilityBlock` that is
created with the booking and removed on cancel/complete.

| Method | Path                                  | Auth               | Description                                                          | Body / Query                                                              | Response `data`/`meta`                                       |
| ------ | ------------------------------------- | ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| POST   | `/bookings`                           | customer / admin   | Create a booking (starts in `held` with a 10-min checkout hold)       | `{ equipmentId, startDate, endDate, idempotencyKey? }`                   | `{ id, status:'held', holdExpiresAt, totalAmount, depositAmount }` (201) |
| GET    | `/bookings`                            | customer / owner / admin | List bookings (role-scoped: customer→own, owner→own, admin→all)  | `?status &page &limit` (default 12, max 48)                                | `Booking[]` (with equipment, customer, owner, payments, _count) + meta |
| GET    | `/bookings/:id`                        | customer / owner / admin | Get a booking with full detail (equipment, customer, owner, payments, messages, disputes, statusHistory). Access control: customer of the booking, owner of the equipment, or admin. | — | `Booking` (full include)                              |
| POST   | `/bookings/:id/confirm`               | customer / admin   | Customer confirms a `held` booking (after payment)                  | —                                                                         | `{ id, status:'confirmed' }`                                  |
| POST   | `/bookings/:id/cancel`                | customer / owner / admin | Cancel a booking; refund computed from cancellation policy. Owner or customer can cancel; `reason` is required. | `{ reason: string }`                              | `{ id, status:'cancelled', refundAmount }`                    |
| POST   | `/bookings/:id/pickup`                | customer / owner / admin | Mark equipment picked up (→ `picked_up`). Records pickup checklist + photos if supplied. | `{ checklist?: Record<string,bool>, photos?: string[] }`      | `{ id, status:'picked_up' }`                                  |
| POST   | `/bookings/:id/return`                | customer / owner / admin | Dual-action: `action:'initiate'` (customer → `return_pending`) or `action:'confirm'` (owner → `returned`, records checklist + photos). Defaults to `initiate`. | `{ action?, checklist?, photos? }` | `{ id, status }`                                              |
| POST   | `/bookings/:id/inspect`              | owner / admin      | Owner inspects returned equipment. `pass:false` flips the booking to `disputed`; `pass:true` (default) → `inspected`. | `{ pass?: boolean }`                              | `{ id, status }`                                              |
| POST   | `/bookings/:id/complete`             | customer / owner / admin | Finalize booking → `completed`. Removes the matching `booked` availability block; deposit release is done via `/payments/:paymentId`. | —                                            | `{ id, status:'completed' }`                                  |
| POST   | `/bookings/:id/extend`               | customer / admin   | Request an extension to a new end date. Re-checks availability and recomputes price/commission; updates the `booked` block's end date. | `{ newEndDate: ISO datetime }`                       | `{ id, status }`                                              |
| POST   | `/bookings/:id/approve`              | owner / admin     | Owner approves (`approve:true` → `confirmed`) or rejects (`approve:false` → cancels via `cancelBooking`) a booking. | `{ approve: boolean }`                              | `{ id, status }`                                              |
| POST   | `/bookings/:id/review`               | customer / owner / admin | Two-way review after `completed`. Customer rates owner+equipment; owner rates customer. Updates `User.trustScore` by ±(rating-3)×2. | `{ rating:1-5, title?, body? }`              | `Review` (201)                                                |
| GET    | `/bookings/:id/messages`             | customer / owner / admin | List booking chat messages. Access control: customer, owner, or admin. | —                                                            | `BookingMessage[]` (with `sender`)                           |
| POST   | `/bookings/:id/messages`             | customer / owner / admin | Send a chat message.                                                  | `{ message: 1..2000 chars, attachmentUrl? }`                              | `BookingMessage` (201)                                       |
| POST   | `/bookings/:id/payments`             | customer / admin   | Simulated payment: writes a `charge` `Payment` for `totalAmount` and a `hold` `Payment` for `depositAmount`, both `status:'completed'`, then confirms the booking. Idempotent via `idempotencyKey` (default `pay-<bookingId>`). | `{ idempotencyKey? }`                | `{ charge: Payment, hold: Payment, bookingStatus:'confirmed' }` (201) |
| POST   | `/bookings/:id/payments/:paymentId`  | owner / admin     | Release a held deposit (`action:'release'`) or refund a charge (`action:'refund'`). Creates a new `Payment` row of the matching type with `status:'completed'` and a `sim_*` reference. | `{ action:'release'\|'refund', amount? }`  | `Payment` (201)                                              |
| POST   | `/bookings/check-availability`       | public             | Check whether a date range is bookable. Applies `Equipment.bufferHours` around the requested range and tests against active bookings, availability blocks, and maintenance windows. | `{ equipmentId, startDate, endDate }`        | `{ available: boolean, conflicts: [{ type, startDate, endDate }] }` |

#### 5.1 Booking State Machine

```
pending ──▶ held ──▶ confirmed ──▶ picked_up ──▶ in_use ──▶ return_pending ──▶ returned ──▶ inspected ──▶ completed
   │          │            │            │            │             │              │
   ▼          ▼            ▼            ▼            ▼             ▼              ▼
cancelled  cancelled   cancelled     late       late          late          disputed (if inspect pass:false)
                        (owner reject)
```

Legal transitions (enforced by `assertTransition` in `src/lib/booking-service.ts`):

| From             | To                                              |
| ---------------- | ----------------------------------------------- |
| `pending`        | `held`, `cancelled`                             |
| `held`           | `confirmed`, `cancelled`                        |
| `confirmed`      | `picked_up`, `cancelled`                        |
| `picked_up`      | `in_use`, `cancelled`, `late`                   |
| `in_use`         | `return_pending`, `late`                        |
| `return_pending` | `returned`, `late`                              |
| `returned`       | `inspected`                                     |
| `inspected`      | `completed`, `disputed`                          |
| `late`           | `returned`, `disputed`, `cancelled`             |
| `completed`      | `disputed`                                      |
| `disputed`       | `completed`, `cancelled`                         |
| `cancelled`      | (terminal)                                      |

Active (date-blocking) statuses: `held`, `confirmed`, `picked_up`, `in_use`,
`return_pending`, `returned`, `inspected`. Cancelled and completed bookings free the
availability block.

#### 5.2 Cancellation Policies

`calculateRefund(booking, cancelledAt=now)` returns the refund amount based on
`Booking.cancellationPolicy` and `hoursUntilStart = (startDate - cancelledAt) / 3600_000`:

| Policy     | More than            | Within               | Notes |
| ---------- | -------------------- | -------------------- | ----- |
| `flexible` | 24h → **100%** refund | 24h → **50%** refund | Default. |
| `moderate`| 48h → **50%** refund | 48h → **25%** refund | — |
| `strict`  | 72h → **25%** refund | 72h → **0%** refund  | — |

Bookings already in `completed` or `returned` refund `0`. `Booking.refundAmount` is persisted
on cancel; the actual refund `Payment` row is written via
`POST /bookings/:id/payments/:paymentId { action:'refund' }`.

### Disputes (`/api/v1/disputes`) — Phase 2

| Method | Path                              | Auth                              | Description                                              | Body / Query                                                                                  | Response `data`/`meta`            |
| ------ | --------------------------------- | --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------- |
| POST   | `/disputes`                       | customer / owner / admin          | Raise a dispute on a booking. Sets the booking to `disputed`. Only the customer or owner of the booking may raise; the `againstId` is auto-derived as the other party. | `{ bookingId, reason: 'damage'\|'late_return'\|'wrong_item'\|'payment'\|'other', description: 10..2000, evidenceUrls?: string[] }` | `Dispute` (201) |
| GET    | `/disputes`                       | customer / owner / admin          | List disputes (role-scoped: customer/owner see disputes they raised or are the subject of; admin sees all). | `?status &page &limit` (default 20, max 50)                                                 | `Dispute[]` (with booking+equipment+parties+_count) + meta |
| GET    | `/disputes/:id`                   | customer / owner / admin          | Get a dispute with full message thread. Access control: raisedBy, against, or admin. | —                                                              | `Dispute` (with booking, messages, parties) |
| GET    | `/disputes/:id/messages`          | customer / owner / admin          | List dispute discussion messages.                         | —                                                                                             | `DisputeMessage[]` (with `sender`, `isStaff`) |
| POST   | `/disputes/:id/messages`          | customer / owner / admin          | Add a message to a dispute. Rejects if status is `resolved`/`closed`. When the `against` party first responds to an `open` dispute, the status is auto-set to `owner_responded`. Admin messages are flagged `isStaff:true`. | `{ message: 1..2000 }`              | `DisputeMessage` (201)            |
| POST   | `/disputes/:id/resolve`           | admin                             | Resolve a dispute. Body choices drive the resolution: `refund_customer` (also writes a `refund` `Payment` for the booking's `totalAmount`), `favor_owner`, `split`, `warning`. Sets `resolvedById`, `resolvedAt`, `status:'resolved'`, and flips the booking back to `completed`. | `{ resolution, resolutionNote? }` | `Dispute`                          |

Dispute status values: `open`, `owner_responded`, `admin_reviewing`, `resolved`, `closed`.
Reasons: `damage`, `late_return`, `wrong_item`, `payment`, `other`.

### Cron (`/api/v1/cron`) — Phase 2

| Method | Path           | Auth | Description                                                                                                                          | Query                                      | Response `data`                                                                       |
| ------ | -------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| POST   | `/cron/run`    | public | Run scheduled jobs. There is **no internal scheduler** — invoke this from an external cron (Vercel Cron, node-cron, k8s CronJob).    | `?job=all` (default) \| `release-holds` \| `detect-late` | `{ expiredHolds?: number, lateReturns?: number }` |

- `release-holds` flips `held` bookings whose `holdExpiresAt` is past to `cancelled` and
  removes the matching `booked` availability block.
- `detect-late` flips any `confirmed`/`picked_up`/`in_use`/`return_pending` booking past
  `endDate` to `late`.

### Analytics (`/api/v1/analytics`) — Phase 3

All analytics endpoints are role-scoped: an `owner` sees only their own bookings/equipment,
an `admin` sees the whole platform.

| Method | Path                       | Auth          | Description                                              | Query                | Response `data`                                                                                                |
| ------ | -------------------------- | ------------- | -------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/analytics/revenue`       | owner / admin | Monthly revenue trend (only `completed` bookings).       | `?months=1..12` (default 6) | `{ months: [{ month, label, revenue, commission, bookings }], totals: { revenue, commission, bookings, avgPerBooking } }` |
| GET    | `/analytics/utilization`   | owner / admin | Per-item utilization = total days rented ÷ days since listed (capped 100%). | —              | `{ items: [{ id, title, baseDailyPrice, status, coverUrl, bookingCount, totalDaysRented, utilizationRate, potentialRevenue }], avgUtilization }` |
| GET    | `/analytics/patterns`      | owner / admin | Booking patterns by weekday/hour, durations, cancellation & repeat rates. | —       | `{ weekday: [{label,bookings}], hourly: [{hour,bookings}], avgDuration, cancellationRate, cancelReasons: [{reason,count}], completedCount, cancelledCount, repeatRate, repeatCustomers, totalCustomers, totalBookings }` |
| GET    | `/analytics/leaderboard`   | admin         | Top-10 owners by completed-booking revenue + per-asset ROI (payback months). | —        | `{ leaderboard: [{ id, name, businessName, avatarUrl, isVerified, revenue, bookings, commission }], roiData: [{ id, title, baseDailyPrice, replacementValue, coverUrl, bookingCount, revenue, roi, monthlyRevenue, paybackMonths }] }` |

### Intelligence (`/api/v1/intelligence`) — Phase 3

| Method | Path                                              | Auth                          | Description                                              | Body / Query                                                              | Response `data`                                                                                                                                                                                              |
| ------ | ------------------------------------------------- | ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/intelligence/pricing-suggestions`               | owner / admin                 | Demand-aware pricing per active listing. Persists each result to `PriceSuggestion`. | —                                                            | `[{ equipmentId, title, currentPrice, suggestedPrice, confidence: 0-1, reasoning, inputs: { wishlistCount, reviewCount, bookingCount, monthsSinceListed, categoryAverage, demandScore } }]`                  |
| POST   | `/intelligence/pricing-suggestions/:id`          | owner / admin                 | Accept / dismiss / edit a suggestion. `accept`/`edit` also updates `Equipment.baseDailyPrice`. | `{ action: 'accept'\|'dismiss'\|'edit', editedPrice? }` | `{ status: 'accepted'\|'dismissed'\|'edited', newPrice? }`                                                                                                                                                  |
| GET    | `/intelligence/recommendations`                   | public (optional session)     | Recommendations. `for_you` is personalized from wishlist categories for logged-in users; falls back to top-rated for anonymous. | `?type=for_you` (default) \| `frequently_together` \| `similar` & `&id=<equipmentId>` | `Equipment[]` (with `reason: string, matchScore: number`); `frequently_together` requires `id`; `similar` requires `id`.                                                            |
| GET    | `/intelligence/fraud-flags`                       | admin                         | Rule-based fraud/anomaly detection.                       | —                                                                         | `{ flags: [{ type, severity:'high'\|'medium'\|'low', description, userId?, bookingId? }], totalFlags }`. Rules: `multiple_failed_payments` (≥3), `frequent_cancellations` (≥5), `frequent_disputes` (≥3), `low_trust_score` (<30), `invalid_booking_duration` (days≤0). |
| GET    | `/intelligence/trust-score`                      | customer / owner / admin      | Trust score + 7-factor breakdown (Verification 10, Completed 25, Cancellation 15, Punctuality 20, Disputes 10, Reviews 10, Avg rating 10 = 100). Customers can query only their own; admins can query anyone. | `?userId=<id>` (default: caller) | `{ userId, userName, role, trustScore, computedScore, isVerified, factors: [{ label, value, max, note }], memberSince }`                                                            |
| GET    | `/intelligence/late-prediction`                  | owner / admin                 | Active bookings with risk score (`trustRisk×0.4 + timeRisk×0.6`) and prediction (`on_track`/`at_risk`/`likely_late`). Owners scoped to their equipment. | —                            | `{ predictions: [{ bookingId, equipmentTitle, customerName, trustScore, hoursRemaining, riskScore, prediction, recommendation, endDate }], atRiskCount, likelyLateCount }`                                  |
| POST   | `/intelligence/what-if`                          | owner / admin                 | Price/availability simulator with price-elasticity demand multiplier. Owners can simulate only their own listings. | `{ equipmentId, dailyPrice, availableDaysPerMonth: 0..31 }`     | `{ current: { dailyPrice, estimatedUtilization, monthlyRevenue, annualRevenue }, simulated: { dailyPrice, availableDaysPerMonth, estimatedUtilization, monthlyRevenue, annualRevenue, sampleBookingTotal }, comparison: { revenueDiff, revenueDiffPct, demandMultiplier } }` |

### Damage Comparison (`/api/v1/bookings/:id/damage-comparison`) — Phase 4

AI pickup-vs-return photo comparison through the pluggable **Vision Provider** interface
(`src/lib/vision-provider.ts`). `VLMProvider` uses the `z-ai-web-dev-sdk` chat completions API;
`RuleBasedProvider` is the always-on fallback. Findings are **preliminary** — every response
carries a `disclaimer` string and must be confirmed or rejected by a human before any deposit
action. Comparisons are persisted to the `DamageComparison` table.

| Method | Path                                                  | Auth               | Description                                              | Body / Query                                                              | Response `data`                                       |
| ------ | ----------------------------------------------------- | ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| POST   | `/bookings/:id/damage-comparison`                     | owner / admin     | Run AI comparison on pickup vs return photos. Audits `AI_DAMAGE_COMPARISON`. Owner must own the booking's equipment (admin bypasses). | `{ pickupPhotoUrl: string, returnPhotoUrl: string, angle?: 'front'\|'back'\|'left'\|'right'\|'top' }` (angle defaults to `front`) | `DamageComparison` + `summary` + `disclaimer` (201)  |
| GET    | `/bookings/:id/damage-comparison`                     | customer / owner / admin | List comparisons for a booking (newest first). Access control: customer of the booking, owner of the equipment, or admin. | —                                                                  | `DamageComparison[]` (each with `disclaimer`)        |
| PATCH  | `/bookings/:id/damage-comparison/:comparisonId`       | owner / admin     | Confirm or reject AI findings. Sets `status`, `reviewedById`, `reviewedAt`. Audits `AI_FINDING_REVIEWED`. Owner-only (admin bypasses). | `{ status: 'confirmed'\|'rejected', findingIndex?: number }`              | `DamageComparison`                                   |

### Intelligence — Damage Estimate (`/api/v1/intelligence`) — Phase 4

| Method | Path                                                  | Auth               | Description                                              | Query                                                                  | Response `data`                                       |
| ------ | ----------------------------------------------------- | ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| GET    | `/intelligence/damage-estimate`                       | owner / admin     | Repair-cost estimate from confirmed AI findings + the equipment's last-5 maintenance history. Suggests a resolution (`release deposit` / `deduct from deposit` / `escalate to dispute`). Owner must own the booking's equipment (admin bypasses). | `?bookingId=<id>` (required)                                          | `{ bookingId, confirmedFindings, costBreakdown: [{ region, severity, estimatedMin, estimatedMax, description }], estimatedCostMin, estimatedCostMax, depositAmount, depositSufficient, suggestedResolution, maintenanceHistory }` |

### Equipment — QR Condition Passport (`/api/v1/equipment`) — Phase 4

| Method | Path                                                  | Auth   | Description                                              | Body / Query | Response `data`                                       |
| ------ | ----------------------------------------------------- | ------ | -------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| GET    | `/equipment/:id/condition-passport`                   | public | Public, read-only "QR condition passport" page data — designed to be linked from a QR code on the physical equipment. Excludes soft-deleted equipment. | —            | `{ id, title, description, condition, conditionNotes, category, owner: { name, isVerified }, baseDailyPrice, images, specs, rating, reviewCount, completedBookings, maintenanceHistory: [{ title, cost, performedAt }], passportGeneratedAt }` |

### Search — Natural Language (`/api/v1/search`) — Phase 4

| Method | Path            | Auth   | Description                                              | Body            | Response `data`                                       |
| ------ | --------------- | ------ | -------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| POST   | `/search/natural` | public | Parse a free-text query (e.g. *"DSLR and two lights for a weekend shoot under ₹5000"*) into structured filters (`q`, `category` via a keyword map, `maxPrice`, `duration` for `weekend`/`week`) and run the standard equipment search. | `{ query: string }` | `{ parsed: { q?, category?, maxPrice?, duration? }, results: EquipmentWithRelations[], resultCount }` |

### Bundles (`/api/v1/bundles`) — Phase 4

| Method | Path        | Auth              | Description                                              | Body                                                            | Response `data`                                       |
| ------ | ----------- | ----------------- | -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| GET    | `/bundles`  | public            | List active smart bundles. Each bundle is enriched with `totalBasePrice`, `discountedPrice`, and `savings` computed from its items' `baseDailyPrice` and `Bundle.discountPercent`. | —                                                               | `Bundle[]` (each with `items[].equipment` (id, title, baseDailyPrice, city, status, primary image), `totalBasePrice`, `discountedPrice`, `savings`) |
| POST   | `/bundles`  | owner / admin     | Create a smart bundle. Owners can only bundle their own equipment (admin bypasses). Audits `BUNDLE_CREATED`. | `{ name: 1..120, description?: 1..500, discountPercent?: 0..50 (default 10), items: [{ equipmentId: cuid, required?: boolean (default false) }] }` (≥2 items) | `Bundle` (with `items`) (201)                         |

### Waitlist (`/api/v1/waitlist`) — Phase 4

| Method | Path              | Auth                            | Description                                              | Body                                                            | Response `data`                                       |
| ------ | ----------------- | ------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| POST   | `/waitlist`       | customer / admin                | Join the waitlist for an unavailable date range on an equipment. Rejects duplicates with `CONFLICT 409`. Audits `WAITLIST_JOINED`. | `{ equipmentId: cuid, startDate: ISO datetime, endDate: ISO datetime }` | `Waitlist` (201)                                      |
| GET    | `/waitlist`       | customer / owner / admin        | List waitlist entries (role-scoped: customer → own, owner → entries against their equipment, admin → all). Includes the equipment title + primary image. | —                                                               | `Waitlist[]`                                          |
| DELETE | `/waitlist/:id`   | customer / admin                | Leave the waitlist. Customer must own the entry (admin bypasses). | —                                                               | `{ success: true }`                                  |

`Waitlist.status` enum: `waiting` | `notified` | `booked` | `expired`. (No scheduler flips
these yet — see Known Issues in `PROGRESS.md`.)

### Platform Health (`/api/v1/health`) — Phase 4

| Method | Path      | Auth    | Description                                              | Body / Query | Response `data`                                       |
| ------ | --------- | ------- | -------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| GET    | `/health` | public  | Platform health check. Pings the DB with `SELECT 1` and reports connectivity + latency, row counts, uptime, version, and current phase. No auth — suitable for uptime monitors. | —            | `{ status: 'healthy'\|'degraded', timestamp, uptime, latency: { total, database }, database: 'ok'\|'error', stats: { users, equipment, bookings, disputes }, version, phase }` |

### GDPR (`/api/v1/gdpr`) — Phase 4

| Method | Path            | Auth                                   | Description                                              | Body / Query | Response `data`                                       |
| ------ | --------------- | -------------------------------------- | -------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| GET    | `/gdpr/export`  | customer / owner / admin               | Export the calling user's full data bundle as a single JSON object (GDPR-style portability). | —            | `{ exportedAt, user, bookings, wishlists, reviews, notifications, auditLogs, waitlist, disputes }` |
| DELETE | `/gdpr/delete`  | customer / owner (admins blocked)      | Soft-delete the calling user's account. Removes wishlist + waitlist entries, marks notifications read, writes `GDPR_ACCOUNT_DELETED` audit. Admins cannot self-delete (`FORBIDDEN 403`). Bookings + reviews are retained for record-keeping. | —            | `{ success: true, message: 'Account deleted. Your data has been anonymized.' }` |

---

## 6. Common Response Shapes

**`SafeUser`** (`src/lib/serializers.ts → userSelect`):

```json
{
  "id": "cuid", "email": "x@y.z", "name": "...", "role": "customer|owner|admin",
  "accountType": "individual|business|null", "businessName": null, "registrationNumber": null,
  "avatarUrl": null, "phone": null, "bio": null,
  "isVerified": false, "isSuspended": false, "isOnboarded": false, "createdAt": "ISO"
}
```

**`EquipmentWithRelations`** (`equipmentInclude`): full Equipment plus
`category { id, name, slug }`, `owner { …SafeUser }`, `images[]` (ordered), `specs[]` (ordered),
and `_count { reviews, wishlists }`. Computed read endpoints additionally attach
`rating` (avg), `reviewCount`, `wishlistCount`, and `distanceKm` (when `?lat&lng` supplied).

**Pricing rules** are stored as JSON on `Equipment.pricingRules` (Zod-validated, max 8 entries):
`{ type: 'weekend_surcharge'|'long_discount'|'seasonal', value, unit: 'percent'|'amount', minDays?, start?, end?, label? }`.
Seasonal rules require `start` + `end`.

**`Booking`** (Phase 2) — full include (returned by `GET /bookings/:id`):

```json
{
  "id": "cuid", "equipmentId": "cuid", "customerId": "cuid", "ownerId": "cuid",
  "status": "pending|held|confirmed|picked_up|in_use|return_pending|returned|inspected|completed|cancelled|late|disputed",
  "previousStatus": "string|null",
  "startDate": "ISO", "endDate": "ISO", "days": 7,
  "baseAmount": 1750, "adjustments": [{ "label": "Weekend +15%", "amount": 175, "type": "surcharge" }],
  "depositAmount": 500, "commissionRate": 10, "commissionAmount": 175, "totalAmount": 1925,
  "cancellationPolicy": "flexible|moderate|strict",
  "refundAmount": null,
  "holdExpiresAt": "ISO|null", "confirmedAt": "ISO|null", "pickedUpAt": "ISO|null",
  "returnedAt": "ISO|null", "inspectedAt": "ISO|null", "completedAt": "ISO|null",
  "cancelledAt": "ISO|null", "cancelReason": "string|null",
  "pickupChecklist": { "fuel_full": true }|null,
  "returnChecklist": { "fuel_full": true }|null,
  "pickupPhotos": ["url"]|null, "returnPhotos": ["url"]|null,
  "idempotencyKey": "string|null",
  "createdAt": "ISO", "updatedAt": "ISO",
  "equipment": { /* EquipmentWithRelations-lite */ },
  "customer": { "id": "cuid", "name": "…", "avatarUrl": "…", "isVerified": bool, "email": "…" },
  "owner":   { "id": "cuid", "name": "…", "businessName": "…", "avatarUrl": "…", "isVerified": bool },
  "payments": [{ "id", "type": "charge|hold|release|refund|commission", "amount", "status": "pending|completed|failed|reversed", "reference": "sim_*", "createdAt" }],
  "messages": [{ "id", "senderId", "sender": { "id", "name", "avatarUrl" }, "message": "…", "attachmentUrl": null, "createdAt" }],
  "disputes": [{ /* Dispute + messages */ }],
  "statusHistory": [{ "id", "fromStatus": null, "toStatus": "held", "actorId": null, "note": "Booking created with 10-min hold", "createdAt" }]
}
```

**`Payment`** (Phase 2):

```json
{
  "id": "cuid", "bookingId": "cuid", "userId": "cuid",
  "type": "charge|hold|release|refund|commission",
  "amount": 1925, "status": "pending|completed|failed|reversed",
  "reference": "sim_charge_a1b2c3…", "idempotencyKey": "pay-<bookingId>|null",
  "createdAt": "ISO"
}
```

**`Dispute`** (Phase 2):

```json
{
  "id": "cuid", "bookingId": "cuid", "raisedById": "cuid", "againstId": "cuid",
  "reason": "damage|late_return|wrong_item|payment|other",
  "description": "string (10..2000)",
  "evidenceUrls": ["url"]|null,
  "status": "open|owner_responded|admin_reviewing|resolved|closed",
  "resolution": "refund_customer|favor_owner|split|warning|null",
  "resolutionNote": "string|null", "resolvedById": "cuid|null", "resolvedAt": "ISO|null",
  "createdAt": "ISO", "updatedAt": "ISO",
  "messages": [{ "id", "senderId", "sender": { "id", "name", "avatarUrl" }, "message": "…", "isStaff": false, "createdAt" }]
}
```

**`PriceSuggestion`** (Phase 3 — returned inline by `GET /intelligence/pricing-suggestions`):

```json
{
  "equipmentId": "cuid", "title": "…",
  "currentPrice": 250, "suggestedPrice": 288, "confidence": 0.75,
  "reasoning": "High demand (3 wishlists, 8 bookings) but price is below category average. Consider raising 15%.",
  "inputs": {
    "wishlistCount": 3, "reviewCount": 2, "bookingCount": 8,
    "monthsSinceListed": 6, "categoryAverage": 280, "demandScore": 2.17
  }
}
```

**`DamageComparison`** (Phase 4 — returned by `POST` and `GET /bookings/:id/damage-comparison`,
mutated by `PATCH /bookings/:id/damage-comparison/:comparisonId`):

```json
{
  "id": "cuid", "bookingId": "cuid",
  "pickupPhotoUrl": "url", "returnPhotoUrl": "url",
  "angle": "front|back|left|right|top",
  "findings": [
    { "region": "front-bumper", "severity": "minor", "description": "New scratch ~5cm on lower bumper", "confidence": 0.78 }
  ],
  "status": "pending|confirmed|rejected",
  "reviewedById": "cuid|null", "reviewedAt": "ISO|null",
  "providerUsed": "vlm|rule_based|manual|null",
  "promptLog": "[redacted] …",
  "createdAt": "ISO",
  "summary": "Potential damage detected (preliminary, requires human confirmation)",
  "disclaimer": "Preliminary, requires human confirmation"
}
```

**`Bundle`** (Phase 4 — returned by `GET /bundles` and `POST /bundles`):

```json
{
  "id": "cuid", "name": "Weekend Photography Kit", "description": "string|null",
  "discountPercent": 10, "status": "active",
  "createdAt": "ISO", "updatedAt": "ISO",
  "items": [
    { "id": "cuid", "bundleId": "cuid", "equipmentId": "cuid", "required": true,
      "equipment": { "id": "cuid", "title": "Canon EOS R5", "baseDailyPrice": 1500, "city": "Mumbai", "status": "active", "images": [{ "url": "…" }] } }
  ],
  "totalBasePrice": 4500, "discountedPrice": 4050, "savings": 450
}
```

**`Waitlist`** (Phase 4 — returned by `POST /waitlist` and `GET /waitlist`):

```json
{
  "id": "cuid", "equipmentId": "cuid", "userId": "cuid",
  "startDate": "ISO", "endDate": "ISO",
  "notifiedAt": "ISO|null", "expiresAt": "ISO|null",
  "status": "waiting|notified|booked|expired",
  "createdAt": "ISO",
  "equipment": { "id": "cuid", "title": "Canon EOS R5", "images": [{ "url": "…" }] }
}
```

---

## 7. Versioning & Compatibility

- All routes are namespaced under `/api/v1`. Breaking changes will be introduced under `/api/v2`
  with the previous version maintained for a deprecation window.
- The envelope is invariant across versions; only resource shapes may evolve.
- Soft-deleted resources are excluded from every list/detail read by default (filtered on
  `deletedAt: null`); admin endpoints explicitly keep them out unless otherwise documented.
