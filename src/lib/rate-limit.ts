// src/lib/rate-limit.ts
// Simple in-memory fixed-window limiter. Adequate for a single instance;
// swap for Upstash Redis / Vercel KV when running multi-instance or
// serverless (each isolate has its own Map, so limits are per-instance).
// Callers MUST namespace keys per route (e.g. `otp-request:<ip>`) so
// unrelated endpoints never share a bucket.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Expired keys are deleted lazily on access, plus a periodic sweep so IPs
// that stop sending requests don't leak memory forever.
const SWEEP_INTERVAL_MS = 60 * 1000;
let lastSweepAt = 0;

function sweepExpired(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function isRateLimited(
  key: string,
  limit: number,
  windowMs = 60 * 1000
): boolean {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (bucket.count >= limit) return true;

  bucket.count++;
  return false;
}

/**
 * Best-effort client key. Trust platform-set headers first
 * (cf-connecting-ip, true-client-ip, x-real-ip, x-vercel-forwarded-for);
 * x-forwarded-for leftmost is client-spoofable unless every proxy in front
 * sanitizes it, so it is only a last resort. Returns "unknown" when no IP
 * is present — callers must still namespace keys per route.
 */
export function getClientKey(request: Request): string {
  const direct =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("true-client-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.trim();
  if (direct) return direct;
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || "unknown";
}
