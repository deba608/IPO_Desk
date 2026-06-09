# IPO Allotment Checker

A production-grade **IPO Allotment Status Checker** built with **Next.js 15**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

Check IPO allotment status for single or multiple PANs instantly. Supports bulk checking via Excel/CSV upload. Export results to CSV or styled Excel.

## ✨ Features

- 🔍 **Single & Bulk PAN Check** — type one, paste many, or upload Excel/CSV
- 📊 **Results Dashboard** — sortable, filterable TanStack Table with pagination
- 📥 **Export** — CSV & styled XLSX with summary sheet
- 🏦 **28 Active KFintech IPOs** — real-time data, no mocking
- 🔒 **Secure** — all API calls server-side only, rate limiting, Zod validation
- 🔌 **Multi-Registrar Ready** — plug-and-play adapter for Link Intime, Bigshare, MUFG

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
├── registrars/           # Registrar adapters (KFintech live, others stub)
├── services/             # Business logic layer
├── data/                 # Static IPO list (KFintech)
└── types/                # TypeScript type definitions
```

## 🔌 Registrar API

The KFintech integration uses the official production API:

```
GET https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan
Headers:
  reqparam: <PAN>
  client_id: <IPO_CLIENT_ID>
```

## ☁️ Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

No environment variables required — the KFintech API is public.

## 📜 License

MIT
