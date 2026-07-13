# Front-end — Dickinson Study Spaces

Next.js 14 (App Router) client for Dickinson Study Spaces: interactive Mapbox campus map, study-space discovery, and faculty search with live office-hours mode.

**Package:** `dickinson-study-spaces-front-end`  
**Runtime:** Node.js 22.x  
**Production:** [https://dson-study-spaces.vercel.app/home](https://dson-study-spaces.vercel.app/home)

Upstream API lives in [`../back-end`](../back-end/README.md). System-wide design: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). Monorepo ops: [`../README.md`](../README.md).

---

## What this package owns

| Responsibility | Implementation |
|----------------|----------------|
| UI shell (`/home`) | `src/app/home/page.js` — map + sidebar, live mode, time travel |
| Mapbox WebGL map | `src/app/components/Map.js` — imperative markers, refs (not React state) |
| Buildings BFF | `src/app/api/buildings/route.js` — injects `INTERNAL_API_SECRET`, proxies to Express |
| Professor API calls | TanStack Query hooks → `NEXT_PUBLIC_API_URL` (rewritten to Express) |
| Distance / sort / filter | `services/distance.js`, `services/operation.js` |
| Live-mode client checks | `services/liveMode.js` + `useActiveNowBuildingIds` |
| Design tokens / fonts | Tailwind + `src/lib/fonts.js` (DM Sans + Space Grotesk) |

This package does **not** talk to Supabase directly. All data goes through the Express API (or the buildings BFF).

---

## Quick start

From the **monorepo root** (preferred — npm workspaces):

```powershell
npm install
cd front-end
copy .env.example .env.local
# Edit .env.local — see Environment below
npm run dev
```

Or from this folder after root `npm install`:

```powershell
npm run dev
```

