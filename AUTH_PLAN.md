# Auth Plan — Google login for users, passwordless OTP for admin

> Status: ✅ IMPLEMENTED (was plan-only). Built per this design; see verification notes in §8.
> Last updated: 2026-09-15.

## 0. Starting state (was verified 2026-09-06, now superseded)

- ~~No auth library, no sessions, no middleware.~~ Now: Auth.js v5 (`next-auth`) with Google provider + JWT sessions; `AuthSessionProvider` in root layout; `AuthButton` (avatar menu) in header.
- ~~Admin = passcode gate.~~ Now: `ADMIN_PASSCODE` handling deleted; admin = email-OTP (`/api/admin/otp/request` + `/verify`, `ipodesk_admin` cookie) with `CRON_SECRET` Bearer kept for cron/programmatic access to `/api/admin/sync` + `/api/logs`.
- ~~Alerts = anonymous `x-device-id` only.~~ Now: user session takes precedence; `POST /api/alerts/link` backfills device alerts to the signed-in user.
- Prisma: `Account` model + `User.phone` added; `AdminOtpChallenge(identifierHash, codeHash, expiresAt, attempts)` added (hashes only, in-memory fallback when no `DATABASE_URL`).
- `/api/health` exposes auth/mail/allowlist config flags.

## 1. Design principles

1. **Two systems, two sessions, no overlap.** User session cookie
   (`authjs.session-token`) via Google; admin session cookie (`ipodesk_admin`)
   via OTP. Neither grants the other's powers.
2. **Login stays optional.** Checks, calendar, backtest remain public; login
   unlocks cross-device history, alert ownership, watchlist.
3. **Fail closed.** Missing secrets/keys disable the flow (503), never bypass it.
4. **Serverless-safe.** JWT sessions (no per-request DB reads); OTP challenges in
   Postgres with in-memory dev fallback (same pattern as `db.service.ts`).

## 2. Phase 0 — Groundwork

- Deps: `next-auth` (Auth.js v5) + `@auth/prisma-adapter` (users); `resend`
  (admin email OTP).
- Google Cloud Console → OAuth client (ID + secret), authorized redirect
  `<site>/api/auth/callback/google`. Cost: $0.
- Env: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `ADMIN_EMAILS` (comma list), `ADMIN_PHONES` (comma list, E.164),
  `RESEND_API_KEY`, `RESEND_FROM`.

## 3. Phase 1 — Users: Google OAuth

- `src/auth.ts` — Auth.js config (Google provider, JWT strategy, PrismaAdapter
  for account linking), `src/app/api/auth/[...nextauth]/route.ts`.
- Prisma: add `Account` model (adapter-required) + optional `User.phone`;
  additive migration.
- Layout: `SessionProvider`; Header: Sign-in-with-Google → avatar menu → sign out.
- Data linking: on first login, backfill `alerts`/`watchlistEntries` whose
  `deviceId` matches the client's, setting `userId`.
- Alerts API: accept user session (takes precedence) or `x-device-id`
  (anonymous, as today).
- No forced-login routes in this phase.

## 4. Phase 2 — Admin: passwordless OTP (NOT Google, NOT password)

- `/admin` login becomes identifier-first: enter **email or mobile** →
  `POST /api/admin/otp/request` checks `ADMIN_EMAILS`/`ADMIN_PHONES`; always
  replies "code sent if authorized" (no account enumeration).
- OTP: 6 digits, **SHA-256 hash stored** (never plaintext), 10-min expiry,
  60s resend cooldown, max 5 requests/hour per identifier.
- `POST /api/admin/otp/verify`: max 5 attempts then invalidate; on success
  issues signed `ipodesk_admin` JWT cookie (HttpOnly, Secure, SameSite=Lax,
  30-min sliding expiry).
- Delivery: **email via Resend** (free tier covers admin logins indefinitely).
  Mobile SMS is effectively paid in India (~₹0.15/msg via MSG91/2Factor;
  Firebase Phone Auth free quota is the only $0 path) — ship email first,
  add SMS only on explicit ask.
- Guards: `/api/admin/sync` + `/api/logs` accept the admin cookie (keep
  `CRON_SECRET` Bearer for cron compat); delete `ADMIN_PASSCODE` handling and
  remaining `admin123` remnants; update `.env.example`.
- DB: `AdminOtpChallenge(identifierHash, codeHash, expiresAt, attempts)` +
  migration; in-memory fallback when no `DATABASE_URL`.

## 5. Phase 3 — Hardening & verify

- Rate limits on all new endpoints (reuse `lib/rate-limit.ts`); OTP single-use;
  audit-log admin sync triggers; user+admin sessions isolated (refresh one,
  the other unaffected).
- Verify matrix: Google login/logout; cross-device alerts after link;
  OTP happy path, wrong code ×5 (invalidate), expired code, resend cooldown,
  non-allowlisted identifier learns nothing; old passcode calls 401/503;
  `tsc`, eslint, vitest, `next build`.

## 6. Costs

| Piece | Cost |
|---|---|
| Google OAuth | $0 |
| Auth.js / JWT sessions | $0 |
| Resend email OTP | $0 (free tier) |
| SMS OTP (if wanted) | ~₹0.15/SMS, or Firebase free quota |

## 7. Decisions needed before build

Decided during implementation (kept here for the record):

1. Admin factor: **email OTP only** (shipped; SMS deferred — paid in India, Firebase free quota is the only $0 path).
2. Forced-login routes: **none** — everything public + optional login.
3. Admin session lifetime: **30-min sliding** `ipodesk_admin` cookie.

## 8. As-built verification (2026-09-15)

- [x] Deps installed: `next-auth` (+ `@auth/prisma-adapter`), `resend` (see `package.json`).
- [x] Routes live: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/admin/otp/request|verify/route.ts`, `src/app/api/admin/logout/route.ts`, `src/app/api/alerts/link/route.ts`.
- [x] UI live: `src/components/auth/AuthSessionProvider.tsx`, `src/components/auth/AuthButton.tsx` (header desktop + compact mobile).
- [x] Schema live: `Account`, `User.phone`, `AdminOtpChallenge` in `prisma/schema.prisma`.
- [x] Env documented: `.env.example` (Google OAuth, admin allowlists, Resend).
- [x] `npx tsc --noEmit` clean; `npm test` 57/57 green.
- Manual re-verify on demand: Google login/logout; cross-device alerts after link; OTP happy path / ×5 wrong (invalidate) / expired / resend cooldown / non-allowlisted learns nothing; old passcode calls 401/503.
