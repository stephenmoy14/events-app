import { NextResponse } from "next/server";
import { safeBack, supabaseForRequest } from "@/lib/supabase";

/** Sends a one-time sign-in link to the email address in the form. */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeBack(form.get("next"));
  const origin = new URL(request.url).origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/login?${q}&next=${encodeURIComponent(next)}`, 303);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back("error=email");
  const supabase = await supabaseForRequest();
  if (!supabase) return back("error=setup");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return back(`error=${encodeURIComponent(error.message.slice(0, 120))}`);
  return back(`sent=${encodeURIComponent(email)}`);
}
