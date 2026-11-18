"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readLocalSaves, SAVES_CHANGED, writeLocalSaves } from "@/lib/local-saves";
import { FIRST_LOCAL_SAVE } from "./save-star";

/** "Saved (n)" for someone who isn't signed in: counts saves on this device. */
export function LocalSavedLink() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sync = () => setN(readLocalSaves().length);
    sync();
    window.addEventListener(SAVES_CHANGED, sync);
    return () => window.removeEventListener(SAVES_CHANGED, sync);
  }, []);
  return <a href="/saved">Saved{n ? ` (${n})` : ""}</a>;
}

/** After the first save without an account, suggest signing in to keep it everywhere. */
export function SaveNudge({ next }: { next: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener(FIRST_LOCAL_SAVE, on);
    return () => window.removeEventListener(FIRST_LOCAL_SAVE, on);
  }, []);
  if (!show) return null;
  return (
    <div className="toast" role="status">
      <p>Saved on this device. Sign in to keep your saves on your phone and computer.</p>
      <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a>
      <button type="button" aria-label="Dismiss" onClick={() => setShow(false)}>×</button>
    </div>
  );
}

/** Once signed in, move anything saved on this device into the account. */
export function MergeLocalSaves() {
  const router = useRouter();
  useEffect(() => {
    const ids = readLocalSaves();
    if (!ids.length) return;
    fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_ids: ids, saved: true }),
    })
      .then((r) => {
        if (r.ok) {
          writeLocalSaves([]);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [router]);
  return null;
}
