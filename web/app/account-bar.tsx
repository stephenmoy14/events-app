import type { User } from "@supabase/supabase-js";
import { LocalSavedLink, MergeLocalSaves } from "./account-extras";

/** Top-right: saved events (on this device or in the account), and sign in / out. */
export function AccountBar({ user, savedCount, back }: { user: User | null; savedCount: number; back: string }) {
  if (!user) {
    return (
      <nav className="account" aria-label="Account">
        <LocalSavedLink />
        <a href={`/login?next=${encodeURIComponent(back)}`}>Sign in</a>
      </nav>
    );
  }
  return (
    <nav className="account" aria-label="Account">
      <MergeLocalSaves />
      <a href="/saved">Saved{savedCount ? ` (${savedCount})` : ""}</a>
      <form method="post" action="/auth/signout">
        <button type="submit" title={user.email ?? undefined}>Sign out</button>
      </form>
    </nav>
  );
}
