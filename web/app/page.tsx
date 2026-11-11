import { addDays, chicagoMidnight, isAllDay, TZ } from "@/lib/dates";
import { type DayView, type EventRow, type Filters, getDayView, getNeighborhoods, hrefWith, LoadError, PAGE_SIZE, parseFilters } from "@/lib/events";
import { RangeCalendar } from "./calendar";
import { DayPager, DayStrip, dayLabel } from "./day-strip";
import { redirect } from "next/navigation";
import { type Account, filtersQuery, getAccount } from "@/lib/account";
import { AccountBar } from "./account-bar";
import { EventItem } from "./event-item";
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
  const { today, day, days, counts, events, total } = view;
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
        <FilterForm
          filters={filters}
          day={day}
          neighborhoods={neighborhoods}
          calendar={
            filters.when === "custom" ? (
              <RangeCalendar f={filters} today={today} range={[days[0], addDays(days[days.length - 1], 1)]} counts={counts} />
            ) : null
          }
        />
        <DefaultFilters account={account} filters={filters} here={here} />
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
                <a href={hrefWith(filters, { categories: [], price: "any", times: [], weekendAny: false, neighborhood: "", q: "", limit: PAGE_SIZE })}>
                  Show everything on {name}
                </a>
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
