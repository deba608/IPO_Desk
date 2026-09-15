// Per-IPO × account mandate tracker. localStorage only — never sent to server.

export type ApplyStatus =
  | "not-started"
  | "applied"
  | "upi-pending"
  | "upi-approved"
  | "done"
  | "skipped";

export const APPLY_STATUSES: { key: ApplyStatus; label: string }[] = [
  { key: "not-started", label: "Not started" },
  { key: "applied", label: "Applied in broker" },
  { key: "upi-pending", label: "UPI pending" },
  { key: "upi-approved", label: "UPI approved" },
  { key: "done", label: "Done" },
  { key: "skipped", label: "Skipped" },
];

const STORAGE_KEY = "ipodesk:apply-status";
const CHANGE_EVENT = "ipodesk:apply-status-change";

function key(ipoId: string, accountId: string): string {
  return `${ipoId}::${accountId}`;
}

function readStore(): Record<string, ApplyStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getApplyStatus(ipoId: string, accountId: string): ApplyStatus {
  if (typeof window === "undefined") return "not-started";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const v = parsed?.[key(ipoId, accountId)];
    return typeof v === "string" ? (v as ApplyStatus) : "not-started";
  } catch {
    return "not-started";
  }
}

export function setApplyStatus(ipoId: string, accountId: string, status: ApplyStatus): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readStore(), [key(ipoId, accountId)]: status };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function subscribeApplyStatus(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
