import type { User } from "@supabase/supabase-js";
import type { EventRow } from "./events";
import { currentUser } from "./supabase";

export type Account = {
  user: User | null;
  savedIds: Set<string>;
  defaultFilters: string | null; // query string, e.g. "when=week&time=evening"
};

const EVENT_COLUMNS =
  "id,title,start_at,end_at,venue_name,neighborhood,price_min,price_max,is_free,category_group,url,source_name";

/** The signed-in visitor (if any), their saved event ids and default filters. */
export async function getAccount(): Promise<Account> {
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return { user: null, savedIds: new Set(), defaultFilters: null };
  const [saved, prefs] = await Promise.all([
    supabase.from("saved_events").select("event_id"),
    supabase.from("user_preferences").select("filters").maybeSingle(),
  ]);
  return {
    user,
    savedIds: new Set((saved.data ?? []).map((r) => r.event_id as string)),
    defaultFilters: prefs.data?.filters || null,
  };
}

/** Saved events that are still upcoming, soonest first. */
export async function getSavedEvents(): Promise<{ user: User | null; events: EventRow[]; savedCount: number }> {
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return { user: null, events: [], savedCount: 0 };
  const { data: saved } = await supabase.from("saved_events").select("event_id");
  const ids = (saved ?? []).map((r) => r.event_id as string);
  if (!ids.length) return { user, events: [], savedCount: 0 };
  const { data } = await supabase
    .from("upcoming_events")
    .select(EVENT_COLUMNS)
    .in("id", ids)
    .order("start_at", { ascending: true });
  return { user, events: (data ?? []) as EventRow[], savedCount: ids.length };
}

/** Keep only the filter parts of a query string (not the day or paging). */
export function filtersQuery(params: URLSearchParams): string {
  const keep = new URLSearchParams();
  for (const [k, v] of params) {
    if (["when", "from", "to", "cat", "price", "time", "wkend", "hood", "q"].includes(k) && v) keep.append(k, v);
  }
  return keep.toString();
}

/** Chat access for the signed-in person: invited, and messages left today. */
export async function getChatAccess(): Promise<{ invited: boolean; remaining: number }> {
  if (!process.env.ANTHROPIC_API_KEY) return { invited: false, remaining: 0 };
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return { invited: false, remaining: 0 };
  const { data, error } = await supabase.rpc("chat_status");
  if (error || !data?.invited) return { invited: false, remaining: 0 };
  return { invited: true, remaining: Number(data.remaining ?? 0) };
}
