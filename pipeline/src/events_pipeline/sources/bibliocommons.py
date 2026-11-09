"""BiblioCommons Events (used by Chicago Public Library and many other libraries).

The library's own events page loads its data from this public JSON API:
    https://gateway.bibliocommons.com/v2/libraries/{library}/events?page=N&limit=100
Audit (2026-10-26): no robots.txt on the gateway host; the library site's robots.txt allows
/events. Results are not strictly sorted by date and date filters aren't supported, so we read
every page and filter to the window ourselves. Library events are free.
"""
from __future__ import annotations

from datetime import datetime

from ..models import Event
from .base import Fetcher

GATEWAY = "https://gateway.bibliocommons.com/v2/libraries/{library}/events"
PAGE_SIZE = 100


def _utc(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class BiblioCommonsFetcher(Fetcher):
    name = "bibliocommons"
    min_delay_s = 10.0

    @property
    def library(self) -> str:
        return self.cfg["library"]          # e.g. "chipublib"

    def fetch(self) -> list[Event]:
        url = GATEWAY.format(library=self.library)
        events: dict[str, Event] = {}
        page, pages = 1, 1
        while page <= pages:
            data = self.get(url, params={"page": page, "limit": PAGE_SIZE, "locale": "en-US"}).json()
            pages = data.get("events", {}).get("pagination", {}).get("pages", 0)
            for ev in self.parse_page(data):
                if self.in_window(ev):
                    events[ev.source_event_id] = ev
            page += 1
        return list(events.values())

    def parse_page(self, data: dict) -> list[Event]:
        ents = data.get("entities", {})
        locations = ents.get("locations", {})
        types = ents.get("eventTypes", {})
        out = []
        for raw in ents.get("events", {}).values():
            ev = self.parse(raw, locations, types)
            if ev:
                out.append(ev)
        return out

    def parse(self, raw: dict, locations: dict, types: dict) -> Event | None:
        d = raw.get("definition", {})
        if d.get("isCancelled"):
            return None
        is_virtual = bool(d.get("isVirtual")) or not (d.get("branchLocationId") or d.get("nonBranchLocationId"))
        if is_virtual and not self.cfg.get("include_online", False):
            return None

        start_at = _utc(raw.get("indexStart"))
        if start_at is None and d.get("start"):        # fall back to local wall-clock time
            start_at = datetime.fromisoformat(d["start"]).replace(tzinfo=self.tz)
        if start_at is None:
            return None
        end_at = _utc(raw.get("indexEnd"))
        if end_at is None and d.get("end"):
            end_at = datetime.fromisoformat(d["end"]).replace(tzinfo=self.tz)

        loc = locations.get(str(d.get("branchLocationId")), {})
        addr = loc.get("address") or {}
        point = (loc.get("mapLocation") or {}).get("centrePoint") or {}
        venue = f"Chicago Public Library – {loc['name']}" if loc.get("name") else None
        if venue and d.get("locationDetails"):
            venue = f"{venue} ({d['locationDetails']})"
        type_names = [types[t]["name"] for t in d.get("typeIds", []) if t in types]

        return Event(
            source=self.source_name,
            source_event_id=raw["id"],
            title=d.get("title") or "",
            start_at=start_at,
            end_at=end_at,
            venue_name="Online" if is_virtual else venue,
            address=" ".join(filter(None, [addr.get("number"), addr.get("street")])) or None,
            lat=point.get("lat"),
            lon=point.get("lng"),
            is_free=True,
            price_min=0,
            price_max=0,
            category=type_names[0] if type_names else None,
            url=f"https://{self.library}.bibliocommons.com/events/{raw['id']}",
        )
