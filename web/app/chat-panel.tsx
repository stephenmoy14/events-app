"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/dates";
import type { EventRow } from "@/lib/events";

type Turn = { role: "user" | "assistant"; text: string; events?: EventRow[] };

const SUGGESTIONS = [
  "Free things to do this weekend",
  "Live music tonight under $20",
  "Something fun for kids Saturday morning",
  "Weeknight comedy after work",
];

const TZ = "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

/** The invite-only event assistant: a button that opens a chat sheet. */
export function ChatPanel({ remaining: initialRemaining, savedIds, preview }: {
  remaining: number;
  savedIds: string[];
  preview?: Turn[]; // design preview only (sample mode)
}) {
  const [open, setOpen] = useState(!!preview);
  const [turns, setTurns] = useState<Turn[]>(preview ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [saved, setSaved] = useState(() => new Set(savedIds));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The assistant couldn’t answer.");
      setTurns([...next, { role: "assistant", text: body.reply, events: body.events }]);
      if (typeof body.remaining === "number") setRemaining(body.remaining);
    } catch (err) {
      setError((err as Error).message);
      setTurns(turns); // let them edit and resend
      setDraft(q);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave(id: string) {
    const want = !saved.has(id);
    const nextSet = new Set(saved);
    if (want) nextSet.add(id);
    else nextSet.delete(id);
    setSaved(nextSet);
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: id, saved: want }),
    });
    if (!res.ok) setSaved(saved); // undo on failure
  }

  return (
    <>
      <button type="button" className="ask" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="assistant">
        <StarMark /> Ask for ideas
      </button>

      {open ? (
        <div className="assistant" id="assistant" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
          <header>
            <h2 id="assistant-title">Event ideas</h2>
            <span className="left">{remaining} {remaining === 1 ? "message" : "messages"} left today</span>
            <button type="button" className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>

          <div className="turns" ref={listRef} aria-live="polite">
            {turns.length === 0 ? (
              <div className="intro">
                <p>Tell me what you like, when you’re free and your budget. I’ll pick from what’s actually on.</p>
                <div className="suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} disabled={busy || remaining <= 0}>{s}</button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="you">{t.text}</p>
              ) : (
                <AssistantTurn key={i} turn={t} saved={saved} onSave={toggleSave} />
              ),
            )}
            {busy ? <p className="thinking">Searching events…</p> : null}
            {error ? <p className="chat-error" role="alert">{error}</p> : null}
          </div>

          <form
            className="compose"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="ask-input" className="visually-hidden">Ask about events</label>
            <textarea
              id="ask-input"
              ref={inputRef}
              rows={2}
              value={draft}
              maxLength={2000}
              placeholder={remaining > 0 ? "e.g. Something outdoors Sunday, cheap" : "No messages left today"}
              disabled={remaining <= 0}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <button type="submit" disabled={busy || !draft.trim() || remaining <= 0}>Send</button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function AssistantTurn({ turn, saved, onSave }: { turn: Turn; saved: Set<string>; onSave: (id: string) => void }) {
  const events = turn.events ?? [];
  return (
    <div className="bot">
      {turn.text.split("\n").filter((l) => l.trim()).map((line, i) => {
        const m = line.match(/^\s*\[\[(\d+)\]\]\s*[-–:—]?\s*(.*)$/);
        const e = m ? events[Number(m[1])] : undefined;
        if (!e) return <p key={i}>{line.replace(/\[\[\d+\]\]/g, "").trim()}</p>;
        return <EventCard key={i} e={e} reason={m![2]} saved={saved.has(e.id)} onSave={() => onSave(e.id)} />;
      })}
    </div>
  );
}

function EventCard({ e, reason, saved, onSave }: { e: EventRow; reason: string; saved: boolean; onSave: () => void }) {
  const price = e.is_free ? "Free" : e.price_min != null ? `From $${Number(e.price_min)}` : null;
  return (
    <div className="card">
      <div>
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="card-title">{e.title}</a>
        <p className="card-meta">
          {dayFmt.format(new Date(e.start_at))}, {formatTime(e.start_at)}
          {e.venue_name ? `, ${e.venue_name}` : ""}
          {price ? <>{". "}<span className={e.is_free ? "price free" : "price"}>{price}</span></> : null}
        </p>
        {reason ? <p className="card-why">{reason}</p> : null}
      </div>
      <button type="button" className={saved ? "save on" : "save"} aria-pressed={saved} aria-label={saved ? `Unsave ${e.title}` : `Save ${e.title}`} onClick={onSave}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 3l5.3 12.3 13.3-1.5-8 10.7 8 10.7-13.3-1.5L24 46l-5.3-12.3-13.3 1.5 8-10.7-8-10.7 13.3 1.5z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function StarMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="currentColor" d="M24 1.5l5.3 12.3 13.3-1.5-8 10.7 8 10.7-13.3-1.5L24 46.5l-5.3-12.3-13.3 1.5 8-10.7-8-10.7 13.3 1.5z" />
    </svg>
  );
}
