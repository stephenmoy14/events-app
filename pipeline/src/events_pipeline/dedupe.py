"""Cross-source duplicate matching.

Two listings are the same event when:
  • titles match — same words after normalizing, or very similar (Jaccard ≥ 0.75), or one
    title's words are all inside the other's ("Elf in Concert" / "Elf in Concert with the CSO");
  • times match — both timed and starting within 30 minutes (5 minutes within one source),
    or one is an all-day listing on the same Chicago date;
  • venues don't contradict — within 1 km when both have coordinates, otherwise the venue
    names share a meaningful word; a missing venue is allowed only for exact, specific titles.

Separate showtimes stay separate: a 2pm and an 8pm show never merge. An all-day listing (Choose
Chicago lists shows as all-day) is hidden under the earliest matching timed showtime instead of
gluing the showtimes together.

The best listing in each group stays visible: timed over all-day, then by source order in the
city config (Ticketmaster first). The rest get duplicate_of = that listing's id.

    python -m events_pipeline.dedupe            # preview groups, change nothing
    python -m events_pipeline.dedupe --apply    # write duplicate_of (the daily run does this)
"""
from __future__ import annotations

import argparse
import html
import math
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TIME_TOLERANCE = timedelta(minutes=30)
SAME_SOURCE_TOLERANCE = timedelta(minutes=5)
MAX_DISTANCE_KM = 1.0
TITLE_JACCARD = 0.75

_STOP = {"the", "a", "an", "and", "of", "at", "in", "on", "for", "with", "to", "live",
         "presents", "presented", "by", "tickets", "ticket", "show", "event", "featuring", "feat", "ft"}
_VENUE_STOP = {"the", "chicago", "of", "at", "and", "theatre", "theater", "center", "centre", "hall",
               "venue", "room", "stage", "club", "bar", "park", "library", "branch", "public",
               "university", "il", "illinois"}


def tokens(text: str | None, stop: set[str]) -> frozenset[str]:
    if not text:
        return frozenset()
    text = html.unescape(text).lower().replace("&", " and ")
    words = re.findall(r"[a-z0-9]+", text)
    return frozenset(w for w in words if w not in stop and len(w) > 1)


@dataclass
class Listing:
    id: str
    source: str
    title: str
    start_at: datetime
    end_at: datetime | None = None
    venue_name: str | None = None
    lat: float | None = None
    lon: float | None = None
    # filled in by prepare()
    words: frozenset[str] = field(default=frozenset(), repr=False)
    venue_words: frozenset[str] = field(default=frozenset(), repr=False)
    local_date: object = None
    all_day: bool = False


def prepare(items: list[Listing], tz: ZoneInfo) -> None:
    for it in items:
        it.words = tokens(it.title, _STOP)
        # "Chicago Theatre" is all generic words; then compare the full name instead.
        it.venue_words = tokens(it.venue_name, _VENUE_STOP) or tokens(it.venue_name, {"the", "of", "at", "and"})
        local = it.start_at.astimezone(tz)
        it.local_date = local.date()
        # Choose Chicago-style "all day": starts at local midnight and lasts ~a day or more.
        it.all_day = (local.hour, local.minute) == (0, 0) and (
            it.end_at is None or it.end_at - it.start_at >= timedelta(hours=20))


def titles_match(a: Listing, b: Listing) -> bool:
    if not a.words or not b.words:
        return False
    if a.words == b.words:
        return True
    small, big = (a.words, b.words) if len(a.words) <= len(b.words) else (b.words, a.words)
    if len(small) >= 2 and small <= big:
        return True
    return len(a.words & b.words) / len(a.words | b.words) >= TITLE_JACCARD


