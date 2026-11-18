import Link from "next/link";
import { addDays, chicagoMidnight, TZ, weekday } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE, WINDOW_DAYS } from "@/lib/events";

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const boxDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

/**
 * Range picker for "Custom": tap a start date, then an end date. Each date shows how many
 * events it has. Folds into a one-line summary once both dates are picked. Works without
 * JavaScript: every date is a link to the next state of the range.
 */
export function RangeCalendar({ f, today, range, counts }: {
  f: Filters; today: string; range: [string, string]; counts: Record<string, number>;
}) {
  const last = addDays(today, WINDOW_DAYS - 1);
  const [start, endExcl] = range;
  const end = addDays(endExcl, -1);
  const choosingEnd = f.pick && !!f.from;
  const picked = !!f.from && !choosingEnd;
  const max = Math.max(1, ...Object.values(counts));
  const hasCounts = Object.keys(counts).length > 0;
  const months: string[] = [];
  for (let m = today.slice(0, 7); m <= last.slice(0, 7); m = nextMonth(m)) months.push(m);

  const set = (from: string, to: string, pick = false) => hrefWith(f, { from, to, pick, day: null, limit: PAGE_SIZE });
  const linkFor = (d: string) => (choosingEnd && d >= start ? set(start, d) : set(d, d, true));
  const shortcuts = rangeShortcuts(today, last);

  return (
    <details className="calendar" open={!picked} aria-label="Choose dates">
      <summary className="cal-boxes">
        <span className={`box ${!f.from || !choosingEnd ? (picked ? "" : "active") : ""}`}>
          <small>From</small>
          {f.from ? boxDay.format(chicagoMidnight(start)) : "Pick a date"}
        </span>
        <span className="arrow-to" aria-hidden="true">→</span>
        <span className={`box ${choosingEnd ? "active" : ""}`}>
          <small>To</small>
          {picked ? boxDay.format(chicagoMidnight(end)) : choosingEnd ? "Pick a date" : "–"}
        </span>
        {picked ? <span className="change">Change</span> : null}
      </summary>

      <p className="cal-status" aria-live="polite">
        {!f.from ? "Tap the first day you’re free." : choosingEnd ? "Now tap the last day (or the same day again)." : "Tap any date to start a new range."}
      </p>

      {shortcuts.length ? (
        <div className="cal-shortcuts">
          {shortcuts.map((s) => (
            <Link key={s.label} scroll={false} href={set(s.from, s.to)} className="pill-link">{s.label}</Link>
          ))}
        </div>
      ) : null}

      {months.map((m) => (
        <table key={m} className="month">
          <caption>{monthName.format(new Date(`${m}-01T12:00:00Z`))}</caption>
          <thead>
            <tr>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                <th key={w} scope="col" abbr={w}>{w[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks(m).map((week, wi) => (
              <tr key={wi}>
                {week.map((d, di) => {
                  if (!d) return <td key={di} />;
                  const inWindow = d >= today && d <= last;
                  const n = counts[d] ?? 0;
                  const inRange = !!f.from && d >= start && d <= end;
                  const level = n === 0 ? 0 : n / max > 0.66 ? 3 : n / max > 0.33 ? 2 : 1;
                  const cls = [
                    `busy${level}`,
                    inRange ? "in" : "",
                    inRange && d === start ? "start" : "",
                    inRange && d === end ? "end" : "",
                    d === today ? "today" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <td key={di} className={inWindow ? cls : undefined}>
                      {inWindow ? (
                        <Link
                          scroll={false}
                          href={linkFor(d)}
                          aria-label={`${longDay.format(chicagoMidnight(d))}${hasCounts ? `: ${n} ${n === 1 ? "event" : "events"}` : ""}`}
                          aria-pressed={inRange || undefined}
                        >
                          <span className="dn">{Number(d.slice(8))}</span>
                          {hasCounts ? <span className="cn">{n}</span> : null}
                        </Link>
                      ) : (
                        <span className="dn out">{Number(d.slice(8))}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {hasCounts ? <p className="cal-note">Numbers are events that day with your other filters. Darker days are busier.</p> : null}
    </details>
  );
}

/** Handy ranges inside the window: weekends, next week, and holidays when they're in reach. */
function rangeShortcuts(today: string, last: string): { label: string; from: string; to: string }[] {
  const out: { label: string; from: string; to: string }[] = [];
  const wd = weekday(today);
  const fri = addDays(today, (5 - wd + 7) % 7);
  const thisWeekendStart = wd === 6 || wd === 0 ? today : fri;
  const thisWeekendEnd = wd === 0 ? today : wd === 6 ? addDays(today, 1) : addDays(fri, 2);
  out.push({ label: "This weekend", from: thisWeekendStart, to: thisWeekendEnd });
  const nextFri = wd === 6 || wd === 0 ? addDays(fri, 0) : addDays(fri, 7);
  out.push({ label: "Next weekend", from: nextFri, to: addDays(nextFri, 2) });
  const nextMon = addDays(today, ((1 - wd + 7) % 7) || 7);
  out.push({ label: "Next week", from: nextMon, to: addDays(nextMon, 6) });

  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const nov1 = weekday(`${y}-11-01`);
    const thanksgiving = addDays(`${y}-11-01`, ((4 - nov1 + 7) % 7) + 21);
    out.push({ label: "Thanksgiving weekend", from: thanksgiving, to: addDays(thanksgiving, 3) });
    out.push({ label: "Christmas", from: `${y}-12-24`, to: `${y}-12-26` });
    out.push({ label: "New Year’s Eve", from: `${y}-12-31`, to: `${y + 1}-01-01` });
  }
  const seen = new Set<string>();
  return out.filter((s) => s.to >= today && s.from <= last && s.to <= last && !seen.has(s.label) && seen.add(s.label))
    .map((s) => ({ ...s, from: s.from < today ? today : s.from }));
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Weeks of a month as arrays of 7 YYYY-MM-DD (or null for padding). */
function weeks(ym: string): (string | null)[][] {
  const [y, m] = ym.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= len; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const out: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}
