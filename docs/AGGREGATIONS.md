# RentalHub — Aggregations & Analytics

The original MERN spec called for "aggregation pipelines saved so they can be run in MongoDB
Compass". Because RentalHub is built on **Prisma + SQLite** (see `DECISIONS.md`), we instead
implement the equivalent analytics with **Prisma `groupBy` / `aggregate` / `count`** primitives.
This document maps each Compass-style aggregation to its Prisma call, gives the **generated SQL**,
provides a runnable **SQLite CLI** snippet, and explains the result. The canonical live
implementation is `GET /api/v1/admin/stats` (`src/app/api/v1/admin/stats/route.ts`).

---

## 1. Users by role

Counts of non-deleted users grouped by role (admin dashboard "usersByRole" widget).

**Prisma**
```ts
const usersByRole = await db.user.groupBy({
  by: ['role'],
  where: { deletedAt: null },
  _count: true,
})
// → [{ role: 'customer', _count: 5 }, { role: 'owner', _count: 5 }, { role: 'admin', _count: 1 }]
```

**Generated SQL**
```sql
SELECT `role`, COUNT(*) AS `_count`
FROM `User`
WHERE `deletedAt` IS NULL
GROUP BY `role`;
```

**SQLite CLI**
```sql
SELECT role, COUNT(*) AS count
FROM User
WHERE deletedAt IS NULL
GROUP BY role;
```

---

## 2. Equipment by status

Counts of non-deleted equipment grouped by status (moderation queue + health overview).

**Prisma**
```ts
const equipmentByStatus = await db.equipment.groupBy({
  by: ['status'],
  where: { deletedAt: null },
  _count: true,
})
```

**SQL**
```sql
SELECT `status`, COUNT(*) AS `_count`
FROM `Equipment`
WHERE `deletedAt` IS NULL
GROUP BY `status`;
```

**SQLite CLI**
```sql
SELECT status, COUNT(*) AS count
FROM Equipment
WHERE deletedAt IS NULL
GROUP BY status;
```

---

## 3. Equipment by category (with category name)

Counts of non-deleted equipment grouped by `categoryId`, joined with the category name so the
admin UI can render labels rather than CUIDs.

**Prisma** (two-step — Prisma `groupBy` does not yet support joins, so we resolve names after):
```ts
const byCat = await db.equipment.groupBy({
  by: ['categoryId'],
  where: { deletedAt: null },
  _count: true,
})
const cats = await db.category.findMany({
  where: { id: { in: byCat.map(c => c.categoryId) } },
  select: { id: true, name: true },
})
const catMap = new Map(cats.map(c => [c.id, c.name]))
const result = byCat.map(c => ({ categoryId: c.categoryId, name: catMap.get(c.categoryId) ?? 'Unknown', count: c._count }))
```

**SQL** (single query with a JOIN)
```sql
SELECT e.categoryId, c.name AS name, COUNT(*) AS count
FROM Equipment e
JOIN Category c ON c.id = e.categoryId
WHERE e.deletedAt IS NULL
GROUP BY e.categoryId, c.name;
```

**SQLite CLI**
```sql
SELECT e.categoryId, c.name AS name, COUNT(*) AS count
FROM Equipment e
JOIN Category c ON c.id = e.categoryId
WHERE e.deletedAt IS NULL
GROUP BY e.categoryId, c.name;
```

---

## 4. Average rating + review count (aggregate)

Platform-wide rating health. The Prisma `aggregate` returns both `_avg` and `_count` in one trip.

**Prisma**
```ts
const agg = await db.review.aggregate({
  where: { status: 'published', deletedAt: null },
  _avg: { rating: true },
  _count: true,
})
// → { _avg: { rating: 4.2 }, _count: 12 }
```

**SQL**
```sql
SELECT AVG(rating) AS avgRating, COUNT(*) AS reviewCount
FROM `Review`
WHERE status = 'published' AND deletedAt IS NULL;
```

**SQLite CLI**
```sql
SELECT AVG(rating) AS avgRating, COUNT(*) AS reviewCount
FROM Review
WHERE status = 'published' AND deletedAt IS NULL;
```

### Per-equipment average rating + review count (used by the search endpoint)

```ts
const perEq = await db.review.groupBy({
  by: ['equipmentId'],
  where: { equipmentId: { in: ids }, status: 'published', deletedAt: null },
  _avg: { rating: true },
  _count: true,
})
```

```sql
SELECT equipmentId, AVG(rating) AS avgRating, COUNT(*) AS reviewCount
FROM Review
WHERE status = 'published' AND deletedAt IS NULL
  AND equipmentId IN ('id1','id2', …)
GROUP BY equipmentId;
```

---

## 5. Wishlist counts per equipment

Popularity signal (used by the search endpoint's `wishlistCount` enrichment and by the admin
"totals.wishlists" gauge).

