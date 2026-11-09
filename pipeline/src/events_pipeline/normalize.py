"""Cleanup shared by all sources, plus the content hash used to skip no-op updates."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import timezone

from .models import Event

_HASH_FIELDS = ("title", "start_at", "end_at", "venue_name", "address",
                "price_min", "price_max", "is_free", "category", "url", "image_url")


def to_utc(event: Event) -> Event:
    return event.model_copy(update={
        "start_at": event.start_at.astimezone(timezone.utc),
        "end_at": event.end_at.astimezone(timezone.utc) if event.end_at else None,
    })


def content_hash(event: Event) -> str:
    data = event.model_dump(mode="json", include=set(_HASH_FIELDS))
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def match_key(title: str) -> str:
    """Lowercased, punctuation-free title for cross-source matching (phase 5)."""
    return re.sub(r"[^a-z0-9 ]", "", title.lower()).strip()
