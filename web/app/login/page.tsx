import { currentUser, safeBack } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const ERRORS: Record<string, string> = {
  email: "That doesn’t look like an email address.",
  link: "That sign-in link didn’t work. Links expire after an hour and only work once, in the same browser that asked for it. Send a new one below.",
  setup: "Sign-in isn’t set up on this site yet.",
};

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
            <p>Save events you’re interested in and keep your favorite filters. No password: we email you a link.</p>
            {p.error ? <p className="error" role="alert">{ERRORS[p.error] ?? p.error}</p> : null}
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
