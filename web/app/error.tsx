"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="shell">
      <main className="line-area">
        <div className="empty">
          <h2>Events didn’t load</h2>
          <p>The event database didn’t answer. This usually clears up within a minute.</p>
          <button type="button" onClick={reset}>Try again</button>
        </div>
      </main>
    </div>
  );
}
