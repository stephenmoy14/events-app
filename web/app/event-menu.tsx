"use client";

import { useEffect, useRef, useState } from "react";

/** The ⋯ menu on an event: share, add to calendar, open on the source site. */
export function EventMenu({ id, title, googleUrl, sourceUrl, sourceName }: {
  id: string; title: string; googleUrl: string; sourceUrl: string; sourceName: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState(false);

  // Close when tapping elsewhere.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  async function share() {
    const url = `${window.location.origin}/e/${id}`;
    try {
      if (navigator.share) await navigator.share({ title, text: title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <details className="ev-menu" ref={ref}>
      <summary aria-label={`More for ${title}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="4" cy="10" r="1.8" fill="currentColor" />
          <circle cx="10" cy="10" r="1.8" fill="currentColor" />
          <circle cx="16" cy="10" r="1.8" fill="currentColor" />
        </svg>
      </summary>
      <div className="ev-menu-list" role="menu">
        <button type="button" role="menuitem" onClick={share}>{copied ? "Link copied" : "Share"}</button>
        <a role="menuitem" href={googleUrl} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
        <a role="menuitem" href={`/api/ics/${id}`}>Add to Apple / Outlook calendar</a>
        <a role="menuitem" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open on {sourceName}</a>
      </div>
    </details>
  );
}
