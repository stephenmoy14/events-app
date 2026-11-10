import { addDays, chicagoMidnight, TZ } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE, WINDOW_DAYS } from "@/lib/events";
import { OpenOnWide } from "./open-on-wide";

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

/** Month grids for today .. today+30; each day shows how busy it is and links to it. */
export function Calendar({ f, today, day, days, counts }: {
  f: Filters; today: string; day: string; days: string[]; counts: Record<string, number>;
}) {
  const last = addDays(today, WINDOW_DAYS - 1);
  const max = Math.max(1, ...Object.values(counts));
  const hasCounts = Object.keys(counts).length > 0; // false before migration 0008
  const months: string[] = [];
  for (let m = today.slice(0, 7); m <= last.slice(0, 7); m = nextMonth(m)) months.push(m);

  return (
    <details className="calendar" id="calendar">
      <summary>Pick a date</summary>
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
                  const label = `${longDay.format(chicagoMidnight(d))}: ${n} ${n === 1 ? "event" : "events"}`;
                  const level = n === 0 ? 0 : n / max > 0.66 ? 3 : n / max > 0.33 ? 2 : 1;
                  const cls = [d === day ? "sel" : "", d === today ? "today" : ""].filter(Boolean).join(" ");
                  return (
                    <td key={di} className={cls || undefined}>
                      {inWindow && (n > 0 || !hasCounts) ? (
                        <a
                          href={hrefWith(f, { day: d, when: days.includes(d) ? f.when : "month", limit: PAGE_SIZE })}
                          aria-label={label}
                          aria-current={d === day ? "date" : undefined}
                        >
                          <span className="dn">{Number(d.slice(8))}</span>
                          <span className={`busy l${level}`} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className={inWindow ? "dn empty-day" : "dn out"} aria-label={inWindow ? label : undefined}>
                          {Number(d.slice(8))}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <p className="cal-note">Dots show how busy each day is with your current filters.</p>
      <OpenOnWide detailsId="calendar" />
    </details>
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
