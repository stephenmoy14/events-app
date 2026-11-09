import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from events_pipeline.sources.eventbrite import EventbriteFetcher

DATA = json.loads((Path(__file__).parent / "fixtures" / "eventbrite_venue_sample.json").read_text(encoding="utf-8"))
CITY = {"timezone": "America/Chicago", "window_days": 35}


def parsed(**cfg):
    f = EventbriteFetcher(CITY, cfg)
    return {e.title: e for e in (f.parse(r) for r in DATA["events"]) if e}


def test_paid_event_parsed():
    ev = parsed()["Late Night Jazz & Soul"]
    assert ev.start_at == datetime(2026, 11, 8, 3, 0, tzinfo=timezone.utc)
    assert ev.venue_name == "Example Lounge"
    assert (ev.price_min, ev.price_max, ev.is_free) == (Decimal("15.00"), Decimal("25.00"), False)
    assert ev.category == "Music"
    assert str(ev.image_url).endswith("original.jpg")


def test_free_event_zero_price():
    ev = parsed()["Free Community Yoga"]
    assert ev.is_free is True and ev.price_min == 0


def test_out_of_state_and_online_skipped():
    evs = parsed()
    assert "Organizer's Milwaukee Show" not in evs
    assert "Online Workshop" not in evs
    assert "Online Workshop" in parsed(include_online=True)
