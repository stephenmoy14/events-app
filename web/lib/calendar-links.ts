import { SOURCE_NAMES } from "./categories";
import { isAllDay } from "./dates";
import type { EventRow } from "./events";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20261120T010000Z
const ymd = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso))
    .replace(/-/g, "");

/** Start and end for calendars; events without an end get two hours. */
function span(e: EventRow): { allDay: boolean; start: Date; end: Date } {
  const start = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 2 * 3600_000);
  return { allDay: isAllDay(e.start_at, e.end_at), start, end };
}

function nextDay(yyyymmdd: string): string {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

const place = (e: EventRow) => [e.venue_name, e.neighborhood ? `${e.neighborhood}, Chicago` : "Chicago"].filter(Boolean).join(", ");
const details = (e: EventRow, pageUrl: string) =>
  `Details and tickets: ${e.url}\n(via ${SOURCE_NAMES[e.source_name] ?? e.source_name})\n\nFound on ${pageUrl}`;

export function googleCalendarUrl(e: EventRow, pageUrl: string): string {
  const { allDay, start, end } = span(e);
  const dates = allDay ? `${ymd(e.start_at)}/${nextDay(ymd(e.start_at))}` : `${stamp(start)}/${stamp(end)}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: details(e, pageUrl), location: place(e) });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Lines longer than 75 bytes are folded, per the calendar file format.
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function icsFile(e: EventRow, pageUrl: string): string {
  const { allDay, start, end } = span(e);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chicago Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@chicago-events`,
    `DTSTAMP:${stamp(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${ymd(e.start_at)}` : `DTSTART:${stamp(start)}`,
    allDay ? `DTEND;VALUE=DATE:${nextDay(ymd(e.start_at))}` : `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(place(e))}`,
    `URL:${e.url}`,
    `DESCRIPTION:${esc(details(e, pageUrl))}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
