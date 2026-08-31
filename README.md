# Dickinson Study Spaces

<p>
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white">
  <img alt="Node 22" src="https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white">
  <img alt="Python 3.10+" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white">
  <img alt="Mapbox GL JS" src="https://img.shields.io/badge/Mapbox_GL_JS-v3-4264FB?logo=mapbox&logoColor=white">
  <img alt="License: ISC" src="https://img.shields.io/badge/License-ISC-blue">
</p>

Campus intelligence for Dickinson College — an interactive Mapbox map of study spaces with live open/closed status, and a faculty directory with full-text search, temporal office hours, and real-time "in office now" detection.

**Production:** [dson-study-spaces.vercel.app/home](https://dson-study-spaces.vercel.app/home)
Allow browser location access for distance-based sorting and the best map experience.

Deep system design (C4 model, ADRs, ingestion internals, security posture, known gaps): **[ARCHITECTURE.md](ARCHITECTURE.md)**
Package docs: **[front-end/README.md](front-end/README.md)** · **[back-end/README.md](back-end/README.md)**

---

## Contents

- [Features](#features)
- [System architecture](#system-architecture)
- [Sequence diagrams](#sequence-diagrams)
  - [Buildings — BFF proxy with secret injection](#1-buildings--bff-proxy-with-secret-injection)
  - [Professors — public rewrite + full-text search](#2-professors--public-rewrite--full-text-search)
  - [Live mode — dual evaluation path](#3-live-mode--dual-evaluation-path)
  - [Faculty ingestion pipeline](#4-faculty-ingestion-pipeline)
- [Data model](#data-model)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment reference](#environment-reference)
- [Faculty pipeline](#faculty-pipeline)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [API reference](#api-reference)
- [Design system](#design-system)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Study spaces
- Interactive campus map (Mapbox GL JS v3, WebGL globe projection, night light preset)
- Building cards with hours, open/closed status, photos, and ratings
- Sort by Closest / Furthest / Highest Rated / Name; filter by Open / Closed
- Building directory with department → building mapping

### Faculty discovery
- Full-text search across name, title, department, and bio (Postgres FTS — weighted `tsvector`, `websearch_to_tsquery`, `ts_rank`)
- Filter by department and building
- Office hours via a temporal model (active rows only: `valid_until IS NULL`)
- **Live mode** — highlights buildings where faculty are in office right now (campus ET, refreshes every 60s)
- **Time travel** — preview which buildings would be active at any hour of the day

### Data pipeline
- Weekly faculty ingestion via GitHub Actions (`pipeline_worker/`)
- Playwright discovery → aiohttp fetch (2 RPS rate cap) → BeautifulSoup / FSM parse → Supabase upsert
- Identity-key upserts: `email` → `profile_url` → `fac_id` (never name-only)
- Temporal office-hours reconciliation: expire + insert on diff, no-op on fingerprint match
- RLS: public `SELECT`; all writes require the service role

---

## System architecture

Four containers: a Next.js frontend, an Express REST API, a Python ingestion pipeline, and a Supabase (PostgreSQL) database. The frontend is the only container users touch directly; the pipeline never talks to the API — it writes straight to the database with the service role key.

```mermaid
flowchart TB
  subgraph actors ["External actors"]
    Student["Student / Browser"]
    FacultySite["Dickinson Faculty Directory"]
  end

  subgraph platform ["Dickinson Study Spaces"]
    NextApp["Next.js 14 Frontend\n(Vercel)"]
    ExpressAPI["Express REST API\n(Vercel serverless)"]
    Pipeline["pipeline_worker\n(GitHub Actions, weekly)"]
  end

  subgraph data ["Data layer"]
    Supabase[("Supabase PostgreSQL\n+ RLS + FTS")]
  end

  MapboxExt["Mapbox CDN"]

  Student -->|"HTTPS — UI, map, search"| NextApp
  NextApp -->|"BFF: Bearer INTERNAL_API_SECRET"| ExpressAPI
  NextApp -->|"Rewrite: public GET"| ExpressAPI
  ExpressAPI -->|"Service role — bypasses RLS"| Supabase
  Pipeline -->|"Service role — direct upsert"| Supabase
  Pipeline -->|"Playwright + aiohttp scrape"| FacultySite
  Student -.->|"Map tiles — public token"| MapboxExt
  NextApp -.-> MapboxExt
```

**Trust boundaries**

| Boundary | Nature |
|---|---|
| Browser ↔ Next.js | Public. `NEXT_PUBLIC_MAPBOX_TOKEN` is intentionally client-exposed. No session cookies or JWTs. |
| Next.js ↔ Express (`/api/buildings`) | Server-to-server. `INTERNAL_API_SECRET` injected by the BFF route handler only, never sent to the browser. |
| Browser ↔ Express (`/api/professors*`) | Transparent Next.js rewrite. No client secret required; RLS restricts writes. |
| Pipeline ↔ Supabase | CI secrets only (`SUPABASE_SERVICE_ROLE_KEY`). No runtime coupling to Express. |

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, TanStack Query v5, Radix UI, Mapbox GL JS v3 |
| Backend | Node.js 22, Express 4, `@supabase/supabase-js`, helmet, cors, winston |
| Database | Supabase (PostgreSQL) — full-text search, temporal office-hours schema, row-level security |
| Ingestion | Python 3.10+, Poetry, Playwright, Pydantic v2, BeautifulSoup4, aiohttp, supabase-py v2 |
| Deployment | Vercel (frontend + API as separate projects), GitHub Actions (weekly pipeline cron) |

---

## Sequence diagrams

### 1. Buildings — BFF proxy with secret injection

`GET /api/buildings` requires a shared secret. The frontend never exposes that secret to the browser: a Next.js Route Handler at `src/app/api/buildings/route.js` reads it server-side and injects it as a Bearer token before calling Express.

```mermaid
sequenceDiagram
  participant Browser
  participant Route as Next.js Route Handler<br/>(/api/buildings)
  participant Express as Express (buildingsAuthMiddleware)
  participant Data as data.json (19 buildings)
  participant DB as Supabase (buildings table)

  Browser->>Route: GET /api/buildings
  Note over Browser,Route: Client may attach ?lat=&lng= for local<br/>Vincenty sort — Express ignores these params
  Route->>Route: read INTERNAL_API_SECRET<br/>(alias: INTERNAL_API_KEY)
  Route->>Express: fetch BACKEND_URL/api/buildings<br/>Authorization: Bearer <secret>
  Express->>Express: validate Bearer header<br/>(missing secret → 500, mismatch → 401)
  Express->>Data: loadStaticBuildings()
  Express->>Express: compute open/closed (server local time)<br/>+ buildingSlug(name)
  Express->>DB: SELECT id, name FROM buildings
  Express->>Express: mergeSupabaseBuildingIds()<br/>(fallback id = slug on lookup miss)
  Express-->>Route: 200 { data: Building[] }
  Route-->>Browser: passthrough body<br/>Cache-Control: public, max-age=300
```

### 2. Professors — public rewrite + full-text search

Professor endpoints are public reads — no secret injection, just a transparent Next.js rewrite (`next.config.mjs` → `/api/:path*`) straight to Express. Search queries are served by the `search_professors_fts` RPC (weighted `tsvector`, `websearch_to_tsquery`, `ts_rank`); listing without a query uses the Supabase query builder directly.

```mermaid
sequenceDiagram
  participant Browser
  participant Rewrite as Next.js Rewrite<br/>(/api/:path*)
  participant Express as Express (/api/professors)
  participant DB as Supabase PostgreSQL

  Browser->>Rewrite: GET /api/professors?q=smith&department_id=...
  Rewrite->>Express: proxy → BACKEND_URL/api/professors?...
  alt q is present
    Express->>DB: rpc(search_professors_fts,<br/>query, dept_id, bldg_id, lim, off)
    DB->>DB: p.search_vector @@ websearch_to_tsquery('english', query)<br/>ORDER BY ts_rank(...) DESC
    DB-->>Express: ranked rows + nested departments/office_hours JSONB
  else no q
    Express->>DB: professors.select('*, departments(name),<br/>professor_office_hours(*)')<br/>+ eq(department_id) + eq(building_id) + range(offset, limit)
    DB-->>Express: rows
  end
  Express->>Express: mapProfessorOfficeHours()<br/>keep only valid_until IS NULL, map day_of_week → name
  Express-->>Rewrite: 200 { data: Professor[] }<br/>Cache-Control: public, max-age=60
  Rewrite-->>Browser: passthrough body
```

### 3. Live mode — dual evaluation path

Live mode has two independent consumers of "is faculty in office right now," both computed against **campus time (`America/New_York`)** but through different code paths — one server-side for the map, one client-side for the professor list.

```mermaid
sequenceDiagram
  participant UI as Home shell (React)
  participant MapHook as useActiveNowBuildingIds
  participant ListHook as useProfessors
  participant Express as GET /api/professors/active-now
  participant DB as Supabase
  participant LiveMode as liveMode.js (client)

  UI->>UI: user enables Live mode

  par Map marker dimming (server-evaluated)
    MapHook->>Express: GET /api/professors/active-now<br/>(enabled, refetchInterval: 60s)
    Express->>DB: professor_office_hours.select(...)<br/>.is('valid_until', null)<br/>join professors!inner(building_id)
    DB-->>Express: rows
    Express->>Express: isOfficeHourActiveNow()<br/>per row, campus-ET day + minute-of-day
    Express-->>MapHook: 200 { data: buildingId[] }<br/>Cache-Control: max-age=60
    MapHook-->>UI: Set of buildingId → Map.js applyAllMarkerStyles()
  and Professor list filter (client-evaluated)
    ListHook->>Express: GET /api/professors (already fetched, staleTime 30s)
    Express-->>ListHook: professors + professor_office_hours
    UI->>LiveMode: isProfessorInOffice(professor)
    LiveMode->>LiveMode: compare campus day/time vs<br/>each office-hours row
    LiveMode-->>UI: boolean → filter visible list
  end
```

> Both paths use `America/New_York`, but they are two separate evaluations of the same clock against two separately fetched datasets — see [ARCHITECTURE.md § Known Gaps](ARCHITECTURE.md#10-known-gaps-and-technical-debt) for the staleness tradeoff this implies.

### 4. Faculty ingestion pipeline

`pipeline_worker` is the **sole** scheduled writer for faculty data, run weekly by GitHub Actions directly against Supabase with the service role key — it never goes through the Express API. The legacy Node crawler (`crawler/`) and `POST /api/professors/sync` are deprecated / kept only for ad-hoc use.

```mermaid
sequenceDiagram
  participant Cron as GitHub Actions<br/>(Sun 02:00 UTC / workflow_dispatch)
  participant Discover as Stage 1 — Playwright discovery
  participant Fetch as Stage 2 — aiohttp fetch
  participant Extract as Stage 3 — BeautifulSoup + FSM
  participant Persist as Stage 4 — Supabase upsert
  participant DB as Supabase PostgreSQL

  Cron->>Discover: run_orchestrator()
  Discover->>Discover: 48 seed URLs, 5 concurrent pages/batch<br/>3 retry attempts w/ backoff
  Discover-->>Fetch: dict[profile_url → department_hint]

  Fetch->>Fetch: extract fac= query param<br/>batches of 10, sleep(batch/2.0) → 2 RPS cap
  Fetch-->>Extract: (fac_id, html | None) tuples

  Extract->>Extract: ProfileExtractor (BeautifulSoup)<br/>→ OfficeHoursFSM (regex tokenize)<br/>→ FacultyProfile (Pydantic)
  Extract-->>Persist: validated FacultyProfile objects

  Persist->>DB: departments upsert (on_conflict=name)
  Persist->>Persist: resolve building: alias map →<br/>canonical name → dept.primary_building_id
  Persist->>DB: professors upsert<br/>priority: email → profile_url → fac_id
  Persist->>DB: SELECT active office_hours<br/>(valid_until IS NULL)
  alt fingerprint unchanged
    Persist->>Persist: no-op (idempotent re-run)
  else fingerprint changed
    Persist->>DB: UPDATE valid_until = NOW() (expire old rows)
    Persist->>DB: INSERT new rows (term_identifier = current term)
    opt insert fails
      Persist->>DB: compensating rollback:<br/>restore valid_until = NULL
    end
  end
```

Full stage-by-stage module reference, retry semantics, and the fingerprint definition: [ARCHITECTURE.md § 4](ARCHITECTURE.md#4-data-ingestion-flow).

---

## Data model

Base tables (`professors`, `departments`, `buildings`) must pre-exist in Supabase — repo migrations extend them, they do not create them from scratch.

```mermaid
erDiagram
  buildings {
    uuid id PK
    text name UK
    float latitude
    float longitude
    text address
    jsonb hours
    text image_url
  }

  departments {
    uuid id PK
    text name UK
    uuid primary_building_id FK
  }

  professors {
    uuid id PK
    text name
    text email UK
    text profile_url UK
    text fac_id UK
    uuid department_id FK
    uuid building_id FK
    varchar title
    text bio
    jsonb publications
    boolean is_active
    timestamptz first_seen_at
    tsvector search_vector
  }

  professor_office_hours {
    uuid id PK
    uuid professor_id FK
    varchar term_identifier
    smallint day_of_week
    time start_time
    time end_time
    boolean is_by_appointment
    varchar location
    timestamptz valid_from
    timestamptz valid_until
    timestamptz created_at
  }

  buildings ||--o{ professors : "building_id"
  buildings ||--o{ departments : "primary_building_id"
  departments ||--o{ professors : "department_id"
  professors ||--o{ professor_office_hours : "professor_id CASCADE"
```

`professor_office_hours` is temporal: active rows have `valid_until IS NULL`; every read path (API, FTS RPC, live mode) filters on that predicate. Migrations, RLS policies, and the full ER rationale: [ARCHITECTURE.md § 6.4](ARCHITECTURE.md#64-database--supabase--postgresql).

---

## Tech stack

| Area | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS, Radix UI primitives |
| Data fetching / cache | TanStack Query v5 |
| Map | Mapbox GL JS v3 (WebGL, globe projection) |
| Backend framework | Node.js 22, Express 4 |
| Backend hardening | helmet, cors (origin allowlist), winston logging |
| Database client | `@supabase/supabase-js` v2 (HTTP transport, service role) |
| Database | Supabase (PostgreSQL) — RLS, GIN-indexed full-text search |
| Ingestion runtime | Python 3.10+ managed by Poetry |
| Ingestion libraries | Playwright (discovery), aiohttp (fetch), BeautifulSoup4 (parse), Pydantic v2 (contracts), supabase-py v2 (writes) |
| CI/CD | GitHub Actions (weekly pipeline cron + `workflow_dispatch`) |
| Hosting | Vercel — frontend and backend as two separate projects |

---

## Repository layout

```
dson-study-spaces/
├── front-end/              Next.js app — see front-end/README.md
├── back-end/               Express API — see back-end/README.md
├── pipeline_worker/        Faculty ingestion (Poetry) — source of truth for writes
├── crawler/                Deprecated Node scraper (do not schedule)
├── supabase/migrations/    Ordered SQL migrations (apply before running the app)
├── .github/workflows/      Faculty pipeline (Sun 02:00 UTC) + deprecated scraper stub
├── ARCHITECTURE.md         System design, ADRs, threat model
└── package.json            npm workspaces root (front-end, back-end, crawler)
```

---

## Prerequisites

- **Node.js 22.x** and npm (workspaces)
- **Python 3.10+** and [Poetry](https://python-poetry.org/) (pipeline only)
- A **Supabase** project (see [Database bootstrap](#3-apply-database-migrations) — base tables are not created by repo migrations)
- A **Mapbox** public access token ([create one](https://account.mapbox.com/access-tokens/))

---

## Getting started

### 1. Clone and install

```powershell
git clone https://github.com/hmhngx/dson-study-spaces.git
cd dson-study-spaces
npm install
```

### 2. Configure environment

Create **`back-end/.env`** from [`back-end/.env.example`](back-end/.env.example) (keep secrets out of git):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INTERNAL_API_SECRET=your-shared-secret
INTERNAL_CRON_SECRET=your-cron-secret
PORT=3002
```

Create **`front-end/.env.local`** from [`front-end/.env.example`](front-end/.env.example):

```env
INTERNAL_API_SECRET=your-shared-secret
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-public-token
NEXT_PUBLIC_API_URL=http://localhost:3000
BACKEND_URL=http://localhost:3002
```

Notes:

- `INTERNAL_API_SECRET` must match between frontend and backend. `INTERNAL_API_KEY` is accepted as an alias for the same value.
- Browser calls should hit the **Next.js origin** (`NEXT_PUBLIC_API_URL=http://localhost:3000`). Buildings go through the BFF route handler; other `/api/*` paths are rewritten to `BACKEND_URL`.
- `BACKEND_URL` is **server-only** (BFF `fetch` + rewrites). Without it in local dev, rewrites fall back to `NEXT_PUBLIC_API_URL` and can mis-route.

### 3. Apply database migrations

Repo migrations **assume** `professors`, `departments`, and `buildings` already exist in Supabase. They do **not** contain base `CREATE TABLE` DDL for those tables. Create or restore that schema first (or clone from an existing project), then run these files **in filename order**:

1. `supabase/migrations/20250314000000_temporal_professor_schema.sql`
2. `supabase/migrations/20250404000000_professor_fts.sql`
3. `supabase/migrations/20250525000000_professor_identity_keys.sql`
4. `supabase/migrations/20250526000000_enable_public_read_rls.sql`

Then seed buildings and map departments (requires service-role credentials in `back-end/.env`):

```powershell
npm run seed:buildings -w back-end
npm run map:departments -w back-end
```

### 4. Run locally

**Terminal 1 — API** (port 3002):

```powershell
npm run dev:api
```

**Terminal 2 — frontend** (port 3000):

```powershell
npm run dev
```

Open [http://localhost:3000/home](http://localhost:3000/home). Both servers must be running for building and professor data to load.

---

## Environment reference

### Frontend (`front-end/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_API_SECRET` | Yes | Shared secret for the `/api/buildings` BFF (`INTERNAL_API_KEY` alias also works) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox public token for the campus map |
| `NEXT_PUBLIC_API_URL` | Dev / prod | Browser-facing origin. Local: `http://localhost:3000`. On Vercel, may be omitted — resolved from `VERCEL_URL` at build time |
| `BACKEND_URL` | Dev / prod | Express origin for server-side BFF + rewrites (e.g. `http://localhost:3002` or the backend Vercel URL) |

### Backend (`back-end/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — **server only**, never expose to the client |
| `INTERNAL_API_SECRET` | Yes | Bearer token for `GET /api/buildings` (`INTERNAL_API_KEY` alias) |
| `INTERNAL_CRON_SECRET` | Yes | Auth for `POST /api/professors/sync` (legacy webhook) |
| `PORT` | No | Listen port (default `3002`) |
| `ALLOWED_ORIGIN_EXTRA` | No | One additional CORS origin (beyond localhost + `*.vercel.app`) |
| `DATABASE_URL` / `SUPABASE_DB_URL` | No | Optional; if set, must be the transaction pooler on port **6543** with `?pgbouncer=true` (port 5432 is rejected) |

### Pipeline (GitHub Actions secrets or local env)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key for ingestion writes |

The orchestrator also loads a repo-root `.env` as a local fallback when present.

---

## Faculty pipeline

The Node crawler in `crawler/` is **deprecated**. Scheduled ingestion is **`pipeline_worker/` only**, writing **directly to Supabase** with the service role (not via `POST /api/professors/sync`).

### Automated (production)

[`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml) runs every **Sunday at 02:00 UTC** and supports `workflow_dispatch`. Configure repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The deprecated [`.github/workflows/scraper.yml`](.github/workflows/scraper.yml) is manual-only and **exits with code 1**.

### Manual (local)

```powershell
cd pipeline_worker
poetry install
poetry run playwright install chromium
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
poetry run python -m pipeline_worker.main_orchestrator
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js (port 3000) |
| `npm run dev:api` | Start Express with nodemon (port 3002) |
| `npm run build` | Production build (frontend) |
| `npm run start:api` | Start API without nodemon |
| `npm run seed:buildings -w back-end` | Upsert 19 buildings from `back-end/api/data/data.json` |
| `npm run map:departments -w back-end` | Map departments → `primary_building_id` |

---

## Deployment

Production: [https://dson-study-spaces.vercel.app/home](https://dson-study-spaces.vercel.app/home)

Frontend and backend are **separate Vercel projects**. Backend entrypoint for Vercel is `back-end/index.js` (re-exports `api/index.js` per `back-end/vercel.json`).

| Project | Required env |
|---------|----------------|
| Frontend | `INTERNAL_API_SECRET`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `BACKEND_URL` (backend deployment URL). `NEXT_PUBLIC_API_URL` optional on Vercel |
| Backend | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_SECRET`, `INTERNAL_CRON_SECRET` |
| GitHub Actions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Apply Supabase migrations before deploying API changes that depend on new schema.

```powershell
cd front-end
vercel --prod

cd ..\back-end
vercel --prod
```

---

## API reference

| Method | Path | Auth | Cache | Description |
|--------|------|------|-------|-------------|
| `GET` | `/` | None | — | Welcome JSON (not a health probe) |
| `GET` | `/api/buildings` | `Authorization: Bearer <INTERNAL_API_SECRET>` | 300s | Building list + open/closed + Supabase UUIDs |
| `GET` | `/api/professors` | Public | 60s | List/search; FTS when `q` is set |
| `GET` | `/api/professors/departments` | Public | 300s | All departments |
| `GET` | `/api/professors/active-now` | Public | 60s | Building UUIDs with faculty in office now (campus ET) |
| `POST` | `/api/professors/sync` | `INTERNAL_CRON_SECRET` | — | Legacy bulk upsert (no office hours) |

`GET /api/professors` query params: `q`, `department_id`, `building_id` (UUID or slug), `limit` (default 20, max 100), `offset`, `live_sync=true` / `all=true` (fetch up to 10k). Full behavior: [ARCHITECTURE.md](ARCHITECTURE.md).

Client may send `lat`/`lng` on buildings fetch for client-side distance sort; the Express buildings route **does not** use those query params.

---

## Design system

- **Typography** — active pairing: **DM Sans** (body) + **Space Grotesk** (headings), configured in `front-end/src/lib/fonts.js` (`FONT_CONFIG`)
- **Controls** — solid utility surfaces for readability; glassmorphic content panels on the map shell
- **Components** — Radix UI primitives + Tailwind in `front-end/src/ui/`

Open/closed and live-mode evaluation use campus timezone `America/New_York` on the primary UI paths. See [ARCHITECTURE.md § Live mode — dual evaluation path](ARCHITECTURE.md#live-mode--dual-evaluation-path) for known inconsistencies in fetch enrichment and the Express buildings status field.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with a clear message describing the *why*
4. Push and open a pull request

Before submitting: keep migrations idempotent, never commit secrets, ensure `npm run build` and `npm run start:api` succeed, and prefer extending `pipeline_worker` over resurrecting `crawler/`.

---

## License

ISC — see individual package manifests for details.
