import { NextResponse } from "next/server";
import { safeBack, supabaseForRequest } from "@/lib/supabase";

/** The sign-in link lands here: trade its code for a session cookie, then go back. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeBack(url.searchParams.get("next"));
  const supabase = await supabaseForRequest();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${url.origin}${next}`);
  }
  return NextResponse.redirect(`${url.origin}/login?error=link&next=${encodeURIComponent(next)}`);
}
