import Link from "next/link";
import { category } from "@/lib/categories";
import { chicagoMidnight, PRICE_OPTIONS, TIME_OPTIONS, TZ, WHEN_OPTIONS } from "@/lib/dates";
import { type Filters, hrefWith, PAGE_SIZE } from "@/lib/events";

const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

/** What's filtered right now, as chips; × removes one. */
export function AppliedFilters({ f, day, range, children }: {
  f: Filters; day: string; range: [string, string]; children?: React.ReactNode;
}) {
  const go = (change: Partial<Filters>) => hrefWith(f, { day, limit: PAGE_SIZE, ...change });
  const chips: { key: string; label: string; href?: string }[] = [];

  const when = WHEN_OPTIONS.find((w) => w.key === f.when)!.label;
  chips.push({
    key: "when",
    label:
      f.when === "custom" && f.from
        ? range[0] === range[1] ? shortDay.format(chicagoMidnight(range[0])) : `${shortDay.format(chicagoMidnight(range[0]))} – ${shortDay.format(chicagoMidnight(range[1]))}`
        : when,
  });
  for (const c of f.categories) {
    chips.push({ key: `c-${c}`, label: category(c).label, href: go({ categories: f.categories.filter((x) => x !== c) }) });
  }
  if (f.price !== "any") {
    chips.push({ key: "price", label: PRICE_OPTIONS.find((p) => p.key === f.price)!.label, href: go({ price: "any" }) });
  }
  if (f.times.length) {
    const names = TIME_OPTIONS.filter((t) => f.times.includes(t.key)).map((t) => t.label.toLowerCase());
    const label = names.join(" + ");
    chips.push({
      key: "time",
      label: `${label[0].toUpperCase()}${label.slice(1)}${f.weekendAny ? ", weekdays only" : ""}`,
      href: go({ times: [], weekendAny: false }),
    });
  }
  for (const h of f.neighborhoods) {
    chips.push({ key: `h-${h}`, label: h, href: go({ neighborhoods: f.neighborhoods.filter((x) => x !== h) }) });
  }
  if (f.q) chips.push({ key: "q", label: `“${f.q}”`, href: go({ q: "" }) });

  const removable = chips.filter((c) => c.href).length;
  return (
    <div className="applied" aria-label="Filters in use">
      <ul>
        {chips.map((c) => (
          <li key={c.key}>
            {c.href ? (
              <Link href={c.href} scroll={false} className="chip" aria-label={`Remove ${c.label}`}>
                {c.label} <span aria-hidden="true">×</span>
              </Link>
            ) : (
              <span className="chip fixed">{c.label}</span>
            )}
          </li>
        ))}
        {removable > 1 ? (
          <li>
            <Link
              href={go({ categories: [], price: "any", times: [], weekendAny: false, neighborhoods: [], q: "" })}
              scroll={false}
              className="chip clear-all"
            >
              Clear all
            </Link>
          </li>
        ) : null}
      </ul>
      {children}
    </div>
  );
}
