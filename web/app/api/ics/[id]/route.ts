import { NextResponse } from "next/server";
import { icsFile } from "@/lib/calendar-links";
import { getEventsByIds } from "@/lib/events";

/** GET /api/ics/:id — a calendar file for one event (Apple Calendar, Outlook, etc.). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e] = await getEventsByIds([id]);
  if (!e) return NextResponse.json({ error: "That event has ended or no longer exists." }, { status: 404 });
  const origin = new URL(request.url).origin;
  const name = e.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
  return new NextResponse(icsFile(e, `${origin}/e/${e.id}`), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.ics"`,
    },
  });
}
