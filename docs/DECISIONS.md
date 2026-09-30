# RentalHub — Architectural Decisions Log

This record explains **why** each major decision was made for RentalHub. The platform was
originally specified as MERN (MongoDB + Express + React + Redux + Vite). The runtime sandbox is a
fixed **Next.js 16 + TypeScript + Prisma (SQLite) + shadcn/ui** environment, so the build is an
**adaptation**, not the literal stack. Each decision below preserves the *behavior* the spec asked
for while choosing a tool that fits the sandbox.

| # | Decision                                       | Status      |
| - | ---------------------------------------------- | ----------- |
| 1 | Stack adaptation: MERN → Next.js + Prisma/SQLite | Adopted     |
| 2 | Auth: custom HS256 JWT in httpOnly cookies       | Adopted     |
| 3 | Database: Prisma + SQLite (not MongoDB/Mongoose)  | Adopted     |
| 4 | Geo: Haversine in JS; Text search: LIKE `contains` | Adopted     |
| 5 | File uploads: local storage, Cloudinary-pluggable | Adopted     |
| 6 | Payments: simulated (Phase 2+), recorded in DB  | Phase 2     |
| 7 | Rate limiting: in-memory bucket → Redis in prod  | Adopted     |
| 8 | Email: dev console transport (Nodemailer Ethereal equivalent) | Adopted |
| 9 | API envelope + `/api/v1` versioning              | Adopted     |
| 10| Soft delete via `deletedAt`                      | Adopted     |
| 11| RBAC: role check on every protected route + owner-assertion | Adopted |
| 12| Audit logging for sensitive actions             | Adopted     |

---

## 1. Stack adaptation: MERN → Next.js

**Context.** The deliverable spec described an Express + MongoDB + Vite + Redux Toolkit stack. The
deployment environment is a pre-provisioned **Next.js 16 App Router + TypeScript + Prisma + SQLite +
shadcn/ui** sandbox with a single user-visible route (`/`) and API routes under `/api/v1/*`.

**Decision.** Build on the existing Next.js stack rather than re-scaffold MERN, and adapt every
"Mongo/Express" concern to its Prisma/Next equivalent.

**What is preserved (functional parity with the spec):**
- Auth + 3 roles (customer / owner / admin) with RBAC.
- Equipment CRUD + dynamic pricing rules (weekend surcharge, long-rental discount, seasonal).
- Marketplace: search, filter, sort, geo distance, pagination, compare (max 3), wishlist.
- Owner tooling: listings, images (multipart), specs, availability blocks, maintenance logs/windows.
- Admin oversight: user directory, listing moderation, audit logs, platform stats.
- Audit log of every sensitive action.
- Seed data (3 roles, 10 categories, 30+ listings, reviews, maintenance, wishlists, audit rows).
- Versioned REST API behind a consistent envelope.

**What changed mechanically:**
| Spec (MERN)                          | RentalHub (adapted)                            |
| ------------------------------------ | --------------------------------------------- |
| Express routes                       | Next.js Route Handlers `app/api/v1/**`         |
| Mongoose models                      | Prisma schema (`prisma/schema.prisma`)         |
| MongoDB Compass aggregations         | Prisma `groupBy`/`aggregate` (`AGGREGATIONS.md`) |
| Redux Toolkit (client state)         | Zustand + TanStack Query (already wired)       |
| Vite SPA `?view=…` routing           | Single `/` route, `?view=…` SPA navigation    |
| Multer + Cloudinary uploads          | Local uploads + Cloudinary-pluggable interface |
| Express JWT middleware               | `getSession()` + `requireAuth()` from cookies  |
| MongoDB-native `2dsphere`/FTS        | Haversine in JS + Prisma `contains` (LIKE)     |

**Why.** The sandbox cannot install a Mongo/Express stack cleanly; adapting preserves every
functional requirement while staying inside a supported, runnable environment.

---

## 2. Auth: custom HS256 JWT in httpOnly cookies

**Context.** The spec called for JWT auth. NextAuth is bundled as a dependency.

**Decision.** Use a small **custom HS256 JWT** (hand-rolled with Node `crypto`, ~60 LOC) stored in
two **httpOnly cookies** (`rh_access`, `rh_refresh`) with refresh-token rotation, instead of NextAuth.

**Why not NextAuth:**
- Fine-grained control over the access/refresh TTLs, cookie attributes (`sameSite`, `secure`,
  `path`), and the exact JSON payload shape (`sub`, `role`, `type`, `jti`).
