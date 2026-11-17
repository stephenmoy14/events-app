"use client";

import { useEffect } from "react";

/** On wide screens the filters sit open in the sidebar; on phones they start folded. */
export function OpenOnWide({ detailsId }: { detailsId: string }) {
  useEffect(() => {
    const el = document.getElementById(detailsId) as HTMLDetailsElement | null;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 960px)");
    const sync = () => {
      if (wide.matches) el.open = true;
    };
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, [detailsId]);
  return null;
}

/** Closes the filter sheet (phones). */
export function SheetDone({ detailsId, label }: { detailsId: string; label: string }) {
  return (
    <button
      type="button"
      className="sheet-done"
      onClick={() => {
        const el = document.getElementById(detailsId) as HTMLDetailsElement | null;
        if (el) el.open = false;
        document.getElementById("events")?.scrollIntoView({ block: "start" });
      }}
    >
      {label}
    </button>
  );
}
