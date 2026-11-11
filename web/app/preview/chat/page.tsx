import { notFound } from "next/navigation";
import { getDayView, parseFilters, supabaseConfig } from "@/lib/events";
import { ChatPanel } from "../../chat-panel";

export const dynamic = "force-dynamic";

/** Design preview of the assistant with a made-up exchange. Only exists without Supabase (local/CI). */
export default async function ChatPreview() {
  if (supabaseConfig()) notFound();
  const view = await getDayView({ ...parseFilters({}), when: "month", day: null });
  const all = (await getDayView({ ...parseFilters({ when: "week" }) })).events.concat(view.events);
  const pick = all.filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i).slice(0, 3);
  return (
    <div className="shell">
      <ChatPanel
        remaining={37}
        savedIds={pick[1] ? [pick[1].id] : []}
        preview={[
          { role: "user", text: "Something fun tonight, under $20, I get off work at 6" },
          {
            role: "assistant",
            text: `Here are a few evening picks that fit your budget.\n[[0]] Easy drop-in and free.\n[[1]] Cozy room, great for winding down after work.\n[[2]] Short set, starts late enough to grab dinner first.`,
            events: pick,
          },
        ]}
      />
    </div>
  );
}
