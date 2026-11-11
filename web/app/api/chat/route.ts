import { NextResponse } from "next/server";
import { chat, type ChatTurn } from "@/lib/chat";
import { currentUser } from "@/lib/supabase";

export const maxDuration = 60; // a few searches + answers can take a while

const REASONS: Record<string, { status: number; message: string }> = {
  signin: { status: 401, message: "Sign in to use the event assistant." },
  not_invited: { status: 403, message: "The event assistant is invite-only for now." },
  limit: { status: 429, message: "You’ve used today’s messages. The assistant resets at midnight." },
  budget: { status: 429, message: "The assistant has reached today’s limit for everyone. Try again tomorrow." },
};

/** GET: can the signed-in person chat, and how many messages are left today? */
export async function GET() {
  const { supabase, user } = await currentUser();
  if (!supabase || !user) return NextResponse.json({ invited: false, reason: "signin" });
  const { data, error } = await supabase.rpc("chat_status");
  if (error) return NextResponse.json({ invited: false, reason: "setup" });
  return NextResponse.json({ ...data, enabled: !!process.env.ANTHROPIC_API_KEY });
}

/** POST {messages: [{role, text}]} → {reply, events, remaining} */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "The event assistant isn’t switched on yet." }, { status: 503 });

  const { supabase, user } = await currentUser();
  if (!supabase || !user) return NextResponse.json({ error: REASONS.signin.message }, { status: 401 });

  const body = await request.json().catch(() => null);
  const history = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: ChatTurn) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-12)
    .map((m: ChatTurn) => ({ role: m.role, text: m.text.slice(0, 2000) })) as ChatTurn[];
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  while (history[0]?.role !== "user") history.shift(); // the API wants the user to speak first

  // Claim one message against the invite, daily limit and overall budget.
  const { data: gate, error: gateError } = await supabase.rpc("chat_begin");
  if (gateError) return NextResponse.json({ error: "The assistant isn’t set up in the database yet (run migration 0009)." }, { status: 503 });
  if (!gate?.allowed) {
    const r = REASONS[gate?.reason] ?? REASONS.not_invited;
    return NextResponse.json({ error: r.message, reason: gate?.reason }, { status: r.status });
  }

  const { data: prefs } = await supabase.from("user_preferences").select("filters").maybeSingle();
  try {
    const result = await chat(history, { apiKey, defaults: prefs?.filters || null });
    await supabase.rpc("chat_finish", { p_input: result.usage.input, p_output: result.usage.output, p_cost: result.usage.cost });
    return NextResponse.json({ reply: result.reply, events: result.events, remaining: gate.remaining });
  } catch (err) {
    console.error("chat failed", err);
    return NextResponse.json({ error: "The assistant couldn’t answer just now. Try again in a moment." }, { status: 502 });
  }
}
