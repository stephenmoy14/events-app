import { redirect } from "next/navigation";
import { getSavedEvents } from "@/lib/account";
import { chicagoDate, chicagoMidnight, TZ } from "@/lib/dates";
import { dayLabel } from "../day-strip";
import { EventItem } from "../event-item";
import { AccountBar } from "../account-bar";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" });

export default async function Saved() {
  const { user, events, savedCount } = await getSavedEvents();
  if (!user) redirect("/login?next=/saved");
  const today = chicagoDate(new Date());
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const d = chicagoDate(new Date(e.start_at)) < today ? today : chicagoDate(new Date(e.start_at));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  }
  const past = savedCount - events.length;

  return (
    <div className="shell narrow">
      <header className="masthead">
        <AccountBar user={user} savedCount={savedCount} back="/saved" />
        <h1>
          <a className="city home" href="/">Chicago</a>
          <span className="span">saved</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
        <p className="summary">
          {events.length ? `${events.length} upcoming saved ${events.length === 1 ? "event" : "events"}` : "No upcoming saved events"}
        </p>
        {past > 0 ? <p className="notice">{past} saved {past === 1 ? "event has" : "events have"} already happened.</p> : null}
      </header>
      <main className="line-area">
        {events.length === 0 ? (
          <div className="empty">
            <h2>Nothing saved yet</h2>
            <p>Tap the star next to any event to keep it here.</p>
            <a href="/">Browse events</a>
          </div>
        ) : (
          <div className="line">
            {[...byDay.entries()].map(([d, list]) => (
              <section key={d} className={d === today ? "stop today" : "stop"} aria-labelledby={`d-${d}`}>
                <h2 id={`d-${d}`}>
                  <span className="marker" aria-hidden="true" />
                  <span className="day">{dayLabel(d, today)}</span>
                  <span className="date">{longDate.format(chicagoMidnight(d))}</span>
                </h2>
                <ul className="events">
                  {list.map((e) => (
                    <EventItem key={e.id} e={e} save={{ signedIn: true, saved: true, back: "/saved" }} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
