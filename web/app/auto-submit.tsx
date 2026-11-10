"use client";

import { useEffect } from "react";

/** Re-runs the filter form as soon as a choice changes (the form still works without JS). */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    form.dataset.auto = "on";
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type === "search" || t.type === "text") return; // search waits for Enter
      // A new date range starts at its first day.
      if (t.name === "when") {
        form.querySelectorAll<HTMLInputElement>("input[data-range]").forEach((i) => (i.disabled = true));
      }
      form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formId]);
  return null;
}
