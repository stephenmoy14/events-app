export const TZ = "America/Chicago";

/** YYYY-MM-DD for an instant, in Chicago. */
export function chicagoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Minutes east of UTC for Chicago at a given instant (-300 or -360). */
function chicagoOffsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-06:00";
  const m = parts.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return -360;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** The UTC instant of local midnight at the start of a Chicago date (YYYY-MM-DD). */
export function chicagoMidnight(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, 6));            // ~midnight Chicago
  const offset = chicagoOffsetMinutes(guess);
  return new Date(Date.UTC(y, mo - 1, d) - offset * 60_000);
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD. */
export function weekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WHEN_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
  { key: "week", label: "Next 7 days" },
  { key: "month", label: "Next 30 days" },
  { key: "custom", label: "Custom" },
] as const;
export type When = (typeof WHEN_OPTIONS)[number]["key"];

/** Time-of-day choices, by local start hour. */
export const TIME_OPTIONS = [
  { key: "morning", label: "Morning", hint: "before noon", hours: [5, 6, 7, 8, 9, 10, 11] },
  { key: "afternoon", label: "Afternoon", hint: "noon–5pm", hours: [12, 13, 14, 15, 16] },
  { key: "evening", label: "Evening", hint: "5–9pm", hours: [17, 18, 19, 20] },
  { key: "night", label: "Late night", hint: "after 9pm", hours: [21, 22, 23, 0, 1, 2, 3, 4] },
] as const;
export type TimeKey = (typeof TIME_OPTIONS)[number]["key"];

export const PRICE_OPTIONS = [
  { key: "any", label: "Any price" },
  { key: "free", label: "Free" },
  { key: "20", label: "Under $20" },
  { key: "50", label: "Under $50" },
] as const;
export type PriceKey = (typeof PRICE_OPTIONS)[number]["key"];

/** [first day, day after last] as Chicago dates for a "when" choice. */
export function rangeFor(when: When, today: string, custom?: { from: string | null; to: string | null }): [string, string] {
  switch (when) {
    case "custom": {
      const last = addDays(today, 30);
      const clamp = (d: string) => (d < today ? today : d > last ? last : d);
      const from = clamp(custom?.from ?? today);
      const to = clamp(custom?.to && custom.to >= from ? custom.to : from);
      return [from, addDays(to, 1)];
    }
    case "today":
      return [today, addDays(today, 1)];
    case "weekend": {
      const wd = weekday(today);
      if (wd === 0) return [today, addDays(today, 1)];               // Sunday: just today
      if (wd === 6) return [today, addDays(today, 2)];               // Saturday: Sat–Sun
      return [addDays(today, 5 - wd), addDays(today, 8 - wd)];       // Fri–Sun ahead
    }
    case "week":
      return [today, addDays(today, 7)];
    case "month":
      return [today, addDays(today, 30)];
  }
}

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso)).replace(":00", "").replace(" AM", "am").replace(" PM", "pm");
}

/** All-day listings start at local midnight and last most of a day. */
export function isAllDay(startIso: string, endIso: string | null): boolean {
  const start = new Date(startIso);
  const local = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
  if (local !== "00:00") return false;
  return !endIso || new Date(endIso).getTime() - start.getTime() >= 20 * 3600_000;
}

export function dayHeading(ymd: string, today: string): { name: string; date: string } {
  const d = chicagoMidnight(ymd);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" }).format(d);
  if (ymd === today) return { name: "Today", date };
  if (ymd === addDays(today, 1)) return { name: "Tomorrow", date };
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(d);
  return { name, date };
}
