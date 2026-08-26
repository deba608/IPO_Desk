// src/lib/server-secret.ts
import { timingSafeEqual } from "crypto";

/** Constant-time comparison of two secrets; false when either is missing. */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected) return false;
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Extract a Bearer token from an Authorization header value. */
export function bearerToken(authHeader: string | null): string | null {
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
