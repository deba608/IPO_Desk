-- One alert per device × IPO × trigger. Nullable columns stay nullable for
-- legacy rows (Postgres treats NULLs as distinct, so existing data migrates).
CREATE UNIQUE INDEX "Alert_deviceId_ipoId_trigger_key" ON "Alert"("deviceId", "ipoId", "trigger");
