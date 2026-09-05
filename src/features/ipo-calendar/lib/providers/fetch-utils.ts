// Shared fetch wrapper for calendar providers: every upstream call gets a
// hard timeout so one stalled source can never hang the catalogue load.

const DEFAULT_TIMEOUT_MS = 10_000;

export function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  ms: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
