# IPO Desk (IPODESK) — Allotment Checker

Check IPO allotment status for single or multiple PANs instantly. Track IPO calendars, analyse GMP, view subscription data, manage a personal check history, coordinate family bids with a checklist, and backtest IPO strategies — all in one dark-themed dashboard.

All IPO data is discovered **dynamically from registrar APIs** — no hardcoded lists. The calendar uses live provider data (IPO Guru, InvestorGain, NSE) with curated sample fallback.

> Brand: canonical name is **IPO Desk**, alias **IPODESK** (no-hyphen form users type in Google). Single source of truth: `src/lib/siteConfig.ts` (`siteUrl`, `siteName`, `siteAlternateName`). The live deployment is `https://ipo-desk.vercel.app` unless `NEXT_PUBLIC_SITE_URL` is set.

---

## Features

### Allotment Checker
- **Single & Bulk PAN Check** — type one PAN, paste many, or upload Excel/CSV (max 5 MB)
- **Cross-IPO Scan** — check the same PANs across all active IPOs at once
- **Latest-first IPO sorting** — IPO selector ordered by allotment date (then open date), newest first
- **Results Dashboard** — sortable, filterable TanStack Table with pagination (10/25/50/100)
- **PAN Labels** — assign nicknames to PANs for easy identification in results
- **Share Card** — Canvas-generated PNG share card for allotment results
- **Export** — CSV & styled XLSX with summary sheet

### IPO Calendar
- **Live Clock & Auto-Refresh** — IST clock, 60-second polling, tab-focus refresh
- **Lifecycle Tabs** — All / Open / Upcoming / Closed / Listed with per-tab counts
- **Board Filter** — Mainboard / SME / All
- **Search & Sort** — search by name, sort by GMP, issue size, dates, subscription
- **Watchlist** — star IPOs to track, persisted in localStorage with cross-tab sync
- **Data Source Badge** — honest "Live" vs "Sample" indicator
- **Calendar Highlights** — at-a-glance stats (open count, top GMP, most subscribed)
- **Related-pages nav** — cross-links to Upcoming IPOs, GMP Today, Allotment Check, Family Checklist (internal SEO)

### IPO Detail Page
- **Key Stats** — price band, lot size, issue size, minimum investment
- **Subscription Bars** — QIB / NII / Retail / Total subscription multiples
- **GMP Analysis** — grey-market premium, estimated listing price, gain %
- **GMP Trend Chart** — Recharts area chart showing GMP history over time
- **AI Research Report** — algorithmic scoring engine with verdict, radar chart, and expandable sections (financial health, valuation, sentiment, risk)
- **IPO Score** — 0–100 composite score with per-category breakdown
- **Timeline** — visual stepper from open to listing
- **Issue Details** — registrar, lead managers, exchanges
- **Add to Calendar** — download `.ics` or add to Google Calendar
- **Alert Settings** — configure push alerts for IPO opens, GMP crossings, subscription milestones, and allotment declarations
- **Deep-Link to Checker** — one click to check allotment for this IPO

### Check History
- **Stats Cards** — total checks, PANs checked, allotted count, win rate
- **Entry List** — scrollable history with per-entry status badges
- **Remove / Clear** — delete individual entries or wipe all history

