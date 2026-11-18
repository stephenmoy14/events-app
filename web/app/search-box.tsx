"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { kind: "venue" | "area" | "event" | "category"; label: string; value: string; events?: number; hint?: string };
const KIND: Record<Suggestion["kind"], string> = { venue: "Venue", area: "Neighborhood", event: "Event", category: "Category" };

/** Search box with suggestions as you type (venues, neighborhoods, events, categories). */
export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2 || q === defaultValue) {
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`).catch(() => null);
      const j = res?.ok ? await res.json() : { suggestions: [] };
      setItems(j.suggestions ?? []);
      setActive(-1);
      setOpen(true);
    }, 180);
    return () => clearTimeout(timer.current);
  }, [value, defaultValue]);

  function choose(s: Suggestion) {
    const form = input.current?.form;
    if (!form) return;
    setOpen(false);
    if (s.kind === "category") {
      // Pick the category instead of searching for its name.
      setValue("");
      const box = form.querySelector<HTMLInputElement>(`input[name="cat"][value="${s.value}"]`);
      if (box && !box.checked) box.click();
      return;
    }
    setValue(s.value);
    if (input.current) input.current.value = s.value;
    form.requestSubmit();
  }

  return (
    <div className="search-box">
      <label htmlFor="q" className="visually-hidden">Search events, venues or neighborhoods</label>
      <input
        id="q"
        ref={input}
        name="q"
        type="search"
        value={value}
        placeholder="Search events, venues, areas"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls="q-suggestions"
        aria-activedescendant={active >= 0 ? `q-s-${active}` : undefined}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && items.length > 0 ? (
        <ul className="suggestions" id="q-suggestions" role="listbox">
          {items.map((s, i) => (
            <li
              key={`${s.kind}-${s.value}`}
              id={`q-s-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "on" : undefined}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
            >
              <span className="s-label">{s.label}</span>
              <span className="s-kind">{s.hint ?? KIND[s.kind]}{s.events ? `, ${s.events}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
