import { NextResponse } from "next/server";
import { getSavedEvents } from "@/lib/account";
import { currentUser, safeBack } from "@/lib/supabase";

/** GET: the signed-in person's upcoming saved events. */
export async function GET() {
  const { user, events } = await getSavedEvents();
  if (!user) return NextResponse.json({ error: "Sign in to see saved events." }, { status: 401 });
  return NextResponse.json({ events });
}

/**
 * POST: save or unsave one event. Accepts a form (event_id, back) and redirects back to the
 * page, or JSON {event_id, saved} and answers with JSON.
 */
export async function POST(request: Request) {
  const isJson = request.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await request.json() : Object.fromEntries((await request.formData()).entries());

  // Bulk save (moving device saves into the account after sign-in).
  if (isJson && Array.isArray(body.event_ids)) {
    const { supabase, user } = await currentUser();
    if (!supabase || !user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const ids = (body.event_ids as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
    if (!ids.length) return NextResponse.json({ saved: 0 });
    // Only events that still exist (old device saves may point at removed listings).
    const { data: existing } = await supabase.from("events").select("id").in("id", ids);
    const rows = (existing ?? []).map((r) => ({ user_id: user.id, event_id: r.id as string }));
    if (rows.length) {
      const { error } = await supabase.from("saved_events").upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ saved: rows.length });
  }

  const eventId = String(body.event_id ?? "");
  const origin = new URL(request.url).origin;
  const back = safeBack(body.back as string);

  const { supabase, user } = await currentUser();
  if (!supabase || !user) {
    return isJson
      ? NextResponse.json({ error: "Sign in to save events." }, { status: 401 })
      : NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(back)}`, 303);
  }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });

  // Explicit target state for JSON; a form toggles.
  let save: boolean;
  if (isJson && typeof body.saved === "boolean") save = body.saved;
  else {
    const { data } = await supabase.from("saved_events").select("event_id").eq("event_id", eventId).maybeSingle();
    save = !data;
  }
  const { error } = save
    ? await supabase.from("saved_events").upsert({ user_id: user.id, event_id: eventId }, { onConflict: "user_id,event_id" })
    : await supabase.from("saved_events").delete().eq("event_id", eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return isJson
    ? NextResponse.json({ event_id: eventId, saved: save })
    : NextResponse.redirect(`${origin}${back}#ev-${eventId}`, 303);
}
