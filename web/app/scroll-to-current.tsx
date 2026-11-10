"use client";

import { useEffect } from "react";

/** Centers the current day in the horizontally scrolling strip (without moving the page). */
export function ScrollToCurrent({ listId }: { listId: string }) {
  useEffect(() => {
    const list = document.getElementById(listId);
    const cur = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !cur) return;
    const li = cur.parentElement as HTMLElement;
    list.scrollLeft = li.offsetLeft - list.clientWidth / 2 + li.clientWidth / 2;
  }, [listId]);
  return null;
}
