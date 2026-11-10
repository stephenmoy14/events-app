import { addDays, chicagoMidnight, TZ } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE } from "@/lib/events";
import { ScrollToCurrent } from "./scroll-to-current";
import { Star } from "./star";

const short = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const long = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const dayNum = (ymd: string) => String(Number(ymd.slice(8)));

export function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  return long.format(chicagoMidnight(ymd)).split(",")[0];
}

/** The range drawn as a stretch of 'L' line: each day is a stop with its event count. */
export function DayStrip({ f, days, day, today, counts }: {
  f: Filters; days: string[]; day: string; today: string; counts: Record<string, number>;
}) {
  if (days.length < 2) return null;
  const i = days.indexOf(day);
  const prev = i > 0 ? days[i - 1] : null;
  const next = i < days.length - 1 ? days[i + 1] : null;
  const go = (d: string) => hrefWith(f, { day: d, limit: PAGE_SIZE });
  return (
    <nav className="strip" aria-label="Choose a day">
      {prev ? (
        <a className="arrow" href={go(prev)} aria-label={`Previous day, ${long.format(chicagoMidnight(prev))}`}>‹</a>
      ) : (
        <span className="arrow off" aria-hidden="true">‹</span>
      )}
      <ol className="stops" id="stops">
        {days.map((d) => {
          const n = counts[d] ?? 0;
          const current = d === day;
          return (
            <li key={d}>
              <a
                href={go(d)}
                className={current ? "current" : undefined}
                aria-current={current ? "date" : undefined}
                aria-label={`${long.format(chicagoMidnight(d))}: ${n} ${n === 1 ? "event" : "events"}`}
              >
                <span className="wk">{d === today ? "Today" : short.format(chicagoMidnight(d))}</span>
                <span className="node" aria-hidden="true">{d === today ? <Star size={18} /> : null}</span>
                <span className="num">{dayNum(d)}</span>
                {Object.keys(counts).length ? <span className="n">{n.toLocaleString("en-US")}</span> : null}
              </a>
            </li>
          );
        })}
      </ol>
      {next ? (
        <a className="arrow" href={go(next)} aria-label={`Next day, ${long.format(chicagoMidnight(next))}`}>›</a>
      ) : (
        <span className="arrow off" aria-hidden="true">›</span>
      )}
      <ScrollToCurrent listId="stops" />
    </nav>
  );
}

export function DayPager({ f, days, day, today }: { f: Filters; days: string[]; day: string; today: string }) {
  const i = days.indexOf(day);
  const prev = i > 0 ? days[i - 1] : null;
  const next = i < days.length - 1 ? days[i + 1] : null;
  if (!prev && !next) return null;
  const go = (d: string) => hrefWith(f, { day: d, limit: PAGE_SIZE });
  return (
    <nav className="pager" aria-label="Previous and next day">
      {prev ? <a href={go(prev)} rel="prev">‹ {dayLabel(prev, today)}</a> : <span />}
      {next ? <a href={go(next)} rel="next">{dayLabel(next, today)} ›</a> : <span />}
    </nav>
  );
}
