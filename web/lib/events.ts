import { addDays, chicagoDate, chicagoMidnight, rangeFor, type When, WHEN_OPTIONS } from "./dates";
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
  day: string | null; // requested day (YYYY-MM-DD); clamped to the range
  categories: CategoryKey[];
  free: boolean;
  neighborhood: string;
  q: string;
  limit: number;
};

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
  return {
    when: (WHEN_OPTIONS.some((w) => w.key === when) ? when : "week") as When,
    day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    categories: all(params.cat).filter(isCategory),
    free: first(params.free) === "1",
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
  if (g.day) p.set("day", g.day);
  g.categories.forEach((c) => p.append("cat", c));
  if (g.free) p.set("free", "1");
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

function config() {
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
  const [from, to] = rangeFor(f.when, today);
  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const day = f.day && days.includes(f.day) ? f.day : days[0];

  // The selected day: from its midnight (or now, for today) to the next midnight.
  const startIso = day === today ? now.toISOString() : chicagoMidnight(day).toISOString();
  const endIso = chicagoMidnight(addDays(day, 1)).toISOString();

  const cfg = config();
  if (!cfg) return sampleView(f, now, today, days, day, startIso, endIso);

  const qs = new URLSearchParams();
  qs.set("select", COLUMNS);
  qs.set("start_at", `lt.${endIso}`);
  const conditions = [`or(start_at.gte.${startIso},end_at.gte.${startIso})`];
  if (f.q) conditions.push(`or(title.ilike.*${f.q}*,venue_name.ilike.*${f.q}*,neighborhood.ilike.*${f.q}*)`);
  qs.set("and", `(${conditions.join(",")})`);
  if (f.categories.length) qs.set("category_group", `in.(${f.categories.join(",")})`);
  if (f.free) qs.set("is_free", "is.true");
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
        p_free: f.free,
        p_hood: f.neighborhood || null,
        p_q: f.q || null,
      }),
    }),
  ]);
  if (!eventsRes.ok) throw new LoadError(eventsRes.status, await eventsRes.text());
  if (!countsRes.ok) throw new LoadError(countsRes.status, await countsRes.text());

  const events = (await eventsRes.json()) as EventRow[];
  const total = Number(eventsRes.headers.get("content-range")?.split("/")[1] ?? events.length);
  const counts: Record<string, number> = {};
  for (const r of (await countsRes.json()) as { day: string; events: number }[]) counts[r.day] = Number(r.events);
  return { today, days, day, counts, events, total: Number.isFinite(total) ? total : events.length, sample: false };
}

export async function getNeighborhoods(): Promise<string[]> {
  const cfg = config();
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
    .filter((e) => !f.free || e.is_free)
    .filter((e) => !f.neighborhood || e.neighborhood === f.neighborhood)
    .filter((e) => !q || [e.title, e.venue_name, e.neighborhood].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const overlaps = (e: EventRow, s: string, end: string) => e.start_at < end && (e.end_at ?? e.start_at) >= s;
  const counts: Record<string, number> = {};
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDays(today, i);
    const s = d === today ? now.toISOString() : chicagoMidnight(d).toISOString();
    const n = rows.filter((e) => overlaps(e, s, chicagoMidnight(addDays(d, 1)).toISOString())).length;
    if (n) counts[d] = n;
  }
  const events = rows.filter((e) => overlaps(e, startIso, endIso));
  return { today, days, day, counts, events: events.slice(0, f.limit), total: events.length, sample: true };
}
