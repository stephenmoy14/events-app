import { currentUser, safeBack } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const ERRORS: Record<string, string> = {
  email: "That doesn’t look like an email address.",
  link: "That sign-in link didn’t work. Links expire after an hour and only work once, in the same browser that asked for it. Send a new one below.",
  setup: "Sign-in isn’t set up on this site yet.",
  rate: "Too many sign-in emails have gone out in the last hour. Try again in a little while",
  google: "Google sign-in didn’t finish. Try again, or use your email.",
};
const GOOGLE = process.env.AUTH_GOOGLE === "on";

function errorText(code: string): string {
  if (/rate limit/i.test(code)) return ERRORS.rate + (GOOGLE ? ", or continue with Google." : ".");
  return ERRORS[code] ?? code;
}

export default async function Login({ searchParams }: Props) {
  const p = await searchParams;
  const next = safeBack(p.next);
  const { user } = await currentUser();

  return (
    <div className="shell narrow">
      <header className="masthead">
        <h1>
          <a className="city home" href="/">Chicago</a>
          <span className="span">sign in</span>
        </h1>
        <div className="stripes" aria-hidden="true" />
      </header>
      <main className="panel">
        {user ? (
          <>
            <h2>You’re signed in</h2>
            <p>As {user.email}.</p>
            <p><a href={next}>Back to events</a> or see your <a href="/saved">saved events</a>.</p>
          </>
        ) : p.sent ? (
          <>
            <h2>Check your email</h2>
            <p>We sent a sign-in link to <strong>{p.sent}</strong>. Open it on this device, in this browser.</p>
            <p className="field-note">Nothing yet? Check spam, or send another below.</p>
            <SignInForm next={next} email={p.sent} label="Send another link" />
          </>
        ) : (
          <>
            <h2>Sign in to save events</h2>
            <p>Keep saved events on your phone and computer, and open the site with your usual filters. No password needed.</p>
            {p.error ? <p className="error" role="alert">{errorText(p.error)}</p> : null}
            {GOOGLE ? (
              <>
                <a className="google" href={`/auth/google?next=${encodeURIComponent(next)}`}>Continue with Google</a>
                <p className="or">or get a link by email</p>
              </>
            ) : null}
            <SignInForm next={next} label="Email me a sign-in link" />
          </>
        )}
      </main>
    </div>
  );
}

function SignInForm({ next, email, label }: { next: string; email?: string; label: string }) {
  return (
    <form className="signin" method="post" action="/auth/login">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
      <button type="submit">{label}</button>
    </form>
  );
}
