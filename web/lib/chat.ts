import { CATEGORIES, type CategoryKey, isCategory, SOURCE_NAMES } from "./categories";
import { addDays, chicagoDate, formatTime, isAllDay, TIME_OPTIONS, type TimeKey, TZ } from "./dates";
import { type EventRow, getNeighborhoods, searchEvents } from "./events";

/** Model and prices (USD per million tokens) used for the daily spending cap. */
const MODEL = process.env.CHAT_MODEL?.trim() || "claude-haiku-5-5";
const PRICE_IN = Number(process.env.CHAT_PRICE_INPUT_PER_MTOK ?? 0.1);
const PRICE_OUT = Number(process.env.CHAT_PRICE_OUTPUT_PER_MTOK ?? 0.5);
const MAX_TOOL_ROUNDS = 4;

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ChatResult = {
  reply: string;           // text with event markers removed
  events: EventRow[];      // events the reply recommends, in order
  usage: { input: number; output: number; cost: number };
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

const SEARCH_TOOL = {
  name: "search_events",
  description:
    "Search upcoming Chicago events (the next 30 days) in the site's database. Returns up to 25 events " +
    "starting between start_date and end_date, soonest first. Call it again with different filters or dates " +
    "to widen or narrow the search.",
  input_schema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "First day, YYYY-MM-DD (Chicago)." },
      end_date: { type: "string", description: "Last day, YYYY-MM-DD (Chicago), inclusive." },
      categories: {
        type: "array",
        items: { type: "string", enum: CATEGORIES.map((c) => c.key) },
        description: "Limit to these categories. Omit for all.",
      },
      free_only: { type: "boolean", description: "Only free events." },
      max_price: { type: "number", description: "Lowest ticket price at most this many dollars (free included)." },
      time_of_day: {
        type: "array",
        items: { type: "string", enum: TIME_OPTIONS.map((t) => t.key) },
        description: "Start times: morning (before noon), afternoon (noon–5pm), evening (5–9pm), night (after 9pm).",
      },
      neighborhood: { type: "string", description: "Exact Chicago community area name from the list in the instructions." },
      keywords: { type: "string", description: "Words to match in the title, venue or neighborhood, e.g. 'jazz' or 'Thalia Hall'." },
      limit: { type: "integer", description: "How many to return (1–25, default 15)." },
    },
    required: ["start_date", "end_date"],
  },
};

function systemPrompt(now: Date, neighborhoods: string[], defaults: string | null): string {
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(now);
  const today = chicagoDate(now);
  return [
    `You help people find things to do in Chicago, using a database of upcoming events from Ticketmaster, Eventbrite, the Chicago Public Library and Choose Chicago. It is now ${local} in Chicago (today is ${today}; the database covers through ${addDays(today, 30)}).`,
    "",
    "How to work:",
    "- Use search_events to find events. Search more than once when it helps (different days, categories or keywords). Resolve phrases like 'this weekend' or 'tonight' into exact dates yourself.",
    "- Recommend only events returned by search_events. Never invent events, times, prices, venues or links.",
    "- Put each recommended event on its own line as {{ev:ID}} (the id from the search results) followed by a short reason it fits, under 20 words. The app shows the event's title, time, venue, price and link from that marker, so don't repeat them.",
    "- Recommend 3 to 6 events unless asked for more. Prefer variety over near-duplicates (one Story Time, not five).",
    "- Write plain text, no markdown: one or two short sentences, then the event lines. Be warm and specific, not salesy.",
    "- If nothing fits, say so plainly and suggest how to widen the search. If the request is too vague to search, ask one short question.",
    "- Only discuss Chicago events and planning around them; politely decline unrelated requests.",
    "",
    `Categories: ${CATEGORIES.map((c) => `${c.key} (${c.label})`).join(", ")}.`,
    `Neighborhoods (Chicago community areas; Pilsen is Lower West Side, Wicker Park and Ukrainian Village are West Town, River North and Streeterville are Near North Side, Wrigleyville is Lake View): ${neighborhoods.join(", ") || "(list unavailable)"}.`,
    defaults ? `This person's saved default filters on the site (a hint about their preferences): ${defaults}` : "",
  ].filter((l) => l !== undefined).join("\n");
}

