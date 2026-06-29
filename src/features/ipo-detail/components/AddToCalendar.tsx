"use client";

// AddToCalendar — lets the user download an .ics with all of an IPO's dated
// milestones, or add the most relevant single date to Google Calendar.

import { useState } from "react";
import { CalendarPlus, Download, Check } from "lucide-react";
import { CalendarIPO } from "@/types/calendar.types";
import { buildIcs, ipoEvents, googleCalendarUrl } from "@/features/ipo-calendar/lib/ics";
import { cn } from "@/lib/utils";

export function AddToCalendar({ ipo }: { ipo: CalendarIPO }) {
  const [downloaded, setDownloaded] = useState(false);
  const events = ipoEvents(ipo);
  // Prefer the allotment date for the quick Google link, else the open date.
  const primary =
    events.find((e) => e.title.includes("allotment")) ?? events[0];

  const handleDownload = () => {
    const blob = new Blob([buildIcs(ipo)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ipo.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
        <CalendarPlus className="h-4 w-4 text-primary" /> Add to calendar
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Never miss the open, close, allotment or listing date.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            downloaded
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-border hover:border-primary/50 hover:text-primary"
          )}
        >
          {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {downloaded ? "Downloaded" : "Download .ics"}
        </button>
        <a
          href={googleCalendarUrl(primary)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
        >
          <CalendarPlus className="h-4 w-4" /> Google Calendar
        </a>
      </div>
    </div>
  );
}
