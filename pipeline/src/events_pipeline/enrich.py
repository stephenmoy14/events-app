"""Adds fields every source should have but none provide consistently:

  • category_group — one of a fixed list, mapped from each source's own category labels
    (and, when a source gives none, from obvious words in the title);
  • neighborhood — the Chicago community area containing the event's coordinates.

The website filters and the Phase 8 chatbot rely on both.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import httpx

from .config import REPO_ROOT, env
from .models import Event

# Display order for the website. Keys are what's stored in events.category_group.
CATEGORY_GROUPS = {
    "music": "Music",
    "comedy": "Comedy",
    "theater": "Theater",
    "arts": "Arts & museums",
    "food": "Food & drink",
    "nightlife": "Nightlife",
    "sports": "Sports & fitness",
    "outdoors": "Outdoors & tours",
    "family": "Kids & family",
    "learning": "Classes & talks",
    "community": "Markets & festivals",
    "other": "Other",
}

# Checked in order; first match wins. Matched against each part of the source's category
# ("Arts & Theatre / Comedy" is checked as "Comedy" first, then "Arts & Theatre").
_RULES: list[tuple[str, str]] = [
    ("comedy", r"comed|improv|stand.?up"),
    ("family", r"child|kids?\b|family|families|storytime|story time|toddler|baby|babies|teens?\b|tweens?\b|youth"),
    ("music", r"music|concert|jazz|blues|rock|hip.?hop|\brap\b|r&b|classical|symphon|orchestra|opera|choir|choral"
              r"|\bdj\b|country|folk|\bpop\b|metal|punk|indie|electronic|\bedm\b|latin|reggae|soul|gospel"),
    ("theater", r"theat|musical|broadway|\bplays?\b|drama|circus|magic|illusion|cabaret|burlesque|spectacular"),
    ("learning", r"lecture|workshop|class|course|seminar|\btalks?\b|computer|technolog|\besl\b|\bell\b|language"
                 r"|homework|career|\bjobs?\b|financ|citizenship|book club|\bdiy\b|maker|stem|science|educat|learn"
                 r"|history|genealog|business|\blaw\b|money"),
    ("arts", r"\barts?\b|fine art|museum|exhibit|gallery|galleries|dance|ballet|film|movie|cinema|photograph"
             r"|literar|poetry|\bbooks?\b|author|reading|craft"),
    ("sports", r"sport|basketball|football|baseball|hockey|soccer|\bnba\b|\bnfl\b|\bmlb\b|\bnhl\b|\bmls\b|wrestl"
               r"|boxing|\bmma\b|\bufc\b|racing|tennis|golf|marathon|\b5k\b|\b10k\b|fitness|yoga|\brun\b"),
    ("outdoors", r"outdoor|\bparks?\b|nature|garden|hike|hiking|\bbird|walk|\btours?\b|cruise|boat|attraction"),
    ("food", r"\bfood|drink|dining|restaurant|beer|wine|cocktail|brunch|tasting|culinary|cooking"),
    ("nightlife", r"nightlife|party|parties|\bclub|\bbars?\b|karaoke|trivia|drag"),
    ("community", r"festival|\bfest\b|market|\bfair\b|parade|holiday|community|civic|volunteer|cultur|heritage"
                  r"|celebrat|outreach|meeting"),
]
_COMPILED = [(group, re.compile(pattern, re.I)) for group, pattern in _RULES]

# Title words are only trusted for unambiguous signals.
_TITLE_RULES = [
    ("sports", re.compile(r"\bvs\.?\s", re.I)),
    ("comedy", re.compile(r"comed|stand.?up|improv", re.I)),
    ("music", re.compile(r"concert|symphony|orchestra|\bjazz\b|\bdj\b|quartet|philharmonic", re.I)),
    ("family", re.compile(r"storytime|story time|\bkids?\b|family", re.I)),
    ("community", re.compile(r"\bmarket\b|festival|parade|\bfair\b", re.I)),
    ("food", re.compile(r"tasting|brunch|food truck|beer fest|wine", re.I)),
    ("nightlife", re.compile(r"trivia|karaoke|\bdrag\b", re.I)),
    ("outdoors", re.compile(r"cruise|walking tour|boat tour|\bhike\b|bird walk", re.I)),
    ("learning", re.compile(r"workshop|\bclass\b|lecture|seminar", re.I)),
    ("arts", re.compile(r"museum|exhibit|gallery", re.I)),
]

# Labels that mean "no label" (Ticketmaster uses these for unclassified events).
_EMPTY_LABELS = {"undefined", "miscellaneous", "other", "n/a"}


def category_group(raw: str | None, title: str | None = None) -> str:
    """Map a source's category label (or, failing that, the title) to a fixed group."""
    if raw:
        parts = [p.strip() for p in raw.split("/") if p.strip().lower() not in _EMPTY_LABELS and p.strip()]
        for part in reversed(parts):
            for group, rx in _COMPILED:
                if rx.search(part):
                    return group
    if title:
        for group, rx in _TITLE_RULES:
            if rx.search(title):
                return group
    return "other"


