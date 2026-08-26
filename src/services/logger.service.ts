// src/services/logger.service.ts
// Lightweight structured logging for sync + allotment monitoring.
// Keeps a bounded in-memory ring buffer (inspectable via /api/logs) and
// mirrors everything to console for platform log drains (Vercel, etc.).

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "ipo_sync_success"
  | "ipo_sync_failure"
  | "ipo_sync_fallback"
  | "ipo_sync_empty"
  | "pan_check_success"
  | "pan_check_failure"
  | "api_response_time";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: LogEvent;
  message: string;
  durationMs?: number;
  meta?: Record<string, string | number | boolean>;
}

const MAX_LOG_ENTRIES = 1000;

// Survive module duplication across Next.js route bundles
const globalStore = globalThis as unknown as { __ipoLogs?: LogEntry[] };
globalStore.__ipoLogs = globalStore.__ipoLogs ?? [];

export function log(
  level: LogLevel,
  event: LogEvent,
  message: string,
  extra?: { durationMs?: number; meta?: Record<string, string | number | boolean> }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    ...extra,
  };

  const buffer = globalStore.__ipoLogs!;
  buffer.push(entry);
  if (buffer.length > MAX_LOG_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_LOG_ENTRIES);
  }

  const line = `[${entry.timestamp}] [${event}] ${message}${
    extra?.durationMs !== undefined ? ` (${extra.durationMs}ms)` : ""
  }`;
  if (level === "error") console.error(line, extra?.meta ?? "");
  else if (level === "warn") console.warn(line, extra?.meta ?? "");
  else console.log(line, extra?.meta ?? "");
}

export function getLogs(event?: LogEvent, limit = 200): LogEntry[] {
  const buffer = globalStore.__ipoLogs!;
  const filtered = event ? buffer.filter((e) => e.event === event) : buffer;
  return filtered.slice(-limit);
}
