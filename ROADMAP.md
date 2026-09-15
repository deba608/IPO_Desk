# IPO Desk — Feature Roadmap

> Planned improvements and new features, ordered by priority.

---

## Phase 1 — GMP Trend Chart (Recharts) ← ✅ Done

**Status:** ✅ Done

Interactive area chart showing GMP history for each IPO on the detail page.

- [x] Install Recharts
- [x] Add `gmpHistory` field to `CalendarIPO` type + `GMPEntry` type
- [x] Create `/api/ipo/[id]/gmp-history` endpoint returning time-series data
- [x] Build `GMPTrendChart` component with Recharts (area chart, tooltips, responsive)
- [x] Wire into IPO detail page below GMP analysis section
- [x] Empty state when no history available
- [x] Demo history generation until real DB snapshots land

---

## Phase 2 — AI Research Reports ← ✅ Done

**Status:** ✅ Done

Scored research reports with expandable sections, verdict banner, and algorithmic assessment. Report service generates structured analysis from available IPO data.

- [x] Create `report.service.ts` — algorithmic scoring engine (financial health, valuation, market sentiment, risk)
- [x] Create `/api/ipo/[id]/report` endpoint
- [x] Build `ResearchReport` component with expandable sections, scored progress bars, verdict banner
- [x] Wire into IPO detail page, replacing "coming soon" placeholder
- [x] Progress bar per section + overall score
- [x] Disclaimer notice
- [x] Loading skeleton state
- [x] Claude-ready prompt & structured schema integration

---

## Phase 3 — IPO Score / Recommendation Engine ← ✅ Done

**Status:** ✅ Done

A quantitative scoring system that distills IPO data into a 0–100 score + actionable verdict.

- [x] Financial health score (derived from subscription, GMP, issue size)
- [x] Valuation score (price band range, lead manager quality)
- [x] Market interest score (QIB/NII/retail subscription breakdown, GMP)
- [x] Composite IPO Score (0–100)
- [x] Risk Score
- [x] Verdict: Strong Apply / Apply / Apply for Listing Gains / Neutral / Avoid
- [x] Score cards on IPO detail page (via ResearchReport component)
- [x] Replace "coming soon" placeholder with live data
- [x] Radar chart visualization for score breakdown
- [x] Company Overview, Financials table, Strengths & Risks, Peer Comparison, FAQs on `/ipo/[id]`

---

## Phase 4 — Database Migration (Prisma + Postgres) ← ✅ Done

**Status:** ✅ Done

Replace in-memory caches with a real database for persistence, history, and queryability.

- [x] Add Prisma + Postgres dependencies (`@prisma/client`, `prisma`, `@prisma/adapter-pg`, `tsx`)
- [x] Design schema: IPOs, GMPHistory, SubscriptionSnapshots, Reports, Alerts, Users, Watchlist
- [x] Generate Prisma client with custom output path
- [x] Create `src/lib/prisma.ts` singleton with async lazy initialization
- [x] Create `src/services/db.service.ts` with availability check + graceful fallback
- [x] Create `prisma/seed.ts` — seed data for sample IPOs + GMP history
- [x] Add `db:migrate`, `db:push`, `db:seed`, `db:studio` npm scripts
- [x] Auto-persist calendar IPO data + GMP snapshots to DB when available
- [x] GMP history route reads from DB when available, falls back to demo data
- [x] `DATABASE_URL` in `.env.example` (optional — app works without DB)
- [x] Cron `/api/cron/sync-ipos` now also runs `loadCatalogue(force)` so GMP/subscription snapshots persist on schedule (every 6h)

---

## Phase 5 — Scheduled Alerts ← ✅ Done

**Status:** ✅ Done

Push and email notifications for key events.

- [x] Alert triggers: IPO opens, GMP crosses threshold, subscription milestone, allotment declared
- [x] Client-side `useAlerts` hook (localStorage-based, with server-side API route)
- [x] `/api/alerts` CRUD endpoint (GET, POST, DELETE)
- [x] `AlertSettings` popover component on IPO detail page
- [x] Per-IPO alert configuration (add/remove/toggle alerts)

---

## Phase 6 — Admin Panel ← ✅ Done

**Status:** ✅ Done

Dashboard for managing IPO data, monitoring syncs, viewing logs, and reviewing AI outputs.

- [x] Route: `/admin` with modern tabs and passcode security gate
- [x] Sync Monitor: real-time registrar status (KFintech, Link Intime, Bigshare, MUFG, InvestorGain)
- [x] Manual Trigger: `/api/admin/sync` with execution latency feedback
- [x] Log Viewer: tail in-memory ring buffer with level filters (Info, Warn, Error), live 5s auto-refresh
- [x] IPO Registry: filterable catalog by board/lifecycle with quick links & status badges
- [x] Report Reviewer: inspect algorithmic scores and section-by-section breakdown

---

## Phase 7 — Testing + CI/CD ← ✅ Done

**Status:** ✅ Done

