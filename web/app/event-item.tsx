import { category, SOURCE_NAMES } from "@/lib/categories";
import { chicagoDate, formatTime, isAllDay, TZ } from "@/lib/dates";
import type { EventRow } from "@/lib/events";

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
      {save ? <SaveButton id={e.id} title={e.title} {...save} /> : null}
    </li>
  );
}

function SaveButton({ id, title, signedIn, saved, back }: { id: string; title: string; signedIn: boolean; saved: boolean; back: string }) {
  if (!signedIn) {
    return (
      <a className="save" href={`/login?next=${encodeURIComponent(back)}`} aria-label={`Sign in to save ${title}`}>
        <StarIcon filled={false} />
      </a>
    );
  }
  return (
    <form className="save-form" method="post" action="/api/saved">
      <input type="hidden" name="event_id" value={id} />
      <input type="hidden" name="back" value={back} />
      <button className={saved ? "save on" : "save"} type="submit" aria-pressed={saved} aria-label={saved ? `Unsave ${title}` : `Save ${title}`}>
        <StarIcon filled={saved} />
      </button>
    </form>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 3l5.3 12.3 13.3-1.5-8 10.7 8 10.7-13.3-1.5L24 46l-5.3-12.3-13.3 1.5 8-10.7-8-10.7 13.3 1.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
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
