import { CATEGORIES } from "@/lib/categories";
import { WHEN_OPTIONS } from "@/lib/dates";
import type { Filters } from "@/lib/events";
import { AutoSubmit } from "./auto-submit";

export function FilterForm({ filters, day, neighborhoods }: { filters: Filters; day: string; neighborhoods: string[] }) {
  const active = filters.categories.length > 0 || filters.free || filters.neighborhood || filters.q;
  return (
    <form id="filters" className="filters" method="get" action="/" aria-label="Filter events">
      {/* Keeps the chosen day when other filters change; dropped when "When" changes. */}
      <input type="hidden" name="day" value={day} />

      <div className="search">
        <label htmlFor="q" className="visually-hidden">Search events, venues or neighborhoods</label>
        <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Search: jazz, Thalia Hall, Pilsen" />
        <button type="submit">Search</button>
      </div>

      <fieldset className="when">
        <legend>When</legend>
        <div className="pills">
          {WHEN_OPTIONS.map((w) => (
            <label key={w.key} className="pill">
              <input type="radio" name="when" value={w.key} defaultChecked={filters.when === w.key} />
              <span>{w.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="cats">
        <legend>What</legend>
        <div className="pills">
          {CATEGORIES.map((c) => (
            <label key={c.key} className="pill">
              <input type="checkbox" name="cat" value={c.key} defaultChecked={filters.categories.includes(c.key)} />
              <span>
                <i className="dot" style={{ background: c.color }} aria-hidden="true" />
                {c.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="pair">
        <fieldset>
          <legend>Price</legend>
          <label className="pill">
            <input type="checkbox" name="free" value="1" defaultChecked={filters.free} />
            <span>Free only</span>
          </label>
        </fieldset>

        {neighborhoods.length > 0 && (
          <div className="hood-field">
            <label htmlFor="hood" className="legend">Where</label>
            <div className="hood">
              <select id="hood" name="hood" defaultValue={filters.neighborhood}>
                <option value="">Any neighborhood</option>
                {neighborhoods.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {active ? <a className="clear" href={`/?when=${filters.when}&day=${day}`}>Clear filters</a> : null}
      <AutoSubmit formId="filters" />
    </form>
  );
}
