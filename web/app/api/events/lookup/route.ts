import { NextResponse } from "next/server";
import { getEventsByIds } from "@/lib/events";

/** GET /api/events/lookup?ids=a,b,c — upcoming events by id (ended ones are left out). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  try {
    return NextResponse.json({ events: await getEventsByIds(ids) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
