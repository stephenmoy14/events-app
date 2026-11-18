"use client";

import { useEffect, useState } from "react";
import { readLocalSaves, SAVES_CHANGED, toggleLocalSave } from "@/lib/local-saves";

export const FIRST_LOCAL_SAVE = "first-local-save";

/**
 * Save star. Signed in: saves to the account. Signed out: saves on this device right away
 * (no sign-in wall), and nudges toward an account the first time.
 */
export function SaveStar({ id, title, signedIn, initialSaved }: { id: string; title: string; signedIn: boolean; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (signedIn) return;
    const sync = () => setSaved(readLocalSaves().includes(id));
    sync();
    window.addEventListener(SAVES_CHANGED, sync);
    return () => window.removeEventListener(SAVES_CHANGED, sync);
  }, [id, signedIn]);

  async function toggle() {
    if (!signedIn) {
      const first = readLocalSaves().length === 0;
      const now = toggleLocalSave(id);
      setSaved(now);
      if (now && first) window.dispatchEvent(new Event(FIRST_LOCAL_SAVE));
      return;
    }
    const want = !saved;
    setSaved(want);
    setBusy(true);
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: id, saved: want }),
    }).catch(() => null);
    if (!res?.ok) setSaved(!want);
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={saved ? "save on" : "save"}
      aria-pressed={saved}
      aria-label={saved ? `Unsave ${title}` : `Save ${title}`}
      onClick={toggle}
      disabled={busy}
    >
      <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M24 3l5.3 12.3 13.3-1.5-8 10.7 8 10.7-13.3-1.5L24 46l-5.3-12.3-13.3 1.5 8-10.7-8-10.7 13.3 1.5z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