App: [http://localhost:3000/home](http://localhost:3000/home)

The Express API must also be running on port **3002** (`npm run dev:api` from the repo root). Without it, buildings and professors fail to load.

---

## Environment

Create `front-end/.env.local` (never commit secrets):

```env
# Browser-facing origin (this Next.js app)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Mapbox public token (safe to expose — pk.*)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token

# Must match back-end INTERNAL_API_SECRET (INTERNAL_API_KEY alias also works)
INTERNAL_API_SECRET=your-shared-secret

# Server-only: Express origin for BFF fetch + /api rewrites
BACKEND_URL=http://localhost:3002
```

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Client + build | Yes (local) | Base URL for professor/department hooks. On Vercel, auto-resolved from `VERCEL_URL` when unset ([`next.config.mjs`](next.config.mjs)) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Client | Yes | Mapbox GL access; missing token shows an in-map banner |
| `INTERNAL_API_SECRET` | Server only | Yes | Bearer injected by `/api/buildings` route handler |
| `BACKEND_URL` | Server only | Yes (local) | Upstream Express for BFF + rewrites. Falls back to `NEXT_PUBLIC_API_URL` if unset (wrong for local split ports) |

Helpers: [`src/lib/env.js`](src/lib/env.js) — `getPublicApiUrl()`, `getMapboxToken()`, `getBackendUrl()`.

### Dual URL model (critical)

```
Browser ──GET /api/buildings──► Next.js Route Handler ──Bearer──► Express :3002
Browser ──GET ${NEXT_PUBLIC_API_URL}/api/professors*──► Next rewrite ──► Express :3002
```

1. **Buildings** — relative `/api/buildings` → filesystem route handler wins over rewrite → secret injected server-side.
2. **Professors** — absolute `${NEXT_PUBLIC_API_URL}/api/...` → rewrite in `next.config.mjs` to `${BACKEND_URL}/api/...`.

If `NEXT_PUBLIC_API_URL` points at `:3002` and `BACKEND_URL` is missing, the browser talks to Express directly (works only if CORS allows it). Prefer `:3000` + `BACKEND_URL=:3002`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (`eslint.config.mjs`; ignored during `next build`) |

From monorepo root: `npm run dev`, `npm run build`, `npm run lint` (workspace-scoped to this package).

---

## Directory map

```
front-end/
├── next.config.mjs          Public API URL resolve + /api rewrites
├── tailwind.config.js
├── jsconfig.json            @/* → ./src/*
├── services/                Domain helpers (imported via relative paths)
│   ├── distance.js          Fetch buildings + Vincenty sort; browser-TZ status enrich
│   ├── operation.js         Sort/filter with campus ET
│   ├── liveMode.js          isProfessorInOffice, matchBuildingFromLocation
│   ├── formatTime.js
│   └── formatId.js
└── src/
    ├── app/
    │   ├── layout.js        Fonts, Providers, viewportFit: cover
    │   ├── page.js          Redirect → /home
    │   ├── home/page.js     Main atlas shell
    │   ├── api/buildings/   BFF route handler (force-dynamic)
    │   ├── components/      Map, cards, directory, professor UI
    │   ├── styles/          globals.css, Map.css
    │   ├── error.js
    │   └── not-found.js
    ├── hooks/               TanStack Query wrappers
    ├── lib/                 env, fonts, campus-time utils
    └── ui/                  Radix + Tailwind primitives
```

Path alias `@/*` maps to `src/*` only. Files under `services/` use relative imports from `src/app/**`.

---

## Routes

| Path | File | Notes |
|------|------|-------|
| `/` | `src/app/page.js` | Client redirect to `/home` |
| `/home` | `src/app/home/page.js` | Main app (client component) |
| `/api/buildings` | `src/app/api/buildings/route.js` | BFF; `dynamic = "force-dynamic"`; passthrough status + Cache-Control |

All other `/api/*` requests are rewritten to `BACKEND_URL` ([`next.config.mjs`](next.config.mjs)).

---

## Data fetching (TanStack Query)

| Hook / query | Key | Endpoint | Caching |
|--------------|-----|----------|---------|
| Inline in `home/page.js` | `["buildings", lat, lng]` | `/api/buildings` (via `fetchAndSortBuildings`) | Default `staleTime: 0` |
| `useDepartments` | `["departments"]` | `/api/professors/departments` | `staleTime` / `gcTime`: `Infinity` |
| `useProfessors` | `["professors", q, deptId, liveSync]` | `/api/professors` | `staleTime: 30_000` |
| `useActiveNowBuildingIds` | `["professors", "active-now"]` | `/api/professors/active-now` | `staleTime: 30_000`, `refetchInterval: 60_000`, enabled when live mode on |
| `useLiveTime` | — | — | Local 60s tick for campus-time UI |

Provider: [`src/app/providers.js`](src/app/providers.js) — `QueryClientProvider` + `100dvh` shell.

Ephemeral UI state (sidebar, view tab, time-travel hour, live toggle) lives in `home/page.js` — no Redux/Zustand.

---

## Map architecture

Mapbox GL owns the WebGL canvas. React owns chrome (controls, banners, recovery UI).

| Concern | Pattern |
|---------|---------|
| Map instance | `useRef` — never React state |
| Markers | Imperative `mapboxgl.Marker` + DOM; rebuild on building **set** change (`buildingIdsKey`) |
| Styles | Direct DOM mutation in `applyAllMarkerStyles` (open/closed, live dim, highlight) |
| Parent API | `useImperativeHandle` → `flyToLocation(lat, lng)` |
| Coordinates | Data is `[lat, lng]`; Mapbox needs `[lng, lat]` — convert at marker/`flyTo` |
| Gestures | No `map.on('move')` → React (avoids 60fps re-renders) |

Style: `mapbox://styles/mapbox/standard`, night light preset, globe projection, cooperative gestures.

---

## Live mode & time travel

| Surface | Source |
|---------|--------|
| Map marker dimming | Server: `GET /api/professors/active-now` → `useActiveNowBuildingIds` |
| Professor list filter | Client: `isProfessorInOffice()` in `liveMode.js` |
| Time travel slider | Client: `isBuildingOpenAtTime` / campus date parts in `lib/utils.js` |

Canonical timezone: **`America/New_York`** (`CAMPUS_TIMEZONE` in [`src/lib/utils.js`](src/lib/utils.js)).

**Known split:** `services/distance.js` attaches building `status` using the **browser local** clock during fetch enrichment. Cards/map/filters re-evaluate with campus ET. Prefer campus-ET helpers for new open/closed logic.

---

## UI / design

- **Fonts (active):** DM Sans (body), Space Grotesk (headings) — [`src/lib/fonts.js`](src/lib/fonts.js) `FONT_CONFIG`
- **Layout:** `100dvh` lock + `overflow: hidden`; mobile stack / desktop `flex-row-reverse`; safe-area insets on overlays
- **Primitives:** Radix wrappers under `src/ui/` (some unused by the import graph — accordion/scroll-area/tooltip still available)
- **Images:** Next `images.remotePatterns` allows `maps.googleapis.com` (legacy; live map is Mapbox)

Example / sandbox components (`DesignSystemExample`, `FontExample`, `DropdownExamples`) are not part of the production `/home` flow.

---

## Deployment (Vercel)

Deploy the **`front-end/`** directory as its own Vercel project.

| Env var | Notes |
|---------|--------|
| `INTERNAL_API_SECRET` | Same value as backend |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public Mapbox token |
| `BACKEND_URL` | Full HTTPS URL of the backend Vercel deployment |
| `NEXT_PUBLIC_API_URL` | Optional; defaults from `VERCEL_URL` |

CORS on the backend already allows `*.vercel.app` and `https://dson-study-spaces.vercel.app`.

```powershell
cd front-end
vercel --prod
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Buildings 500: secret not set | Missing `INTERNAL_API_SECRET` in `.env.local` |
| Buildings 401 | Secret mismatch vs `back-end/.env` |
| Buildings 502 | Express not running / wrong `BACKEND_URL` |
| Professors empty / CORS | `NEXT_PUBLIC_API_URL` pointing at wrong origin; prefer `:3000` + rewrite |
| Map blank + token banner | Missing `NEXT_PUBLIC_MAPBOX_TOKEN` |
| Distance sort disabled | Browser geolocation denied — Closest/Furthest need coordinates |

---

## Related

- [`../back-end/README.md`](../back-end/README.md) — Express API
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — BFF sequence, ADRs, timezone notes
- [`../README.md`](../README.md) — Monorepo install & migrations
