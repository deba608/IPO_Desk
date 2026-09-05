# Bigshare Bulk-Upload Speed Plan — CAPTCHA Bottleneck

> Problem: bulk uploads for Bigshare IPOs are slow because **every PAN pays for a full CAPTCHA round-trip** (fetch image → remote OCR.Space solve → POST answer), executed with low parallelism and sequential frontend batches.
> Goal: cut wall-clock time for 100–500 PAN bulk checks by ~3–5× and show users the first results in seconds (progressive rendering), without breaking single-PAN reliability.

Last updated: 2026-09-05

---

## 1. Diagnosis (why it is slow today)

| # | Bottleneck | Where | Cost |
|---|-----------|-------|------|
| 1 | **Remote OCR per PAN** — each `checkAllotment` calls `solveBigShareCaptcha()` → `GET Captcha.ashx` (~0.5s) + `POST api.ocr.space` (~1.5–3s, up to 3 engines serially + 2s/4s backoff on HTTP 429) | `src/services/captcha.service.ts:71-143`, `src/registrars/bigshare.ts:147-169` | ~2–5s serial latency **per PAN**, before the allotment POST even runs |
| 2 | **Docker image already ships a local solver that is never used** — `Dockerfile` installs `ddddocr + pillow`, but the code only calls the remote OCR.Space API | `Dockerfile:8-14` vs `captcha.service.ts` | Paying network + quota cost for something that could be ~200–500ms in-process |
| 3 | **Free-tier OCR rate limits under bulk parallelism** — 8 parallel solves hit OCR.Space 429s (esp. on the `helloworld` fallback key), triggering multi-second retries that serialize the whole chunk | `captcha.service.ts:95-123`, `bigshare.ts:329-332` (`chunkSize: 8`) | Bulk bursts get *slower* with more parallelism; retries cascade |
| 4 | **Serial CAPTCHA→POST pipeline per PAN** — no prefetching; each worker idles on its CAPTCHA before it can POST | `bigshare.ts:147-195` | No overlap of captcha solves with allotment POSTs |
| 5 | **Serial mirror fallback** — 3 mirrors tried in series with `withRetry(attempts=4, base 1.5s exponential)` and 12s axios timeout; one dead mirror multiplies every PAN's latency | `bigshare.ts:28-32, 74-84`, `shared.ts:25-47` | Slow networks stall the entire bulk job |
| 6 | **Frontend sends bulk sequentially** — `BULK_BATCH_SIZE = 12`, one `/api/check` request at a time for 500 PANs = ~42 sequential round-trips | `src/app/page.tsx:29, 41-86` | Total time = sum of all batches; user sees nothing until batch N finishes |
| 7 | **Server throttles its own bulk client** — `/api/check` allows 20 req/min; a 500-PAN upload needs ~42 requests → self-inflicted 429s mid-upload | `src/app/api/check/route.ts:7-8` | Upload stalls / errors partway |
| 8 | **No progressive rendering** — results state is set only after *all* batches finish | `page.tsx:137-142` | Perceived slowness: blank screen for minutes |

Estimated today: 100 PANs ≈ 60–90s; 500 PANs ≈ 5–8 min + `CHECK_TIMEOUT_MS` (50s) / rate-limit failures.

---

## 2. Plan (phased, cheapest wins first)

### Phase A — Local OCR fast-path (biggest win on Docker/VPS) ✅ APPLIED
- Add `scripts/solve_captcha.py` using the already-installed `ddddocr` (stdin base64 → stdout digits).
- `captcha.service.ts`: try local solver first (~1s, zero quota); fall back to OCR.Space on any failure (missing python/lib, bad output, timeout).
- **Vercel note:** serverless has no python/ddddocr, so the first PAN trips a circuit-breaker (`localOcrUnavailable`) and every later PAN skips the doomed spawn with zero cost — Vercel automatically stays on the remote path.
- Reduces 429 pressure on OCR.Space for everyone.

