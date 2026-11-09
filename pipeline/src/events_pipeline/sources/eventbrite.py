"""Eventbrite API v3, by venue (and, best effort, by organizer).

Eventbrite removed location search in 2020, so we query a hand-kept list of IDs from
config/cities/<city>.yaml. Documented: GET /v3/venues/{venue_id}/events/ (status, order_by,
only_public). Organizer listing (/v3/organizers/{id}/events/) is the older endpoint and isn't
in the current docs, so it may stop working; a failing ID is logged and skipped.
Find IDs with:  python -m events_pipeline.eventbrite_lookup <event URL or ID>
"""
from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal

import httpx

from ..config import env
from ..models import Event
from .base import Fetcher

API = "https://www.eventbriteapi.com/v3"
EXPAND = "venue,ticket_availability,category"


def _utc(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _money(obj: dict | None) -> Decimal | None:
    if obj and obj.get("major_value") not in (None, ""):
        return Decimal(str(obj["major_value"]))
    return None


class EventbriteFetcher(Fetcher):
    name = "eventbrite"
    min_delay_s = 0.5

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        token = env("EVENTBRITE_TOKEN")
        if token:
            self.client.headers["Authorization"] = f"Bearer {token}"

    def fetch(self) -> list[Event]:
        if not env("EVENTBRITE_TOKEN"):
            raise RuntimeError("EVENTBRITE_TOKEN is not set")
        targets = [f"{API}/venues/{v}/events/" for v in self.cfg.get("venue_ids") or []]
        targets += [f"{API}/organizers/{o}/events/" for o in self.cfg.get("organizer_ids") or []]
        if not targets:
            raise RuntimeError("no venue_ids or organizer_ids configured for eventbrite")

        events: dict[str, Event] = {}
        failures = 0
        for url in targets:
            try:
                for raw in self._pages(url):
                    ev = self.parse(raw)
                    if ev and self.in_window(ev):
                        events[ev.source_event_id] = ev
            except httpx.HTTPStatusError as exc:
                failures += 1
                print(f"[{self.source_name}] skipping {url}: HTTP {exc.response.status_code}",
                      file=sys.stderr)
        if failures == len(targets):
            raise RuntimeError("every Eventbrite venue/organizer request failed")
        return list(events.values())

    def _pages(self, url: str):
        _, window_end = self.window()
        params = {"status": "live", "order_by": "start_asc", "only_public": "true", "expand": EXPAND}
        while True:
            data = self.get(url, params=params).json()
            batch = data.get("events", [])
            yield from batch
            pg = data.get("pagination", {})
            # Sorted by start, so stop once we're past the window.
            last_start = _utc((batch[-1].get("start") or {}).get("utc")) if batch else None
            if not pg.get("has_more_items") or (last_start and last_start >= window_end):
                break
            if pg.get("continuation"):
                params = {**params, "continuation": pg["continuation"]}
            else:
                params = {**params, "page": pg.get("page_number", 1) + 1}

    def parse(self, raw: dict) -> Event | None:
        start_at = _utc((raw.get("start") or {}).get("utc"))
        if start_at is None or raw.get("status") in ("canceled", "draft"):
            return None
        online = bool(raw.get("online_event"))
        if online and not self.cfg.get("include_online", False):
            return None
        venue = raw.get("venue") or {}
        addr = venue.get("address") or {}
        region = (addr.get("region") or "").upper()
        if region and region not in ("IL", "ILLINOIS"):
            return None                      # organizer events in other cities
        ticket = raw.get("ticket_availability") or {}
        price_min = _money(ticket.get("minimum_ticket_price"))
        price_max = _money(ticket.get("maximum_ticket_price"))
        lat, lon = venue.get("latitude") or addr.get("latitude"), venue.get("longitude") or addr.get("longitude")
        logo = raw.get("logo") or {}

        return Event(
            source=self.source_name,
            source_event_id=raw["id"],
            title=(raw.get("name") or {}).get("text") or "",
            start_at=start_at,
            end_at=_utc((raw.get("end") or {}).get("utc")),
            venue_name="Online" if online else venue.get("name"),
            address=addr.get("address_1"),
            lat=float(lat) if lat else None,
            lon=float(lon) if lon else None,
            price_min=price_min if not raw.get("is_free") else Decimal(0),
            price_max=price_max if not raw.get("is_free") else Decimal(0),
            is_free=raw.get("is_free"),
            category=(raw.get("category") or {}).get("name"),
            url=raw["url"],
            image_url=(logo.get("original") or {}).get("url") or logo.get("url") or None,
        )
