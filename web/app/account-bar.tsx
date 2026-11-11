import type { User } from "@supabase/supabase-js";

/** Top-right: sign in, or the signed-in person's saved events and sign out. */
export function AccountBar({ user, savedCount, back }: { user: User | null; savedCount: number; back: string }) {
  if (!user) {
    return (
      <nav className="account" aria-label="Account">
        <a href={`/login?next=${encodeURIComponent(back)}`}>Sign in</a>
      </nav>
    );
  }
  return (
    <nav className="account" aria-label="Account">
      <a href="/saved">Saved{savedCount ? ` (${savedCount})` : ""}</a>
      <form method="post" action="/auth/signout">
        <button type="submit" title={user.email ?? undefined}>Sign out</button>
      </form>
    </nav>
  );
}