**Prisma**
```ts
const wishAgg = await db.wishlist.groupBy({
  by: ['equipmentId'],
  where: { equipmentId: { in: ids } },
  _count: true,
})
// total wishlists platform-wide:
const totalWishlists = await db.wishlist.count()
```

**SQL**
```sql
-- per equipment
SELECT equipmentId, COUNT(*) AS wishCount
FROM Wishlist
WHERE equipmentId IN ('id1','id2', …)
GROUP BY equipmentId;

-- platform total
SELECT COUNT(*) AS total FROM Wishlist;
```

**SQLite CLI**
```sql
SELECT equipmentId, COUNT(*) AS wishCount
FROM Wishlist
GROUP BY equipmentId
ORDER BY wishCount DESC;
```

---

## 6. Audit logs in the last 7 days

Activity/health indicator surfaced in the admin "totals.auditLast7d" field.

**Prisma**
```ts
const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
const recentAuditCount = await db.auditLog.count({ where: { createdAt: { gt: since } } })
```

**SQL**
```sql
SELECT COUNT(*) FROM AuditLog WHERE createdAt > datetime('now','-7 days');
```

**SQLite CLI**
```sql
SELECT COUNT(*) AS last7d
FROM AuditLog
WHERE createdAt > datetime('now', '-7 days');
```

### Bonus: top actions in the last 7 days (frequency table)

```sql
SELECT action, COUNT(*) AS count
FROM AuditLog
WHERE createdAt > datetime('now', '-7 days')
GROUP BY action
ORDER BY count DESC;
```

```ts
const topActions = await db.auditLog.groupBy({
  by: ['action'],
  where: { createdAt: { gt: since } },
  _count: true,
  orderBy: { _count: 'desc' },
})
```

---

## 7. Notes on adaptation (MongoDB Compass → SQLite/Prisma)

| MongoDB pattern                                  | RentalHub equivalent                                          |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `$match`                                          | Prisma `where`                                                |
| `$group` + `$sum: 1`                              | `db.<model>.groupBy({ by, _count: true })`                   |
| `$group` + `$avg`                                 | `db.<model>.aggregate({ _avg: { … } })` or `groupBy` with `_avg` |
| `$lookup` (join)                                  | Prisma `include` for parent/child, or a 2nd `findMany` + Map join for `groupBy` (Prisma `groupBy` cannot `include`) |
| `$sort` on computed value                         | JS `Array.sort` on the small aggregated result set            |
| `db.collection.aggregate([...])` saved in Compass | Equivalent snippets persisted in this doc and the route file  |
| Compass "Save aggregation"                         | The `GET /admin/stats` endpoint **is** the saved aggregation — runnable via HTTP |

### Where the aggregations live in the code
- **`src/app/api/v1/admin/stats/route.ts`** — the platform-wide dashboard (sections 1–4 + totals).
- **`src/app/api/v1/equipment/route.ts`** — the marketplace search endpoint enriches each result
  with `rating`, `reviewCount`, `wishlistCount` via `groupBy` on `Review` and `Wishlist` (sections 4 + 5).
- **`src/app/api/v1/equipment/[id]/route.ts`** — single-equipment aggregate (`aggregate` on reviews,
  `count` on wishlists) used to power the detail page header.

---

## 8. Phase 2 — planned aggregations (revenue & utilization)

Booking system, payments, and a real availability engine are Phase 2. The intended Prisma
approach for the two headline analytics:

### Revenue trends (daily/monthly)
Once a `Booking` model exists with `startDate`, `endDate`, `totalAmount`, `status='paid'`:

```ts
// Daily revenue for last 30 days
const rows = await db.booking.findMany({
  where: { status: 'paid', paidAt: { gte: thirtyDaysAgo } },
  select: { totalAmount: true, paidAt: true },
})
// bucket in JS by day/month; SQLite's date functions make SQL grouping easy too:
// SELECT date(paidAt) AS day, SUM(totalAmount) FROM Booking
//   WHERE status='paid' GROUP BY date(paidAt) ORDER BY day;
```

### Utilization (rental days per equipment per period)
```ts
// Utilization = sum(booking days) / (window days) per equipment
const util = await db.booking.groupBy({
  by: ['equipmentId'],
  where: { status: { in: ['completed', 'active'] }, endDate: { gte: since } },
  _sum: { days: true }, // or compute via endDate - startDate
})
```
```sql
SELECT equipmentId,
       SUM(julianday(endDate) - julianday(startDate)) AS rentedDays
FROM Booking
WHERE status IN ('completed','active') AND endDate >= ?
GROUP BY equipmentId;
```

These are intentionally **not** wired into Phase 1 — no `Booking` table exists yet — but the
admin stats endpoint and ER model are designed to accept them without restructuring.
