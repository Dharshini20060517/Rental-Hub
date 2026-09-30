# RentalHub

> A multi-role equipment rental marketplace — search, compare, wishlist, owner listings with
> dynamic pricing & maintenance, and admin oversight with audit trails.

RentalHub is a full-stack equipment rental platform. Phase 1 delivers the **Foundation &
Marketplace**: auth + RBAC, equipment CRUD, marketplace search/compare/wishlist, owner listing
management with dynamic pricing and maintenance, admin moderation & audit logs, file uploads, and
seed data.

The original specification prescribed a MERN/Vite stack; the project is **adapted** to this
sandbox's **Next.js 16 + TypeScript + Prisma (SQLite) + shadcn/ui** environment while preserving
every Phase 1 functional requirement. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the rationale.

---

## Tech stack

| Layer            | Choice                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, single `/` route SPA, API under `/api/v1`) |
| Language         | TypeScript 5                                                     |
| Database         | Prisma 6 + SQLite (file at `db/custom.db`)                        |
| Auth             | Custom HS256 JWT in httpOnly cookies (`rh_access` + `rh_refresh`) |
| Validation       | Zod 4 (`src/lib/validators.ts`)                                  |
| UI               | shadcn/ui (New York) + Tailwind CSS 4 + next-themes dark mode    |
| Motion / charts  | Framer Motion + Recharts                                         |
| Client state     | Zustand                                                          |
| Server state     | TanStack Query 5 + Axios (401 → refresh → retry interceptor)    |
| File uploads     | Local storage (`public/uploads/`), Cloudinary-pluggable         |
| Tooling          | Bun (runtime + scripts), ESLint, Prisma CLI                     |

---

## Demo accounts

Seeded by `bun run seed` (see [`prisma/seed.ts`](prisma/seed.ts)).

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | `admin@rentalhub.test`  | `Admin123!`    |
| Owner    | `rohit@rentalhub.test`  | `Owner123!`    |
| Customer | `rahul@rentalhub.test`  | `Customer123!` |

Additional seeded users (same per-role password): owners `anita@`, `karan@`, `priya@`, `sam@`;
customers `meena@`, `joe@`, `fatima@`, `arjun@` (all `@rentalhub.test`).

---

## Getting started