### Phase B — Pipeline the bulk (overlap captcha + POST, skip dead mirrors fast) ✅ APPLIED
- `BigShareAdapter.checkBulkAllotment`: pre-warm a pool of up to 8 solved CAPTCHAs **in parallel** before starting, then run checks through `bulkCheck` with `chunkDelayMs: 100` (was 250). Works on Vercel too (pool = parallel remote solves).
- **Remote OCR latency profile reworked for Vercel** (`captcha.service.ts`): typical case is now ONE OCR.Space request (engine 2); fallback engines 1+3 race **in parallel** instead of serially; single short 1.5s backoff on 429 instead of 2s+4s serial retries. Worst-case remote solve ~5s (was ~18s).
- Per-POST `withRetry` tightened to 2 attempts / 800ms base (fail fast; mirror loop already gives 3×2 redundancy).
- Sticky fastest-mirror: first working mirror is tried first for all later PANs (dead-mirror penalty paid once per instance, not per PAN).
- Expected: captcha latency hidden behind POST latency; dead-mirror penalty paid once per bulk, not per PAN.

### Phase C — Unblock throughput + perceived speed (frontend + rate limit) ✅ APPLIED
- `/api/check` rate limit `20/min → 60/min` (bulk of 500 PANs in 20-PAN batches = 25 requests, fits comfortably); `maxDuration = 60` so platforms that allow it (Vercel Pro/Docker) don't kill long batches early.
- Frontend `BULK_BATCH_SIZE 12 → 20`, and batches run with **concurrency 3** instead of strictly sequential — each serverless invocation works independently, ≈3× throughput on Vercel.
- **Progressive results**: each completed batch merges into the visible results table immediately (`onPartial`), so the first ~20 rows appear in seconds while the rest stream in.
- Dedupe already exists server-side; client keeps real progress %.

### Phase D — Recommended follow-ups (NOT yet applied)
1. **Persistent bulk jobs**: upload → `jobId` → poll/SSE (`/api/bulk/[jobId]`), removes the 50s serverless ceiling entirely; required for 1000+ PAN files.
2. **Adaptive OCR concurrency limiter** (e.g. `p-limit` 4 for remote OCR, 10 for local) with per-engine circuit breaker on 429.
3. **Manual-captcha fallback UI**: when auto-OCR fails for a PAN, show the image inline and let the user type 6 digits (retry just that PAN).
4. **Result caching**: `(registrar, clientId, PAN)` cache for 15 min — re-uploads and profile re-checks become instant.
5. **Mirror health cache**: remember fastest mirror for 5 min across requests (in-memory + DB when available).
6. **Set `OCR_SPACE_API_KEY`** in production (free 25k/mo key) so Vercel fallback stops sharing the `helloworld` quota.

---

## 3. What changed in this pass (files)

- `scripts/solve_captcha.py` (new) — local ddddocr solver.
- `src/services/captcha.service.ts` — local-first `solveBigShareCaptcha()` with Vercel circuit-breaker, `FETCH_TIMEOUT_MS` 15s→10s, remote OCR reworked to primary-engine fast-path + parallel fallback.
- `src/registrars/bigshare.ts` — captcha pool pre-warm, sticky fastest-mirror ordering, fail-fast POST retry (2 attempts / 800ms), `chunkDelayMs` 250→100.
- `src/app/api/check/route.ts` — rate limit 20→60/min, `maxDuration = 60`.
- `src/app/page.tsx` — batch size 12→20, concurrency-3 parallel batches, progressive `setResults` per batch.
- `src/app/api/health/route.ts` — `localOcrScriptPresent` + `localOcrCircuitTripped` flags (tells you which OCR path the deploy uses).

## 4. How to verify

- `npm test` — adapter unit tests mock `fetchCaptchaToken`, unaffected by solver internals.
- `npx tsc --noEmit` — typecheck.
- Manual: upload 100-PAN file for a Bigshare IPO on Docker deploy → first rows should render in <10s; total should drop vs. main.
- `/api/health` shows `ocrKeyConfigured` + new `localOcrAvailable`.
- If local OCR underperforms on a captcha style, it auto-falls-back to OCR.Space per-PAN (no user impact).

## 5. Rollback

Each phase is independent: revert `captcha.service.ts` to pure OCR.Space, or `page.tsx` to sequential batches, without touching the other. No schema/migration involved.
