# IPODesk AI — Implementation Plan

> India's most intelligent IPO research & decision platform.
> Goal: move users from *"here's the data"* to *"should I apply or not?"*

**Last updated:** 2026-09-16 (Rollout: registrar expansion ×7, auth, SEO landing pages ×3 + brand, Family Checklist, perf/caching, checker sorting)

---

## Status legend

- ✅ **Done** — implemented, typechecked, and verified in the running app
- 🟡 **In progress** — partially built
- ⬜ **Planned** — not started
- 🔮 **Future** — deferred until an earlier module justifies it

---

## Architecture decision (locked for now)

IPODesk AI is being built by **extending the existing Next.js 16 app**, *not* by standing
up the spec's separate NestJS + Postgres + Redis backend yet.

- **Now:** Full-stack Next.js (App Router + Route Handlers), Tailwind v4, shadcn/ui,
  feature-folder architecture. Data sits behind swappable loaders (e.g. `loadCatalogue()`)
  so a Prisma query drops in without touching UI.
- **Later (🔮):** Extract a NestJS + Prisma + Postgres + Redis/BullMQ backend once data
  pipelines, AI report queues, and alert delivery justify a dedicated service.

### Stack — current vs. target

| Concern        | Current (shipping)              | Target (🔮)                       |
| -------------- | ------------------------------- | --------------------------------- |
| Framework      | Next.js 16 App Router + TS      | same (frontend)                   |
| Styling        | Tailwind v4, shadcn/ui          | same                              |
| Backend        | Next.js Route Handlers          | NestJS                            |
| Data store     | PostgreSQL + Prisma / memory    | PostgreSQL + Prisma               |
| Cache/queues   | In-memory ring buffer           | Redis + BullMQ                    |
| Auth           | Google OAuth (Auth.js v5) + admin email OTP + JWT | Google OAuth + Email OTP + JWT    |
| AI             | Algorithmic + Claude-ready      | Claude (Opus 4.8) report/score    |
| Charts         | Recharts (GMP, Backtesting)     | Recharts                          |
| Deploy         | Docker + Vercel (`vercel.json`) | Docker + GitHub Actions + VPS     |

---

## Build order & progress

The spec's stated order. Check items off as they land.

### 0. Allotment Checker (pre-existing base app) — ✅ Done

- [x] Dynamic IPO discovery across 7 registrars (KFintech, MUFG, Link Intime-legacy, Bigshare, Skyline, Purva, Maashitla)
- [x] Registrar adapter interface + per-registrar adapters (single source of truth: `src/registrars/registry.ts`)
- [x] Single PAN check
- [x] Bulk PAN check (paste multiple)
- [x] Excel upload (`xlsx`) for bulk checking (Bigshare bulk: local OCR fast-path, pipelined CAPTCHAs, concurrency-3 batches, progressive rendering)
- [x] IPO selector sorted latest-first (allotment date, calendar openDate fallback)
- [x] Results dashboard with status badges
- [x] CSV / Excel export
- [x] Cron sync route (`/api/cron/sync-ipos`) + logging service
- [x] PWA manifest, SEO metadata, JSON-LD, dark fintech UI

### 1. IPO Calendar — ✅ Done

- [x] Calendar domain types (`src/types/calendar.types.ts`) — Prisma-ready shape
- [x] Seed catalogue (`features/ipo-calendar/data/calendar-seed.ts`) — mainboard + SME
- [x] Service with lifecycle derivation + computed fields (`lib/calendar.service.ts`)
      - issue size, price band, lot size, open/close/listing dates, registrar, lead managers
      - derived: upcoming / open / closed / listed, min investment, GMP %, listing gain %
- [x] API route `/api/calendar` (force-dynamic, cache headers)
- [x] `IPOCalendarCard` — full per-IPO metrics + GMP / listing-gain
- [x] `IPOCalendarView` — lifecycle tabs w/ counts, Mainboard/SME filter, skeletons, empty/error states
- [x] Page at `/calendar` + nav links from home
- [x] **Real-time:** client auto-refresh + live "updated" clock; lifecycle recomputed server-side from IST "today"
- [x] Per-IPO deep link into Details page (cards link to `/ipo/[id]`)
- [x] Subscription (QIB/NII/Retail/Total) + allotment date on cards & model
- [x] **Live data provider** abstraction (`lib/providers/`): InvestorGain / IPO Guru API / NSE providers with honest "Live / Sample data" badge

### 2. IPO Details Page — ✅ Done

- [x] Route `/ipo/[id]` reading from the catalogue loader (+ `generateMetadata`, `notFound`)
- [x] Overview: title block, board/status badges, key-stat grid
- [x] Subscription status (QIB/NII/Retail/Total bars)
- [x] GMP analysis (cap price → est. listing → est. gain + GMP history table)
- [x] Issue details (size, band, lot, registrar, lead managers)
- [x] Visual issue timeline (open → close → allotment → listing)
- [x] Link calendar cards → details; CTA to allotment checker
- [x] **Business model & Objects of issue** (`CompanyOverview.tsx`)
- [x] **Financial performance track record** (`FinancialsTable.tsx`)
- [x] **Key Investment Moats & Risks** (`StrengthsRisks.tsx`)
- [x] **Peer Valuation Matrix** (`PeerComparison.tsx`)
- [x] **Investor FAQ section** (`IpoFaq.tsx`)
- [x] **GMP trend chart** (`GMPTrendChart.tsx` with Recharts)

### 3. Database + Admin Panel — ✅ Done

