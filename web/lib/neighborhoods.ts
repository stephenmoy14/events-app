// Chicago's 77 community areas grouped by side of town, plus the everyday names people use
// for places inside them (so "Pilsen" finds Lower West Side).

export const SIDES: { side: string; areas: string[] }[] = [
  { side: "Downtown", areas: ["Loop", "Near North Side", "Near South Side"] },
  {
    side: "North Side",
    areas: [
      "Lake View", "Lincoln Park", "North Center", "Logan Square", "Avondale", "Uptown", "Lincoln Square",
      "Edgewater", "Rogers Park", "West Ridge", "Albany Park", "North Park", "Forest Glen", "Jefferson Park",
      "Norwood Park", "Edison Park", "O'Hare",
    ],
  },
  { side: "Northwest Side", areas: ["Irving Park", "Portage Park", "Dunning", "Montclare", "Belmont Cragin", "Hermosa"] },
  {
    side: "West Side",
    areas: [
      "West Town", "Near West Side", "Humboldt Park", "Lower West Side", "South Lawndale", "North Lawndale",
      "East Garfield Park", "West Garfield Park", "Austin",
    ],
  },
  {
    side: "South Side",
    areas: [
      "Hyde Park", "Kenwood", "Bridgeport", "Armour Square", "Douglas", "Oakland", "Grand Boulevard", "Woodlawn",
      "Washington Park", "South Shore", "Fuller Park", "Greater Grand Crossing", "Chatham", "Avalon Park",
      "South Chicago", "Calumet Heights", "Burnside", "Roseland", "Pullman", "South Deering", "East Side",
      "West Pullman", "Riverdale", "Hegewisch",
    ],
  },
  {
    side: "Southwest Side",
    areas: [
      "McKinley Park", "Brighton Park", "Archer Heights", "Garfield Ridge", "New City", "West Elsdon", "Gage Park",
      "Clearing", "West Lawn", "Chicago Lawn", "West Englewood", "Englewood", "Ashburn", "Auburn Gresham", "Beverly",
      "Washington Heights", "Mount Greenwood", "Morgan Park",
    ],
  },
];

/** Everyday names → community area. */
export const ALSO_KNOWN_AS: Record<string, string[]> = {
  "Near North Side": ["River North", "Streeterville", "Gold Coast", "Magnificent Mile"],
  "Near West Side": ["West Loop", "Fulton Market", "Greektown", "Little Italy"],
  "Near South Side": ["South Loop", "Museum Campus"],
  "Lower West Side": ["Pilsen"],
  "West Town": ["Wicker Park", "Ukrainian Village", "East Village", "Noble Square"],
  "Logan Square": ["Bucktown"],
  "Lake View": ["Lakeview", "Wrigleyville", "Boystown", "Northalsted"],
  "Lincoln Park": ["Old Town", "DePaul"],
  "Edgewater": ["Andersonville"],
  "Armour Square": ["Chinatown"],
  "South Lawndale": ["Little Village"],
  "Uptown": ["Argyle"],
  "North Center": ["Roscoe Village"],
};

export type AreaGroup = { side: string; areas: { name: string; aka: string[] }[] };

/** The neighborhoods that have events right now, grouped by side, in a sensible order. */
export function groupAreas(available: string[]): AreaGroup[] {
  const have = new Set(available);
  const placed = new Set<string>();
  const groups: AreaGroup[] = SIDES.map(({ side, areas }) => ({
    side,
    areas: areas
      .filter((a) => have.has(a))
      .map((a) => {
        placed.add(a);
        return { name: a, aka: ALSO_KNOWN_AS[a] ?? [] };
      }),
  })).filter((g) => g.areas.length);
  const rest = available.filter((a) => !placed.has(a));
  if (rest.length) groups.push({ side: "Elsewhere", areas: rest.map((a) => ({ name: a, aka: [] })) });
  return groups;
}

export function areaLabel(name: string): string {
  const aka = ALSO_KNOWN_AS[name];
  return aka?.length ? `${name} (${aka.slice(0, 2).join(", ")})` : name;
}

/** If text is a neighborhood's name or everyday name, the community area it means. */
export function areaFor(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  for (const { areas } of SIDES) for (const a of areas) if (a.toLowerCase() === t) return a;
  for (const [area, names] of Object.entries(ALSO_KNOWN_AS)) if (names.some((n) => n.toLowerCase() === t)) return area;
  return null;
}
