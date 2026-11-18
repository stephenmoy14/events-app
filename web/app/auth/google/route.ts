import { NextResponse } from "next/server";
import { safeBack, supabaseForRequest } from "@/lib/supabase";

/** Starts "Continue with Google" (Supabase handles Google; it comes back to /auth/callback). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeBack(url.searchParams.get("next"));
  const supabase = await supabaseForRequest();
  if (!supabase || process.env.AUTH_GOOGLE !== "on") {
    return NextResponse.redirect(`${url.origin}/login?error=setup&next=${encodeURIComponent(next)}`);
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return NextResponse.redirect(`${url.origin}/login?error=google&next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(data.url);
}