- [x] Prisma + Postgres schema with Ipo, GmpSnapshot, SubSnapshot, Report, User, Account (OAuth), AdminOtpChallenge, Alert, WatchlistEntry; `enum Registrar` covers all 7 registrars
- [x] Auto-persistence of calendar IPO snapshots to database
- [x] Admin console at `/admin` with passwordless email-OTP gate (passcode retired; `CRON_SECRET` Bearer kept for cron/programmatic)
- [x] Sync monitor with real-time status across all 7 registrars + manual trigger `/api/admin/sync`
- [x] Real-time log inspector reading from `logger.service.ts` ring-buffer with filters & search
- [x] IPO registry catalog viewer with deep links & filters
- [x] AI and research score report review tool

### 4. Data Ingestion — ✅ Done

- [x] Sources: Registrars (KFintech, Link Intime-legacy, MUFG, Bigshare, Skyline, Purva, Maashitla), InvestorGain, NSE, IPO Guru
- [x] Scheduled jobs: `/api/cron/sync-ipos` (daily Vercel Cron) auto-persisting snapshots; per-registrar fault isolation
- [x] Diagnostic logging with execution duration and event classifications

### 5. Alerts — ✅ Done

- [x] Triggers: GMP changes, subscription milestones, IPO opens, allotment declared
- [x] Popover UI on detail page + client/server API route `/api/alerts`

### 6. AI Reports — ✅ Done

- [x] Sectioned report generator (`report.service.ts`) with financial health, valuation, market sentiment, risk assessment
- [x] Algorithmic score & verdict banner
- [x] Research report component on detail page

### 7. Recommendation Engine — ✅ Done

- [x] IPO Score (0–100) based on multiple quantitative factors
- [x] Risk score & market sentiment analysis
- [x] Actionable verdict: Strong Apply / Apply / Apply for Listing Gains / Neutral / Avoid

### 8. Backtesting Engine — ✅ Done

- [x] Strategy simulation engine (`backtest.service.ts`)
- [x] Verified historical dataset (`historical-ipos.ts`) spanning 2023–2026
- [x] Interactive UI (`/backtest`) with parameter sliders (GMP %, QIBx, Retailx, Board, Issue Size)
- [x] 5 Strategy Presets (High GMP Momentum, Institutional Conviction, SME Multibagger Hunt, Conservative Bluechip, All-Weather)
- [x] Simulation KPI metrics: Win rate %, Avg listing gain %, Capital growth (₹1L starting base), Benchmark comparison
- [x] Visual Return Distribution & Cumulative Capital AreaChart
- [x] Searchable historical issues table & CSV export
- [x] Programmatic API endpoint `/api/backtest`

### 9. Testing & CI/CD — ✅ Done

- [x] 57 Vitest unit tests across 7 suites covering providers, calendar service, report scoring, backtest engine, registrar adapters (incl. Skyline/Purva/Maashitla sentinels), and broker deep-links
- [x] GitHub Actions workflow (`.github/workflows/ci.yml`)
- [x] Production Dockerfile and `docker-compose.yml`

### 10. Registrar Expansion — ✅ Done

- [x] Skyline, Purva, Maashitla adapters live (`src/registrars/skyline.ts`, `purva.ts`, `maashitla.ts`); Cameo/Beetal/MCS deferred — see [plan.md](./plan.md)
- [x] `RegistrarName` union, Prisma `enum Registrar` + migration, IPO Guru `REGISTRAR_MAP`, `/api/scan` zod enum, history/detail labels

### 11. Auth (Users + Admin) — ✅ Done

- [x] Google OAuth (Auth.js v5), `AuthSessionProvider`, header sign-in/avatar, `/api/alerts/link` device→user linking — see [AUTH_PLAN.md](./AUTH_PLAN.md)
- [x] Admin passwordless email OTP (`/api/admin/otp/*`, `AdminOtpChallenge`, `ipodesk_admin` cookie)

### 12. SEO, Brand & Performance — ✅ Done

- [x] `src/lib/siteConfig.ts` brand source of truth (`siteUrl` / `siteName` / `siteAlternateName` = IPODESK); Organization JSON-LD in root layout; expanded keywords; `x-default` alternate; GSC verification
- [x] Homepage server-rendered visible H1 hero + feature links above client checker; WebSite + WebApplication JSON-LD; single-H1 rule
- [x] SEO landing pages: `/ipo-allotment-check` (how-to + FAQ + BreadcrumbList), `/ipo-gmp-today` (live GMP + ItemList), `/upcoming-ipo` (live upcoming/open + ItemList) — all in `sitemap.ts` (with `revalidate = 3600`)
- [x] Dynamic `sitemap.ts` + `robots.ts` (per-bot allows, crawl-delay for generic crawlers); OG banner; `NEXT_PUBLIC_SITE_URL` env override
- [x] Perf: `optimizePackageImports`, browserslist targets, CLS logo fix, `poweredByHeader: false`, immutable `/_next/static` + 7-day public-asset cache, incorrect `Cache-Control` headers removed

### 13. Family Checklist (`/apply`) — ✅ Done

- [x] `/apply` repositioned from "Apply" to "Family Checklist" (manual broker + UPI flow); header nav label `Checklist` — see [FAMILY_CHECKLIST_PLAN.md](./FAMILY_CHECKLIST_PLAN.md)
- [x] `AccountVault` + `ApplyWorkspace` + `ApplyChecklist`, broker deep-links, UPI mandate tracker, `useApplyAccounts` vault — see [MULTI_APPLY_PLAN.md](./MULTI_APPLY_PLAN.md)

---

## Real-time / data-freshness conventions

- Lifecycle (upcoming/open/closed/listed) is **never stored** — always derived from IST
  "today" in `calendar.service.ts`, so status is correct on every request.
- API routes are `force-dynamic`; client views poll on an interval and refresh on tab focus.
- All dates are ISO (`yyyy-mm-dd`) in data, formatted for display in `en-IN` / IST.
