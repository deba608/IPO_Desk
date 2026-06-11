# IPO Desk — Allotment Checker

Check IPO allotment status for single or multiple PANs instantly. Supports bulk checking via Excel/CSV upload with export to CSV or styled Excel. All IPO data is discovered dynamically from registrar APIs — no hardcoded lists.

## Features

- **Single & Bulk PAN Check** — type one, paste many, or upload Excel/CSV (max 5 MB)
- **Results Dashboard** — sortable, filterable TanStack Table with pagination (10/25/50/100)
- **Export** — CSV & styled XLSX with summary sheet
- **Live Multi-Registrar Data** — KFintech, MUFG Intime (formerly Link Intime), and Bigshare, all discovered dynamically with 5-minute caching
- **Registrar-Agnostic** — the frontend never knows which registrar serves an IPO; adding one means implementing `RegistrarAdapter` and registering it
- **Scroll-Responsive Navbar** — sticky header shrinks with rounded corners and shadow on scroll
- **Secure** — all API calls server-side only, rate limiting, Zod validation, security headers

## Getting Started

```bash
npm install
npm run dev
# -> http://localhost:3000
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Table | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| File Parsing | XLSX (SheetJS) |
| HTTP | Axios with retry |
| Notifications | Sonner |
| Icons | Lucide React |

## Project Structure

```
src/
  app/
    api/
      check/           # POST - allotment check (rate-limited, Zod-validated)
      cron/sync-ipos/  # GET  - Vercel Cron daily sync
      export/          # POST - CSV/XLSX download
      ipos/            # GET  - active IPO list (merged, cached)
      logs/            # GET  - debug event logs
    globals.css
    layout.tsx
    manifest.json
    page.tsx           # main landing page
  components/
    common/
      StatusBadge.tsx
    ui/                # shadcn-style primitives (badge, button, card, input, etc.)
  features/ipo-checker/
    components/
      IPOSelector.tsx  # searchable dropdown with registrar filter pills
      CheckerTabs.tsx  # single / bulk / file-upload input modes
      ResultsDashboard.tsx  # table, summary cards, export buttons
    utils/
      pan-validator.ts
      pan-parser.ts    # Excel/CSV column auto-detection
  lib/utils.ts
  registrars/          # RegistrarAdapter interface + live implementations
    adapter.interface.ts
    bigshare.ts
    kfintech.ts
    linkintime.ts      # alias adapter (rebranded -> MUFG)
    mufg.ts
    registry.ts
    shared.ts          # retry, bulk-check, ASP.NET XML parser
  services/
    export.service.ts
    ipo.service.ts
    kfintech-sync.ts   # KFintech SPA bundle scraping + cache
    logger.service.ts  # ring-buffer logger (viewable at /api/logs)
    registrar.service.ts  # main check pipeline
    registrar-sync.ts  # multi-registrar sync with fault isolation
  types/
    allotment.types.ts
    api.types.ts
    ipo.types.ts
```

## Registrar Integrations

Every IPO is checked through the same `RegistrarAdapter` interface; the correct adapter is selected from the IPO's metadata. All integrations use the registrars' own public endpoints — no Playwright or headless browser needed.

| Registrar | Discovery | Allotment check |
|---|---|---|
| KFintech | IPO list embedded in their SPA bundle | `GET .../prod/api/query?type=pan` |
| MUFG Intime (ex Link Intime) | `POST /Initial_Offer/IPO.aspx/GetDetails` | `POST /Initial_Offer/IPO.aspx/SearchOnPan` |
| Bigshare | Parsed from `IPO_Status.html` dropdown | `POST /Data.aspx/FetchIpodetails` |

`linkintime` remains as an alias adapter for legacy metadata — both routes hit the same MUFG API.

Allotment checks always hit the registrar live, per request. IPO catalogues are cached for 5 minutes per registrar with stale-cache and disk-snapshot fallbacks; one registrar failing never hides the others.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/check` | POST | Check allotment for 1-500 PANs |
| `/api/ipos` | GET | List active IPOs (merged across registrars) |
| `/api/export` | POST | Download results as CSV or XLSX |
| `/api/logs` | GET | Debug event logs (ring buffer) |
| `/api/cron/sync-ipos` | GET | Vercel Cron daily sync (optional `CRON_SECRET`) |

## Deploy

[![Deploy with Vercel]

No environment variables required — all registrar APIs are public.

Optional: `CRON_SECRET` to protect the `/api/cron/sync-ipos` endpoint.

## License

MIT
