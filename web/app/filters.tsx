import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_OPTIONS, TIME_OPTIONS, WHEN_OPTIONS } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE } from "@/lib/events";
import { groupAreas } from "@/lib/neighborhoods";
import { AreaPicker } from "./area-picker";
import { AutoSubmit } from "./auto-submit";
import { SearchBox } from "./search-box";
import { OpenOnWide, SheetDone } from "./open-on-wide";

/** How many filters beyond "When" are on (for the Filters button badge). */
export function activeCount(f: Filters): number {
  return f.categories.length + (f.price !== "any" ? 1 : 0) + (f.times.length ? 1 : 0) + f.neighborhoods.length;
}

/**
 * The filter form. On phones: a search row with a Filters button that opens a sheet.
 * On wide screens the sheet is simply the sidebar. Works without JavaScript (plain GET form).
 */
export function FilterForm({ filters, day, neighborhoods, calendar, total }: {
  filters: Filters; day: string; neighborhoods: string[]; calendar: React.ReactNode; total: number;
}) {
  const n = activeCount(filters);
  // Remount the inputs whenever the filters change (so they show the new state), while the
  // sheet itself stays open.
  const k = hrefWith(filters, { day });
  return (
    <form id="filters" className="filters" method="get" action="/" aria-label="Filter events">
      <div key={`h-${k}`} hidden>
      {/* Keep the chosen day and custom dates when other filters change; dropped when "When" changes. */}
      <input type="hidden" name="day" value={day} data-range />
      {filters.when === "custom" && filters.from ? <input type="hidden" name="from" value={filters.from} data-range /> : null}
      {filters.when === "custom" && filters.to ? <input type="hidden" name="to" value={filters.to} data-range /> : null}
      {filters.when === "custom" && filters.pick ? <input type="hidden" name="pick" value="1" data-range /> : null}
      </div>

      <div className="toolbar" key={`t-${k}`}>
        <div className="search">
          <SearchBox defaultValue={filters.q} />
          <button type="submit">Search</button>
        </div>
      </div>

      <details className="sheet" id="filter-sheet">
        <summary className="sheet-toggle">
          Filters{n ? <span className="badge">{n}</span> : null}
        </summary>
        <div className="sheet-backdrop" aria-hidden="true" />
        <div className="sheet-body" role="group" aria-label="Filters" key={`b-${k}`}>
          <div className="sheet-head">
            <h2>Filters</h2>
            <SheetDone detailsId="filter-sheet" label={`Show ${total.toLocaleString("en-US")} ${total === 1 ? "event" : "events"}`} />
          </div>

          <fieldset className="section when">
            <legend>When</legend>
            <div className="pills wrap">
              {WHEN_OPTIONS.map((w) => (
                <label key={w.key} className="pill">
                  <input type="radio" name="when" value={w.key} defaultChecked={filters.when === w.key} />
                  <span>{w.label}</span>
                </label>
              ))}
            </div>
            {calendar}
          </fieldset>

          <fieldset className="section cats">
            <legend>What</legend>
            <div className="pills wrap">
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

          <fieldset className="section">
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

          <fieldset className="section">
            <legend>Time of day</legend>
            <Link
              className="quick-pick"
              scroll={false}
              href={hrefWith(filters, { times: ["evening", "night"], weekendAny: true, day, limit: PAGE_SIZE })}
            >
              After work: weekday evenings, weekends any time
            </Link>
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
              <span>Only on weekdays</span>
            </label>
          </fieldset>

          {neighborhoods.length > 0 && (
            <fieldset className="section hood-field">
              <legend>Where</legend>
              <AreaPicker groups={groupAreas(neighborhoods)} selected={filters.neighborhoods} />
            </fieldset>
          )}
        </div>
        <OpenOnWide detailsId="filter-sheet" />
      </details>

      <AutoSubmit formId="filters" />
    </form>
  );
}
