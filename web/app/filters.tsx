import { CATEGORIES } from "@/lib/categories";
import { PRICE_OPTIONS, TIME_OPTIONS, WHEN_OPTIONS } from "@/lib/dates";
import type { Filters } from "@/lib/events";
import { AutoSubmit } from "./auto-submit";
import { OpenOnWide } from "./open-on-wide";

export function FilterForm({ filters, day, neighborhoods, calendar }: {
  filters: Filters; day: string; neighborhoods: string[]; calendar: React.ReactNode;
}) {
  const extra = (filters.price !== "any" ? 1 : 0) + (filters.times.length ? 1 : 0) + (filters.neighborhood ? 1 : 0);
  const active = filters.categories.length > 0 || extra > 0 || filters.q;
  const clearHref = `/?when=${filters.when}${filters.when === "custom" && filters.from ? `&from=${filters.from}&to=${filters.to ?? filters.from}` : ""}&day=${day}`;
  return (
    <form id="filters" className="filters" method="get" action="/" aria-label="Filter events">
      {/* Keep the chosen day and custom dates when other filters change; dropped when "When" changes. */}
      <input type="hidden" name="day" value={day} data-range />
      {filters.when === "custom" && filters.from ? <input type="hidden" name="from" value={filters.from} data-range /> : null}
      {filters.when === "custom" && filters.to ? <input type="hidden" name="to" value={filters.to} data-range /> : null}
      {filters.when === "custom" && filters.pick ? <input type="hidden" name="pick" value="1" data-range /> : null}

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
        {calendar}
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

      <details className="more-filters" id="more-filters" open={extra > 0 || undefined}>
        <summary>More filters{extra ? ` (${extra})` : ""}</summary>

        <fieldset>
          <legend>Price</legend>
          <div className="pills wrap">
            {PRICE_OPTIONS.map((p) => (
              <label key={p.key} className="pill">
                <input type="radio" name="price" value={p.key} defaultChecked={filters.price === p.key} />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          {filters.price !== "any" && filters.price !== "free" ? (
            <p className="field-note">Events without a listed price are left out.</p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Time of day</legend>
          <div className="pills wrap">
            {TIME_OPTIONS.map((t) => (
              <label key={t.key} className="pill">
                <input type="checkbox" name="time" value={t.key} defaultChecked={filters.times.includes(t.key)} />
                <span>
                  {t.label} <small>{t.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" name="wkend" value="1" defaultChecked={filters.weekendAny} />
            <span>Any time on weekends</span>
          </label>
          <p className="field-note">
            {filters.times.length
              ? filters.weekendAny
                ? "Times apply Monday to Friday; Saturday and Sunday show everything."
                : "All-day listings are hidden while a time is chosen."
              : "Pick when you’re free, like evenings after work or school."}
          </p>
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
        <OpenOnWide detailsId="more-filters" />
      </details>

      {active ? <a className="clear" href={clearHref}>Clear filters</a> : null}
      <AutoSubmit formId="filters" />
    </form>
  );
}
