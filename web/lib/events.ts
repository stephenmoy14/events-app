import { addDays, chicagoDate, chicagoMidnight, isAllDay, PRICE_OPTIONS, type PriceKey, rangeFor, TIME_OPTIONS, type TimeKey, type When, WHEN_OPTIONS, weekday } from "./dates";
import { isCategory, type CategoryKey } from "./categories";
import { SAMPLE_EVENTS, SAMPLE_NEIGHBORHOODS } from "./sample";

export type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  neighborhood: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean | null;
  category_group: string | null;
  url: string;
  source_name: string;
};

export type Filters = {
  when: When;
  from: string | null;  // custom range (YYYY-MM-DD, inclusive)
  to: string | null;
  pick: boolean;        // custom range: start chosen, waiting for the end date
  day: string | null;   // requested day; clamped to the range
  categories: CategoryKey[];
  price: PriceKey;
  times: TimeKey[];
  weekendAny: boolean;  // time-of-day filter applies Mon–Fri only
  neighborhood: string;
  q: string;
  limit: number;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export const PAGE_SIZE = 150;
export const WINDOW_DAYS = 31; // calendar covers today + 30
const COLUMNS =
  "id,title,start_at,end_at,venue_name,neighborhood,price_min,price_max,is_free,category_group,url,source_name";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function parseFilters(params: Params): Filters {
  const when = first(params.when);
  const day = first(params.day);
  const limit = Number.parseInt(first(params.limit), 10);
  const price = first(params.price) || (first(params.free) === "1" ? "free" : "any"); // free=1: older links
  return {
    when: (WHEN_OPTIONS.some((w) => w.key === when) ? when : "week") as When,
    from: isDate(first(params.from)) ? first(params.from) : null,
    to: isDate(first(params.to)) ? first(params.to) : null,
    pick: first(params.pick) === "1",
    day: isDate(day) ? day : null,
    categories: all(params.cat).filter(isCategory),
    price: (PRICE_OPTIONS.some((p) => p.key === price) ? price : "any") as PriceKey,
    times: all(params.time).filter((t): t is TimeKey => TIME_OPTIONS.some((o) => o.key === t)),
    weekendAny: first(params.wkend) === "1",
    neighborhood: first(params.hood).slice(0, 60),
    // PostgREST filter syntax uses , ( ) " * \ — drop them from free text.
    q: first(params.q).replace(/[,()"*\\%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1500) : PAGE_SIZE,
  };
}

/** Build a link to the page with some filters changed. */
export function hrefWith(f: Filters, change: Partial<Filters> = {}, hash = ""): string {
  const g = { ...f, ...change };
  const p = new URLSearchParams();
  p.set("when", g.when);
  if (g.when === "custom") {
    if (g.from) p.set("from", g.from);
    if (g.to) p.set("to", g.to);
    if (g.pick) p.set("pick", "1");
  }
  if (g.day) p.set("day", g.day);
  g.categories.forEach((c) => p.append("cat", c));
  if (g.price !== "any") p.set("price", g.price);
  g.times.forEach((t) => p.append("time", t));
  if (g.weekendAny) p.set("wkend", "1");
  if (g.neighborhood) p.set("hood", g.neighborhood);
  if (g.q) p.set("q", g.q);
  if (g.limit !== PAGE_SIZE) p.set("limit", String(g.limit));
  return `/?${p}${hash}`;
}

export type DayView = {
  today: string;
  days: string[];               // the range shown in the strip
  day: string;                  // the selected day
  counts: Record<string, number>; // events per day, today .. today+30, with filters
  events: EventRow[];           // selected day
  total: number;                // selected day
  sample: boolean;
};

export function supabaseConfig() {
  // Tolerate copy-paste extras: spaces, newlines, surrounding quotes, a trailing slash.
  const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, "").trim();
  const url = clean(process.env.SUPABASE_URL)?.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = clean(process.env.SUPABASE_ANON_KEY);
  return url && key ? { url, key } : null;
}

/** A failed Supabase request, with a plain-language hint about the likely fix. */
export class LoadError extends Error {
  constructor(public status: number, body: string) {
    let detail = body;
    try {
      const j = JSON.parse(body);
      detail = [j.message, j.hint, j.details].filter(Boolean).join(" ");
    } catch {}
    super(`Supabase answered ${status}: ${detail.slice(0, 300)}`);
  }
  get hint(): string {
    if (this.status === 401 || this.status === 403)
      return "Check SUPABASE_ANON_KEY in the Vercel project settings (use the publishable/anon key), then redeploy.";
    if (this.status === 404)
      return "Something the site reads wasn't found. Check SUPABASE_URL and that every file in db/migrations has been run.";
    return "Check the Vercel environment variables and the Supabase migrations.";
  }
}

export async function getDayView(f: Filters, now = new Date()): Promise<DayView> {
  const today = chicagoDate(now);
  const [from, to] = rangeFor(f.when, today, f);
  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const day = f.day && days.includes(f.day) ? f.day : days[0];

  // The selected day: from its midnight (or now, for today) to the next midnight.
  const startIso = day === today ? now.toISOString() : chicagoMidnight(day).toISOString();
  const endIso = chicagoMidnight(addDays(day, 1)).toISOString();

  const cfg = supabaseConfig();
  if (!cfg) return sampleView(f, now, today, days, day, startIso, endIso);

  const qs = new URLSearchParams();
  qs.set("select", COLUMNS);
  qs.set("start_at", `lt.${endIso}`);
  const conditions = [`or(start_at.gte.${startIso},end_at.gte.${startIso})`];
  if (f.q) conditions.push(`or(title.ilike.*${f.q}*,venue_name.ilike.*${f.q}*,neighborhood.ilike.*${f.q}*)`);
  if (f.price === "free") qs.set("is_free", "is.true");
  else if (f.price !== "any") conditions.push(`or(is_free.is.true,price_min.lt.${f.price})`);
  const hours = timeFilterHours(f, day);
  if (hours) {
    conditions.push("all_day.is.false");
    qs.set("start_hour", `in.(${hours.join(",")})`);
  }
  qs.set("and", `(${conditions.join(",")})`);
  if (f.categories.length) qs.set("category_group", `in.(${f.categories.join(",")})`);
  if (f.neighborhood) qs.set("neighborhood", `eq.${f.neighborhood}`);
  qs.set("order", "start_at.asc,title.asc");
  qs.set("limit", String(f.limit));

  const headers = { apikey: cfg.key, "Content-Type": "application/json" };
  // Always fresh: one quick query per view, and a bad moment can't get stuck in a cache.
  const [eventsRes, countsRes] = await Promise.all([
    fetch(`${cfg.url}/rest/v1/upcoming_events?${qs}`, { headers: { ...headers, Prefer: "count=exact" }, cache: "no-store" }),
    fetch(`${cfg.url}/rest/v1/rpc/event_day_counts`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        p_from: today,
        p_to: addDays(today, WINDOW_DAYS),
        p_cats: f.categories.length ? f.categories : null,
        p_price: f.price,
        p_hood: f.neighborhood || null,
        p_q: f.q || null,
        p_hours: f.times.length ? allowedHours(f.times) : null,
        p_weekend_any: f.weekendAny,
      }),
    }),
  ]);
  if (!eventsRes.ok) throw new LoadError(eventsRes.status, await eventsRes.text());
  // Counts are a nice-to-have: without them (e.g. before migration 0008) the page still works.
  const countRows = countsRes.ok ? ((await countsRes.json()) as { day: string; events: number }[]) : [];
  if (!countsRes.ok) console.error("event_day_counts failed", countsRes.status, (await countsRes.text()).slice(0, 200));

  const events = (await eventsRes.json()) as EventRow[];
  const total = Number(eventsRes.headers.get("content-range")?.split("/")[1] ?? events.length);
  const counts: Record<string, number> = {};
  for (const r of countRows) counts[r.day] = Number(r.events);
  return { today, days, day, counts, events, total: Number.isFinite(total) ? total : events.length, sample: false };
}

