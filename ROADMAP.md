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
- [ ] Claude-powered report generation (add `ANTHROPIC_API_KEY` for AI-generated analysis)

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
- [ ] Listing Gain Score + Long-Term Score (needs historical data / Phase 4)

---

## Phase 4 — Database Migration (Prisma + Postgres) ← ✅ Done

**Status:** ✅ Done

Replace in-memory caches with a real database for persistence, history, and queryability.

- [x] Add Prisma + Postgres dependencies (`@prisma/client`, `prisma`, `@prisma/adapter-pg`, `tsx`)
- [x] Design schema: IPOs, GMPHistory, SubscriptionSnapshots, Reports, Alerts, Users, Watchlist
- [x] Generate Prisma client with custom output path
- [x] Create `src/lib/prisma.ts` singleton with async lazy initialization
- [x] Create `src/services/db.service.ts` with availability check + graceful fallback
- [x] Create `prisma/seed.ts` — seed data for 5 sample IPOs + GMP history
- [x] Add `db:migrate`, `db:push`, `db:seed`, `db:studio` npm scripts
- [x] Auto-persist calendar IPO data + GMP snapshots to DB when available
- [x] GMP history route reads from DB when available, falls back to demo data
- [x] `DATABASE_URL` in `.env.example` (optional — app works without DB)

---

## Phase 5 — Scheduled Alerts ← ✅ Done

**Status:** ✅ Done

Push and email notifications for key events.

- [x] Alert triggers: IPO opens, GMP crosses threshold, subscription milestone, allotment declared
- [x] Client-side `useAlerts` hook (localStorage-based, with server-side API route)
- [x] `/api/alerts` CRUD endpoint (GET, POST, DELETE)
- [x] `AlertSettings` popover component on IPO detail page
- [x] Per-IPO alert configuration (add/remove/toggle alerts)
- [ ] Delivery channels: browser push notifications, email (needs phase 4 DB + service worker)
- [ ] Rate-limited alert dispatch

---

## Phase 6 — Admin Panel

**Status:** ⬜ Planned

Dashboard for managing IPO data, monitoring syncs, and reviewing AI outputs.

- [ ] Route: `/admin`
- [ ] Auth guard (basic credentials or OAuth)
- [ ] IPO management: view, edit, add, delist
- [ ] Sync history: last sync time, record counts, errors per registrar
- [ ] Log viewer: search/filter server logs
- [ ] Report review: approve/reject AI-generated reports
- [ ] Manual trigger: force sync, force report generation

---

## Phase 7 — Testing + CI/CD

**Status:** ⬜ Planned

Add testing infrastructure and automated deployment.

- [ ] Unit tests: Vitest for services, providers, utils
- [ ] Integration tests: API route testing with mocked registrars
- [ ] E2E tests: Playwright for critical user flows
- [ ] GitHub Actions: lint → test → build → deploy
- [ ] Dockerfile for self-hosted deployment
- [ ] VPS deployment guide (Docker Compose + Caddy/Nginx)

---

## Phase 8 — Backtesting Engine

**Status:** ⬜ Planned

Allow users to build and test IPO selection strategies against historical data.

- [ ] Rule builder: GMP > X%, QIB > Yx, Debt < Z
- [ ] Historical IPO database (requires Phase 4)
- [ ] Backtest results: win rate, avg listing gain, max drawdown
- [ ] Strategy comparison UI
- [ ] Export backtest report

---

## Future Ideas 🔮

- **Command palette** (`cmdk` already installed) — ⌘K search for IPOs, pages, actions
- **Watchlist improvements** — server-side sync, push alerts for watchlisted IPOs
- **Auth** — Google OAuth, Email OTP, JWT for persistent personalized features
- **Recharts analytics dashboards** — subscription trends, market activity, GMP distributions
- **PWA offline support** — service worker caching for calendar and history
- **NestJS backend extraction** — when queues/AI/ingestion load justify a dedicated service
- **S3-compatible storage** — for generated PDF reports

---

*Last updated: 2026-07-01*