### Family Checklist (`/apply`)
- **Account Vault** — save family PANs, brokers, UPI IDs once (browser localStorage, never sent to server)
- **Apply Workspace** — pick an open IPO, set lots, tick who applies, see per-account + total blocked amounts
- **Copy helpers** — per-account Copy PAN/UPI/DP-ID plus `Copy all details` TSV for Excel/broker forms
- **Broker deep-links** — one-click `Open broker IPO pages` + per-account `Continue in <Broker>` (submission always happens in the broker's own app)
- **UPI mandate tracker** — per-IPO × account stepper (`not-started → applied → upi-pending → upi-approved → done + skipped`)
- Honesty guardrail: IPO Desk never places bids or moves money. One PAN = one bid (SEBI rule).

### Backtest (`/backtest`)
- **Strategy sliders** — Min GMP %, Min QIB/Retail/Total subscription, board, issue size
- **Presets** — High GMP Momentum, Institutional Conviction, SME Multibagger Hunt, Conservative Bluechip, All-Weather Filter
- **Metrics** — win rate %, avg listing-day gain %, ₹1L capital-growth simulation, benchmark comparison
- **Visuals + export** — return distribution chart, cumulative growth trajectory, searchable history table, CSV export, programmatic `/api/backtest`

### Auth (optional, app works without it)
- **Users** — Google OAuth via Auth.js v5 (JWT sessions); login unlocks cross-device alert ownership + watchlist linking
- **Admin** — passwordless email OTP (6-digit, hashed, 10-min expiry, rate-limited) issuing a short-lived `ipodesk_admin` cookie; `CRON_SECRET` Bearer still works for cron/programmatic access
- See [AUTH_PLAN.md](./AUTH_PLAN.md) for the implemented design.

### SEO
- **Landing pages** — `/ipo-allotment-check` (how-to + FAQ schema), `/ipo-gmp-today` (live GMP + ItemList), `/upcoming-ipo` (live upcoming/open IPOs + ItemList); each with canonical + `en-IN`/`x-default` alternates, OG/Twitter cards, BreadcrumbList schema
- **Sitemap + robots** — dynamic `sitemap.xml` (static routes incl. the 3 landing pages + per-IPO entries with real `lastModified`, cached 1h via `revalidate`); `robots.ts` with per-bot allow rules for major search engines, crawl-delay for generic crawlers, sitemap reference
- **JSON-LD** — Organization schema (brand + `IPODESK` alias + logo) in root layout; WebSite + WebApplication schemas on homepage; FAQ/Breadcrumb/ItemList schemas on landing pages
- **Homepage hero** — server-rendered visible H1 + crawlable copy and feature links above the client-side checker UI
- **Canonical brand config** — `src/lib/siteConfig.ts` (`NEXT_PUBLIC_SITE_URL` override, `en-IN` + `x-default` alternates, Google Search Console verification)
- **Perf/caching** — `optimizePackageImports`, browserslist targets, CLS logo fix, `poweredByHeader: false`, immutable 1y cache on `/_next/static`, 7-day cache on public icons/images (incorrect blanket `Cache-Control` headers removed)

### Technical
- **Live Multi-Registrar Discovery** — KFintech, MUFG Intime (ex Link Intime, plus legacy `linkintime` key), Bigshare, Skyline, Purva, Maashitla — all discovered dynamically
- **Fault Isolation** — each registrar syncs independently; one failing never hides others
- **Rate Limiting** — in-memory per-IP rate limiting on check/scan endpoints (`/api/check` at 60 req/min for bulk uploads)
- **Zod Validation** — all API inputs validated with detailed error responses
- **Structured Logging** — ring-buffer logger viewable at `/api/logs` (Bearer-guarded)
- **Server-Side Only** — all registrar API calls are server-side; client only talks to Next.js
- **Optional Database** — Prisma + Postgres for persistent IPO data, GMP history, and user alerts (graceful fallback when no DB configured)
- **Bigshare bulk speed** — local ddddocr OCR fast-path (Docker) with OCR.Space fallback, CAPTCHA pool pre-warm, sticky fastest-mirror, parallel frontend batches (×3) with progressive rendering — see [BIGSHARE_BULK_SPEED_PLAN.md](./BIGSHARE_BULK_SPEED_PLAN.md)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui |
| Table | TanStack Table v8 |
| Charts | Recharts (GMP trend, backtest analytics) |
| Command palette | cmdk (⌘K global search) |
| Auth | Auth.js v5 (Google OAuth, JWT sessions) + Resend email OTP for admin |
| Database | Prisma + Postgres (`@prisma/client`, `@prisma/adapter-pg`) — optional |
| Notifications | Sonner |
| Icons | Lucide React |
| HTTP | Axios |
| File Parsing | SheetJS (xlsx) |
| File Export | SheetJS (CSV) + ExcelJS (styled XLSX) |
| Validation | Zod |
| Tests | Vitest (57 tests across 7 suites) |
| PWA | Web app manifest (`standalone` mode) |

---

## Pages

| Route | Description |
|---|---|
| `/` | Allotment checker — single/bulk/excel check, results dashboard, cross-IPO scan (server-rendered SEO hero + client checker) |
| `/ipo-allotment-check` | SEO guide — how to check allotment by PAN per registrar, FAQ schema |
| `/ipo-gmp-today` | SEO page — live Grey Market Premium today, ItemList schema |
| `/upcoming-ipo` | SEO page — upcoming + open IPOs 2026 from live calendar, ItemList schema |
| `/calendar` | IPO calendar — live data, lifecycle tabs, search, sort, watchlist |
| `/ipo/[id]` | IPO detail — key stats, subscription, GMP, timeline, add to calendar, research report, apply CTA |
| `/apply` | Family IPO checklist — account vault, apply workspace, mandate tracker |
| `/backtest` | Strategy backtesting engine with presets, metrics, charts, CSV export |
| `/history` | Check history — stats, per-entry list, remove/clear |
| `/admin` | Admin console — OTP-gated sync monitor + log viewer + IPO registry + report reviewer |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/check` | POST | Check allotment for 1–500 PANs on a single IPO (60 req/min, Bigshare CAPTCHA-aware) |
| `/api/scan` | POST | Check PANs against all active IPOs (max 50 PANs, all 7 registrars) |
| `/api/ipos` | GET | List active IPOs merged across all registrars |
| `/api/calendar` | GET | IPO calendar data with lifecycle derivation |
| `/api/backtest` | GET/POST | Programmatic strategy simulation |
| `/api/bigshare/captcha` | GET | Bigshare CAPTCHA image proxy/solver support |
| `/api/export` | POST | Download results as CSV or XLSX |
| `/api/logs` | GET | Debug event logs, Bearer-guarded (admin cookie or `CRON_SECRET`) |
| `/api/health` | GET | Health + config flags (auth/mail/allowlist, OCR availability) |
| `/api/alerts` | GET/POST/DELETE | Manage IPO alerts (user session or `x-device-id`) |
| `/api/alerts/link` | POST | Link anonymous device alerts to a signed-in user |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js routes (Google OAuth) |
| `/api/admin/otp/request` | POST | Request admin email-OTP code (allowlisted identifiers only) |
| `/api/admin/otp/verify` | POST | Verify OTP, issue `ipodesk_admin` cookie |
| `/api/admin/logout` | POST | Clear admin session |
| `/api/admin/sync` | POST | Manual registrar sync trigger (admin cookie or `CRON_SECRET` Bearer) |
| `/api/ipo/[id]/gmp-history` | GET | GMP time-series data for trend chart (DB when available, demo fallback) |
| `/api/ipo/[id]/report` | GET | AI research report with scores and verdict |
| `/api/cron/sync-ipos` | GET | Vercel Cron daily sync (Bearer `CRON_SECRET`), persists snapshots when DB is configured |

---

## Getting Started

```bash
npm install
npm run dev
# → http://localhost:3000
```

No environment variables required — all registrar APIs are public. Optional:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata/sitemap/JSON-LD (defaults to `https://ipo-desk.vercel.app`) |
| `IPOGURU_API_KEY` | Enables IPO Guru as the live calendar data source |
| `CRON_SECRET` | Protects `/api/cron/sync-ipos`, `/api/logs`, `/api/admin/sync` (Bearer) |
| `DATABASE_URL` | Enables Postgres persistence (otherwise in-memory fallback) |
| `OCR_SPACE_API_KEY` | Bigshare CAPTCHA OCR quota (25k/mo free; else shared demo key) |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enables Google sign-in (Auth.js v5) |
| `ADMIN_EMAILS`, `ADMIN_PHONES` | Allowlisted admin OTP identities |
| `RESEND_API_KEY`, `RESEND_FROM` | Admin email-OTP delivery |

See [.env.example](./.env.example) for the full annotated list.

---

## Registrar Integrations

Every IPO is checked through the same `RegistrarAdapter` interface. All integrations use the registrars' own public endpoints — no Playwright or headless browser needed.

| Registrar | Discovery | Allotment Check |
|---|---|---|
| **KFintech** | SPA bundle scrape from `ipostatus.kfintech.com` | `GET .../prod/api/query?type=pan` |
| **MUFG Intime** (ex Link Intime) | `POST /Initial_Offer/IPO.aspx/GetDetails` | `POST /Initial_Offer/IPO.aspx/SearchOnPan` |
| **Link Intime (legacy key)** | Same MUFG portal family | Same portal (kept as separate key for back-compat) |
| **Bigshare** | HTML `<select>` scrape from `IPO_Status.html` (+ mirrors) | `POST /Data.aspx/FetchIpodetails` + CAPTCHA (local ddddocr fast-path, OCR.Space fallback) |
| **Skyline** | IPO `<select>` list scrape | 2-step session POST (CSRF token + search), no CAPTCHA |
| **Purva Sharegistry** | Django IPO query page | Django CSRF session flow, PAN mode |
| **Maashitla** | `GET /api/public-issue/companies` (public OpenAPI JSON) | `GET /api/public-issue/search?company_name=&pan=` (HTTP 404 = `not_found`) |

Allotment checks always hit the registrar live per request. IPO catalogues are cached for 5 minutes with stale-cache and disk-snapshot fallbacks.

---

## Calendar Data Providers

| Provider | API Key | Data |
|---|---|---|
| **IPO Guru** | Required (`IPOGURU_API_KEY`) | Full IPO data + GMP + subscription |
| **InvestorGain** | None | GMP, dates, price band, lot size, category |
| **NSE India** | None | Official NSE/BSE issue data (no GMP) |
| **Seed** (fallback) | None | 10 curated IPOs with dynamic dates |

Providers are tried in priority order; the first to return data wins. If all live sources fail, the curated seed ensures the calendar is never empty.

---

## Project Structure

```
src/
  app/
    api/               # Route handlers (check, scan, calendar, export, logs, health, ipos, backtest, bigshare/captcha, alerts, auth, admin, cron)
    admin/page.tsx     # Admin console (OTP-gated)
    apply/page.tsx     # Family IPO checklist
    backtest/page.tsx  # Strategy backtesting engine
    calendar/page.tsx  # IPO calendar page
    history/page.tsx   # Check history page
    ipo/[id]/page.tsx  # IPO detail page
    page.tsx           # Home — server SEO hero + client allotment checker
    sitemap.ts         # Dynamic sitemap (static routes + per-IPO URLs)
    robots.ts          # Robots rules + sitemap reference
  components/
    auth/              # AuthSessionProvider, AuthButton
    common/            # Header, CommandPalette, StatusBadge
    ui/                # shadcn primitives (badge, button, card, input, tabs, etc.)
  features/
    ipo-apply/         # AccountVault, ApplyWorkspace, ApplyChecklist, brokers, apply-store
    backtest/          # Backtest workspace, strategy engine, historical dataset
    ipo-checker/       # CheckerTabs, IPOSelector, ResultsDashboard, ScanResultsDashboard
    ipo-calendar/      # Calendar view, cards, highlights, providers, format utils, ICS
    ipo-detail/        # Subscription bars, timeline, add-to-calendar, research report
  hooks/               # useWatchlist, usePanLabels, useCheckHistory, useApplyAccounts, useAlerts
  lib/
    siteConfig.ts      # Canonical site URL + brand identity (siteUrl, siteName, siteAlternateName)
    utils.ts           # cn() helper
  registrars/          # RegistrarAdapter interface + KFintech, MUFG, Link Intime, Bigshare, Skyline, Purva, Maashitla adapters
  services/            # check pipeline, registrar sync, KFintech sync, captcha solver, export, logger, report, backtest
  types/               # Allotment, IPO, calendar, API type definitions
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for completed phases and what's next. Key plans: [plan.md](./plan.md) (registrar expansion — Skyline/Purva/Maashitla live, Cameo/Beetal/MCS deferred), [AUTH_PLAN.md](./AUTH_PLAN.md) (implemented auth design), [MULTI_APPLY_PLAN.md](./MULTI_APPLY_PLAN.md) + [FAMILY_CHECKLIST_PLAN.md](./FAMILY_CHECKLIST_PLAN.md) (family checklist), [BIGSHARE_BULK_SPEED_PLAN.md](./BIGSHARE_BULK_SPEED_PLAN.md) (bulk-upload performance).

---

## License

MIT
