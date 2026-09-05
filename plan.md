# Add Other IPO Registrars — Plan

> Goal: expand allotment checker from 4 registrars (KFintech, MUFG/Link Intime, Bigshare, Link Intime-legacy) to cover the SME-heavy long tail that handles ~15-20% of IPOs.
> Last updated: 2026-09-05 — ✅ Implemented: Skyline, Purva, Maashitla (live list + live check, 8 new tests green). Deferred: Cameo, Beetal, MCS (SPAs, no public API found — see §8).

## 1. Current state

- `RegistrarAdapter` interface: `src/registrars/adapter.interface.ts:5-33` (`getActiveIPOs`, `checkAllotment`, `checkBulkAllotment`).
- Registry is single source of truth: `src/registrars/registry.ts:12-17` — frontend, catalogue, check pipeline all resolve via `getAdapter()` / `listAdapters()`.
- Sync fan-out with fault isolation needs **zero changes** for new registrars: `src/services/registrar-sync.ts:200-213` iterates `listAdapters()`.
- Check pipeline is registrar-agnostic: `src/services/registrar.service.ts:46-66` (single IPO) + `78-122` (scan fan-out).
- Shared helpers: `src/registrars/shared.ts` — `bulkCheck`, `withRetry`, `parseNewDataSetTables`, `findField`, `PAN_FORMAT`.
- Types: `RegistrarName = "kfintech" | "linkintime" | "bigshare" | "mufg"` in `src/types/ipo.types.ts:2`.
- DB: `enum Registrar { kfintech, linkintime, bigshare, mufg }` in `prisma/schema.prisma:22-27`.

## 2. Which "other" registrars to add (priority order)

Based on 2026 allotment-portal coverage (KFin + MUFG ≈ 80%, rest = SME/mid-cap):

| Prio | Registrar | Allotment portal (to reverse-engineer) | Expected pattern | Notes |
|------|-----------|----------------------------------------|------------------|-------|
| P1 ✅ | **Skyline Financial Services** | `https://www.skylinerta.com/ipo.php` | HTML `<select>` IPO list + session/CSRF POST by PAN | **LIVE** in `src/registrars/skyline.ts`. No CAPTCHA. |
| P2 ⏸ | **Cameo Corporate Services** | `https://ipo.cameoindia.com/` (Angular SPA) | Unknown — JS bundle has no API URLs, only marketing link | **DEFERRED**, see §8. |
| P3 ✅ | **Purva Sharegistry** | `https://www.purvashare.com/investor-service/ipo-query` | Django CSRF form POST by PAN/AppNo | **LIVE** in `src/registrars/purva.ts`. |
| P4a ⏸ | **Beetal Financial** | `https://beetal.in/` (SPA, no forms in HTML) | Unknown — allotment at `/investor-service/#IPO_Allotment_Status` | **DEFERRED**, see §8. |
| P4b ⏸ | **MCS Share Transfer** | `mcsregistrars.com` (allotment path unknown) | Unknown | **DEFERRED**, see §8. |
| P5 ✅ | **Maashitla Securities** | `https://api.maashitla.com` (public OpenAPI JSON) | JSON `GET /api/public-issue/search?company_name=&pan=` | **LIVE** in `src/registrars/maashitla.ts`. |
| — | Consolidated list ref | `ipoguru.in/registrars`, `ipoplatform.com/ipo-registrar/*` | — | 13 SEBI RTAs ranked; use for registrar-name mapping. |

Scope for this plan: **P1–P3 must-have, P4–P5 stretch**. Each is one new file `src/registrars/<name>.ts` + registry wiring. No Playwright — public endpoints only (repo rule, see `README.md:119`).

> Note: `linkintime` vs `mufg` are the same company (MUFG Intime, ex-Link Intime). Keep both keys for back-compat; new registrars get fresh keys (`skyline`, `cameo`, `purva`, `beetal`, `mcs`, `maashitla`).

