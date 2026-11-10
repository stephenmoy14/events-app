// Mirrors pipeline/src/events_pipeline/enrich.py CATEGORY_GROUPS. Colors borrow from the CTA
// 'L' lines; they're decoration next to a text label, never the only signal.
export const CATEGORIES = [
  { key: "music", label: "Music", color: "#C60C30" },        // Red Line
  { key: "comedy", label: "Comedy", color: "#F9461C" },      // Orange Line
  { key: "theater", label: "Theater", color: "#522398" },    // Purple Line
  { key: "arts", label: "Arts & museums", color: "#E27EA6" }, // Pink Line
  { key: "food", label: "Food & drink", color: "#62361B" },  // Brown Line
  { key: "nightlife", label: "Nightlife", color: "#2B2D7C" },
  { key: "sports", label: "Sports & fitness", color: "#00A1DE" }, // Blue Line
  { key: "outdoors", label: "Outdoors & tours", color: "#009B3A" }, // Green Line
  { key: "family", label: "Kids & family", color: "#E8B400" }, // Yellow Line, darkened
  { key: "learning", label: "Classes & talks", color: "#4F7C8A" },
  { key: "community", label: "Markets & festivals", color: "#B5651D" },
  { key: "other", label: "Other", color: "#8A949E" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

const BY_KEY = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map((c) => [c.key, c]));

export function category(key: string | null | undefined) {
  return BY_KEY.get(key ?? "other") ?? BY_KEY.get("other")!;
}

export function isCategory(key: string): key is CategoryKey {
  return BY_KEY.has(key);
}

export const SOURCE_NAMES: Record<string, string> = {
  ticketmaster: "Ticketmaster",
  eventbrite: "Eventbrite",
  chicago_public_library: "Chicago Public Library",
  choose_chicago: "Choose Chicago",
};
