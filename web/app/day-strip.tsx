import Link from "next/link";
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
  // Jump to the top of the list (the strip stays pinned there).
  const go = (d: string) => hrefWith(f, { day: d, limit: PAGE_SIZE }, "#events");
  return (
    <nav className="strip" aria-label="Choose a day">
      {prev ? (
        <Link className="arrow" href={go(prev)} aria-label={`Previous day, ${long.format(chicagoMidnight(prev))}`}>‹</Link>
      ) : (
        <span className="arrow off" aria-hidden="true">‹</span>
      )}
      <ol className="stops" id="stops">
        {days.map((d) => {
          const n = counts[d] ?? 0;
          const current = d === day;
          return (
            <li key={d}>
              <Link
                href={go(d)}
                className={current ? "current" : undefined}
                aria-current={current ? "date" : undefined}
                aria-label={`${long.format(chicagoMidnight(d))}: ${n} ${n === 1 ? "event" : "events"}`}
              >
                <span className="wk">{d === today ? "Today" : short.format(chicagoMidnight(d))}</span>
                <span className="node" aria-hidden="true">{d === today ? <Star size={18} /> : null}</span>
                <span className="num">{dayNum(d)}</span>
                {Object.keys(counts).length ? <span className="n">{n.toLocaleString("en-US")}</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
      {next ? (
        <Link className="arrow" href={go(next)} aria-label={`Next day, ${long.format(chicagoMidnight(next))}`}>›</Link>
      ) : (
        <span className="arrow off" aria-hidden="true">›</span>
      )}
      <ScrollToCurrent listId="stops" />
    </nav>
  );
}

export function DayPager({ f, days, day, today }: { f: Filters; days: string[]; day: string; today: string }) {
  const i = days.indexOf(day);
  const next = i < days.length - 1 ? days[i + 1] : null;
  if (!next) return null;
  return (
    <nav className="pager" aria-label="Next day">
      <Link href={hrefWith(f, { day: next, limit: PAGE_SIZE }, "#events")} rel="next">
        Next day: {dayLabel(next, today)} ›
      </Link>
    </nav>
  );
}
