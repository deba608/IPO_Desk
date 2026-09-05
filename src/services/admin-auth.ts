// src/services/admin-auth.ts
// Admin authentication: passwordless email OTP, SEPARATE from user Google
// login. No passwords exist anywhere in this flow.
//
// Flow: identifier (email) → allowlist check → 6-digit code (SHA-256 stored,
// 10-min expiry, 5 attempts, 60s resend cooldown) → signed `ipodesk_admin`
// cookie (HMAC-SHA256, 30-min fixed expiry).
//
// Mobile numbers in the allowlist are accepted by the request endpoint but
// SMS delivery is not configured — it answers 501 directing to email.

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { checkDbAvailability, getPrisma } from "./db.service";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_HOUR = 5;

const SESSION_COOKIE = "ipodesk_admin";
const SESSION_TTL_MS = 30 * 60 * 1000;

export function adminSessionCookieName(): string {
  return SESSION_COOKIE;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Session/OTP signing secret. Absent → admin OTP is disabled (fail closed). */
function signingSecret(): string | null {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

export type IdentifierKind = "email" | "phone";

export function classifyIdentifier(raw: string): IdentifierKind | null {
  const v = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length >= 8 && digits.length <= 15) return "phone";
  return null;
}

/** Canonical form for allowlist comparison + challenge keys. */
export function normalizeIdentifier(raw: string, kind: IdentifierKind): string {
  return kind === "email" ? raw.trim().toLowerCase() : raw.replace(/[^\d]/g, "");
}

function allowlist(kind: IdentifierKind): string[] {
  const raw =
    kind === "email" ? process.env.ADMIN_EMAILS : process.env.ADMIN_PHONES;
  return (raw ?? "")
    .split(",")
    .map((s) => normalizeIdentifier(s, kind))
    .filter(Boolean);
}

export function isAllowlisted(raw: string): boolean {
  const kind = classifyIdentifier(raw);
  if (!kind) return false;
  return allowlist(kind).includes(normalizeIdentifier(raw, kind));
}

// ── Challenge store (DB with in-memory dev fallback) ────────────────────

interface Challenge {
  codeHash: string;
  attempts: number;
  resendAfter: number;
  expiresAt: number;
  requestedAt: number[];
}

const memStore = globalThis as unknown as {
  __adminOtp?: Map<string, Challenge>;
};
memStore.__adminOtp ??= new Map();
const memChallenges = memStore.__adminOtp;

async function readChallenge(key: string): Promise<Challenge | null> {
  if (checkDbAvailability()) {
    try {
      const prisma = await getPrisma();
      const row = await prisma.adminOtpChallenge.findUnique({
        where: { identifierHash: key },
      });
      if (!row) return null;
      return {
        codeHash: row.codeHash,
        attempts: row.attempts,
        resendAfter: row.resendAfter.getTime(),
        expiresAt: row.expiresAt.getTime(),
        requestedAt: [],
      };
    } catch {
      return memChallenges.get(key) ?? null;
    }
  }
  return memChallenges.get(key) ?? null;
}

async function writeChallenge(key: string, c: Challenge): Promise<void> {
  memChallenges.set(key, c);
  if (!checkDbAvailability()) return;
  try {
    const prisma = await getPrisma();
    await prisma.adminOtpChallenge.upsert({
      where: { identifierHash: key },
      update: {
        codeHash: c.codeHash,
        attempts: c.attempts,
        resendAfter: new Date(c.resendAfter),
        expiresAt: new Date(c.expiresAt),
      },
      create: {
        identifierHash: key,
        codeHash: c.codeHash,
        attempts: c.attempts,
        resendAfter: new Date(c.resendAfter),
        expiresAt: new Date(c.expiresAt),
      },
    });
  } catch {
    // Memory copy above keeps dev working; DB errors surface in logs.
  }
}

async function clearChallenge(key: string): Promise<void> {
  memChallenges.delete(key);
  if (!checkDbAvailability()) return;
  try {
    const prisma = await getPrisma();
    await prisma.adminOtpChallenge.deleteMany({ where: { identifierHash: key } });
  } catch {
    // ignore
  }
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export type OtpRequestResult =
  | { ok: true; code: string; identifier: string; kind: IdentifierKind }
  | { ok: false; reason: "invalid" | "rate_limited" | "unconfigured" };

/**
 * Create (or refresh) an OTP challenge. ALWAYS call isAllowlisted() first and
 * answer generically — this function assumes the caller already decided.
 * Returns the plaintext code ONLY so the caller can deliver it (email);
 * it is never persisted.
 */
export async function createChallenge(
  identifier: string,
  kind: IdentifierKind
): Promise<OtpRequestResult> {
  if (!signingSecret()) return { ok: false, reason: "unconfigured" };
  const now = Date.now();
  const key = sha256Hex(`${kind}:${identifier}`);
  const existing = await readChallenge(key);

  if (existing) {
    if (now < existing.resendAfter) {
      return { ok: false, reason: "rate_limited" };
    }
    const recent = (existing.requestedAt ?? []).filter(
      (t) => now - t < 3600 * 1000
    );
    if (recent.length >= OTP_MAX_REQUESTS_PER_HOUR) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  const code = randomCode();
  const prev = existing?.requestedAt ?? [];
  await writeChallenge(key, {
    codeHash: sha256Hex(code),
    attempts: 0,
    resendAfter: now + OTP_RESEND_COOLDOWN_MS,
    expiresAt: now + OTP_TTL_MS,
    requestedAt: [...prev.filter((t) => now - t < 3600 * 1000), now],
  });
  return { ok: true, code, identifier, kind };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "locked" | "unconfigured" };

export async function verifyChallenge(
  identifier: string,
  kind: IdentifierKind,
  code: string
): Promise<OtpVerifyResult> {
  if (!signingSecret()) return { ok: false, reason: "unconfigured" };
  const key = sha256Hex(`${kind}:${identifier}`);
  const existing = await readChallenge(key);
  if (!existing) return { ok: false, reason: "invalid" };
  if (Date.now() > existing.expiresAt) {
    await clearChallenge(key);
    return { ok: false, reason: "expired" };
  }
  if (existing.attempts >= OTP_MAX_ATTEMPTS) {
    await clearChallenge(key);
    return { ok: false, reason: "locked" };
  }
  const match =
    existing.codeHash.length === sha256Hex(code).length &&
    timingSafeEqual(
      Buffer.from(existing.codeHash),
      Buffer.from(sha256Hex(code))
    );
  if (!match) {
    existing.attempts += 1;
    if (existing.attempts >= OTP_MAX_ATTEMPTS) {
      await clearChallenge(key);
      return { ok: false, reason: "locked" };
    }
    await writeChallenge(key, existing);
    return { ok: false, reason: "invalid" };
  }
  await clearChallenge(key);
  return { ok: true };
}

// ── Signed admin session (HMAC-SHA256, base64url header.payload.sig) ─────

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signAdminSession(sub: string): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "ADM" }));
  const payload = b64url(
    JSON.stringify({
      sub,
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
    })
  );
  const sig = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export interface AdminSession {
  sub: string;
  expiresAt: number;
}

export function verifyAdminSession(token: string): AdminSession | null {
  const secret = signingSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  const actual =
    sig.length === expected.toString("base64url").length
      ? Buffer.from(sig, "base64url")
      : null;
  if (!actual || actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { sub?: unknown; exp?: unknown };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return { sub: data.sub, expiresAt: data.exp };
  } catch {
    return null;
  }
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

/** True when the request carries a live admin session cookie. */
export function isAdminRequest(request: Request): boolean {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return false;
  return verifyAdminSession(token) !== null;
}
