import { category, SOURCE_NAMES } from "@/lib/categories";
import { chicagoDate, formatTime, isAllDay, TZ } from "@/lib/dates";
import { googleCalendarUrl } from "@/lib/calendar-links";
import type { EventRow } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { EventMenu } from "./event-menu";
import { SaveStar } from "./save-star";

const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

/** One event in a list. `save` adds the save button: signed in → toggles; signed out → sign in. */
export function EventItem({ e, untilFor, save }: {
  e: EventRow;
  untilFor?: string;
  save?: { signedIn: boolean; saved: boolean; back: string };
}) {
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
    const endsAtMidnight = formatTime(e.end_at) === "11:59pm";
    when =
      chicagoDate(end) === untilFor
        ? endsAtMidnight ? "All day" : `Until ${formatTime(e.end_at)}`
        : `Until ${shortDate.format(end)}`;
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
      <div className="ev-actions">
        {save ? <SaveStar id={e.id} title={e.title} signedIn={save.signedIn} initialSaved={save.saved} /> : null}
        <EventMenu
          id={e.id}
          title={e.title}
          googleUrl={googleCalendarUrl(e, `${SITE_URL}/e/${e.id}`)}
          sourceUrl={e.url}
          sourceName={SOURCE_NAMES[e.source_name] ?? e.source_name}
        />
      </div>
    </li>
  );
}

export function priceText(e: EventRow): string | null {
  if (e.is_free) return "Free";
  const lo = e.price_min != null ? Number(e.price_min) : null;
  const hi = e.price_max != null ? Number(e.price_max) : null;
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi > lo) return `${fmt(lo)}–${fmt(hi)}`;
  return fmt((lo ?? hi)!);
}
