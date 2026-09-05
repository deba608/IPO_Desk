-- Deduplicate signed-in owners' alerts the same way device alerts are deduped.
-- Safe on existing data: userId has only ever been NULL (no auth before),
-- and Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX "Alert_userId_ipoId_trigger_key" ON "Alert"("userId", "ipoId", "trigger");
