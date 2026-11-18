// Events saved on this device by someone who isn't signed in (browser storage).
// Moved into their account the next time they sign in.
const KEY = "chicago-events:saved";
export const SAVES_CHANGED = "local-saves-changed";

export function readLocalSaves(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocalSaves(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, 500)));
  } catch {
    // storage blocked (private mode); the star just won't stick
  }
  window.dispatchEvent(new Event(SAVES_CHANGED));
}

export function toggleLocalSave(id: string): boolean {
  const ids = readLocalSaves();
  const saved = !ids.includes(id);
  writeLocalSaves(saved ? [...ids, id] : ids.filter((x) => x !== id));
  return saved;
}
