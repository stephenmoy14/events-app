"""Ticketmaster Discovery API v2.

Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
Free key: 5,000 calls/day, 5 req/s. Deep paging caps at 1,000 results per query
(size * page < 1000), so the window is split into weekly chunks.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import env
from ..models import Event
from .base import Fetcher

BASE = "https://app.ticketmaster.com/discovery/v2/events.json"
PAGE_SIZE = 200
CHUNK_DAYS = 7


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class TicketmasterFetcher(Fetcher):
    name = "ticketmaster"
    min_delay_s = 0.25

    def fetch(self) -> list[Event]:
        key = env("TICKETMASTER_API_KEY")
        if not key:
            raise RuntimeError("TICKETMASTER_API_KEY is not set")
        start, end = self.window()
        events: dict[str, Event] = {}
        chunk_start = start
        while chunk_start < end:
            chunk_end = min(chunk_start + timedelta(days=CHUNK_DAYS), end)
            for raw in self._pages(key, chunk_start, chunk_end):
                ev = self.parse(raw)
                if ev:
                    events[ev.source_event_id] = ev
            chunk_start = chunk_end
        return list(events.values())

    def _pages(self, key: str, start: datetime, end: datetime):
        page = 0
        while True:
            params = {
                "apikey": key,
                **self.cfg.get("params", {}),
                "startDateTime": _iso(start),
                "endDateTime": _iso(end),
                "size": PAGE_SIZE,
                "page": page,
                "sort": "date,asc",
            }
            data = self.get(BASE, params=params).json()
            yield from data.get("_embedded", {}).get("events", [])
            info = data.get("page", {})
            page += 1
            if page >= info.get("totalPages", 0) or (page + 1) * PAGE_SIZE > 1000:
                break

    def parse(self, raw: dict) -> Event | None:
        """Turn one Discovery API event into an Event. Returns None for TBA/unusable rows."""
        start_info = raw.get("dates", {}).get("start", {})
        start_at = self._dt(start_info)
        if start_at is None:
            return None
        end_at = self._dt(raw.get("dates", {}).get("end", {}))

        venue = (raw.get("_embedded", {}).get("venues") or [{}])[0]
        loc = venue.get("location") or {}
        prices = raw.get("priceRanges") or []
        cls = (raw.get("classifications") or [{}])[0]
        images = sorted(raw.get("images") or [], key=lambda i: i.get("width", 0), reverse=True)

        return Event(
            source=self.source_name,
            source_event_id=raw["id"],
            title=raw["name"],
            start_at=start_at,
            end_at=end_at,
            venue_name=venue.get("name"),
            address=(venue.get("address") or {}).get("line1"),
            lat=float(loc["latitude"]) if loc.get("latitude") else None,
            lon=float(loc["longitude"]) if loc.get("longitude") else None,
            price_min=min((p["min"] for p in prices if "min" in p), default=None),
            price_max=max((p["max"] for p in prices if "max" in p), default=None),
            category=(cls.get("segment") or {}).get("name"),
            url=raw["url"],
            image_url=images[0]["url"] if images else None,
        )

    def _dt(self, info: dict) -> datetime | None:
        if info.get("dateTBD") or info.get("dateTBA"):
            return None
        if info.get("dateTime"):
            return datetime.fromisoformat(info["dateTime"].replace("Z", "+00:00"))
        if info.get("localDate"):
            t = info.get("localTime", "00:00:00")
            return datetime.fromisoformat(f"{info['localDate']}T{t}").replace(tzinfo=self.tz)
        return None
