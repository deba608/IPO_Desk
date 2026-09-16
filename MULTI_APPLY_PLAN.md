# Multi-Account IPO Apply — Plan

> Goal: let a user with family PANs + different brokers/UPI IDs apply for the same IPO from all accounts in an easy way, from our web.
> Last updated: 2026-09-15 — Status: ✅ Phase 1 BUILT (`/apply` live: vault + workspace + tracker + deep-links: `AccountVault.tsx`, `ApplyWorkspace.tsx`, `ApplyChecklist.tsx`, `brokers.ts`, `apply-store.ts`, `useApplyAccounts.ts`, `brokers.test.ts` green). Nav label repositioned to **Checklist** per FAMILY_CHECKLIST_PLAN.md. Phase 3 broker-API automation still deferred.

## 1. Reality check (read before coding)

True "one-click auto-submit for all accounts" is **not possible** from a third-party website in India, for regulatory + technical reasons:

1. **Only brokers / banks can submit IPO bids** — via exchange (BSE eIPO / NSE eIPO) or ASBA. A third-party site has no bid-submission endpoint.
2. **Each bid needs broker login + OTP** (SEBI 2FA) inside the broker's own app/site. We cannot bypass that.
3. **Each bid needs UPI mandate approval** in GPay/PhonePe/Paytm by 5 PM on close day. That step is always manual in the UPI app.
4. **One PAN = one application per IPO.** Multiple applications with the same PAN get rejected. Family applying = distinct PAN + demat + bank/UPI per person.

So the honest "easy way" we CAN build is a **Multi-Account Apply Workspace**:

- Save family accounts once (vault) → tick who applies for this IPO → get per-account checklist + amounts → jump to each broker's apply page in one click → track UPI mandate status → never miss a mandate.

Broker-API auto-bidding (Zerodha Kite Connect / Upstox API) stays a **Phase 3 opt-in**: user pastes their own API keys, bids are placed via the broker's official API, UPI approval still manual.

## 2. What we will build (agreed scope)

### Phase 1 — Account Vault (localStorage, no login needed)

Reuse patterns from `src/hooks/usePanLabels.ts` + `src/hooks/useProfiles.ts` (localStorage + cross-tab sync events).

New hook `src/hooks/useApplyAccounts.ts`:

```ts
interface ApplyAccount {
  id: string;            // uuid
  label: string;         // "Self", "Spouse", "Dad", "Mom-HUF"
  pan: string;           // ABCDE1234F (validate: 5 letters + 4 digits + 1 letter)
  dematId?: string;      // DP + Client ID / BOID (optional, copy-helper)
  broker: BrokerKey;     // zerodha | groww | upstox | angelone | icicidirect | hdfc | kotak | paytm | other
  upiId?: string;        // name@bank (copy-helper)
  phone?: string;        // last 4 for identification only — never full PII in logs
}
type BrokerKey = "zerodha" | "groww" | "upstox" | "angelone" | "icicidirect" | "hdfc" | "kotak" | "paytm" | "other";
```

- Storage key: `ipodesk:apply-accounts` (+ change event `ipodesk:apply-accounts-change`).
- CRUD: add / update / remove, dedupe by PAN (one PAN = one account).
- Import helper: one-click "Import from PAN labels" (`usePanLabels`) so existing users don't retype PANs.
- Privacy: vault lives in the user's own browser. Never sent to our server. Add "Export / Wipe" buttons.

### Phase 2 — Apply Workspace (the "easy way" page)

New route `/apply` + embeddable section on `/ipo/[id]` ("Apply with multiple accounts").

New feature folder `src/features/ipo-apply/`:

```
src/features/ipo-apply/
  lib/brokers.ts        # BrokerKey → label + IPO-apply deep-link URL templates
  lib/apply-store.ts    # per-IPO × PAN status map (localStorage)
  components/ApplyWorkspace.tsx   # IPO picker + account tick-list + summary
  components/AccountVault.tsx     # CRUD form for ApplyAccount
  components/ApplyChecklist.tsx   # per-account card: copy buttons + broker link + status stepper
```

Workspace flow:

1. **Pick IPO** — dropdown of `lifecycle === "open"` IPOs from `findCalendarIPO` / `/api/calendar` (price band, lot size, min investment already known). Defaults to `?ipo=` param.
2. **Lots + price** — lots stepper (default 1), price = cutoff (max) toggle. Per-account amount = `lots × lotSize × price`. Total blocked = sum over ticked accounts.
3. **Tick accounts** — checkbox list from vault. Shows label + PAN (masked `AXXXX123X`) + broker + UPI.
4. **One-click helpers (per selected set):**
   - `Copy all details` — TSV (Name / PAN / DP / UPI / Lots / Amount) for pasting into Excel / broker forms.
   - `Open broker pages` — opens each selected account's broker IPO URL in new tabs (one click → N tabs). Popup-blocker safe: single user gesture loop with fallback list of links.
   - Per-account `Copy PAN` / `Copy UPI` / `Copy DP ID` buttons.
   - Per-account `Apply on <Broker>` deep-link button (see §3).
