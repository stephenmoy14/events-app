import { category, SOURCE_NAMES } from "@/lib/categories";
import { chicagoDate, chicagoMidnight, formatTime, isAllDay, TZ } from "@/lib/dates";
import { type DayView, type EventRow, type Filters, getDayView, getNeighborhoods, hrefWith, LoadError, PAGE_SIZE, parseFilters } from "@/lib/events";
import { Calendar } from "./calendar";
import { DayPager, DayStrip, dayLabel } from "./day-strip";
import { FilterForm } from "./filters";
import { Star } from "./star";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const longDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  let view: DayView;
  let neighborhoods: string[];
  try {
    [view, neighborhoods] = await Promise.all([getDayView(filters), getNeighborhoods()]);
  } catch (err) {
    return <LoadFailed err={err} />;
  }
  const { today, day, days, counts, events, total } = view;
  const dayStart = chicagoMidnight(day).toISOString();
  const ongoing = events.filter((e) => e.start_at < dayStart);
  const onDay = events.filter((e) => e.start_at >= dayStart);
  const name = dayLabel(day, today);

  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          <span className="city">Chicago</span>
          <span className="span">next 30 days</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
        <p className="summary" aria-live="polite">
          {total.toLocaleString("en-US")} {total === 1 ? "event" : "events"}
          {day === today ? " left today" : ` on ${name}, ${longDate.format(chicagoMidnight(day))}`}
          {filters.neighborhood ? ` in ${filters.neighborhood}` : ""}
          {filters.q ? ` matching “${filters.q}”` : ""}
        </p>
        {view.sample ? (
          <p className="notice">Showing built-in sample events. Set SUPABASE_URL and SUPABASE_ANON_KEY to load real listings.</p>
        ) : null}
      </header>

      <aside className="sidebar">
        <FilterForm filters={filters} day={day} neighborhoods={neighborhoods} />
        <Calendar f={filters} today={today} day={day} days={days} counts={counts} />
      </aside>

      <main className="line-area" id="events">
        <DayStrip f={filters} days={days} day={day} today={today} counts={counts} />

        <div className="line">
          <section className={day === today ? "stop today" : "stop"} aria-labelledby="day-heading">
            <h2 id="day-heading">
              <span className="marker" aria-hidden="true">{day === today ? <Star /> : null}</span>
              <span className="day">{name}</span>
              <span className="date">{longDate.format(chicagoMidnight(day))}</span>
            </h2>

            {events.length === 0 ? (
              <div className="empty">
                <h3>Nothing on {name.toLowerCase() === "today" ? "today" : name} with these filters</h3>
                <p>Pick another day above, or loosen the filters.</p>
                <a href={hrefWith(filters, { categories: [], free: false, neighborhood: "", q: "", limit: PAGE_SIZE })}>
                  Show everything on {name}
                </a>
              </div>
            ) : (
              <ul className="events">
                {sortForDay(onDay).map((e) => <EventItem key={e.id} e={e} />)}
              </ul>
            )}

            {ongoing.length > 0 ? (
              <>
                <h3 className="sub">Still running</h3>
                <ul className="events">
                  {ongoing.map((e) => <EventItem key={e.id} e={e} untilFor={day} />)}
                </ul>
              </>
            ) : null}
          </section>

          {events.length < total ? (
            <div className="more">
              <a href={hrefWith(filters, { day, limit: filters.limit + PAGE_SIZE }, `#ev-${events[events.length - 1]?.id}`)}>
                Show {Math.min(PAGE_SIZE, total - events.length)} more
              </a>
              <span>
                {events.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} shown
              </span>
            </div>
          ) : null}
        </div>

        <DayPager f={filters} days={days} day={day} today={today} />
      </main>

      <footer className="colophon">
        <p>
          Listings come from Ticketmaster, Eventbrite, the Chicago Public Library and Choose Chicago, refreshed every
          morning. Each event links to its original page for tickets and details.
        </p>
      </footer>
    </div>
  );
}

function sortForDay(list: EventRow[]) {
  // All-day listings first, then by start time.
  return [...list].sort(
    (a, b) => Number(isAllDay(b.start_at, b.end_at)) - Number(isAllDay(a.start_at, a.end_at)) || a.start_at.localeCompare(b.start_at),
  );
}

function EventItem({ e, untilFor }: { e: EventRow; untilFor?: string }) {
  const cat = category(e.category_group);
  const allDay = isAllDay(e.start_at, e.end_at);
  const where = [e.venue_name, e.neighborhood && !e.venue_name?.includes(e.neighborhood) ? e.neighborhood : null]
    .filter(Boolean)
    .join(", ");
  const price = priceText(e);
  let when = allDay ? "All day" : formatTime(e.start_at);
  if (untilFor && e.end_at) {
    // Started on an earlier day: show when it ends instead of when it began.
    const end = new Date(e.end_at);
    when = chicagoDate(end) === untilFor ? `Until ${formatTime(e.end_at)}` : `Until ${shortDate.format(end)}`;
  }
  return (
    <li className="event" id={`ev-${e.id}`}>
      <time className="time" dateTime={e.start_at}>{when}</time>
      <div className="body">
        <a className="title" href={e.url} target="_blank" rel="noopener noreferrer">
          {e.title}
        </a>
        {where ? <p className="where">{where}</p> : null}
        <p className="meta">
          <span className="cat">
            <i className="dot" style={{ background: cat.color }} aria-hidden="true" />
            {cat.label}
          </span>
          {price ? <span className={e.is_free ? "price free" : "price"}>{price}</span> : null}
          <span className="src">via {SOURCE_NAMES[e.source_name] ?? e.source_name}</span>
        </p>
      </div>
    </li>
  );
}

function priceText(e: EventRow): string | null {
  if (e.is_free) return "Free";
  const lo = e.price_min != null ? Number(e.price_min) : null;
  const hi = e.price_max != null ? Number(e.price_max) : null;
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi > lo) return `${fmt(lo)}–${fmt(hi)}`;
  return fmt((lo ?? hi)!);
}

function LoadFailed({ err }: { err: unknown }) {
  const known = err instanceof LoadError;
  return (
    <div className="shell">
      <main className="line-area">
        <div className="empty">
          <h2>Events didn’t load</h2>
          <p>{known ? err.message : "The event database didn’t answer."}</p>
          <p>{known ? err.hint : "This usually clears up within a minute. Reload the page to try again."}</p>
        </div>
      </main>
    </div>
  );
}