function allowedHours(times: TimeKey[]): number[] {
  return TIME_OPTIONS.filter((o) => times.includes(o.key)).flatMap((o) => [...o.hours]);
}

/** Hours to keep on this day, or null when the time-of-day filter doesn't apply to it. */
export function timeFilterHours(f: Filters, day: string): number[] | null {
  if (!f.times.length) return null;
  const dow = weekday(day);
  if (f.weekendAny && (dow === 0 || dow === 6)) return null;
  return allowedHours(f.times);
}

export async function getNeighborhoods(): Promise<string[]> {
  const cfg = supabaseConfig();
  if (!cfg) return SAMPLE_NEIGHBORHOODS;
  const res = await fetch(`${cfg.url}/rest/v1/upcoming_neighborhoods?select=neighborhood&order=neighborhood.asc`, {
    headers: { apikey: cfg.key },
    next: { revalidate: 900 },
  });
  if (!res.ok) return []; // the filter just won't offer neighborhoods
  return ((await res.json()) as { neighborhood: string }[]).map((r) => r.neighborhood);
}

// ---------------------------------------------------------------- sample data (no Supabase)

function sampleView(f: Filters, now: Date, today: string, days: string[], day: string, startIso: string, endIso: string): DayView {
  const q = f.q.toLowerCase();
  const rows = SAMPLE_EVENTS.map((e) => {
    const s = chicagoMidnight(addDays(today, e.day)).getTime() + e.minutes * 60_000;
    return {
      ...e.row,
      start_at: new Date(s).toISOString(),
      end_at: e.durationMinutes ? new Date(s + e.durationMinutes * 60_000).toISOString() : null,
    };
  })
    .filter((e) => !f.categories.length || f.categories.includes((e.category_group ?? "other") as CategoryKey))
    .filter((e) => f.price === "any" || !!e.is_free || (f.price !== "free" && e.price_min != null && e.price_min < Number(f.price)))
    .filter((e) => !f.neighborhood || e.neighborhood === f.neighborhood)
    .filter((e) => !q || [e.title, e.venue_name, e.neighborhood].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
  const timeOk = (e: EventRow, d: string) => {
    const hours = timeFilterHours(f, d);
    return !hours || (!isAllDay(e.start_at, e.end_at) && hours.includes(hourOf(e.start_at)));
  };
  const overlaps = (e: EventRow, s: string, end: string, d: string) =>
    e.start_at < end && (e.end_at ?? e.start_at) >= s && timeOk(e, d);
  const counts: Record<string, number> = {};
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDays(today, i);
    const s = d === today ? now.toISOString() : chicagoMidnight(d).toISOString();
    const n = rows.filter((e) => overlaps(e, s, chicagoMidnight(addDays(d, 1)).toISOString(), d)).length;
    if (n) counts[d] = n;
  }
  const events = rows.filter((e) => overlaps(e, startIso, endIso, day));
  return { today, days, day, counts, events: events.slice(0, f.limit), total: events.length, sample: true };
}


