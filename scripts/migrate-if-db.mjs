// scripts/migrate-if-db.mjs
// Apply pending Prisma migrations only when a database is configured.
// The app runs fine without a DB (in-memory fallback), so builds and
// environments without DATABASE_URL must not fail here — just skip.
//
// Usage: `node scripts/migrate-if-db.mjs` (build step, Docker CMD).

import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("[migrate-if-db] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.log("[migrate-if-db] DATABASE_URL is not postgres — skipping migrations.");
  process.exit(0);
}

try {
  execFileSync(
    process.execPath,
    ["./node_modules/prisma/build/index.js", "migrate", "deploy"],
    { stdio: "inherit" }
  );
  console.log("[migrate-if-db] Migrations applied.");
} catch {
  console.error("[migrate-if-db] `prisma migrate deploy` failed.");
  process.exit(1);
}
