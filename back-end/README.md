# Back-end — Dickinson Study Spaces

Express REST API for Dickinson Study Spaces: hybrid building catalog, professor search (Postgres FTS), live office-hours aggregates, and a legacy sync webhook. Talks to Supabase with the **service role** (bypasses RLS).

**Package:** `dickinson-study-spaces-back-end`  
**Runtime:** Node.js 22.x  
**Default port:** `3002`  
**Author:** Harrison Nguyen · License: ISC

Consumed by [`../front-end`](../front-end/README.md) (BFF + rewrites). Faculty **writes** for office hours are owned by [`../pipeline_worker`](../pipeline_worker/) (direct Supabase), not this API. System design: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). Monorepo ops: [`../README.md`](../README.md).

---

## What this package owns

| Responsibility | Implementation |
|----------------|----------------|
| HTTP API | `api/index.js` — Express app, CORS, helmet, auth middleware |
| Buildings | `api/routes/buildings.js` — `data.json` + Supabase UUID merge |
| Professors | `api/routes/professors.js` — list, FTS RPC, active-now, sync |
| Supabase client | `api/db.js` — lazy singleton, service role, pooler URL guard |
| Building aliases / slugs | `api/utils/*` |
| Seed / dept mapping | `scripts/seed_buildings.js`, `scripts/map_departments_to_buildings.js` |
| Vercel serverless entry | `index.js` → re-exports `api/index.js` |

This package does **not** run Playwright or scrape Dickinson.edu. Do not schedule the deprecated `crawler/` against this API for production ingestion.

---

## Quick start

From the **monorepo root**:

```powershell
npm install
# Create back-end/.env (see Environment)
npm run dev:api
```

Or from this folder:

```powershell
npm run dev
```

