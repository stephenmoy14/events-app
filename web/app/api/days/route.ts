import { NextResponse } from "next/server";
import { getDayView, LoadError, parseFilters } from "@/lib/events";

/** GET /api/days — events per Chicago day for the next 30 days, with the page's filters. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const params = Object.fromEntries([...sp.keys()].map((k) => [k, sp.getAll(k)]));
  try {
    const view = await getDayView({ ...parseFilters(params), limit: 1 });
    return NextResponse.json({ today: view.today, counts: view.counts });
  } catch (err) {
    const status = err instanceof LoadError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Counts didn’t load." }, { status });
  }
}
