"""The Events Calendar (WordPress plugin by StellarWP / "tribe") REST API.

Any WordPress site running The Events Calendar exposes:
    {base_url}/wp-json/tribe/events/v1/events?start_date=...&end_date=...&per_page=50&page=N
Used for Choose Chicago today; add another site by adding a config entry, no new code.
Audit (2026-10-26): choosechicago.com robots.txt allows /wp-json/ but asks for a 20s crawl
delay and disallows the ?ical= export, so use this API and set delay_seconds: 20.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from ..models import Event
from .base import Fetcher

PAGE_SIZE = 50   # the plugin's default maximum
_STATE_NAMES = {"IL": "ILLINOIS"}


def _utc(value: str | None) -> datetime | None:
    # "2026-10-26 05:00:00" (already UTC)
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def _prices(raw: dict) -> tuple[Decimal | None, Decimal | None]:
    vals = []
    for v in (raw.get("cost_details") or {}).get("values") or []:
        try:
            vals.append(Decimal(str(v)))
        except InvalidOperation:
            pass
    return (min(vals), max(vals)) if vals else (None, None)


class TribeEventsFetcher(Fetcher):
    name = "tribe_events"
    min_delay_s = 5.0

    def fetch(self) -> list[Event]:
        url = self.cfg["base_url"].rstrip("/") + "/wp-json/tribe/events/v1/events"
        start, end = self.window()
        params = {
            "start_date": start.strftime("%Y-%m-%d %H:%M:%S"),   # site-local time
            "end_date": end.strftime("%Y-%m-%d %H:%M:%S"),
            "per_page": PAGE_SIZE,
            "status": "publish",
        }
        events: dict[str, Event] = {}
        page, total_pages = 1, 1
        while page <= total_pages:
            data = self.get(url, params={**params, "page": page}).json()
            total_pages = data.get("total_pages", 0)
            for raw in data.get("events", []):
                ev = self.parse(raw)
                if ev and self.in_window(ev):
                    events[ev.source_event_id] = ev
            page += 1
        return list(events.values())

    def parse(self, raw: dict) -> Event | None:
        start_at = _utc(raw.get("utc_start_date"))
        if start_at is None or not raw.get("url"):
            return None
        venue = raw.get("venue") if isinstance(raw.get("venue"), dict) else {}
        state = (venue.get("stateprovince") or venue.get("state") or venue.get("province") or "").strip().upper()
        wanted = (self.city.get("state_code") or "").upper()
        if state and wanted and state not in (wanted, _STATE_NAMES.get(wanted, "")):
            return None                      # e.g. a Cincinnati game listed on a Chicago site
        price_min, price_max = _prices(raw)
        cost = (raw.get("cost") or "").strip().lower()
        is_free = True if cost == "free" or (price_max is not None and price_max == 0) else (
            False if price_max else None)
        cats = raw.get("categories") or []
        image = raw.get("image") if isinstance(raw.get("image"), dict) else {}
        lat, lon = venue.get("geo_lat"), venue.get("geo_lng")

        return Event(
            source=self.source_name,
            # Recurring events share an id across dates; the URL includes the date, so it's
            # unique per occurrence.
            source_event_id=raw["url"],
            title=raw.get("title") or "",
            start_at=start_at,
            end_at=_utc(raw.get("utc_end_date")),
            venue_name=venue.get("venue"),
            address=venue.get("address"),
            lat=float(lat) if lat not in (None, "") else None,
            lon=float(lon) if lon not in (None, "") else None,
            price_min=price_min,
            price_max=price_max,
            is_free=is_free,
            category=cats[0]["name"] if cats else None,
            url=raw["url"],
            image_url=image.get("url") or None,
        )
