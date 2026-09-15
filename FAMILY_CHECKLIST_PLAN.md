# Family Checklist Reposition Plan — Keep, Don't Remove

> Decision: KEEP `/apply`, reframe from "Apply" to "Family Checklist".
> Date: 2026-09-15 — Status: ✅ Done (copy-only, 3 files)
> Context: Groww / Angel One expose NO IPO-apply API (secondary orders only). Only Upstox has IPO Application API Beta (`POST /v2/ipos/orders`, 14-Aug-2026), and even it needs per-person OAuth + manual UPI mandate. So full auto-apply is out of scope. This plan removes overpromise, keeps low-cost value.

## 1. Goal

- Stop implying one-click bid submission.
- Keep what works for 3-5 PAN families: vault + lots math + copy helpers + UPI mandate tracker.
- Foundation stays reusable if Upstox auto-submit is built later.

## 2. Scope (small, copy + label only)

### 2.1 Rename

| Where | Before | After |
|---|---|---|
| `src/components/common/Header.tsx:32-36` NAV_ITEMS | `Apply` | `Checklist` |
| `src/app/apply/page.tsx` metadata title | `Apply for IPO from Multiple Accounts — IPO Desk` | `Family IPO Checklist — Track Bids Across Accounts — IPO Desk` |
| `src/app/apply/page.tsx` H1 | `Apply from all accounts, one flow` | `Don't miss a family bid` |
| `src/app/apply/page.tsx` subtitle | `We prepare everything — you approve each bid...` | `We don't place bids. We prevent missed / rejected bids — you still apply in each broker + approve UPI.` |
| Route | `/apply` (keep URL for backlinks, no redirect needed) | same |

Icon stays `Users`. `isActive` unchanged.

### 2.2 Copy hardening (honesty guardrails)

- `ApplyWorkspace.tsx` step headers:
  - `1 · Pick IPO & lots` → keep
  - `2 · Tick who applies` → `2 · Tick who applies (1 PAN = 1 bid)`
  - `3 · Apply each account, then track UPI` → `3 · Apply in broker app, then tick here`
- `Open broker pages (N)` button → `secondary / outline` variant, label → `Open broker IPO pages ⧉` + helper text `Login + bid + UPI approval happen there, per account.`
- Footer disclaimer (already in `page.tsx:41`, `ApplyWorkspace.tsx:227`) → keep verbatim: `IPO Desk never places bids or moves money.`
- Per-card CTA `Continue in <Broker>` → keep (accurate).

### 2.3 No logic changes

Keep as-is, no refactor:
- `src/hooks/useApplyAccounts.ts` (vault, PAN dedupe, localStorage `ipodesk:apply-accounts`)
- `src/features/ipo-apply/lib/brokers.ts` (deep-links, PAN validation)
- `src/features/ipo-apply/lib/apply-store.ts` (status map `ipodesk:apply-status`)
- `ApplyChecklist.tsx` (`Copy PAN/UPI/Demat`, `buildCopyAllTsv`, stepper `not-started → applied → upi-pending → upi-approved → done + skipped`)

Explicitly OUT:
- No broker API calls, no OAuth, no token storage
- No Upstox `POST /v2/ipos/orders` in this plan (separate future MD if validated)
- No route rename, no DB migration, no deletion of `/apply`

## 3. Files to touch

```
EDIT src/components/common/Header.tsx — label "Apply" → "Checklist"
EDIT src/app/apply/page.tsx — metadata + H1 + subtitle
EDIT src/features/ipo-apply/components/ApplyWorkspace.tsx — step 2/3 labels + Open-broker button variant/label + helper line
```

No new deps. No Prisma change.

## 4. Verify

1. `npm run dev` → header shows `Checklist`, `/apply` still resolves.
2. Add Self/Groww + Spouse/Angel One → tick both → totals = `2 × perAccount` correct.
3. `Copy all details` pastes TSV with 8 cols.
4. Stepper persists after reload, progress `x/y UPI approved` updates.
5. Mobile: no horizontal scroll, buttons wrap.
6. `npx tsc --noEmit` + `npm test` green.

## 5. Rollback

Copy-only change. Rollback = revert 3 file edits. Vault data in user localStorage unaffected.

## 6. Future (not this plan)

- `UPSTOX_IPO_AUTO_PLAN.md` (separate): OAuth per family member → `POST /v2/ipos/orders` → poll `GET /v2/ipos/orders/{id}`. Only if >20% of vault users are all-Upstox. Groww/Angel automation stays impossible (no IPO endpoint).
- Delete trigger: if analytics shows <5% visits to `/apply` over 30 days, remove nav link first, keep route.