def km(a: Listing, b: Listing) -> float:
    r = 6371.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dp, dl = p2 - p1, math.radians(b.lon - a.lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def venues_match(a: Listing, b: Listing) -> bool:
    if None not in (a.lat, a.lon, b.lat, b.lon):
        return km(a, b) <= MAX_DISTANCE_KM
    if a.venue_words and b.venue_words:
        return bool(a.venue_words & b.venue_words)
    # One side has no usable venue: only trust an exact, specific title.
    return a.words == b.words and len(a.words) >= 3


def times_match(a: Listing, b: Listing) -> bool:
    if a.all_day or b.all_day:
        return a.local_date == b.local_date
    tol = SAME_SOURCE_TOLERANCE if a.source == b.source else TIME_TOLERANCE
    return abs(a.start_at - b.start_at) <= tol


def is_match(a: Listing, b: Listing) -> bool:
    return times_match(a, b) and titles_match(a, b) and venues_match(a, b)


class _UnionFind:
    def __init__(self):
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        self.parent[self.find(a)] = self.find(b)


def find_duplicates(items: list[Listing], tz: ZoneInfo, source_order: list[str]) -> dict[str, str]:
    """Returns {duplicate_id: canonical_id}. Canonical listings are not keys."""
    prepare(items, tz)
    rank = {name: i for i, name in enumerate(source_order)}

    def better(x: Listing) -> tuple:
        return (x.all_day, rank.get(x.source, len(rank)), x.start_at, x.id)

    by_date: dict[object, list[Listing]] = {}
    for it in items:
        by_date.setdefault(it.local_date, []).append(it)

    uf = _UnionFind()
    allday_hits: dict[str, list[Listing]] = {}   # all-day id -> timed listings it matches
    for day_items in by_date.values():
        n = len(day_items)
        for i in range(n):
            a = day_items[i]
            for j in range(i + 1, n):
                b = day_items[j]
                if not (a.words & b.words) or not is_match(a, b):
                    continue
                if a.all_day == b.all_day:
                    uf.union(a.id, b.id)           # timed–timed or all-day–all-day
                else:
                    ad, timed = (a, b) if a.all_day else (b, a)
                    allday_hits.setdefault(ad.id, []).append(timed)

    groups: dict[str, list[Listing]] = {}
    for it in items:
        groups.setdefault(uf.find(it.id), []).append(it)

    result: dict[str, str] = {}
    canonical_of: dict[str, str] = {}
    for members in groups.values():
        best = min(members, key=better)
        for m in members:
            canonical_of[m.id] = best.id
            if m.id != best.id:
                result[m.id] = best.id

    # Attach each all-day group to the earliest timed showtime any member matched.
    attached: set[str] = set()
    for ad_id, timed_list in allday_hits.items():
        root = uf.find(ad_id)
        if root in attached:
            continue
        group_timed = [t for m in groups[root] for t in allday_hits.get(m.id, [])]
        target = min(group_timed, key=lambda t: (t.start_at, better(t)))
        target_canon = canonical_of[target.id]
        for m in groups[root]:
            result[m.id] = target_canon
        attached.add(root)

    # Never point at something that is itself a duplicate.
    for k in list(result):
        seen = set()
        while result[k] in result and result[k] not in seen:
            seen.add(result[k])
            result[k] = result[result[k]]
    return result


# --------------------------------------------------------------------------- database side

LOAD_SQL = """
select e.id::text, s.name, e.title, e.start_at, e.end_at, e.venue_name,
       e.lat::float, e.lon::float
from events e join sources s on s.id = e.source_id
where coalesce(e.end_at, e.start_at) > now() - interval '1 day'
  and e.missed_runs < 2
"""


def load(conn) -> list[Listing]:
    return [Listing(*row) for row in conn.execute(LOAD_SQL).fetchall()]


def apply(conn, mapping: dict[str, str]) -> int:
    """Rewrites duplicate_of for current events to match `mapping`. Returns rows marked."""
    conn.execute("""update events set duplicate_of = null
                    where duplicate_of is not null
                      and coalesce(end_at, start_at) > now() - interval '1 day'""")
    with conn.cursor() as cur:
        cur.executemany("update events set duplicate_of = %s::uuid where id = %s::uuid",
                        [(canon, dup) for dup, canon in mapping.items()])
    return len(mapping)


def run(conn, city: dict) -> int:
    items = load(conn)
    mapping = find_duplicates(items, ZoneInfo(city["timezone"]), list(city["sources"]))
    return apply(conn, mapping)


def main(argv: list[str] | None = None) -> int:
    from . import db
    from .config import load_city

    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write duplicate_of (default: preview only)")
    ap.add_argument("--city", default=None)
    ap.add_argument("--limit", type=int, default=40, help="groups to print in preview")
    args = ap.parse_args(argv)

    city = load_city(args.city)
    tz = ZoneInfo(city["timezone"])
    conn = db.connect()
    items = load(conn)
    mapping = find_duplicates(items, tz, list(city["sources"]))
    by_id = {it.id: it for it in items}

    groups: dict[str, list[str]] = {}
    for dup, canon in mapping.items():
        groups.setdefault(canon, []).append(dup)
    print(f"{len(items)} current listings → {len(mapping)} duplicates in {len(groups)} groups\n")
    for canon, dups in sorted(groups.items(), key=lambda kv: by_id[kv[0]].start_at)[: args.limit]:
        c = by_id[canon]
        print(f"KEEP  {c.start_at.astimezone(tz):%a %b %d %I:%M%p}  [{c.source}] {c.title} @ {c.venue_name}")
        for d in dups:
            x = by_id[d]
            when = "all day" if x.all_day else f"{x.start_at.astimezone(tz):%I:%M%p}"
            print(f"  hide {when:>7}  [{x.source}] {x.title} @ {x.venue_name}")
    if args.apply:
        n = apply(conn, mapping)
        conn.commit()
        print(f"\nmarked {n} duplicates")
    else:
        print("\npreview only; add --apply to save")
    return 0


if __name__ == "__main__":
    sys.exit(main())
