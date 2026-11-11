import { type CookieOptions, createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { type NextRequest, NextResponse } from "next/server";

/** Refreshes the visitor's sign-in session on each request so pages see a valid one. */
export async function middleware(request: NextRequest) {
  const url = process.env.SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: CookieToSet[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
