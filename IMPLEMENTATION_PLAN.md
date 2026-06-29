# IPODesk AI — Implementation Plan

> India's most intelligent IPO research & decision platform.
> Goal: move users from *"here's the data"* to *"should I apply or not?"*

**Last updated:** 2026-06-15 (Module 2 + live-data provider)

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
  so a Prisma query can drop in without touching UI.
- **Later (🔮):** Extract a NestJS + Prisma + Postgres + Redis/BullMQ backend once data
  pipelines, AI report queues, and alert delivery justify a dedicated service.

> Decision defaulted on 2026-06-15 (clarifying question dismissed). Revisit if the exact
> spec stack becomes a hard requirement. Mirrored in project memory
> `ipodesk-architecture-decision.md`.

### Stack — current vs. target

| Concern        | Current (shipping)              | Target (🔮)                       |
| -------------- | ------------------------------- | --------------------------------- |
| Framework      | Next.js 16 App Router + TS      | same (frontend)                   |
| Styling        | Tailwind v4, shadcn/ui          | same                              |
| Backend        | Next.js Route Handlers          | NestJS                            |
| Data store     | In-memory seed / live registrar | PostgreSQL + Prisma               |
| Cache/queues   | —                               | Redis + BullMQ                    |
| Auth           | —                               | Google OAuth + Email OTP + JWT    |
| AI             | —                               | Claude (Opus 4.8) report/score    |
| Charts         | —                               | Recharts                          |
| Deploy         | Vercel (`vercel.json`)          | Docker + GitHub Actions + VPS     |

---

## Build order & progress

The spec's stated order. Check items off as they land.

### 0. Allotment Checker (pre-existing base app) — ✅ Done

- [x] Dynamic IPO discovery across registrars (KFintech, MUFG, Bigshare, Link Intime)
- [x] Registrar adapter interface + per-registrar adapters
- [x] Single PAN check
- [x] Bulk PAN check (paste multiple)
- [x] Excel upload (`xlsx`) for bulk checking
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
- [x] **Live data provider** abstraction (`lib/providers/`): IPO Guru API when `IPOGURU_API_KEY` set, seed fallback, 5-min cache, honest "Live / Sample data" badge
- [ ] Wire a real `IPOGURU_API_KEY` (free, by email) to flip from sample → live
- [ ] Other ingestion sources: NSE/BSE/SEBI (Module 4)

### 2. IPO Details Page — 🟡 In progress (core shipped)

- [x] Route `/ipo/[id]` reading from the same catalogue loader (+ `generateMetadata`, `notFound`)
- [x] Overview: title block, board/status badges, key-stat grid
- [x] Subscription status (QIB/NII/Retail/Total bars)
- [x] GMP analysis (cap price → est. listing → est. gain)
- [x] Issue details (size, band, lot, registrar, lead managers)
- [x] Visual issue timeline (open → close → allotment → listing)
- [x] Link calendar cards → details; CTA to allotment checker
- [ ] Business model, Objects of issue, Promoters, Financials, Risks, Strengths, Peer comparison
      *(needs richer data + arrives with Recommendation/AI modules — placeholder shown)*
- [ ] GMP trend chart (Recharts) — needs GMP history (Module 8 / historical DB)
- [ ] FAQ section

### 3. Database + Admin Panel — ⬜ Planned

- [ ] Introduce Prisma + Postgres; models: Users, IPOs, Financials, Subscriptions,
      GMPHistory, Recommendations, Reports, Alerts, Watchlists, Notifications, AuditLogs
- [ ] Migrate seed loaders → `prisma.*` queries (no UI change)
- [ ] Admin: manage IPOs, data ingestion, reports, users, alerts, review AI outputs

### 4. Data Ingestion — ⬜ Planned

- [ ] Sources: SEBI filings, NSE, BSE, registrar announcements, merchant-banker disclosures
- [ ] Store raw → normalize → track changes over time
- [ ] Scheduled jobs (cron now, BullMQ later 🔮)

### 5. Alerts — ⬜ Planned

- [ ] Triggers: GMP changes, subscription milestones, new filings, listing & allotment reminders
- [ ] Delivery: email + browser push

### 6. AI Reports — ⬜ Planned

- [ ] Sectioned report generator (business, financials, growth, valuation, peers, risk,
      subscription, GMP, recommendation)
- [ ] Downloadable PDF
- [ ] Powered by Claude (Opus 4.8)

### 7. Recommendation Engine — ⬜ Planned

- [ ] IPO Score (0–100): financial health, valuation, market interest, sentiment
- [ ] Risk Score, Listing Gain Score, Long-Term Score
- [ ] Verdict: Strong Apply / Apply / Apply for Listing Gains / Long-Term / Neutral / Avoid + reasoning

### 8. Backtesting Engine — ⬜ Planned

- [ ] Rule builder (e.g. GMP > 30% & QIB > 20x & Debt < 0.5)
- [ ] Outputs: win rate, avg listing gain, avg return, historical examples
- [ ] Requires Historical Database (built alongside Module 3/4)

---

## Cross-cutting / future plans (🔮)

- [ ] Auth (Google OAuth, Email OTP, JWT)
- [ ] Watchlist (IPOs, sectors, SME, companies)
- [ ] Command palette (`cmdk` already a dependency)
- [ ] Recharts-based analytics dashboards
- [ ] S3-compatible storage for generated PDFs
- [ ] Docker + GitHub Actions CI/CD + VPS deployment guide
- [ ] Testing strategy (unit for services, integration for routes, e2e for flows)
- [ ] Extract NestJS backend when queues/AI/ingestion load justify it

---

## Real-time / data-freshness conventions

- Lifecycle (upcoming/open/closed/listed) is **never stored** — always derived from IST
  "today" in `calendar.service.ts`, so status is correct on every request.
- API routes are `force-dynamic`; client views poll on an interval and refresh on tab focus,
  keeping dates/times and counts live without a manual reload.
- All dates are ISO (`yyyy-mm-dd`) in data, formatted for display in `en-IN` / IST.
