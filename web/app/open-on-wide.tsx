"use client";

import { useEffect } from "react";

/** On wide screens the calendar sits open in the sidebar; on phones it starts folded. */
export function OpenOnWide({ detailsId }: { detailsId: string }) {
  useEffect(() => {
    const el = document.getElementById(detailsId) as HTMLDetailsElement | null;
    if (el && window.matchMedia("(min-width: 960px)").matches) el.open = true;
  }, [detailsId]);
  return null;
}