// ---------------------------------------------------------------- general search (chatbot)

export type Search = {
  startDate: string;        // Chicago dates, inclusive
  endDate: string;
  categories?: CategoryKey[];
  freeOnly?: boolean;
  maxPrice?: number | null;
  times?: TimeKey[];
  neighborhood?: string;
  keywords?: string;
  limit?: number;
};

/** Events starting between two Chicago dates, with optional filters. */
export async function searchEvents(s: Search, now = new Date()): Promise<EventRow[]> {
  const today = chicagoDate(now);
  const start = s.startDate < today ? today : s.startDate;
  const startIso = start === today ? now.toISOString() : chicagoMidnight(start).toISOString();
  const endIso = chicagoMidnight(addDays(s.endDate < start ? start : s.endDate, 1)).toISOString();
  const limit = Math.min(Math.max(s.limit ?? 15, 1), 25);
  const q = (s.keywords ?? "").replace(/[,()"*\\%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const hours = s.times?.length ? allowedHours(s.times) : null;

  const cfg = supabaseConfig();
  if (!cfg) {
    const view = await getDayView({ ...parseFilters({}), when: "month" });
    return view.events.filter((e) => e.start_at >= startIso && e.start_at < endIso).slice(0, limit);
  }
  const qs = new URLSearchParams();
  qs.set("select", COLUMNS);
  qs.set("start_at", `gte.${startIso}`);
  const conditions = [`start_at.lt.${endIso}`];
  if (q) conditions.push(`or(title.ilike.*${q}*,venue_name.ilike.*${q}*,neighborhood.ilike.*${q}*)`);
  if (s.maxPrice != null && !s.freeOnly) conditions.push(`or(is_free.is.true,price_min.lte.${Number(s.maxPrice)})`);
  if (hours) conditions.push("all_day.is.false");
  qs.set("and", `(${conditions.join(",")})`);
  if (s.freeOnly) qs.set("is_free", "is.true");
  if (s.categories?.length) qs.set("category_group", `in.(${s.categories.join(",")})`);
  if (s.neighborhood) qs.set("neighborhood", `eq.${s.neighborhood}`);
  if (hours) qs.set("start_hour", `in.(${hours.join(",")})`);
  qs.set("order", "start_at.asc,title.asc");
  qs.set("limit", String(limit));
  const res = await fetch(`${cfg.url}/rest/v1/upcoming_events?${qs}`, { headers: { apikey: cfg.key }, cache: "no-store" });
  if (!res.ok) throw new LoadError(res.status, await res.text());
  return (await res.json()) as EventRow[];
}