Health/welcome: [http://localhost:3002/](http://localhost:3002/) → `{ "message": "Welcome to the Dickinson Study Spaces Backend" }`

Requires a Supabase project with migrations applied and (for useful professor data) the faculty pipeline or seed scripts run. See [`../README.md`](../README.md).

---

## Environment

Create **`back-end/.env`** (gitignored). Dotenv also loads a repo-root `.env` as fallback (`api/index.js`).

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INTERNAL_API_SECRET=your-shared-secret
INTERNAL_CRON_SECRET=your-cron-secret
PORT=3002
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role — **never** expose to the browser |
| `INTERNAL_API_SECRET` | Yes | Bearer for `GET /api/buildings` (`INTERNAL_API_KEY` accepted as alias) |
| `INTERNAL_CRON_SECRET` | Yes | Auth for `POST /api/professors/sync` (raw header or `Bearer`) |
| `PORT` | No | Listen port (default `3002`); unused on Vercel |
| `ALLOWED_ORIGIN_EXTRA` | No | One extra CORS origin beyond localhost + `*.vercel.app` |
| `DATABASE_URL` / `SUPABASE_DB_URL` | No | If set, must be transaction pooler **port 6543** with `?pgbouncer=true`. Port **5432 is rejected** ([`api/db.js`](api/db.js)) |
| `MAX_SYNC_RECORDS` | No | Cap for sync payload size (default `1000`) |
| `NODE_ENV` | No | When not `production`, Winston also logs to console |

**Fail-closed buildings auth:** if `INTERNAL_API_SECRET` / `INTERNAL_API_KEY` is unset, `GET /api/buildings` returns **500**, not anonymous access.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Nodemon on `api/index.js` |
| `npm start` | `node api/index.js` (no reload) |
| `npm run seed:buildings` | Upsert 19 buildings from `api/data/data.json` into Supabase |
| `npm run map:departments` | Fuzzy-map departments → `primary_building_id` |

From monorepo root:

```powershell
npm run seed:buildings -w back-end
npm run map:departments -w back-end
```

Run **seed buildings before** map departments. Scripts require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

---

## Directory map

```
back-end/
├── index.js                 Vercel entry (module.exports = require('./api/index'))
├── vercel.json              @vercel/node → index.js
├── api/
│   ├── index.js             Express app, middleware, route mount, listen (local only)
│   ├── db.js                getSupabase() + pooler validation
│   ├── data/data.json       19 curated buildings (display source of truth)
│   ├── routes/
│   │   ├── buildings.js     GET /
│   │   └── professors.js    GET /, /departments, /active-now; POST /sync
│   └── utils/
│       ├── buildingAliases.js
│       ├── buildingSlug.js
│       └── facId.js
└── scripts/
    ├── seed_buildings.js
    └── map_departments_to_buildings.js
```

---

## Middleware stack

Order in [`api/index.js`](api/index.js):

```
express.json({ limit: '5mb' })
  → helmet()
  → cors({ origin: isAllowedOrigin, credentials: true })
  → routes
  → global 500 handler
```

### CORS allowlist

| Origin | Allowed |
|--------|---------|
| Missing `Origin` (server-to-server / BFF) | Yes |
| `http://localhost:3000` | Yes |
| `https://dson-study-spaces.vercel.app` | Yes |
| Any `*.vercel.app` | Yes |
| `ALLOWED_ORIGIN_EXTRA` | Yes (exact match) |

Methods: `GET`, `POST`, `OPTIONS`. Headers: `Content-Type`, `Authorization`.

---

## API reference

Base URL (local): `http://localhost:3002`

### `GET /`

Welcome JSON. Not a health/readiness probe.

### `GET /api/buildings`

| | |
|-|-|
| **Auth** | `Authorization: Bearer <INTERNAL_API_SECRET>` (exact match) |
| **Cache** | `Cache-Control: public, max-age=300` |
| **Body** | `{ data: Building[] }` |

**Pipeline:**

1. Load cached `api/data/data.json` (19 buildings: `name`, `coords`, `address`, `hours`, `station`, `rating`, `image`)
2. Compute `status` Open/Closed from per-day hour ranges using **server local time**
3. Attach `slug` via `buildingSlug(name)`
4. Merge Supabase `buildings.id` by exact `name`; fallback `id = slug`

Query params such as `lat`/`lng` may be forwarded by the frontend BFF; **this route ignores them**. Distance sorting is client-side.

### `GET /api/professors/departments`

| | |
|-|-|
| **Auth** | None |
| **Cache** | 300s |
| **Body** | `{ data: Department[] }` ordered by `name` |

### `GET /api/professors/active-now`

| | |
|-|-|
| **Auth** | None |
| **Cache** | 60s |
| **Body** | `{ data: string[] }` — distinct `building_id` UUIDs with faculty in office **now** |

Uses campus timezone **`America/New_York`**. Joins active `professor_office_hours` (`valid_until IS NULL`) to professors with a `building_id`.

### `GET /api/professors`

| | |
|-|-|
| **Auth** | None |
| **Cache** | 60s |
| **Body** | `{ data: Professor[] }` with nested departments + active office hours |

| Query | Behavior |
|-------|----------|
| `q` | RPC `search_professors_fts` (websearch + rank) |
| `department_id` | Filter UUID |
| `building_id` | UUID or slug (resolved via `resolveBuildingUuid`) |
| `limit` | Default 20, max 100 (ignored when fetching all) |
| `offset` | Default 0 |
| `live_sync=true` or `all=true` | Fetch up to 10 000 rows |

Without `q`, runs a direct Supabase select with nested relations. Office hours in responses are active rows only (`valid_until === null`), with human-readable day names.

### `POST /api/professors/sync`

| | |
|-|-|
| **Auth** | Header equals `INTERNAL_CRON_SECRET`, or `Bearer <INTERNAL_CRON_SECRET>` |
| **Body** | JSON array of professor profiles (max `MAX_SYNC_RECORDS`, default 1000) |
| **Chunking** | Upserts in batches of 50 |

**Legacy path.** Identity priority: `email` → `profile_url` → `fac_id`. Strips ingestion-only fields (`department`, `building`, `office_hours`, …) before DB write. **Does not persist office hours** — `pipeline_worker` owns temporal OH reconciliation.

Used by the deprecated Node crawler; prefer the Python pipeline for production.

---

## Buildings hybrid model

```
data.json (curated metadata) ──merge by name──► response Building
Supabase buildings (UUID)    ─┘
```

- Metadata edits (hours, coords, images) → change `data.json` + redeploy / re-seed
- UUID joins for professors/departments → Supabase `buildings` rows (seed script)
- Alias map for scraped free-text locations: `api/utils/buildingAliases.js` (mirrored in Python under `pipeline_worker`)

---

## Supabase access policy

[`api/db.js`](api/db.js):

- **Always** use `getSupabase()` (HTTP via `@supabase/supabase-js`) from this process
- Service role **bypasses RLS** — suitable for server-side reads/writes only
- Do **not** open direct Postgres sockets from the API on session port 5432
- If you add raw SQL later, set `DATABASE_URL` to the **transaction pooler** (`6543` + `pgbouncer=true`)

Public clients (anon key) can `SELECT` under RLS; they cannot write. See migrations under [`../supabase/migrations`](../supabase/migrations/).

---

## Logging

Winston JSON logs to `error.log` and `combined.log` in the process CWD (local). Console transport when `NODE_ENV !== 'production'`.

---

## Deployment (Vercel)

Deploy the **`back-end/`** directory as a separate Vercel project.

[`vercel.json`](vercel.json):

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

| Env var | Required |
|---------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `INTERNAL_API_SECRET` | Yes |
| `INTERNAL_CRON_SECRET` | Yes |

Set the frontend’s `BACKEND_URL` to this deployment’s HTTPS origin.

Local listen is skipped when the module is imported (`require.main === module` guard) — Vercel uses the exported app.

```powershell
cd back-end
vercel --prod
```

**Note:** Cold starts on `@vercel/node` can add latency to FTS queries. A long-running Node host is a documented target posture in [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## Security checklist

- [ ] Service role key only in server/CI env — never `NEXT_PUBLIC_*`
- [ ] Buildings secret shared only with Next.js BFF
- [ ] Sync secret only for trusted callers (legacy)
- [ ] CORS `*.vercel.app` is intentional for preview deploys — revisit if adding privileged cookie/session APIs
- [ ] No Express rate limiting today — public professor GETs are unthrottled

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Buildings 500 “configuration error” | Missing `INTERNAL_API_SECRET` |
| Buildings 401 | Wrong/missing `Authorization: Bearer …` |
| `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set` | Empty `.env` or wrong path |
| DATABASE_URL validation error | Using port 5432 or 6543 without `pgbouncer=true` |
| Building IDs are slugs not UUIDs | Seed not run / name mismatch vs Supabase |
| Sync 401 | Wrong `INTERNAL_CRON_SECRET` |
| Sync ignores office hours | By design — use `pipeline_worker` |

---

## Related

- [`../front-end/README.md`](../front-end/README.md) — Next.js BFF + map UI
- [`../pipeline_worker/`](../pipeline_worker/) — Faculty ingestion (source of truth for OH)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — ADRs, temporal model, threat notes
- [`../README.md`](../README.md) — Migrations, monorepo scripts