## 3. Per-registrar integration research (do before coding each adapter)

For each candidate, capture in `scratch/<registrar>-research.md`:

1. `GET` IPO list page → record dropdown/JSON/AJAX URL, request/response sample.
2. Open DevTools → submit a PAN check → record method, URL, headers, body, response (`d` JSON? XML `<NewDataSet>`? HTML?).
3. Note: CAPTCHA? session cookie? CSRF token? rate limits? PAN vs AppNo vs DP-ID modes?
4. Map response fields → `AllotmentResult { pan, name?, appliedShares?, allottedShares?, status, error? }` + sentinel strings (`no record`, `not applied`, `invalid pan` → `not_found`, never `error`).
5. Decide `clientId` = what the portal uses as company key (`company_id`, slug, numeric id?).

If a portal is CAPTCHA-gated with no bypass (like Bigshare was), fall back to **deep-link only** for that registrar (list IPOs + "Check on registrar site" button) rather than blocking the whole phase.

## 4. Implementation steps

### Phase 0 — Plumbing (1 PR, unblocks all adapters)
- [x] Extend `RegistrarName` in `src/types/ipo.types.ts:2` with `skyline | purva | maashitla` (cameo/beetal/mcs left out until their APIs are mapped).
- [x] Extend `enum Registrar` in `prisma/schema.prisma:22-27` + migration `prisma/migrations/20250906000002_other_registrars/migration.sql` (additive only, no data loss).
- [x] Update `REGISTRAR_MAP` + `parseRegistrar()` in `src/features/ipo-calendar/lib/providers/ipoguru.provider.ts:108-118`.
- [x] Update zod filter in `src/app/api/scan/route.ts:24` to accept new keys.
- [x] Add labels in `src/app/history/page.tsx:22-25` + `src/app/ipo/[id]/page.tsx:37-40` (`REGISTRAR_LABELS`).
- [x] Admin sync monitor picks up new adapters automatically via `listAdapters()` — just verify labels render (`ROADMAP.md Phase 6` section).
- [ ] Update `README.md:123-125` adapter table + `prisma/seed.ts` sample rows for new registrars.

### Phase 1 — Skyline (`src/registrars/skyline.ts`) ✅ Done
- [x] `SkylineAdapter implements RegistrarAdapter` (`name="skyline"`, `displayName="Skyline Financial Services Pvt. Ltd."`), axios 20s timeout + browser UA.
- [x] `getActiveIPOs()`: scrape IPO `<select>` list endpoint → `IPO { id: skyline-<clientId>, ... }`.
- [x] `checkAllotment(pan, clientId)`: 2-step session POST (form → csrf_token, then search); empty/sentinel → `not_found`; keyword-anchored table parse; unknown schema → `error` + `log("warn", ...)`.
- [x] `checkBulkAllotment`: delegate to `bulkCheck()` in `shared.ts:62-106`.
- [x] Register in `REGISTRAR_REGISTRY` (`registry.ts:12-17`).

### Phase 2 — Cameo (`src/registrars/cameo.ts`) ⏸ Deferred — see §8

### Phase 3 — Purva (`src/registrars/purva.ts`) ✅ Done
- [x] Same checklist as Phase 1 (`name="purva"`): Django CSRF session flow, PAN mode. AppNo mode exists on portal but interface only carries PAN.

### Phase 4 — Stretch: Beetal / MCS ⏸ Deferred — see §8

### Phase 4b — Maashitla (`src/registrars/maashitla.ts`) ✅ Done
- [x] JSON API (OpenAPI spec at `api.maashitla.com/openapi.json`): `GET /api/public-issue/companies` for list, `GET /api/public-issue/search?company_name=&pan=` for check; HTTP 404 = `not_found` (verified live); uuid clientId resolved to company_name via 5-min cache.

