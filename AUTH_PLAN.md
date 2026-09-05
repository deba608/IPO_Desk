# Auth Plan — Google login for users, passwordless OTP for admin

> Status: PLAN ONLY — nothing implemented yet.
> Decisions needed (bottom) before build starts.

## 0. Current state (verified 2026-09-06)

- No auth library, no sessions, no middleware. `User` model exists (email unique,
  name, avatarUrl) but is fully unused — `userId` is always null.
- Admin = passcode gate (`ADMIN_PASSCODE`/`CRON_SECRET` via `x-admin-passcode` or
  Bearer on `/api/admin/sync`; `CRON_SECRET` Bearer on `/api/logs` + cron).
  Login dialog verifies against `/api/logs` (401 = wrong code).
- Alerts = anonymous `x-device-id` scoping (self-asserted, not authentication).
- Goal: Google OAuth for users; a DIFFERENT, password-free mechanism for admin
  (email and/or mobile OTP). No passwords stored anywhere, ever.

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

1. Admin factor: **email OTP only** (recommended, free) or must-have SMS too?
2. Any **forced-login** routes, or keep everything public + optional login?
3. Admin session lifetime: **30-min sliding** or longer (e.g. 8h)?
