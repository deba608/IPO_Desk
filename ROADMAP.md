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

## Phase 2 — AI Research Reports ← Current focus

**Status:** 🟡 In progress

---

## Phase 2 — AI Research Reports

**Status:** ⬜ Planned

Generate sectioned research PDFs via Claude API. The IPO detail page already has a placeholder for AI Research & Recommendation.

- [ ] Add `ANTHROPIC_API_KEY` env var + Zod validation
- [ ] Create `/api/ipo/[id]/report` endpoint
- [ ] Build report prompt: business model, financials, growth, valuation, peer comparison, risk
- [ ] Generate structured JSON report via Claude API
- [ ] Render report in expandable sections on detail page
- [ ] Add "Download PDF" button (PDF generation via `@react-pdf/renderer` or server-side)
- [ ] Cache reports with TTL (market data changes daily)
- [ ] Report history: regenerate on demand, show last generated timestamp

---

## Phase 3 — IPO Score / Recommendation Engine

**Status:** ⬜ Planned

A quantitative scoring system that distills IPO data into a 0–100 score + actionable verdict.

- [ ] Financial health score (revenue growth, profit margins, debt/equity)
- [ ] Valuation score (PE vs industry, price band reasonableness)
- [ ] Market interest score (subscription multiples, GMP trend)
- [ ] Sentiment score (news sentiment, social media buzz — future)
- [ ] Composite IPO Score (0–100)
- [ ] Risk Score + Listing Gain Score + Long-Term Score
- [ ] Verdict: Strong Apply / Apply / Apply for Listing Gains / Neutral / Avoid
- [ ] Display as radar chart + score cards on IPO detail page
- [ ] Replace "coming soon" placeholder with live data

---

## Phase 4 — Database Migration (Prisma + Postgres)

**Status:** ⬜ Planned

Replace in-memory caches with a real database for persistence, history, and queryability.

- [ ] Add Prisma + Postgres dependencies
- [ ] Design schema: IPOs, GMPHistory, SubscriptionSnapshots, Reports, Alerts, Users
- [ ] Migrate seed loaders → Prisma queries
- [ ] Migrate registrar sync → upsert into DB
- [ ] Add GMP history tracking (daily snapshots)
- [ ] Add subscription history tracking
- [ ] Replace `globalThis` caches with DB reads
- [ ] Data migration script for existing in-memory state

---

## Phase 5 — Scheduled Alerts

**Status:** ⬜ Planned

Push and email notifications for key events.

- [ ] Alert triggers:
  - IPO opens / closes / lists
  - GMP crosses threshold (e.g. >50%)
  - Subscription milestone (e.g. >10x)
  - Allotment result available
- [ ] Delivery channels:
  - Browser push notifications (Web Push API)
  - Email (Resend / SendGrid)
- [ ] Alert preferences UI (which IPOs, which triggers, which channels)
- [ ] Rate-limited alert dispatch (avoid spam)

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