5. **Mandate tracker** — per (ipoId + accountId) status stepper: `not-started → applied → upi-pending → upi-approved → done` (+ `skipped`). Stored in `ipodesk:apply-status` localStorage map. Progress bar "3/5 UPI approved".
6. **Reminder** — "UPI mandate expires 5 PM on close day" banner with close date from IPO data + Add-to-calendar reuse (`src/features/ipo-calendar/lib/ics.ts`).

### Phase 3 — Broker API automation (DEFERRED, design-only in this MD)

- Settings fields on vault: optional `kiteApiKey`, `upstoxToken` per account (password-type input, localStorage only).
- Future backend: `POST /api/apply/:broker` proxy that uses official broker SDKs server-side, never logs secrets.
- Even with API: UPI mandate approval stays manual. UI must say so.
- Do NOT build in Phase 1. This MD only reserves the fields + route shape so Phase 1 doesn't block it.

## 3. Broker deep-links (public IPO pages, no auth needed)

| Broker | Deep-link template |
|--------|-------------------|
| Zerodha Kite | `https://kite.zerodha.com/ipo` |
| Groww | `https://groww.in/ipos` |
| Upstox | `https://upstox.com/ipo/` |
| Angel One | `https://www.angelone.in/ipo` |
| ICICI Direct | `https://www.icicidirect.com/ipo` |
| HDFC Sky / HDFC Bank | `https://www.hdfcbank.com/personal/invest/ipo` |
| Kotak Securities | `https://www.kotaksecurities.com/ipo/` |
| BSE eIPO (all brokers) | `https://www.bseindia.com/static/publicissue/` |
| NSE eIPO | `https://www.nseindia.com/products-services/initial-public-offerings` |

All links open in new tab with `rel="noopener"`. Labelled "Continue in broker app ⧉" so users know submission happens there, not on our site. Keep in `brokers.ts` as data so adding a broker = one row.

## 4. Files to touch / create (Phase 1 only)

```
NEW  MULTI_APPLY_PLAN.md (this file)
NEW  src/hooks/useApplyAccounts.ts
NEW  src/features/ipo-apply/lib/brokers.ts
NEW  src/features/ipo-apply/lib/apply-store.ts
NEW  src/features/ipo-apply/components/AccountVault.tsx
NEW  src/features/ipo-apply/components/ApplyWorkspace.tsx
NEW  src/features/ipo-apply/components/ApplyChecklist.tsx
NEW  src/app/apply/page.tsx
EDIT src/app/ipo/[id]/page.tsx  — add "Apply with multiple accounts" CTA → /apply?ipo=<id>
EDIT src/components/common/Header.tsx — add "Apply" nav link (check existing nav pattern first)
```

No Prisma migration in Phase 1 (localStorage only). Optional Phase 2 DB: `ApplicantAccount` + `ApplicationAttempt` models linked to `User` — only after auth is adopted. Do not add until then.

Explicitly OUT of scope: auto-submitting bids, storing UPI PINs/passwords, calling broker APIs, sending money, guaranteeing allotment.

## 5. UX copy (honesty guardrails)

- Page subtitle: "We prepare everything — you approve each bid in your broker + UPI app. No website can skip that step."
- Each broker button: "Continue in <Broker> ⧉".
- Tracker note: "UPI mandate must be approved before 5 PM on close day, else the application lapses."
- Disclaimer footer: "IPO Desk never places bids or moves money. Bids are placed only in your broker's app under your login."

## 6. Verify (manual, no backend)

1. `npm run dev` → `/apply`: add 3 family accounts (Self/Zerodha, Spouse/Groww, Dad/Upstox).
2. Pick an open IPO → tick all 3 → lots=1 → total = 3 × min-investment.
3. `Copy all` pastes clean TSV into Excel.
4. `Open broker pages` opens 3 tabs; per-card broker buttons work.
5. Status stepper persists after reload (localStorage). Progress bar updates.
6. `npx tsc --noEmit` + `npm test` green (add `src/features/ipo-apply/lib/brokers.test.ts` for URL templates + PAN validation).
7. Mobile: cards stack, no horizontal scroll.

## 7. Rollback

Phase 1 is additive (new route + new hooks). Rollback = remove `/apply` link + folder. Vault data stays in user's localStorage, harmless.
