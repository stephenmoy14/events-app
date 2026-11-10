import { addDays, chicagoMidnight, TZ } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE, WINDOW_DAYS } from "@/lib/events";

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

/**
 * Range picker for "Custom": tap a start date, then an end date. Works without JavaScript —
 * every date is a link that sets the next state of the range. Dots show how busy each day is.
 */
export function RangeCalendar({ f, today, range, counts }: {
  f: Filters; today: string; range: [string, string]; counts: Record<string, number>;
}) {
  const last = addDays(today, WINDOW_DAYS - 1);
  const [start, endExcl] = range;
  const end = addDays(endExcl, -1);
  const choosingEnd = f.pick && !!f.from;
  const max = Math.max(1, ...Object.values(counts));
  const hasCounts = Object.keys(counts).length > 0;
  const months: string[] = [];
  for (let m = today.slice(0, 7); m <= last.slice(0, 7); m = nextMonth(m)) months.push(m);

  const linkFor = (d: string) =>
    choosingEnd && d >= start
      ? hrefWith(f, { from: start, to: d, pick: false, day: null, limit: PAGE_SIZE })
      : hrefWith(f, { from: d, to: d, pick: true, day: null, limit: PAGE_SIZE });

  return (
    <div className="calendar" aria-label="Choose dates">
      <p className="cal-status" aria-live="polite">
        {!f.from
          ? "Tap a start date."
          : choosingEnd
            ? `From ${shortDay.format(chicagoMidnight(start))}. Now tap an end date.`
            : `${shortDay.format(chicagoMidnight(start))}${end !== start ? ` to ${shortDay.format(chicagoMidnight(end))}` : ""}. Tap a date to start over.`}
      </p>
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
                  const picked = !!f.from && d >= start && d <= end;
                  const cls = [
                    picked ? "in" : "",
                    picked && d === start ? "start" : "",
                    picked && d === end ? "end" : "",
                    d === today ? "today" : "",
                  ].filter(Boolean).join(" ");
                  const level = n === 0 ? 0 : n / max > 0.66 ? 3 : n / max > 0.33 ? 2 : 1;
                  return (
                    <td key={di} className={cls || undefined}>
                      {inWindow ? (
                        <a
                          href={linkFor(d)}
                          aria-label={`${longDay.format(chicagoMidnight(d))}${hasCounts ? `: ${n} ${n === 1 ? "event" : "events"}` : ""}`}
                          aria-pressed={picked || undefined}
                        >
                          <span className="dn">{Number(d.slice(8))}</span>
                          <span className={`busy l${level}`} aria-hidden="true" />
                        </a>
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
      {hasCounts ? <p className="cal-note">Dots show how busy each day is with your current filters.</p> : null}
    </div>
  );
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
