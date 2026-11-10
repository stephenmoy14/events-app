import { category, SOURCE_NAMES } from "@/lib/categories";
import { chicagoDate, dayHeading, formatTime, isAllDay, WHEN_OPTIONS } from "@/lib/dates";
import { type EventRow, type Filters, getEvents, getNeighborhoods, LoadError, PAGE_SIZE, parseFilters } from "@/lib/events";
import { FilterForm } from "./filters";
import { Star } from "./star";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  let listing: Awaited<ReturnType<typeof getEvents>>;
  let neighborhoods: string[];
  try {
    [listing, neighborhoods] = await Promise.all([getEvents(filters), getNeighborhoods()]);
  } catch (err) {
    return <LoadFailed err={err} />;
  }
  const days = groupByDay(listing.events, listing.from);
  const whenLabel = WHEN_OPTIONS.find((w) => w.key === filters.when)!.label.toLowerCase();

  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          <span className="city">Chicago</span>
          <span className="span">next 30 days</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
        <p className="summary" aria-live="polite">
          {listing.total.toLocaleString("en-US")} {listing.total === 1 ? "event" : "events"} {phrase(filters.when, whenLabel)}
          {filters.neighborhood ? ` in ${filters.neighborhood}` : ""}
          {filters.q ? ` matching “${filters.q}”` : ""}
        </p>
        {listing.sample ? (
          <p className="notice">Showing built-in sample events. Set SUPABASE_URL and SUPABASE_ANON_KEY to load real listings.</p>
        ) : null}
      </header>

      <aside className="sidebar">
        <FilterForm filters={filters} neighborhoods={neighborhoods} />
      </aside>

      <main className="line" id="events">
        {days.length === 0 ? (
          <div className="empty">
            <h2>Nothing matches these filters</h2>
            <p>Try a longer time range, fewer categories, or a different neighborhood.</p>
            <a href={`/?when=month`}>Show everything in the next 30 days</a>
          </div>
        ) : (
          days.map(([ymd, events]) => <Day key={ymd} ymd={ymd} today={listing.today} events={events} />)
        )}

        {listing.events.length < listing.total ? (
          <div className="more">
            <a href={moreHref(filters, `ev-${listing.events[listing.events.length - 1]?.id}`)}>
              Show {Math.min(PAGE_SIZE, listing.total - listing.events.length)} more
            </a>
            <span>
              {listing.events.length.toLocaleString("en-US")} of {listing.total.toLocaleString("en-US")} shown
            </span>
          </div>
        ) : null}
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

function phrase(when: Filters["when"], label: string) {
  if (when === "today") return "today";
  if (when === "weekend") return "this weekend";
  return `in the ${label}`; // "in the next 7 days"
}

function moreHref(f: Filters, anchor: string) {
  const p = new URLSearchParams();
  p.set("when", f.when);
  f.categories.forEach((c) => p.append("cat", c));
  if (f.free) p.set("free", "1");
  if (f.neighborhood) p.set("hood", f.neighborhood);
  if (f.q) p.set("q", f.q);
  p.set("limit", String(f.limit + PAGE_SIZE));
  return `/?${p}#${anchor}`;
}

function groupByDay(events: EventRow[], from: string): [string, EventRow[]][] {
  const map = new Map<string, EventRow[]>();
  for (const e of events) {
    const d = chicagoDate(new Date(e.start_at));
    const key = d < from ? from : d; // something already under way sits on the first day
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(isAllDay(b.start_at, b.end_at)) - Number(isAllDay(a.start_at, a.end_at)) || a.start_at.localeCompare(b.start_at));
  }
  return [...map.entries()];
}

function Day({ ymd, today, events }: { ymd: string; today: string; events: EventRow[] }) {
  const { name, date } = dayHeading(ymd, today);
  const isToday = ymd === today;
  return (
    <section className={isToday ? "stop today" : "stop"} aria-labelledby={`d-${ymd}`}>
      <h2 id={`d-${ymd}`}>
        <span className="marker" aria-hidden="true">{isToday ? <Star /> : null}</span>
        <span className="day">{name}</span>
        <span className="date">{date}</span>
      </h2>
      <ul className="events">
        {events.map((e) => (
          <EventItem key={e.id} e={e} />
        ))}
      </ul>
    </section>
  );
}

function EventItem({ e }: { e: EventRow }) {
  const cat = category(e.category_group);
  const allDay = isAllDay(e.start_at, e.end_at);
  const where = [e.venue_name, e.neighborhood && !e.venue_name?.includes(e.neighborhood) ? e.neighborhood : null]
    .filter(Boolean)
    .join(", ");
  const price = priceText(e);
  return (
    <li className="event" id={`ev-${e.id}`}>
      <time className="time" dateTime={e.start_at}>{allDay ? "All day" : formatTime(e.start_at)}</time>
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
      <main className="line">
        <div className="empty">
          <h2>Events didn’t load</h2>
          <p>{known ? err.message : "The event database didn’t answer."}</p>
          <p>{known ? err.hint : "This usually clears up within a minute. Reload the page to try again."}</p>
        </div>
      </main>
    </div>
  );
}
