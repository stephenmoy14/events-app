import { addDays, chicagoDate, chicagoMidnight, isAllDay, TZ } from "@/lib/dates";
import { type DayView, type EventRow, type Filters, getDayView, getNeighborhoods, hrefWith, LoadError, PAGE_SIZE, parseFilters } from "@/lib/events";
import { RangeCalendar } from "./calendar";
import { DayPager, DayStrip, dayLabel } from "./day-strip";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type Account, filtersQuery, getAccount } from "@/lib/account";
import { AccountBar } from "./account-bar";
import { SaveNudge } from "./account-extras";
import { EventItem } from "./event-item";
import { AppliedFilters } from "./applied";
import { FilterForm } from "./filters";
import { Star } from "./star";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const longDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" });

export default async function Page({ searchParams }: Props) {
  const raw = await searchParams;
  const account = await getAccount();
  // A bare visit opens with the signed-in person's default filters, if they saved some.
  if (account.defaultFilters && Object.keys(raw).length === 0) redirect(`/?${account.defaultFilters}`);

  const filters = parseFilters(raw);
  let view: DayView;
  let neighborhoods: string[];
  try {
    [view, neighborhoods] = await Promise.all([getDayView(filters), getNeighborhoods()]);
  } catch (err) {
    return <LoadFailed err={err} />;
  }
  const { today, day, days, counts, events, total, rangeTotal, searching } = view;
  const dayStart = chicagoMidnight(day).toISOString();
  const ongoing = events.filter((e) => e.start_at < dayStart);
  const onDay = events.filter((e) => e.start_at >= dayStart);
  const name = dayLabel(day, today);
  const here = hrefWith(filters, { day });
  const save = (id: string) => ({ signedIn: !!account.user, saved: account.savedIds.has(id), back: here });

  return (
    <div className="shell">
      <header className="masthead">
        <AccountBar user={account.user} savedCount={account.savedIds.size} back={here} />
        <h1>
          <span className="city">Chicago</span>
          <span className="span">next 30 days</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
        <p className="summary" aria-live="polite">
          {searching
            ? `${total.toLocaleString("en-US")} ${total === 1 ? "match" : "matches"} for “${filters.q}” ${rangePhrase(filters, days)}`
            : `${rangeTotal.toLocaleString("en-US")} ${rangeTotal === 1 ? "event" : "events"} ${rangePhrase(filters, days)}`}
        </p>
        {view.sample ? (
          <p className="notice">Showing built-in sample events. Set SUPABASE_URL and SUPABASE_ANON_KEY to load real listings.</p>
        ) : null}
      </header>

      <aside className="sidebar">
        <FilterForm
          filters={filters}
          total={rangeTotal}
          day={day}
          neighborhoods={neighborhoods}
          calendar={
            filters.when === "custom" ? (
              <RangeCalendar f={filters} today={today} range={[days[0], addDays(days[days.length - 1], 1)]} counts={counts} />
            ) : null
          }
        />
      </aside>

      <main className="line-area">
        <AppliedFilters f={filters} day={day} range={[days[0], days[days.length - 1]]}>
          <DefaultFilters account={account} filters={filters} here={here} />
        </AppliedFilters>
        <div id="events" className="events-anchor" />
        {searching ? (
          <SearchResults filters={filters} events={events} total={total} days={days} today={today} save={save} />
        ) : (
        <>
        <DayStrip f={filters} days={days} day={day} today={today} counts={counts} />

        <div className="line">
          <section className={day === today ? "stop today" : "stop"} aria-labelledby="day-heading">
            <h2 id="day-heading">
              <span className="marker" aria-hidden="true">{day === today ? <Star /> : null}</span>
              <span className="day">{name}</span>
              <span className="date">{longDate.format(chicagoMidnight(day))}</span>
              <span className="count">{total.toLocaleString("en-US")} {total === 1 ? "event" : "events"}</span>
            </h2>

            {events.length === 0 ? (
              <div className="empty">
                <h3>Nothing on {name.toLowerCase() === "today" ? "today" : name} with these filters</h3>
                <p>Pick another day above, or loosen the filters.</p>
                <Link scroll={false} href={hrefWith(filters, { day, categories: [], price: "any", times: [], weekendAny: false, neighborhoods: [], q: "", limit: PAGE_SIZE })}>
                  Show everything on {name}
                </Link>
              </div>
            ) : (
              <ul className="events">
                {sortForDay(onDay).map((e) => <EventItem key={e.id} e={e} save={save(e.id)} />)}
              </ul>
            )}

            {ongoing.length > 0 ? (
              <>
                <h3 className="sub">Still running</h3>
                <ul className="events">
                  {ongoing.map((e) => <EventItem key={e.id} e={e} untilFor={day} save={save(e.id)} />)}
                </ul>
              </>
            ) : null}
          </section>

          {events.length < total ? (
            <div className="more">
              <Link scroll={false} href={hrefWith(filters, { day, limit: filters.limit + PAGE_SIZE })}>
                Show {Math.min(PAGE_SIZE, total - events.length)} more
              </Link>
              <span>
                {events.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} shown
              </span>
            </div>
          ) : null}
        </div>

        <DayPager f={filters} days={days} day={day} today={today} />
        </>
        )}
      </main>

      {!account.user ? <SaveNudge next={here} /> : null}

      <footer className="colophon">
        <p>
          Listings come from Ticketmaster, Eventbrite, the Chicago Public Library and Choose Chicago, refreshed every
          morning. Each event links to its original page for tickets and details.
        </p>
      </footer>
    </div>
  );
}

