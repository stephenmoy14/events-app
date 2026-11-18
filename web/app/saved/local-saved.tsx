"use client";

import { useEffect, useState } from "react";
import type { EventRow } from "@/lib/events";
import { readLocalSaves, SAVES_CHANGED } from "@/lib/local-saves";
import { SaveStar } from "../save-star";

const TZ = "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Saved events for someone who isn't signed in (stored on this device). */
export function LocalSaved() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      const ids = readLocalSaves();
      setCount(ids.length);
      if (!ids.length) return setEvents([]);
      fetch(`/api/events/lookup?ids=${ids.join(",")}`)
        .then((r) => r.json())
        .then((j) => setEvents((j.events ?? []) as EventRow[]))
        .catch(() => setEvents([]));
    };
    load();
    window.addEventListener(SAVES_CHANGED, load);
    return () => window.removeEventListener(SAVES_CHANGED, load);
  }, []);

  if (events === null) return <p className="summary">Loading your saved events…</p>;
  if (!events.length) {
    return (
      <div className="empty">
        <h2>Nothing saved yet</h2>
        <p>Tap the star next to any event to keep it here.</p>
        <a href="/">Browse events</a>
      </div>
    );
  }
  const ended = count - events.length;
  return (
    <>
      <p className="summary">
        {events.length} upcoming saved {events.length === 1 ? "event" : "events"} on this device
        {ended > 0 ? ` (${ended} already happened)` : ""}
      </p>
      <ul className="events plain">
        {events.map((e) => (
          <li key={e.id} className="event" id={`ev-${e.id}`}>
            <span className="time">{timeFmt.format(new Date(e.start_at)).replace(" AM", "am").replace(" PM", "pm").replace(":00", "")}</span>
            <div className="body">
              <a className="title" href={`/e/${e.id}`}>{e.title}</a>
              <p className="where">{dayFmt.format(new Date(e.start_at))}{e.venue_name ? `, ${e.venue_name}` : ""}</p>
            </div>
            <div className="ev-actions">
              <SaveStar id={e.id} title={e.title} signedIn={false} initialSaved />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
