import { NextResponse } from "next/server";
import { getDayView, LoadError, parseFilters } from "@/lib/events";

/**
 * GET /api/events — one day's events plus per-day counts, with the same query parameters as
 * the page: when, from, to, day, cat, price, time, wkend, hood, q, limit.
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(
    [...new URL(request.url).searchParams.keys()].map((k) => [k, new URL(request.url).searchParams.getAll(k)]),
  );
  try {
    const view = await getDayView(parseFilters(params));
    return NextResponse.json({
      day: view.day,
      days: view.days,
      total: view.total,
      events: view.events,
      counts: view.counts,
    });
  } catch (err) {
    const status = err instanceof LoadError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Events didn’t load." }, { status });
  }
}