### Phase 5 — Tests + docs
- [x] New `src/registrars/other-adapters.test.ts`: 8 tests (list parsing, not_found sentinels, CSRF-missing error, Maashitla allotted + 404). Existing 6 adapter tests untouched.
- [x] `npm test` (52 passed), `npx tsc --noEmit`, `npx eslint` on touched files.
- [ ] Manual: `/api/ipos?refresh=true` shows new registrar IPOs; single + bulk (20 PANs) + `/api/scan` fan-out; `/admin` sync monitor counts; `/history` labels.
- [ ] Update `IMPLEMENTATION_PLAN.md §0/§4` registrar lists + this file's checkboxes.

## 8. Deferred: Cameo / Beetal / MCS (evidence from 2026-09-05 recon)

- **Cameo**: `ipostatus.cameoindia.com` DNS-dead; `ipo.cameoindia.com` is an Angular SPA whose JS bundle contains no API URLs (only marketing link `cambridge.cameoindia.com`, itself an ASP.NET WebForms site). No public JSON endpoint found → needs browser-devtools session or registrar contact before a live adapter can be built honestly.
- **Beetal**: `beetal.in` is an SPA (no forms in HTML); allotment lives at `/investor-service/#IPO_Allotment_Status` (client-side route, API unknown). Same blocker as Cameo.
- **MCS**: allotment URL path not discoverable via search (`mcsregistrars.com` main site only). Needs manual portal walkthrough.
- None of the three were added to the registry — a placeholder adapter with a fake check would corrupt scan results, and an empty-list adapter would be dead code. Revisit when an API/form endpoint is identified; the per-registrar template (`skyline.ts`) + Phase 0 plumbing make each a small follow-up.

## 5. Files to touch (summary)

```
src/registrars/skyline.ts      (new)  Phase 1
src/registrars/cameo.ts        (new)  Phase 2
src/registrars/purva.ts        (new)  Phase 3
src/registrars/beetal.ts       (new)  Phase 4 (stretch)
src/registrars/registry.ts     (edit) register each adapter
src/types/ipo.types.ts         (edit) RegistrarName union
prisma/schema.prisma           (edit) enum Registrar + migration
src/app/api/scan/route.ts      (edit) zod enum
src/app/history/page.tsx       (edit) REGISTRAR_LABELS
src/app/ipo/[id]/page.tsx      (edit) REGISTRAR_LABELS
.../providers/ipoguru.provider.ts (edit) REGISTRAR_MAP
src/registrars/adapters.test.ts (edit) new suites
README.md, IMPLEMENTATION_PLAN.md, prisma/seed.ts (edit) docs/seeds
```

No changes needed: `registrar-sync.ts`, `registrar.service.ts`, `ipo.service.ts`, `/api/ipos`, `/api/check` — all resolve via registry.

## 6. Risks / guards

- Parser break on redesign → `registrar-sync.ts` empty-guard (`EMPTY_RESULTS_BEFORE_ACCEPT=3`) + per-registrar fault isolation already handles it; each adapter must return `[]` on list failure, never throw past `syncRegistrar`.
- Rate limits → keep `BULK_CHUNK_SIZE=5` default (`shared.ts:8`); raise only with evidence.
- CAPTCHA (Bigshare lesson, see `BIGSHARE_BULK_SPEED_PLAN.md`) → prefer CAPTCHA-free PAN endpoints; if forced, do deep-link-only.
- `linkintime`/`mufg` duplication → don't merge in this plan; just add new keys.

## 7. Verify / rollback

- Verify: `npm test` (new suites green), `/api/ipos?refresh=true` counts per registrar, `/api/health`, bulk upload of 20 PANs on new registrar IPO, `/admin` sync monitor green.
- Rollback: remove adapter line from `REGISTRAR_REGISTRY` — everything else degrades gracefully (unknown key → `getAdapter` throws only for that IPO; sync/scan skip it). No data migration rollback needed (enum additions are additive).
