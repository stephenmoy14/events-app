"""The one Event shape every fetcher returns."""
from __future__ import annotations

import html
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, HttpUrl, field_validator


class Event(BaseModel):
    source: str                 # sources.name, e.g. "ticketmaster"
    source_event_id: str        # the source's own ID, or the URL
    title: str
    start_at: datetime          # must be timezone-aware
    end_at: datetime | None = None
    venue_name: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    lat: float | None = None
    lon: float | None = None
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    is_free: bool | None = None
    category: str | None = None           # the source's own label
    category_group: str | None = None     # fixed list, see enrich.CATEGORY_GROUPS
    url: HttpUrl
    image_url: HttpUrl | None = None

    @field_validator("start_at", "end_at")
    @classmethod
    def _tz_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("datetimes must be timezone-aware")
        return v

    @field_validator("title", "venue_name", "address", "category")
    @classmethod
    def _clean_text(cls, v: str | None) -> str | None:
        """Decode HTML entities (&amp; -> &) and collapse whitespace."""
        if v is None:
            return None
        v = " ".join(html.unescape(v).split())
        return v or None

    @field_validator("title")
    @classmethod
    def _title_required(cls, v: str | None) -> str:
        if not v:
            raise ValueError("title is empty")
        return v