const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

function rangePhrase(f: Filters, days: string[]): string {
  switch (f.when) {
    case "today": return "left today";
    case "weekend": return "this weekend";
    case "week": return "in the next 7 days";
    case "month": return "in the next 30 days";
    case "custom": {
      const a = shortDay.format(chicagoMidnight(days[0]));
      const b = shortDay.format(chicagoMidnight(days[days.length - 1]));
      return days.length === 1 ? `on ${a}` : `from ${a} to ${b}`;
    }
  }
}

function sortForDay(list: EventRow[]) {
  // All-day listings first, then by start time.
  return [...list].sort(
    (a, b) => Number(isAllDay(b.start_at, b.end_at)) - Number(isAllDay(a.start_at, a.end_at)) || a.start_at.localeCompare(b.start_at),
  );
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

/** "Make these my default": signed-in people can open the site with their usual filters. */
function DefaultFilters({ account, filters, here }: { account: Account; filters: Filters; here: string }) {
  if (!account.user) return null;
  const current = filtersQuery(new URLSearchParams(hrefWith(filters).slice(2)));
  const isDefault = account.defaultFilters === current;
  return (
    <div className="defaults">
      {isDefault ? (
        <p className="field-note">These are your default filters; the site opens with them.</p>
      ) : (
        <form method="post" action="/api/preferences">
          <input type="hidden" name="query" value={current} />
          <input type="hidden" name="back" value={here} />
          <button type="submit" className="link-button">Make these my default filters</button>
        </form>
      )}
      {account.defaultFilters ? (
        <form method="post" action="/api/preferences">
          <input type="hidden" name="clear" value="1" />
          <input type="hidden" name="back" value={here} />
          <button type="submit" className="link-button quiet">Stop using default filters</button>
        </form>
      ) : null}
    </div>
  );
}

/** A search covers the whole range: matches grouped by day. */
function SearchResults({ filters, events, total, days, today, save }: {
  filters: Filters;
  events: EventRow[];
  total: number;
  days: string[];
  today: string;
  save: (id: string) => { signedIn: boolean; saved: boolean; back: string };
}) {
  if (!events.length) {
    return (
      <div className="line">
        <div className="empty">
          <h2>No matches for “{filters.q}”</h2>
          <p>Check the spelling, try a shorter word, or search a longer time range.</p>
          <Link scroll={false} href={hrefWith(filters, { q: "", limit: PAGE_SIZE })}>
            Clear the search
          </Link>
        </div>
      </div>
    );
  }
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    let d = chicagoDate(new Date(e.start_at));
    if (d < days[0]) d = days[0];
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  }
  return (
    <div className="line">
      {[...byDay.entries()].map(([d, list]) => (
        <section key={d} className={d === today ? "stop today" : "stop"} aria-labelledby={`d-${d}`}>
          <h2 id={`d-${d}`}>
            <span className="marker" aria-hidden="true">{d === today ? <Star /> : null}</span>
            <span className="day">{dayLabel(d, today)}</span>
            <span className="date">{longDate.format(chicagoMidnight(d))}</span>
            <span className="count">{list.length} {list.length === 1 ? "match" : "matches"}</span>
          </h2>
          <ul className="events">
            {sortForDay(list).map((e) => <EventItem key={e.id} e={e} save={save(e.id)} />)}
          </ul>
        </section>
      ))}
      {events.length < total ? (
        <div className="more">
          <Link scroll={false} href={hrefWith(filters, { limit: filters.limit + PAGE_SIZE })}>
            Show {Math.min(PAGE_SIZE, total - events.length)} more
          </Link>
          <span>{events.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} shown</span>
        </div>
      ) : null}
    </div>
  );
}