- Refresh-token **rotation** on every `/auth/refresh` call (new `jti`, re-signed) is trivial to
  hand-roll and exactly what the spec asked for; NextAuth's refresh flow is heavier and provider-driven.
- No database adapter needed; sessions are stateless. `getSession()` reads the access cookie (and
  falls back to the refresh cookie for SSR/SPA reads mid-session) without any session store.
- The whole token path stays framework-agnostic — useful when Phase 2 adds booking/payment flows
  that need custom claim checks (`role`, equipment ownership) on every route.

**Cookie attributes:** `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: true` in
production only. Access TTL `900s`, refresh TTL `604800s` (7 days); both overridable via env
(`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`). Signing secret: `JWT_SECRET` (dev default fallback exists).

**Password hashing:** bcrypt (10 rounds) with a transparent scrypt fallback if `bcryptjs` import
fails — kept the same `verifyPassword`/`hashPassword` API surface either way.

---

## 3. Database: Prisma + SQLite (not MongoDB/Mongoose)

**Context.** The spec assumed MongoDB. SQLite is the only DB driver in the sandbox (no Mongo
daemon, no creds, no network egress).

**Decision.** Use **Prisma 6** with **SQLite**. Mongoose schemas → Prisma models; the data
modelling shape is unchanged.

**Why Prisma specifically (vs raw `better-sqlite3`):**
- A single `schema.prisma` is both the source of truth and the migration driver.
- Type-safe client that the route handlers consume via `db`.
- `groupBy`, `aggregate`, `count`, and `include` cover the spec's "aggregation pipeline" needs
  (see `AGGREGATIONS.md`).
- Drop-in switch to Postgres/MySQL later: change the `datasource` provider; the model file stays.

**Why SQLite for Phase 1 is fine:**
- Single-writer, file-backed; the seed + dev server + admin endpoint are all in-process.
- Atomic `deleteMany({})` cascade ordering in `prisma/seed.ts` keeps the seed idempotent.
- Prisma transparently maps `DateTime`, `Json?`, `Boolean`, and `Int`/`Float` to SQLite's
  narrower type system.

**Caveat.** SQLite has **no native enums**; we model them as `String` and validate at the Zod
boundary (see ER.md "Enums are Strings"). Prisma has **no native `enum` on SQLite** either —
using `String` is the cleanest cross-DB choice.

---

## 4. Geo: Haversine in JS; Text search: LIKE (`contains`)

**Context.** The spec asked for geo-radius filtering and full-text search. SQLite has no
`2dsphere` index and no full-text catalog wired into Prisma.

**Decision.**
- **Geo:** store `lat`/`lng` as `Float?`. The search endpoint (`GET /equipment`) fetches candidate
  rows matching the other filters, then computes Haversine distance in JS
  (`src/lib/geo.ts → haversineKm`), filters by `radiusKm`, and sorts by `distance` if requested.
  Result `distance` (km) is returned on each item.
- **Text search:** use Prisma `contains` (compiles to SQL `LIKE '%q%'`) over `title`,
  `description`, and `city`. Sufficient for the seeded catalog (~30 listings) and Phase 1 traffic.

**Why this is acceptable for Phase 1:**
- Catalog size is small; the post-filter cost is negligible.
- No false positives from tokenization; the LIKE query is intuitive and portable.
- The shape of the API (`?lat&lng&radiusKm&sort=distance`) is unchanged, so swapping to PostGIS or
  an FTS5 virtual table in Phase 2 needs no client changes.

**Indexes** that still matter and are declared in the schema: `Equipment.status`, `city`,
`baseDailyPrice`, `categoryId`, `ownerId`, `deletedAt`; `AvailabilityBlock.[startDate, endDate]`;
`MaintenanceWindow.[startDate, endDate]`; `AuditLog.createdAt`; `AuditLog.[resource, resourceId]`.

---

## 5. File uploads: local storage + Cloudinary-pluggable interface

**Context.** The spec assumed Multer + Cloudinary. The sandbox has no Cloudinary credentials and
no network egress to upload files.

**Decision.** Implement a small **local-storage** uploader with the same surface area as
Cloudinary, behind a stable `UploadResult = { url, publicId, width?, height? }` contract
(`src/lib/upload.ts`). Files land in `public/uploads/` and are served at `/uploads/<file>`.

