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
  categories: CategoryKey[];
  free: boolean;
  neighborhood: string;
  q: string;
  limit: number;
};

export const PAGE_SIZE = 150;

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
      return "The upcoming_events view wasn't found. Check SUPABASE_URL and that the migrations ran.";
    return "Check the Vercel environment variables and the Supabase migrations.";
  }
}
const COLUMNS =
  "id,title,start_at,end_at,venue_name,neighborhood,price_min,price_max,is_free,category_group,url,source_name";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function parseFilters(params: Params): Filters {
  const when = first(params.when);
  const limit = Number.parseInt(first(params.limit), 10);
  return {
    when: (WHEN_OPTIONS.some((w) => w.key === when) ? when : "week") as When,
    categories: all(params.cat).filter(isCategory),
    free: first(params.free) === "1",
    neighborhood: first(params.hood).slice(0, 60),
    // PostgREST filter syntax uses , ( ) " * \ — drop them from free text.
    q: first(params.q).replace(/[,()"*\\%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1500) : PAGE_SIZE,
  };
}

export type Listing = {
  events: EventRow[];
  total: number;
  from: string; // Chicago date
  to: string;   // Chicago date, exclusive
  today: string;
  sample: boolean;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function getEvents(f: Filters, now = new Date()): Promise<Listing> {
  const today = chicagoDate(now);
  const [from, to] = rangeFor(f.when, today);
  // Today's view starts now, so finished events drop off; later days start at midnight.
  const startIso = from === today ? now.toISOString() : chicagoMidnight(from).toISOString();
  const endIso = chicagoMidnight(to).toISOString();

  const cfg = config();
  if (!cfg) return sampleListing(f, today, from, to, startIso, endIso);

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

  const res = await fetch(`${cfg.url}/rest/v1/upcoming_events?${qs}`, {
    headers: { apikey: cfg.key, Prefer: "count=exact" },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    throw new LoadError(res.status, await res.text());
  }
  const events = (await res.json()) as EventRow[];
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? events.length);
  return { events, total: Number.isFinite(total) ? total : events.length, from, to, today, sample: false };
}

export async function getNeighborhoods(): Promise<string[]> {
  const cfg = config();
  if (!cfg) return SAMPLE_NEIGHBORHOODS;
  const res = await fetch(`${cfg.url}/rest/v1/upcoming_neighborhoods?select=neighborhood&order=neighborhood.asc`, {
    headers: { apikey: cfg.key },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return []; // the filter just won't offer neighborhoods
  return ((await res.json()) as { neighborhood: string }[]).map((r) => r.neighborhood);
}

function sampleListing(f: Filters, today: string, from: string, to: string, startIso: string, endIso: string): Listing {
  // Sample events are stored relative to "today" so the layout always has something to show.
  const shifted = SAMPLE_EVENTS.map((e) => {
    const s = chicagoMidnight(addDays(today, e.day)).getTime() + e.minutes * 60_000;
    return {
      ...e.row,
      start_at: new Date(s).toISOString(),
      end_at: e.durationMinutes ? new Date(s + e.durationMinutes * 60_000).toISOString() : null,
    };
  });
  const q = f.q.toLowerCase();
  const events = shifted
    .filter((e) => e.start_at < endIso && (e.start_at >= startIso || (e.end_at ?? "") >= startIso))
    .filter((e) => !f.categories.length || f.categories.includes((e.category_group ?? "other") as CategoryKey))
    .filter((e) => !f.free || e.is_free)
    .filter((e) => !f.neighborhood || e.neighborhood === f.neighborhood)
    .filter((e) => !q || [e.title, e.venue_name, e.neighborhood].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  return { events: events.slice(0, f.limit), total: events.length, from, to, today, sample: true };
}
