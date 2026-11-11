import { NextResponse } from "next/server";
import { filtersQuery } from "@/lib/account";
import { currentUser, safeBack } from "@/lib/supabase";

/** GET: the signed-in person's default filters (a query string). */
export async function GET() {
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data } = await supabase.from("user_preferences").select("filters,updated_at").maybeSingle();
  return NextResponse.json({ filters: data?.filters ?? "", updated_at: data?.updated_at ?? null });
}

/** POST (form): save the given filters as the default (field "query"), or clear them ("clear"). */
export async function POST(request: Request) {
  const form = await request.formData();
  const origin = new URL(request.url).origin;
  const back = safeBack(form.get("back"));
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(back)}`, 303);

  const filters = form.get("clear") ? "" : filtersQuery(new URLSearchParams(String(form.get("query") ?? "")));
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, filters, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.redirect(`${origin}${back}`, 303);
}
