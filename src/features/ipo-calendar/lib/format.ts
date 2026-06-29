// src/features/ipo-calendar/lib/format.ts
// Small display formatters shared by calendar components.

/** ₹2,100 Cr / ₹38.5 Cr */
export function formatCrore(cr: number): string {
  const value = cr >= 100 ? Math.round(cr).toLocaleString("en-IN") : cr.toString();
  return `₹${value} Cr`;
}

/** ₹1,23,456 — Indian digit grouping, no decimals */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** "22 Jun 2026" */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "22–24 Jun" when same month, else "28 May – 02 Jun" */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00+05:30`);
  const end = new Date(`${endISO}T00:00:00+05:30`);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(d);
  const dayMonth = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(d);

  return sameMonth
    ? `${day(start)}–${dayMonth(end)}`
    : `${dayMonth(start)} – ${dayMonth(end)}`;
}