Testing infrastructure and automated deployment.

- [x] Unit tests: Vitest test suite with 57 tests across 7 suites (`npm test`) — calendar service, providers, report scoring, backtest engine, registrar adapters (incl. Skyline/Purva/Maashitla), brokers deep-links
- [x] Calendar lifecycle & date derivation tests
- [x] Algorithmic score & verdict tests
- [x] Backtesting engine rule & simulation tests
- [x] Registrar `not_found` sentinel tests (never `error` for unapplied PANs)
- [x] `npx tsc --noEmit` clean
- [x] GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
- [x] Production multi-stage `Dockerfile` and `docker-compose.yml`

---

## Phase 8 — Backtesting Engine ← ✅ Done

**Status:** ✅ Done

Allow users to build and test quantitative IPO selection strategies against historical data.

- [x] Route: `/backtest` with interactive dark fintech workspace
- [x] Verified Historical IPO database (Mainboard & SME 2023–2026)
- [x] Strategy Parameter Sliders: Min GMP %, Min QIB (x), Min Retail (x), Min Total (x), Board, Issue Size
- [x] Strategy Presets: "High GMP Momentum", "Institutional Conviction", "SME Multibagger Hunt", "Conservative Bluechip", "All-Weather Filter"
- [x] Performance Metrics: Win Rate %, Avg Listing Day Gain %, Capital Growth Simulation (₹1L base), Market Benchmark Comparison
- [x] Visual Analytics: Return distribution bar chart & cumulative capital growth trajectory
- [x] Searchable, sortable historical issue table & CSV export
- [x] Programmatic API endpoint at `/api/backtest`

---

## Navigation & Discovery Improvements ← ✅ Done

- [x] Global Command Palette (`cmdk` / ⌘K) registered with shortcuts for Allotment Checker, Calendar, Backtester, History, Admin
- [x] Header navigation with responsive sliding pill indicators and mobile menu
- [x] Header nav: Checklist (`/apply`), Backtest, History + Google sign-in button + mobile safe-area menu

---

## Phase 9 — Registrar Expansion (Skyline / Purva / Maashitla) ← ✅ Done

**Status:** ✅ Done (see [plan.md](./plan.md))

7 live adapters via `REGISTRAR_REGISTRY` (`src/registrars/registry.ts`): KFintech, Link Intime (legacy key), MUFG, Bigshare, Skyline, Purva, Maashitla. `RegistrarName` union + Prisma `enum Registrar` + `/api/scan` zod filter + history/detail labels all extended. Cameo / Beetal / MCS deferred (SPAs, no public API found).

---

## Phase 10 — Auth: Google Users + Admin Passwordless OTP ← ✅ Done

**Status:** ✅ Done (see [AUTH_PLAN.md](./AUTH_PLAN.md))

- [x] Auth.js v5 Google OAuth (`/api/auth/[...nextauth]`), `SessionProvider`, avatar menu, cross-device alert linking (`/api/alerts/link`)
- [x] Admin email-OTP (`/api/admin/otp/*`, `AdminOtpChallenge` model, `ipodesk_admin` cookie); passcode retired
- [x] `Account` + `User.phone` Prisma models; `/api/health` exposes auth/mail/allowlist flags

---

## Phase 11 — SEO & Brand (IPODESK) ← ✅ Done (uncommitted: `siteConfig`, `layout`, `page`)

**Status:** ✅ Done — changes live in working tree, not yet committed

- [x] `src/lib/siteConfig.ts`: `siteUrl` (`NEXT_PUBLIC_SITE_URL` override) + `siteName` ("IPO Desk") + `siteAlternateName` ("IPODESK")
- [x] Root layout: Organization JSON-LD (brand + alias + logo), expanded keywords, `x-default` alternate, GSC verification
- [x] Homepage: server-rendered visible H1 hero (crawlable without JS) + feature-link nav; WebSite + WebApplication JSON-LD, single-H1 rule
- [x] Dynamic `sitemap.ts` (static routes + per-IPO `lastModified`) + `robots.ts` (disallow `/admin`, `/api/`, `/history`)
- [x] Perf: `optimizePackageImports`, browserslist, CLS logo fix, bad `Cache-Control` headers removed

---

## Phase 12 — Family Checklist (`/apply`) ← ✅ Done

**Status:** ✅ Done (see [MULTI_APPLY_PLAN.md](./MULTI_APPLY_PLAN.md) + [FAMILY_CHECKLIST_PLAN.md](./FAMILY_CHECKLIST_PLAN.md))

- [x] `/apply` repositioned: "Apply" → "Checklist" (manual broker + UPI flow, no auto-submit overpromise)
- [x] `AccountVault` + `ApplyWorkspace` + `ApplyChecklist` components, broker deep-links, UPI mandate tracker

---

## Phase 13 — Checker Sorting ← ✅ Done (uncommitted)

- [x] IPO selector sorted latest-first by allotment date (calendar openDate fallback)

---

*Last updated: 2026-09-15*
