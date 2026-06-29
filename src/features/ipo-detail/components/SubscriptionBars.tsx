import { Subscription } from "@/types/calendar.types";

const CATEGORIES: { key: keyof Subscription; label: string }[] = [
  { key: "qib", label: "QIB" },
  { key: "nii", label: "NII / HNI" },
  { key: "retail", label: "Retail" },
  { key: "total", label: "Total" },
];

/** Horizontal bars for subscription multiples; bar width caps at 50× for scale. */
export function SubscriptionBars({ subscription }: { subscription: Subscription }) {
  return (
    <div className="space-y-3">
      {CATEGORIES.map(({ key, label }) => {
        const value = subscription[key];
        if (typeof value !== "number") return null;
        const pct = Math.min(100, (value / 50) * 100);
        const isTotal = key === "total";
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={isTotal ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
              <span className={isTotal ? "font-semibold text-primary" : "font-medium text-foreground"}>
                {value}×
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={isTotal ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-emerald-500/70"}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
