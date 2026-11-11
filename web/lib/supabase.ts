import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./events";

/**
 * Supabase client acting as the signed-in visitor (their session lives in cookies), so the
 * database's row rules decide what they can see and change. Null when Supabase isn't set up.
 */
export async function supabaseForRequest() {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Pages can't set cookies; middleware keeps the session fresh instead.
        }
      },
    },
  });
}

export async function currentUser() {
  const supabase = await supabaseForRequest();
  if (!supabase) return { supabase: null, user: null };
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

/** Only allow redirects back into this site. */
export function safeBack(value: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}
