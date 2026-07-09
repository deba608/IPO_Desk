"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, Download, Check, ExternalLink } from "lucide-react";
import { CalendarIPO } from "@/types/calendar.types";
import { buildIcs, ipoEvents, googleCalendarUrl } from "../lib/ics";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AddToCalendarButtonProps {
  ipo: CalendarIPO;
  variant?: "icon" | "full";
}

export function AddToCalendarButton({ ipo, variant = "icon" }: AddToCalendarButtonProps) {
  const [downloaded, setDownloaded] = useState(false);
  const events = ipoEvents(ipo);

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const blob = new Blob([buildIcs(ipo)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ipo.name.replace(/\s+/g, "_")}_IPO_Dates.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "full" ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>Reminders</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Add to Calendar"
            title="Add reminders to calendar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 bg-slate-900 border-slate-800 text-slate-100 p-3 shadow-xl"
        align="end"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <h4 className="text-xs font-semibold text-slate-400 mb-2 px-1">
          IPO Reminders for {ipo.name}
        </h4>
        <div className="flex flex-col gap-1">
          {/* Download ICS */}
          <button
            type="button"
            onClick={handleDownload}
            className={cn(
              "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left w-full",
              downloaded
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "hover:bg-slate-800/80 text-slate-300 hover:text-slate-100"
            )}
          >
            <span className="flex items-center gap-2">
              <Download className="h-3.5 w-3.5" />
              <span>{downloaded ? "Downloaded" : "Download .ics Calendar"}</span>
            </span>
            {downloaded && <Check className="h-3.5 w-3.5" />}
          </button>

          {/* Quick links to Google Calendar */}
          <div className="h-px bg-slate-800 my-1" />
          <p className="text-[10px] text-slate-500 font-semibold px-2 mb-1 uppercase tracking-wider">
            Add to Google Calendar
          </p>

          {events.map((ev, idx) => (
            <a
              key={idx}
              href={googleCalendarUrl(ev)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 transition-colors"
            >
              <span>{ev.title}</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
