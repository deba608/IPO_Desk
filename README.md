# IPO Allotment Checker

A production-grade **IPO Allotment Status Checker** built with **Next.js 15**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

Check IPO allotment status for single or multiple PANs instantly. Supports bulk checking via Excel/CSV upload. Export results to CSV or styled Excel.

## ✨ Features

- 🔍 **Single & Bulk PAN Check** — type one, paste many, or upload Excel/CSV
- 📊 **Results Dashboard** — sortable, filterable TanStack Table with pagination
- 📥 **Export** — CSV & styled XLSX with summary sheet
- 🏦 **Live Multi-Registrar Data** — KFintech, MUFG Intime (formerly Link Intime), and Bigshare, discovered dynamically with no hardcoded IPO lists
- 🔒 **Secure** — all API calls server-side only, rate limiting, Zod validation
- 🔌 **Registrar-Agnostic** — the frontend never knows which registrar serves an IPO; adding one means implementing `RegistrarAdapter` and registering it

## 🚀 Getting Started

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| UI | React 19 + Tailwind CSS v4 |
| Table | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| File Parsing | XLSX (SheetJS) |
| HTTP | Axios with retry |
| Notifications | Sonner |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/check/        # POST — allotment check endpoint
│   ├── api/export/       # POST — CSV/XLSX download
│   └── api/ipos/         # GET  — active IPO list
├── features/ipo-checker/ # Main feature components + utils
├── registrars/           # Registrar adapters + registry (all live)
├── services/             # Business logic layer (multi-registrar sync, check pipeline)
└── types/                # TypeScript type definitions
```

## 🔌 Registrar Integrations

Every IPO is checked through the same `RegistrarAdapter` interface; the
correct adapter is selected from the IPO's metadata. All integrations use
the registrars' own public endpoints — no scraping automation (Playwright)
is needed anywhere.

| Registrar | Discovery | Allotment check |
|---|---|---|
| KFintech | IPO list embedded in their SPA bundle | `GET …/prod/api/query?type=pan` (headers `reqparam`, `client_id`) |
| MUFG Intime (ex Link Intime) | `POST /Initial_Offer/IPO.aspx/GetDetails` | `POST /Initial_Offer/IPO.aspx/SearchOnPan` |
| Bigshare | Parsed from `IPO_Status.html` dropdown | `POST /Data.aspx/FetchIpodetails` |

`linkintime` remains as an alias adapter for legacy metadata — Link Intime
rebranded to MUFG Intime in 2024 and both routes hit the same API.

IPO catalogues are cached for 6 hours per registrar with stale-cache and
disk-snapshot fallbacks; one registrar failing never hides the others.

## ☁️ Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

No environment variables required — the KFintech API is public.

## 📜 License

MIT
