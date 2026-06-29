import { CheckCircle2, Circle } from "lucide-react";
import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { formatDate } from "@/features/ipo-calendar/lib/format";

/** Vertical issue timeline with past steps marked complete against IST "today". */
export function Timeline({ ipo, today }: { ipo: CalendarIPOWithStatus; today: string }) {
  const steps = [
    { label: "Issue Opens", date: ipo.openDate },
    { label: "Issue Closes", date: ipo.closeDate },
    { label: "Allotment", date: ipo.allotmentDate },
    { label: "Listing", date: ipo.listingDate },
  ].filter((s): s is { label: string; date: string } => Boolean(s.date));

  return (
    <ol className="relative space-y-5">
      {steps.map((step, i) => {
        const done = today >= step.date;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {!isLast && (
                <span className={done ? "mt-1 h-8 w-px bg-emerald-400/40" : "mt-1 h-8 w-px bg-border"} />
              )}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground">{formatDate(step.date)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