/** What the model sees for each event: compact, with a short id. */
function forModel(e: EventRow) {
  const start = new Date(e.start_at);
  const when = isAllDay(e.start_at, e.end_at)
    ? `${new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(start)}, all day`
    : `${new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(start)}, ${formatTime(e.start_at)}`;
  const price = e.is_free ? "free" : e.price_min != null ? `from $${Number(e.price_min)}` : "price not listed";
  return {
    id: e.id.slice(0, 8),
    title: e.title,
    when,
    venue: e.venue_name,
    neighborhood: e.neighborhood,
    category: e.category_group,
    price,
    source: SOURCE_NAMES[e.source_name] ?? e.source_name,
  };
}

async function runSearch(input: Record<string, unknown>, seen: Map<string, EventRow>): Promise<string> {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(input.start_date) || !isDate(input.end_date)) {
    return JSON.stringify({ error: "start_date and end_date must be YYYY-MM-DD." });
  }
  const cats = Array.isArray(input.categories) ? (input.categories as string[]).filter(isCategory) : [];
  const times = Array.isArray(input.time_of_day)
    ? (input.time_of_day as string[]).filter((t): t is TimeKey => TIME_OPTIONS.some((o) => o.key === t))
    : [];
  const events = await searchEvents({
    startDate: input.start_date as string,
    endDate: input.end_date as string,
    categories: cats as CategoryKey[],
    freeOnly: input.free_only === true,
    maxPrice: typeof input.max_price === "number" ? input.max_price : null,
    times,
    neighborhood: str(input.neighborhood),
    keywords: str(input.keywords),
    limit: typeof input.limit === "number" ? input.limit : 15,
  });
  for (const e of events) seen.set(e.id.slice(0, 8), e);
  return JSON.stringify({ count: events.length, events: events.map(forModel) });
}

async function callClaude(apiKey: string, system: string, messages: Message[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, tools: [SEARCH_TOOL], messages }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${body?.error?.message ?? "request failed"}`);
  return body as {
    content: ContentBlock[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  };
}

export async function chat(history: ChatTurn[], opts: { apiKey: string; defaults: string | null; now?: Date }): Promise<ChatResult> {
  const now = opts.now ?? new Date();
  const system = systemPrompt(now, await getNeighborhoods(), opts.defaults);
  const messages: Message[] = history.map((t) => ({ role: t.role, content: t.text }));
  const seen = new Map<string, EventRow>();
  let input = 0;
  let output = 0;
  let text = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await callClaude(opts.apiKey, system, messages);
    input += res.usage?.input_tokens ?? 0;
    output += res.usage?.output_tokens ?? 0;
    text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const calls = res.content.filter((b) => b.type === "tool_use") as Extract<ContentBlock, { type: "tool_use" }>[];
    if (res.stop_reason !== "tool_use" || !calls.length) break;
    messages.push({ role: "assistant", content: res.content });
    const results: ContentBlock[] = [];
    for (const call of calls) {
      try {
        const content = call.name === "search_events" ? await runSearch(call.input, seen) : JSON.stringify({ error: "Unknown tool." });
        results.push({ type: "tool_result", tool_use_id: call.id, content });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: call.id, content: `Search failed: ${(err as Error).message}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
    if (round === MAX_TOOL_ROUNDS) text = text || "I searched a few ways but couldn’t settle on suggestions. Try asking a bit more specifically.";
  }

  // Swap {{ev:ID}} markers for event cards; ids the search never returned are dropped.
  const picked: EventRow[] = [];
  const reply = text
    .replace(/\{\{ev:([0-9a-f]{6,36})\}\}/gi, (_, id: string) => {
      const e = seen.get(id.slice(0, 8).toLowerCase());
      if (e && !picked.includes(e)) picked.push(e);
      return e ? `[[${picked.indexOf(e)}]]` : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const cost = (input * PRICE_IN + output * PRICE_OUT) / 1_000_000;
  return { reply, events: picked, usage: { input, output, cost } };
}
