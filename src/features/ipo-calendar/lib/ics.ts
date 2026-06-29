// src/features/ipo-calendar/lib/ics.ts
// Builds calendar artifacts (ICS file + Google Calendar links) for an IPO's key
// dates so users can add reminders. All events are all-day in the user's local
// calendar; dates are the IST yyyy-mm-dd values from the catalogue.

import { CalendarIPO } from "@/types/calendar.types";

export interface IpoEvent {
  /** yyyy-mm-dd */
  date: string;
  title: string;
  description: string;
}

/** The set of dated milestones an IPO exposes, in chronological order. */
export function ipoEvents(ipo: CalendarIPO): IpoEvent[] {
  const events: IpoEvent[] = [
    { date: ipo.openDate, title: `${ipo.name} IPO opens`, description: `Subscription opens for ${ipo.name}.` },
    { date: ipo.closeDate, title: `${ipo.name} IPO closes`, description: `Last day to apply for ${ipo.name}.` },
  ];
  if (ipo.allotmentDate)
    events.push({ date: ipo.allotmentDate, title: `${ipo.name} allotment`, description: `Allotment finalised for ${ipo.name}.` });
  if (ipo.listingDate)
    events.push({ date: ipo.listingDate, title: `${ipo.name} lists`, description: `${ipo.name} lists on ${ipo.exchanges.join("/")}.` });
  return events;
}

/** "2026-06-30" → "20260630" (ICS DATE form). */
function compact(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Next calendar day in compact form — ICS all-day DTEND is exclusive. */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return compact(d.toISOString().slice(0, 10));
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** A full VCALENDAR string with one all-day VEVENT per milestone. */
export function buildIcs(ipo: CalendarIPO): string {
  const events = ipoEvents(ipo);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IPO Desk//Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  events.forEach((ev, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ipo.id}-${i}@ipodesk`,
      `DTSTAMP:${compact(ev.date)}T000000Z`,
      `DTSTART;VALUE=DATE:${compact(ev.date)}`,
      `DTEND;VALUE=DATE:${nextDay(ev.date)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      `DESCRIPTION:${escapeText(ev.description)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  // ICS lines must be CRLF-delimited.
  return lines.join("\r\n");
}

/** Google Calendar "add event" URL for a single milestone (all-day). */
export function googleCalendarUrl(ev: IpoEvent): string {
  const dates = `${compact(ev.date)}/${nextDay(ev.date)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    details: ev.description,
    dates,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
