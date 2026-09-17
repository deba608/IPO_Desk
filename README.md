# IPO Desk (IPODESK) — Allotment Checker

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Check IPO allotment status for single or multiple PANs instantly. Track the IPO calendar, analyse GMP, view subscription data, manage check history, coordinate family bids with a checklist, and backtest IPO strategies — all in one dark-themed dashboard.

**Live demo:** https://ipo-desk.vercel.app

All IPO data is discovered **dynamically from registrar APIs** — no hardcoded lists. The calendar uses live provider data (IPO Guru, InvestorGain, NSE) with curated sample fallback.

> Brand: canonical name is **IPO Desk**, alias **IPODESK** (the no-hyphen form users type in Google). Single source of truth: `src/lib/siteConfig.ts` (`siteUrl`, `siteName`, `siteAlternateName`). The live URL is `https://ipo-desk.vercel.app` unless `NEXT_PUBLIC_SITE_URL` is set.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [Pages](#pages)
- [API Endpoints](#api-endpoints)
- [Registrar Integrations](#registrar-integrations)
- [Calendar Data Providers](#calendar-data-providers)
- [Project Structure](#project-structure)
- [Testing & Quality](#testing--quality)
- [Auth & Admin](#auth--admin)
- [SEO](#seo)
- [Architecture](#architecture)
- [Roadmap & Docs](#roadmap--docs)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Features

### Allotment Checker (`/`)
- **Single & bulk PAN check** — one PAN, a pasted list, or Excel/CSV upload (max 5 MB, up to 500 PANs per request)
- **Cross-IPO scan** — check the same PANs across all active IPOs at once (max 50 PANs)
- **Latest-first IPO selector** — ordered by allotment date (then open date), newest first
- **Results dashboard** — sortable, filterable TanStack Table with pagination (10/25/50/100)
- **PAN labels** — nicknames for PANs, persisted locally
- **Share card** — Canvas-generated PNG for results
- **Export** — CSV & styled XLSX with summary sheet

### IPO Calendar (`/calendar`)
- Live IST clock, 60-second polling, tab-focus refresh
- Lifecycle tabs (All / Open / Upcoming / Closed / Listed) with counts + Mainboard/SME board filter
- Search, sort (GMP, issue size, dates, subscription), watchlist (localStorage, cross-tab sync)
- Honest **Live vs Sample** data-source badge + at-a-glance highlights

### IPO Detail (`/ipo/[id]`)
- Key stats (price band, lot size, issue size, min investment), subscription bars (QIB/NII/Retail/Total)
- GMP analysis + Recharts trend chart, algorithmic **AI research report** (0–100 score, radar chart, verdict)
- Visual timeline, issue details, `.ics` / Google Calendar export, per-IPO alert settings, deep-link to checker

### Family Checklist (`/apply`)
- **Account vault** (PANs, brokers, UPI IDs in browser localStorage — never sent to the server)
- **Apply workspace** — pick an open IPO, set lots, tick who applies, see blocked amounts
- Copy helpers (per-account + TSV for Excel/broker forms), broker deep-links, UPI mandate tracker
- Guardrail: IPO Desk never places bids or moves money. One PAN = one bid (SEBI rule).

### Backtest (`/backtest`)
- Strategy sliders (min GMP %, QIB/Retail/Total subscription, board, issue size) + 5 presets
- Metrics: win rate, avg listing-day gain, ₹1L growth simulation, benchmark comparison
- Charts (return distribution, cumulative growth), searchable history table, CSV export, programmatic `/api/backtest`

### Check History (`/history`)
- Stats cards (checks, PANs, allotted, win rate), per-entry badges, remove/clear

### Command Palette
- Global `⌘K` / `Ctrl+K` search (checker, calendar, backtest, history, admin) via `cmdk`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `standalone` output) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui + Sonner + Lucide |
| Table / Charts / Search | TanStack Table v8, Recharts, cmdk |
| Auth | Auth.js v5 (Google OAuth, JWT) + Resend email OTP for admin |
| Database | Prisma + Postgres (`@prisma/client`, `@prisma/adapter-pg`) — optional, in-memory fallback |
| Validation / HTTP / Files | Zod, Axios, SheetJS (parse/CSV), ExcelJS (styled XLSX) |
| Tests | Vitest (7 suites, `npm test`) |
| PWA | Web app manifest (`standalone` display mode) |

---

## Getting Started

Prerequisites: **Node.js 20+** and npm. Postgres is optional (app runs in-memory without it).

```bash
npm install
npm run dev
# → http://localhost:3000
```

Useful scripts:

```bash
npm run build        # prisma generate + conditional migrate + next build
npm start            # serve production build
npm run lint         # eslint
npm test             # vitest run
npm run test:watch   # vitest watch mode
npm run db:push      # push Prisma schema (needs DATABASE_URL)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed sample IPOs + GMP history (tsx prisma/seed.ts)
npm run db:studio    # open Prisma Studio
```

No environment variables are required for the core checker — all registrar APIs are public. Set the vars below only for the features you want.

---

## Environment Variables

See [`.env.example`](./.env.example) for the full annotated list.

| Variable | Required? | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL for metadata/sitemap/JSON-LD (defaults to `https://ipo-desk.vercel.app`) |
| `IPOGURU_API_KEY` | No | Enables IPO Guru as live calendar source (15 req/min, 300/day; cached 5 min) |
| `CRON_SECRET` | No | Bearer secret for `/api/cron/sync-ipos`, `/api/logs`, `/api/admin/sync` |
| `DATABASE_URL` | No | Postgres connection string; without it the app uses in-memory fallback |
| `OCR_SPACE_API_KEY` | No | Bigshare CAPTCHA OCR quota (25k/mo free; else shared demo key) |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Enables Google sign-in (Auth.js v5) |
| `ADMIN_EMAILS`, `ADMIN_PHONES` | No | Allowlisted admin OTP identities |
| `RESEND_API_KEY`, `RESEND_FROM` | No | Admin email-OTP delivery |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker only | Compose DB credentials (`POSTGRES_PASSWORD` has no default) |

---

## Docker

Production multi-stage image (Node 20-slim + `ddddocr` for Bigshare CAPTCHA) with `standalone` output.

```bash
# 1. Copy and fill env (DATABASE_URL + POSTGRES_PASSWORD required)
cp .env.example .env

# 2. Build + run app (http://localhost:3000) + Postgres (localhost-only)
docker compose up --build
```

- Migrations run automatically at container start when `DATABASE_URL` is set (`scripts/migrate-if-db.mjs`); otherwise the app runs with in-memory fallback.
- Postgres data persists in the `pgdata` volume and is bound to `127.0.0.1:5432` only.

**Vercel:** set env vars in Project → Settings → Environment Variables, plus the daily cron in [`vercel.json`](./vercel.json) (`/api/cron/sync-ipos` → `0 0 * * *`).

---

## Pages

| Route | Description |
|---|---|
| `/` | Allotment checker (single/bulk/Excel, results dashboard, cross-IPO scan) |
| `/calendar` | IPO calendar (lifecycle tabs, search, sort, watchlist) |
| `/ipo/[id]` | IPO detail (stats, subscription, GMP, report, timeline, alerts) |
| `/apply` | Family checklist (vault, workspace, mandate tracker) |
| `/backtest` | Strategy backtesting engine + charts + CSV export |
| `/history` | Check history (stats, entry list, remove/clear) |
| `/ipo-allotment-check` | SEO guide: how to check allotment by PAN + FAQ schema |
| `/ipo-gmp-today` | SEO page: GMP today guide + FAQ schema |
| `/upcoming-ipo` | SEO page: live upcoming/open IPOs + ItemList schema |
| `/admin` | Admin console (OTP-gated sync monitor, logs, registry, report reviewer) |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/check` | POST | 1–500 PANs on one IPO (60 req/min, 50 s timeout, Bigshare CAPTCHA-aware) |
| `/api/scan` | POST | PANs across all active IPOs (max 50 PANs, all registrars) |
| `/api/ipos` | GET | Active IPOs merged across all registrars |
| `/api/calendar` | GET | Calendar data with lifecycle derivation |
| `/api/ipo/[id]/gmp-history` | GET | GMP time-series (DB when available, demo fallback) |
| `/api/ipo/[id]/report` | GET | Algorithmic research report with scores + verdict |
| `/api/backtest` | GET/POST | Programmatic strategy simulation |
| `/api/export` | POST | Results as CSV or XLSX |
| `/api/bigshare/captcha` | GET | Bigshare CAPTCHA image proxy/solver support |
| `/api/alerts` | GET/POST/DELETE | IPO alerts (user session or `x-device-id`) |
| `/api/alerts/link` | POST | Link anonymous device alerts to a signed-in user |
| `/api/health` | GET | Health + config flags (auth/mail/allowlist, OCR) |
| `/api/logs` | GET | Debug event logs (Bearer `CRON_SECRET` or admin cookie) |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js routes (Google OAuth) |
| `/api/admin/otp/request` | POST | Request admin email-OTP (allowlisted identities only) |
| `/api/admin/otp/verify` | POST | Verify OTP, issue `ipodesk_admin` cookie |
| `/api/admin/logout` | POST | Clear admin session |
| `/api/admin/sync` | POST | Manual registrar sync (admin cookie or `CRON_SECRET` Bearer) |
| `/api/cron/sync-ipos` | GET | Daily sync cron (Bearer `CRON_SECRET`), persists snapshots when DB is configured |

All inputs are Zod-validated with JSON error responses (`400` validation, `404` IPO not found, `429` rate-limited, `504` timeout — never hangs).

---

## Registrar Integrations

Every registrar implements the same `RegistrarAdapter` interface (`src/registrars/adapter.interface.ts`), called **server-side only**. Checks always hit the registrar live; catalogues are cached 5 min with stale-memory + disk-snapshot fallbacks. Each registrar syncs independently — one failure never hides the others.

| Registrar | Discovery | Allotment check |
|---|---|---|
| **KFintech** | SPA bundle scrape (`ipostatus.kfintech.com`) | `GET …/prod/api/query?type=pan` |
| **MUFG Intime** (ex Link Intime) | `POST /Initial_Offer/IPO.aspx/GetDetails` | `POST /Initial_Offer/IPO.aspx/SearchOnPan` |
| **Link Intime (legacy key)** | Same MUFG portal family (back-compat key) | Same portal |
| **Bigshare** | HTML `<select>` scrape (`IPO_Status.html` + mirrors) | `POST /Data.aspx/FetchIpodetails` + CAPTCHA (local `ddddocr` fast-path, OCR.Space fallback) |
| **Skyline** | IPO `<select>` list scrape | 2-step session POST (CSRF token + search), no CAPTCHA |
| **Purva Sharegistry** | Django IPO query page | Django CSRF session flow, PAN mode |
| **Maashitla** | `GET /api/public-issue/companies` (public OpenAPI JSON) | `GET /api/public-issue/search?company_name=&pan=` (`404` = `not_found`) |

---

## Calendar Data Providers

Tried in priority order; first to return data wins. If all live sources fail, curated seed keeps the calendar non-empty.

| Provider | API key | Data |
|---|---|---|
| **IPO Guru** | Required (`IPOGURU_API_KEY`) | Full IPO data + GMP + subscription |
| **InvestorGain** | None | GMP, dates, price band, lot size, category |
| **NSE India** | None | Official NSE/BSE issue data (no GMP) |
| **Seed** (fallback) | None | Curated IPOs with dynamic dates |

Bigshare bulk speed: CAPTCHA pool pre-warm, sticky fastest-mirror, parallel frontend batches (×3) with progressive rendering.

---

## Project Structure

```
src/
  app/
    api/                 # check, scan, ipos, calendar, backtest, export,
                         # bigshare/captcha, alerts(+/link), health, logs,
                         # auth/[...nextauth], admin/otp/*, admin/sync, cron/sync-ipos
    admin/page.tsx       # Admin console (OTP-gated)
    apply/page.tsx       # Family checklist
    backtest/page.tsx    # Backtesting workspace
    calendar/page.tsx    # IPO calendar
    history/page.tsx     # Check history
    ipo/[id]/page.tsx    # IPO detail
    page.tsx             # Home (server SEO hero + client checker)
    sitemap.ts robots.ts # Dynamic sitemap + robots rules
  components/
    auth/                # SessionProvider, AuthButton
    common/              # Header, CommandPalette, StatusBadge
    ui/                  # shadcn primitives
  features/
    ipo-checker/         # CheckerTabs, IPOSelector, ResultsDashboard
    ipo-calendar/        # Calendar view, cards, providers, ICS utils
    ipo-detail/          # Subscription bars, timeline, research report
    ipo-apply/           # Vault, workspace, checklist, broker links
    backtest/            # Workspace, strategy engine, historical dataset
  hooks/                 # useWatchlist, usePanLabels, useCheckHistory, useAlerts, …
  lib/                   # siteConfig.ts, prisma.ts, rate-limit.ts, utils.ts
  registrars/            # Adapter interface + 7 registrar adapters + registry
  services/              # check pipeline, sync, captcha, export, logger, report, backtest
  types/                 # Allotment, IPO, calendar, API types
prisma/
  schema.prisma          # Ipo, GmpSnapshot, SubSnapshot, Report, User,
                         # Account, AdminOtpChallenge, Alert, WatchlistEntry
  seed.ts
scripts/                 # migrate-if-db.mjs (conditional migrate on boot)
```

---

## Testing & Quality

```bash
npm test          # Vitest suite (7 suites: registrars, calendar, providers, report, backtest, brokers)
npx tsc --noEmit  # typecheck (clean)
npm run lint      # eslint
```

CI runs lint + typecheck + tests on every push (`.github/workflows/ci.yml`).

---

## Auth & Admin

App works without auth. Sign-in unlocks cross-device alert ownership + watchlist linking.

- **Users:** Google OAuth via Auth.js v5 (JWT sessions)
- **Admin:** passwordless email OTP (6-digit, hashed, 10-min expiry, rate-limited) issuing a short-lived `ipodesk_admin` cookie; `CRON_SECRET` Bearer still works for cron/programmatic access
- See [AUTH_PLAN.md](./AUTH_PLAN.md) for the implemented design

---

## SEO

- Landing pages: `/ipo-allotment-check`, `/ipo-gmp-today`, `/upcoming-ipo` — canonical + `en-IN`/`x-default` alternates, OG/Twitter cards, FAQ/Breadcrumb/ItemList schemas
- Dynamic `sitemap.xml` (static routes + per-IPO entries with real `lastModified`, `revalidate = 3600`) + per-bot `robots.ts`
- JSON-LD: Organization (brand + `IPODESK` alias + logo) in root layout; WebSite + WebApplication on homepage
- Perf: `optimizePackageImports`, `poweredByHeader: false`, immutable 1-year `/_next/static` cache, 7-day public-asset cache, CLS-safe logo

---

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                               │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Checker UI │  │ Calendar /   │  │ Family     │  │  Backtest /   │  │
│  │  (bulk/scan)│  │ IPO Detail   │  │ Checklist  │  │  History      │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └──────┬────────┘  │
│         │                │                │                │           │
│  localStorage (vault, labels, history, watchlist — never sent server)  │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │  HTTPS          │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Next.js App Router (Vercel / Docker)                │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      API Route Handlers                          │   │
│  │                                                                  │   │
│  │  /api/check ──────────────────────────────────────────────────┐  │   │
│  │  /api/scan  ──► check pipeline ──► registrar registry ──► 7  │  │   │
│  │  /api/ipos  ──► sync service   ──► adapters (parallel)    │  │   │   │
│  │  /api/calendar ──► calendar service ──► 3 live providers  │  │   │   │
│  │  /api/backtest ──► backtest engine                        │  │   │   │
│  │  /api/export ──► ExcelJS / CSV builder                    │  │   │   │
│  │  /api/health, /api/logs (admin)                           │  │   │   │
│  │  /api/admin/* (OTP gate) /api/auth/* (Auth.js v5)        │  │   │   │
│  └────────────────────────────────────────────────┬──────────┘   │   │
│                                                   │              │   │
│  ┌──────────────────┐   ┌──────────────────────┐  │              │   │
│  │  Rate Limiter    │   │  Zod Validator       │  │              │   │
│  │  (per-IP, 60/min)│   │  (all inputs)        │  │              │   │
│  └──────────────────┘   └──────────────────────┘  │              │   │
│                                                   ▼              │   │
│  ┌────────────────────────────────────────────────────────────┐  │   │
│  │               Prisma ORM (optional)                        │  │   │
│  │  Ipo · GmpSnapshot · SubSnapshot · Report · User          │  │   │
│  │  AdminOtpChallenge · Alert · WatchlistEntry               │  │   │
│  └────────────────────────────────────────────┬───────────────┘  │   │
└────────────────────────────────────────────────┼──────────────────┘   │
                                                 │                      │
                          ┌──────────────────────┘                      │
                          ▼                                              │
                 ┌─────────────────┐                                    │
                 │  PostgreSQL DB  │ (optional — in-memory fallback)     │
                 └─────────────────┘                                    │
                                                                        │
          ┌─────────────────────────────────────────────────────────────┘
          │  Server → Registrar (never browser → registrar)
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        External Services                                │
│                                                                         │
│  Registrars (live, per-check)          Calendar data providers          │
│  ┌──────────┐ ┌──────────┐            ┌───────────┐ ┌──────────────┐   │
│  │ KFintech │ │   MUFG   │            │ IPO Guru  │ │InvestorGain  │   │
│  │  (PAN    │ │  Intime  │            │ (API key) │ │    (free)    │   │
│  │  query)  │ │  (AJAX)  │            └───────────┘ └──────────────┘   │
│  └──────────┘ └──────────┘            ┌───────────┐                    │
│  ┌──────────┐ ┌──────────┐            │    NSE    │ OCR.Space API       │
│  │Bigshare  │ │ Skyline  │            │  (free)   │ (CAPTCHA solve,     │
│  │(CAPTCHA) │ │  (CSRF)  │            └───────────┘  free 25k/mo)       │
│  └──────────┘ └──────────┘                                             │
│  ┌──────────┐ ┌──────────┐                                             │
│  │  Purva   │ │Maashitla │                                             │
│  │ (Django) │ │(OpenAPI) │                                             │
│  └──────────┘ └──────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component Breakdown

| Component | Location | Responsibility |
|---|---|---|
| **Registrar Registry** | `src/registrars/registry.ts` | Discovers all `RegistrarAdapter` instances; routes PAN checks by IPO id prefix; merges IPO catalogues |
| **Check Pipeline** | `src/services/check.service.ts` | Validates PANs, strips duplicates, fans out to the right adapter, coerces errors to `AllotmentResult` |
| **Sync Service** | `src/services/sync.service.ts` | 5-min TTL catalogue cache; disk snapshot + memory fallback so a registrar hiccup never empties the IPO list |
| **CAPTCHA Service** | `src/services/captcha.service.ts` | Local `ddddocr` (Docker) fast-path → OCR.Space fallback; jittered 429 backoff; shared promise dedup |
| **Bigshare Adapter** | `src/registrars/bigshare.ts` | Token-sharing bulk strategy (1 OCR call/batch); lazy pool ≤2 in-flight; sticky fastest-mirror |
| **Rate Limiter** | `src/lib/rate-limit.ts` | Sliding-window in-memory counter per client IP; 60 req/min on `/api/check` |
| **Calendar Service** | `src/features/ipo-calendar/lib/calendar.service.ts` | Priority-chain providers; live vs. sample badge; lifecycle derivation (Open/Upcoming/Closed/Listed) |
| **Report Service** | `src/services/report.service.ts` | Algorithmic 0–100 score (GMP, sub ratios, board, issue size); cached per IPO |
| **Backtest Engine** | `src/features/backtest/lib/backtest.service.ts` | Strategy simulation over historical dataset; metrics + ₹1L growth curve |
| **Export Service** | `src/services/export.service.ts` | CSV + styled multi-sheet XLSX via ExcelJS |
| **Logger** | `src/services/logger.service.ts` | Structured in-memory event ring (size 500); tailed by `/api/logs` |

---

### Bigshare CAPTCHA Flow (Bulk)

```
checkBulkAllotment(pans)
        │
        ▼
  fetchCaptchaToken()  ←── ONE OCR.Space call (no burst)
        │
        │  sharedCaptcha = { token, answer }
        │
  ┌─────▼──────────────────────────────────────────────────┐
  │  bulkCheck — 5 PANs per chunk, 200ms inter-chunk delay │
  │                                                        │
  │  For each PAN:                                         │
  │    pickCaptcha()                                       │
  │       │                                               │
  │       ├─► sharedCaptcha still fresh? ──YES──► reuse   │
  │       │   (zero extra OCR call)                       │
  │       │                                               │
  │       └─► expired / refreshing?                       │
  │              │                                        │
  │              ├─► getOrRefreshShared()  ← deduped      │
  │              │   (all concurrent callers await same   │
  │              │    Promise — only 1 OCR call fires)    │
  │              │                                        │
  │              └─► pool fallback (≤2 in-flight solves)  │
  │                                                        │
  │  POST FetchIpodetails → Status?                        │
  │    "OK"      → parse result                            │
  │    "CAPTCHA" → invalidateShared() + checkAllotment     │
  │                retries with fresh token internally     │
  │    "NOTFOUND"→ not_found                               │
  └────────────────────────────────────────────────────────┘
```

**OCR call budget per bulk run:**

| Scenario | OCR.Space calls |
|---|---|
| All PANs reuse shared token (best case) | **1** |
| Token rejected once, re-solved | **2** |
| Shared refresh in-flight, pool used | **1 + ≤2** |
| Token sharing unsupported (worst case) | 1 per PAN (per-PAN fallback inside `checkAllotment`) |

---

### Data Flow: Single PAN Check

```
POST /api/check { pans: ["ABCDE1234F"], ipoClientId: "bigshare-42" }
        │
        ├── Zod validate → 400 if invalid
        ├── Rate limit check → 429 if exceeded
        │
        ▼
  checkAllotment({ pans, ipoClientId })
        │
        ├── strip "bigshare-" prefix → clientId = "42"
        ├── resolve adapter = BigShareAdapter
        │
        ▼
  BigShareAdapter.checkAllotment("ABCDE1234F", "42")
        │
        ├── fetchCaptchaToken() → { token, answer }
        │       └── solveBigShareCaptcha()
        │               ├── GET ipo.bigshareonline.com/Captcha.ashx
        │               └── OCR.Space engine 2 (primary)
        │                   └── on 429: jitter + race engines 1+3
        │
        ├── POST /Data.aspx/FetchIpodetails (mirror 1)
        │       └── on Status:"CAPTCHA" → re-solve + retry (attempt 2)
        │       └── on HTTP 4xx → break mirror loop
        │
        └── parse { ALLOTED, APPLIED, Name } → AllotmentResult
                └── 200 JSON { results: [...] }
```

---

### Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│  BROWSER (untrusted)                            │
│  • Never calls registrar APIs directly          │
│  • Family vault stays in localStorage only      │
│  • All user input re-validated server-side      │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│  SERVER (trusted boundary)                      │
│  • Zod validates every API input                │
│  • Per-IP rate limiter on all write endpoints   │
│  • Admin routes: OTP cookie + CRON_SECRET       │
│  • Registrar errors surfaced as typed results   │
│    — never raw stack traces to client           │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  EXTERNALS (untrusted, treated as flaky)        │
│  • Retry + exponential backoff on 5xx/429       │
│  • Mirror fallback (Bigshare: 3 mirrors)        │
│  • Fault isolation: one adapter failure never   │
│    blocks another                               │
└─────────────────────────────────────────────────┘
```

---

### Deployment Topology

| Target | Notes |
|---|---|
| **Vercel (recommended)** | Serverless functions; `maxDuration=60s`; no Python/ddddocr — OCR.Space remote path used. Set `OCR_SPACE_API_KEY` in env vars. Daily cron via `vercel.json`. |
| **Docker / VPS** | Multi-stage image; Node 20-slim + Python + `ddddocr`. Local OCR fast-path (~200ms, no quota). Migrations run on boot. Postgres via compose. |
| **Local dev** | `npm run dev`; in-memory fallback; no env vars required for core checker. |

See [plan.md](./plan.md) and [AUTH_PLAN.md](./AUTH_PLAN.md) for deeper design docs.


---

## Roadmap & Docs

- [ROADMAP.md](./ROADMAP.md) — completed phases and what's next
- [plan.md](./plan.md) — registrar expansion (Skyline/Purva/Maashitla live; Cameo/Beetal/MCS deferred)
- [AUTH_PLAN.md](./AUTH_PLAN.md) — auth design (implemented)

---

## Contributing

1. Fork the repo and create a feature branch
2. `npm install && npm run dev`
3. Keep changes small; run `npm run lint`, `npx tsc --noEmit`, and `npm test`
4. Open a PR describing behavior + verification

---

## Disclaimer

IPO Desk is a convenience dashboard, not a broker, registrar, or investment advisor. Allotment data comes from third-party registrar portals and may be delayed or inaccurate — always confirm on the registrar's official site. Research scores and backtests are algorithmic illustrations, not financial advice. Bidding always happens in your broker/UPI app.

---

## License

MIT — see [LICENSE](./LICENSE).