**Validation (mirrors a production Multer config):**
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`.
- Per-file max size: 5 MB (`UPLOAD_MAX_SIZE_MB`).
- Max files per request: 8 (equipment images) or 1 (avatar).
- Extension whitelist; random 12-byte hex filename; path traversal guarded in `deleteUpload`.

**Cloudinary-pluggable.** The `parseAndSaveImages` / `parseAndSaveImage` / `deleteUpload`
functions are the entire public surface. Swapping to Cloudinary means re-implementing those three
functions to call `cloudinary.uploader.upload` / `destroy` and return the same `{ url, publicId }`.
The routes that consume them (`/upload`, `/equipment/:id/images`, `/auth/avatar`) and the
`EquipmentImage.publicId` / `User.avatarPublicId` columns are unchanged.

**Why.** Keeps the codebase honest about the sandbox constraint while preserving the production
intent. `publicId` is already the abstraction seam.

---

## 6. Payments: simulated (Phase 2+), recorded in DB

**Context.** The spec's payment flow needs a gateway and webhook infrastructure not available in
the sandbox. Bookings + availability engine are Phase 2.

**Decision.** Do not implement the payment flow in Phase 1. The data model is designed to accept a
`Booking` table (with `status`, `totalAmount`, `paidAt`) and a `Payment` table (with `provider`,
`providerRef`, `amount`, `status`) without restructuring existing models. The admin stats and
aggregation approach already plan for revenue/utilization queries (`AGGREGATIONS.md §8`).

**Why.** Phase 1 is "Foundation & Marketplace"; renting/booking is gated on the booking engine,
which itself needs the availability engine. Both are sequenced into Phase 2.

---

## 7. Rate limiting: in-memory bucket → Redis in production

**Context.** Every public endpoint (login, register, forgot-password, upload) is a brute-force /
abuse vector.

**Decision.** Per-IP+route in-memory token bucket (`src/lib/rateLimit.ts`). Default `120 req / 60s`.
Route-specific overrides: register 10/min, login 12/min, forgot-password 6/min, reset-password
10/min, upload 30/min.

**Why in-memory for Phase 1:**
- Single-server sandbox; an in-process `Map` is correct and cheap.
- The interface is `rateLimit(opts) => (key) => { ok | { retryAfter } }`. Swapping the storage
  backend to **Redis** in production is a single-file change behind the same function signature.

**Client IP detection:** `x-forwarded-for` (first hop) → `x-real-ip` → `0.0.0.0`. The 429 response
includes `Retry-After` header and `error.details.retryAfter`.

---

## 8. Email: dev console transport (Nodemailer Ethereal equivalent)

**Context.** The password-reset flow must email a token. The sandbox has no SMTP credentials and
no network egress.

**Decision.** In dev, the reset link is **printed to the server log** (`[DEV MAIL] Password reset
link for <email>: <link>`). This is the standard Nodemailer-Ethereal equivalent — the user reads the
link from the dev console and pastes it into the `?view=reset-password&token=…` SPA route. No SMTP
config is required.

**Why.** Keeps the reset flow end-to-end testable in the sandbox without external services. The
`forgot-password` handler already returns `{ sent: true }` for *any* email (including unknown ones)
to avoid email enumeration; the token is only generated for a real, non-suspended, non-deleted
user. The reset token is a 24-byte random hex with a 1-hour expiry (`resetTokenExpiry`).

**Production swap.** Replace the `console.log` with a `nodemailer.sendMail` call (or any email
provider). The token generation, expiry, and audit-log call are unchanged.

---

## 9. API envelope + `/api/v1` versioning

**Context.** Many small endpoints; the spec wants predictable error handling and stable contracts.

**Decision.** Every response uses the same envelope:
`{ success, data, error: { code, message, details } | null, meta: { page, limit, total, totalPages } | undefined }`.
All routes are namespaced under `/api/v1`. Breaking changes go under `/api/v2` with a deprecation
window; the envelope is invariant.

**Why.**
- A single error shape means the client (Axios interceptor + TanStack Query) only has one code path.
- `meta.totalPages` lets the UI render pagination in one round-trip.
- `error.code` is a stable, machine-readable string (`UNAUTHENTICATED`, `FORBIDDEN`,
  `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, …) so i18n/UX can branch on it
  instead of parsing the message.
- Versioning in the path (not a header) is the simplest contract for the Postman collection and
  for external integrators.

