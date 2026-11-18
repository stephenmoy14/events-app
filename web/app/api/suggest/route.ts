import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { supabaseConfig } from "@/lib/events";
import { ALSO_KNOWN_AS, SIDES } from "@/lib/neighborhoods";

type Suggestion = { kind: "venue" | "area" | "event" | "category"; label: string; value: string; events?: number; hint?: string };

/** GET /api/suggest?q=… — what to suggest while someone types in the search box. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  const lower = q.toLowerCase();
  const out: Suggestion[] = [];

  // Neighborhoods by everyday name ("Pilsen" → Lower West Side) and categories.
  for (const [area, names] of Object.entries(ALSO_KNOWN_AS)) {
    for (const n of names) if (n.toLowerCase().startsWith(lower)) out.push({ kind: "area", label: n, value: n, hint: area });
  }
  for (const { areas } of SIDES) for (const a of areas) if (a.toLowerCase().startsWith(lower)) out.push({ kind: "area", label: a, value: a });
  for (const c of CATEGORIES) if (c.label.toLowerCase().includes(lower) && c.key !== "other") out.push({ kind: "category", label: c.label, value: c.key });

  // Venues and event titles from the database, typo-tolerant (migration 0010).
  const cfg = supabaseConfig();
  if (cfg) {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/search_suggestions`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_q: q }),
      next: { revalidate: 300 },
    }).catch(() => null);
    if (res?.ok) {
      for (const r of (await res.json()) as { kind: string; label: string; events: number }[]) {
        if (r.kind === "area" && out.some((o) => o.value === r.label)) continue;
        out.push({ kind: r.kind as Suggestion["kind"], label: r.label, value: r.label, events: Number(r.events) });
      }
    }
  }
  const seen = new Set<string>();
  const suggestions = out.filter((s) => !seen.has(`${s.kind}:${s.value}`) && seen.add(`${s.kind}:${s.value}`)).slice(0, 8);
  return NextResponse.json({ suggestions });
}
