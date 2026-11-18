import type { Metadata } from "next";
import Link from "next/link";
import { getAccount } from "@/lib/account";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { category, SOURCE_NAMES } from "@/lib/categories";
import { chicagoDate, chicagoMidnight, formatTime, isAllDay, TZ } from "@/lib/dates";
import { getEventsByIds } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { AccountBar } from "../../account-bar";
import { SaveNudge } from "../../account-extras";
import { priceText } from "../../event-item";
import { SaveStar } from "../../save-star";
import { ShareButton } from "./share-button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const fullDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [e] = await getEventsByIds([id]).catch(() => []);
  if (!e) return { title: "Event not found | Chicago, next 30 days" };
  const when = `${fullDate.format(new Date(e.start_at))}${isAllDay(e.start_at, e.end_at) ? "" : `, ${formatTime(e.start_at)}`}`;
  const description = [when, e.venue_name, priceText(e)].filter(Boolean).join(" · ");
  return {
    title: `${e.title} | Chicago, next 30 days`,
    description,
    openGraph: { title: e.title, description, url: `${SITE_URL}/e/${e.id}`, siteName: "Chicago, next 30 days", type: "website" },
  };
}

/** One event, shareable: what it is, when, where, and ways to keep it. */
export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const [[e], account] = await Promise.all([getEventsByIds([id]).catch(() => []), getAccount()]);
  const back = `/e/${id}`;

  if (!e) {
    return (
      <div className="shell narrow">
        <header className="masthead">
          <h1><Link className="city home" href="/">Chicago</Link></h1>
          <div className="stripes" aria-hidden="true" />
        </header>
        <main className="panel">
          <h2>This event has ended</h2>
          <p>It’s no longer listed. Plenty else is on, though.</p>
          <p><Link href="/?when=week">See what’s on this week</Link></p>
        </main>
      </div>
    );
  }

  const day = chicagoDate(new Date(e.start_at));
  const allDay = isAllDay(e.start_at, e.end_at);
  const cat = category(e.category_group);
  const source = SOURCE_NAMES[e.source_name] ?? e.source_name;
  const price = priceText(e);

  return (
    <div className="shell narrow">
      <header className="masthead">
        <AccountBar user={account.user} savedCount={account.savedIds.size} back={back} />
        <h1>
          <Link className="city home" href="/">Chicago</Link>
          <span className="span">next 30 days</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
      </header>

      <main className="panel event-page">
        <p className="ep-cat">
          <i className="dot" style={{ background: cat.color }} aria-hidden="true" /> {cat.label}
        </p>
        <h2>{e.title}</h2>
        <dl className="ep-facts">
          <dt>When</dt>
          <dd>
            {fullDate.format(chicagoMidnight(day))}
            {allDay ? ", all day" : `, ${formatTime(e.start_at)}${e.end_at ? ` to ${formatTime(e.end_at)}` : ""}`}
          </dd>
          {e.venue_name ? (<><dt>Where</dt><dd>{e.venue_name}{e.neighborhood ? `, ${e.neighborhood}` : ""}</dd></>) : null}
          {price ? (<><dt>Price</dt><dd className={e.is_free ? "price free" : "price"}>{price}</dd></>) : null}
        </dl>

        <div className="ep-actions">
          <a className="primary" href={e.url} target="_blank" rel="noopener noreferrer">Details and tickets on {source}</a>
          <div className="ep-row">
            <SaveStar id={e.id} title={e.title} signedIn={!!account.user} initialSaved={account.savedIds.has(e.id)} />
            <ShareButton id={e.id} title={e.title} />
            <a href={googleCalendarUrl(e, `${SITE_URL}/e/${e.id}`)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
            <a href={`/api/ics/${e.id}`}>Apple / Outlook</a>
          </div>
        </div>

        <p className="ep-more">
          <Link href={`/?when=custom&from=${day}&to=${day}&day=${day}`}>Everything else on {fullDate.format(chicagoMidnight(day))}</Link>
        </p>
        {!account.user ? <SaveNudge next={back} /> : null}
      </main>
    </div>
  );
}