# --------------------------------------------------------------------------- neighborhoods

def _ring_contains(ring: list[list[float]], x: float, y: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _polygon_contains(poly: list, x: float, y: float) -> bool:
    outer, holes = poly[0], poly[1:]
    return _ring_contains(outer, x, y) and not any(_ring_contains(h, x, y) for h in holes)


def _pretty(name: str) -> str:
    name = name.title()
    name = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), name)
    return name.replace("O'H", "O'H")


class Neighborhoods:
    """Point-in-polygon lookup over a GeoJSON file of named areas (no extra dependencies)."""

    def __init__(self, geojson: dict, name_property: str):
        self.areas = []
        for feat in geojson.get("features", []):
            geom = feat.get("geometry") or {}
            polys = geom.get("coordinates", [])
            if geom.get("type") == "Polygon":
                polys = [polys]
            elif geom.get("type") != "MultiPolygon":
                continue
            xs = [p[0] for poly in polys for p in poly[0]]
            ys = [p[1] for poly in polys for p in poly[0]]
            name = _pretty(str(feat.get("properties", {}).get(name_property, "")).strip())
            if name:
                self.areas.append((name, (min(xs), min(ys), max(xs), max(ys)), polys))

    def lookup(self, lat: float | None, lon: float | None) -> str | None:
        if lat is None or lon is None:
            return None
        for name, (x0, y0, x1, y1), polys in self.areas:
            if x0 <= lon <= x1 and y0 <= lat <= y1 and any(_polygon_contains(p, lon, lat) for p in polys):
                return name
        return None

    @classmethod
    def from_config(cls, city: dict) -> "Neighborhoods | None":
        cfg = city.get("neighborhoods")
        if not cfg:
            return None
        path = REPO_ROOT / cfg["file"]
        if not path.exists() and cfg.get("url"):
            print(f"[neighborhoods] downloading {cfg['url']} → {cfg['file']} (commit this file)",
                  file=sys.stderr)
            r = httpx.get(cfg["url"], timeout=60, follow_redirects=True,
                          headers={"User-Agent": env("USER_AGENT", "ChicagoEventsBot/0.1")})
            r.raise_for_status()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(r.text, encoding="utf-8")
        if not path.exists():
            print(f"[neighborhoods] {path} not found; skipping neighborhoods", file=sys.stderr)
            return None
        return cls(json.loads(Path(path).read_text(encoding="utf-8")), cfg.get("name_property", "name"))


def km_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def in_area(ev: Event, city: dict) -> bool:
    """False for events whose coordinates put them clearly outside the city's area."""
    center, radius = city.get("center"), city.get("radius_km")
    if not center or not radius or ev.lat is None or ev.lon is None:
        return True
    return km_between(ev.lat, ev.lon, center[0], center[1]) <= radius


def enrich(events: list[Event], areas: Neighborhoods | None) -> list[Event]:
    out = []
    for ev in events:
        update = {"category_group": category_group(ev.category, ev.title)}
        if ev.is_free is None and ev.price_max is not None and ev.price_max == 0:
            update["is_free"] = True         # "$0" tickets are free RSVPs
        if areas and not ev.neighborhood:
            update["neighborhood"] = areas.lookup(ev.lat, ev.lon)
        out.append(ev.model_copy(update=update))
    return out
