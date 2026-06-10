// src/instrumentation.ts
// Next.js instrumentation hook — runs once on server startup.
// Warms the IPO cache so the first visitor gets an instant dropdown.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncActiveIPOs } = await import("@/services/kfintech-sync");
    // Fire-and-forget: failures are logged and retried on first request
    syncActiveIPOs().catch(() => {});
  }
}
