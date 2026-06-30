# IPO Desk — Allotment Checker

Check IPO allotment status for single or multiple PANs instantly. Track IPO calendars, analyse GMP, view subscription data, and manage a personal check history — all in one dark-themed dashboard.

All IPO data is discovered **dynamically from registrar APIs** — no hardcoded lists. The calendar uses live provider data (InvestorGain, NSE, IPO Guru) with curated sample fallback.

---

## Features

### Allotment Checker
- **Single & Bulk PAN Check** — type one PAN, paste many, or upload Excel/CSV (max 5 MB)
- **Cross-IPO Scan** — check the same PANs across all active IPOs at once
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

### Technical
- **Live Multi-Registrar Discovery** — KFintech, MUFG Intime (ex Link Intime), Bigshare — all discovered dynamically
- **Fault Isolation** — each registrar syncs independently; one failing never hides others
- **Rate Limiting** — in-memory per-IP rate limiting on check/scan endpoints
- **Zod Validation** — all API inputs validated with detailed error responses
- **Structured Logging** — ring-buffer logger viewable at `/api/logs`
- **Server-Side Only** — all registrar API calls are server-side; client only talks to Next.js
- **Optional Database** — Prisma + Postgres for persistent IPO data, GMP history, and user alerts (graceful fallback when no DB configured)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui |
| Table | TanStack Table v8 |
| Notifications | Sonner |
| Icons | Lucide React |
| HTTP | Axios |
| File Parsing | SheetJS (xlsx) |
| File Export | SheetJS (CSV / styled XLSX) |
| Validation | Zod |
| PWA | Web app manifest (`standalone` mode) |

---

## Pages

| Route | Description |
|---|---|
| `/` | Allotment checker — single/bulk/excel check, results dashboard, cross-IPO scan |
| `/calendar` | IPO calendar — live data, lifecycle tabs, search, sort, watchlist |
| `/ipo/[id]` | IPO detail — key stats, subscription, GMP, timeline, add to calendar |
| `/history` | Check history — stats, per-entry list, remove/clear |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/check` | POST | Check allotment for 1–500 PANs on a single IPO |
| `/api/scan` | POST | Check PANs against all active IPOs (max 50 PANs) |
| `/api/ipos` | GET | List active IPOs merged across all registrars |
| `/api/calendar` | GET | IPO calendar data with lifecycle derivation |
| `/api/export` | POST | Download results as CSV or XLSX |
| `/api/logs` | GET | Debug event logs (ring buffer) |
| `/api/alerts` | GET/POST/DELETE | Manage IPO alerts |
| `/api/ipo/[id]/gmp-history` | GET | GMP time-series data for trend chart |
| `/api/ipo/[id]/report` | GET | AI research report with scores and verdict |
| `/api/cron/sync-ipos` | GET | Vercel Cron daily sync |

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
| `IPOGURU_API_KEY` | Enables IPO Guru as the live calendar data source |
| `CRON_SECRET` | Protects the `/api/cron/sync-ipos` endpoint |

---

## Registrar Integrations

Every IPO is checked through the same `RegistrarAdapter` interface. All integrations use the registrars' own public endpoints — no Playwright or headless browser needed.

| Registrar | Discovery | Allotment Check |
|---|---|---|
| **KFintech** | SPA bundle scrape from `ipostatus.kfintech.com` | `GET .../prod/api/query?type=pan` |
| **MUFG Intime** (ex Link Intime) | `POST /Initial_Offer/IPO.aspx/GetDetails` | `POST /Initial_Offer/IPO.aspx/SearchOnPan` |
| **Bigshare** | HTML `<select>` scrape from `IPO_Status.html` | `POST /Data.aspx/FetchIpodetails` |

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
    api/               # Route handlers (check, scan, calendar, export, logs, ipos, cron)
    calendar/page.tsx  # IPO calendar page
    history/page.tsx   # Check history page
    ipo/[id]/page.tsx  # IPO detail page
    page.tsx           # Home — allotment checker
  components/
    common/            # Header, StatusBadge
    ui/                # shadcn primitives (badge, button, card, input, tabs, etc.)
  features/
    ipo-checker/       # CheckerTabs, IPOSelector, ResultsDashboard, ScanResultsDashboard
    ipo-calendar/      # Calendar view, cards, highlights, providers, format utils, ICS
    ipo-detail/        # Subscription bars, timeline, add-to-calendar
  hooks/               # useWatchlist, usePanLabels, useCheckHistory
  lib/utils.ts         # cn() helper
  registrars/          # RegistrarAdapter interface + KFintech, MUFG, Bigshare adapters
  services/            # check pipeline, registrar sync, KFintech sync, export, logger
  types/               # Allotment, IPO, calendar, API type definitions
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features: GMP trend charts, AI research reports, IPO scoring engine, database, alerts, admin panel, and more.

---

## License

MIT