Helpers in `src/lib/api.ts`: `ok`, `paged`, `fail`, `failFromZod`, `HttpError`, `handleError`.
`handleError` also maps Prisma's `P2002` → `CONFLICT 409` and `P2025` → `NOT_FOUND 404`.

---

## 10. Soft delete pattern

**Decision.** `User`, `Category`, `Equipment`, and `Review` carry a nullable `deletedAt`. Delete
handlers set `deletedAt = now()`; every read path filters `deletedAt: null`. Indexes include
`deletedAt` where it's query-relevant (`User`, `Equipment`).

**Why.**
- Preserves auditability — you can still see in `AuditLog` who deleted what, and you can restore
  by nulling `deletedAt`.
- Avoids cascading hard deletes that would lose reviews/wishlists/images of a popular item.
- Admin endpoints can opt in to "include deleted" by simply omitting the filter.

**Child rows** (`EquipmentImage`, `EquipmentSpec`, `AvailabilityBlock`, `MaintenanceLog`,
`MaintenanceWindow`, `Wishlist`, `Notification`) use **`onDelete: Cascade`** where the relation is
declared, so they go away with the parent on a hard delete (only used by the seed script's
`deleteMany({})` reset).

---

## 11. RBAC strategy

**Decision.** Two helper functions in `src/lib/rbac.ts`:
- `requireAuth(roles?)` — throws `UNAUTHENTICATED 401` if no session; `FORBIDDEN 403` if the
  session's role isn't in the allow-list. Admins are always allowed on `['owner','admin']` routes
  by including `'admin'` in the allow-list.
- `assertOwner(resourceOwnerId, actorId, isAdmin)` — admin bypasses; otherwise the resource's
  `ownerId` must equal the actor's `id` or `FORBIDDEN 403` is thrown.

Every protected route calls `requireAuth(...)` first; every owner-scoped mutation
(equipment update/delete, image upload/delete, availability block create/delete, maintenance
log/window create/update/delete) calls `assertOwner(...)` immediately after fetching the resource.
Admin endpoints additionally pass `actorId` into the audit log.

**Why.**
- The pattern is uniform and short — every route reads the same two-line preamble, which makes
  missed checks easy to spot in review.
- Owner-assertion lives next to the resource fetch, so the check is impossible to forget once the
  resource is loaded.
- The 401 vs 403 distinction matters for the SPA: 401 triggers refresh→retry; 403 shows a "not
  allowed" toast and stops.

---

## 12. Audit logging for sensitive actions

**Decision.** Every state-changing or sensitive read calls `audit({ action, resource,
resourceId, actorId, targetId?, metadata?, ip? })` (`src/lib/audit.ts`), which writes a row to
`AuditLog`. The audit call is best-effort — a failure is logged but never blocks the main operation.

**Actions logged (non-exhaustive):**
- Auth: `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGOUT`, `PROFILE_UPDATED`, `AVATAR_UPDATED`,
  `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET`.
- Categories: `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`.
- Equipment: `LISTING_CREATED`, `LISTING_UPDATED`, `LISTING_DELETED`, `LISTING_IMAGES_ADDED`,
  `LISTING_IMAGE_UPDATED`, `LISTING_IMAGE_REMOVED`, `LISTING_APPROVED`, `LISTING_REJECTED`.
- Availability/maintenance: `AVAILABILITY_BLOCKED`, `AVAILABILITY_UNBLOCKED`, `MAINTENANCE_LOGGED`,
  `MAINTENANCE_UPDATED`, `MAINTENANCE_DELETED`, `MAINTENANCE_WINDOW_CREATED`,
  `MAINTENANCE_WINDOW_DELETED`.
- Reviews: `REVIEW_CREATED`.
- Admin user ops: `USER_UPDATED_BY_ADMIN` (with `targetId` + `metadata = full patch`).
- System: `SEED_RUN`, `LISTING_CREATED` (seed row).

**Querying.** Admin-only `GET /api/v1/admin/audit-logs` with filters by `action`, `resource`,
`actorId` and pagination. The audit log is also surfaced in the admin stats endpoint as
`totals.auditLast7d`.

**Why.** A rental marketplace is a regulated multi-tenant system; mod actions, role changes, and
listing lifecycle transitions must be attributable to an actor for trust & safety review. The
schema (`AuditLog.actorId`, `targetId`, `resource`, `resourceId`, `metadata: Json`, `ip`) supports
both event-stream queries and forensic reconstruction of a single resource's history.