> The preview runs in the sandbox. **Use the Preview Panel** to open the app (do not navigate to
> `localhost:3000` from outside the environment — the dev server is bound internally and surfaced
> through the sandbox's preview).

```bash
# 1. Install dependencies
bun install

# 2. Create the SQLite schema
bun run db:push

# 3. Seed the database (idempotent — wipes & re-inserts)
bun run seed

# 4. Start the dev server
bun run dev
```

After `bun run dev`, open the **Preview Panel** in the sandbox. The first load shows the SPA shell;
login with one of the demo accounts above to explore role-specific views.

> Password reset links are printed to the dev console (`[DEV MAIL] …`) — there is no SMTP in the
> sandbox. Copy the link into the `?view=reset-password&token=…` SPA route to test the reset flow.

---

## Scripts

| Script              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `bun run dev`        | Start the Next.js dev server (port 3000)                 |
| `bun run build`      | Production build (standalone output)                      |
| `bun run start`      | Run the standalone production server                       |
| `bun run lint`       | ESLint                                                    |
| `bun run db:push`    | Apply the Prisma schema to SQLite (destructive)          |
| `bun run db:generate`| Regenerate the Prisma client                              |
| `bun run db:migrate` | Create/apply a Prisma migration (dev)                     |
| `bun run db:reset`   | Reset the DB via migrations                               |
| `bun run seed`       | Seed demo data (`prisma/seed.ts`)                         |

---

## Project structure

```
.
├── prisma/
│   ├── schema.prisma        # 11 models, soft delete, indexes
│   └── seed.ts              # Idempotent seed (users, categories, listings, reviews, audit)
├── src/
│   ├── app/
│   │   ├── page.tsx         # SPA shell (single route, ?view= keys)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── v1/          # Versioned REST API (route handlers)
│   │           ├── auth/        categories/    equipment/
│   │           ├── reviews/    wishlist/     upload/
│   │           └── admin/      (users, equipment, audit-logs, stats)
│   ├── lib/
│   │   ├── api.ts           # Envelope helpers (ok / paged / fail / HttpError)
│   │   ├── handler.ts       # apiHandler wrapper (error + rate-limit)
│   │   ├── auth.ts          # HS256 JWT, cookie helpers, getSession
│   │   ├── rbac.ts          # requireAuth, assertOwner, parseListParams
│   │   ├── validators.ts    # Zod schemas (request bodies)
│   │   ├── serializers.ts   # SafeUser / equipmentInclude
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── upload.ts        # Local uploads (Cloudinary-pluggable)
│   │   ├── audit.ts         # AuditLog writer
│   │   ├── rateLimit.ts     # In-memory token bucket
│   │   ├── geo.ts           # Haversine (km)
│   │   └── utils.ts
│   ├── components/ui/       # shadcn/ui (New York)
│   └── hooks/               # use-toast, use-mobile
├── docs/                    # Project documentation
│   ├── API_CONTRACT.md
│   ├── ER.md
│   ├── AGGREGATIONS.md
│   ├── DECISIONS.md
│   ├── PROGRESS.md
│   └── postman/RentalHub.postman_collection.json
├── public/uploads/         # Local upload target (created on demand)
└── db/custom.db            # SQLite database file
```

---

## Documentation

| Doc                          | What it covers                                              |
| ---------------------------- | ----------------------------------------------------------- |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Envelope, auth model, error codes, every endpoint, request/response shapes |
| [`docs/ER.md`](docs/ER.md)                     | Prisma models, fields, indexes, relationships, Mermaid ER diagram, soft-delete & enum conventions |
| [`docs/AGGREGATIONS.md`](docs/AGGREGATIONS.md) | Prisma `groupBy`/`aggregate` equivalents of the MongoDB Compass pipelines, with SQL + SQLite-CLI snippets |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)        | Architectural decision log (stack adaptation, auth, DB, uploads, payments, rate limiting, email, envelope, soft delete, RBAC, audit) |
| [`docs/PROGRESS.md`](docs/PROGRESS.md)         | Phase 1 status, feature checklist, page inventory, known issues, integration checkpoints, Phase 2 plan |
| [`docs/postman/RentalHub.postman_collection.json`](docs/postman/RentalHub.postman_collection.json) | Postman v2.1 collection skeleton (`{{base_url}}` variable, example bodies) |

---

## Notes on the adaptation (MERN → Next.js + Prisma)

- **API:** Express routes → Next.js Route Handlers under `/api/v1/**` with a uniform
  `{ success, data, error, meta }` envelope.
- **Database:** MongoDB/Mongoose → Prisma 6 + SQLite. Enums stored as `String`, validated in Zod
  (SQLite has no native enums). Aggregations: MongoDB pipelines → Prisma `groupBy`/`aggregate`
  (see `docs/AGGREGATIONS.md`).
- **Auth:** Express JWT middleware → custom HS256 JWT in httpOnly cookies (`rh_access`/`rh_refresh`)
  with refresh-token rotation. Chosen over NextAuth for fine-grained control (see `DECISIONS.md §2`).
- **Client state:** Redux Toolkit → Zustand + TanStack Query (already wired in `package.json`).
- **SPA routing:** Vite + react-router → single Next.js `/` route with `?view=<key>` client-side
  view switching.
- **Uploads:** Multer + Cloudinary → local storage behind a Cloudinary-pluggable interface
  (`src/lib/upload.ts`).
- **Geo/FTS:** MongoDB `2dsphere` + full-text → Haversine in JS + Prisma `contains` (SQL `LIKE`).
  Phase 1 limitation for catalog sizes up to a few hundred items; revisit in Phase 2.
- **Email:** Nodemailer SMTP → dev console transport (reset links printed to the server log).

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the full rationale behind each choice.

---

## License

Internal project — all rights reserved.
