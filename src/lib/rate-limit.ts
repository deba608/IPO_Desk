// src/lib/rate-limit.ts
// Simple in-memory fixed-window limiter. Adequate for a single instance;
// swap for Upstash Redis when running multi-instance.

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
 * Best-effort client key. x-real-ip is preferred because it is set by the
 * platform proxy; the leftmost x-forwarded-for entry is client-spoofable
 * unless every proxy in front sanitizes it.
 */
export function getClientKey(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
