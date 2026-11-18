"use client";

import { useMemo, useState } from "react";
import type { AreaGroup } from "@/lib/neighborhoods";

/** Where: neighborhoods by side of town, with everyday names; pick any number. */
export function AreaPicker({ groups, selected }: { groups: AreaGroup[]; selected: string[] }) {
  const [find, setFind] = useState("");
  const q = find.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          areas: q
            ? g.areas.filter((a) => a.name.toLowerCase().includes(q) || a.aka.some((x) => x.toLowerCase().includes(q)))
            : g.areas,
        }))
        .filter((g) => g.areas.length),
    [groups, q],
  );

  return (
    <div className="areas">
      <label htmlFor="area-find" className="visually-hidden">Find a neighborhood</label>
      <input
        id="area-find"
        type="search"
        className="area-find"
        placeholder="Find a neighborhood, e.g. Pilsen"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        autoComplete="off"
      />
      {shown.length === 0 ? <p className="field-note">No neighborhood by that name has events right now.</p> : null}
      {shown.map((g) => {
        const picked = g.areas.filter((a) => selected.includes(a.name)).length;
        return (
          <details key={g.side} className="side" open={!!q || picked > 0}>
            <summary>
              {g.side}
              {picked ? <span className="badge">{picked}</span> : null}
            </summary>
            <div className="pills wrap">
              {g.areas.map((a) => (
                <label key={a.name} className="pill">
                  <input type="checkbox" name="hood" value={a.name} defaultChecked={selected.includes(a.name)} />
                  <span>
                    {a.name}
                    {a.aka.length ? <small>{a.aka.slice(0, 2).join(", ")}</small> : null}
                  </span>
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
