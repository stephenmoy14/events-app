"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

/**
 * Re-runs the filter form as soon as a choice changes, without a full page load, so the page
 * keeps its scroll position. Without JavaScript the form still submits normally.
 */
export function AutoSubmit({ formId }: { formId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.toggleAttribute("data-loading", pending);
  }, [pending]);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const go = () => {
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") params.append(k, v);
      startTransition(() => router.push(`/?${params}`, { scroll: false }));
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type === "search" || t.type === "text") return; // search waits for Enter
      // A new date range starts at its first day.
      if (t.name === "when") form.querySelectorAll<HTMLInputElement>("input[data-range]").forEach((i) => (i.disabled = true));
      go();
    };
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      go();
    };
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
    };
  }, [formId, router]);
  return null;
}
