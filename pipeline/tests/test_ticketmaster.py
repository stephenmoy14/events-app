import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from events_pipeline.normalize import content_hash, to_utc
from events_pipeline.sources.ticketmaster import TicketmasterFetcher

FIXTURE = Path(__file__).parent / "fixtures" / "ticketmaster_sample.json"
CITY = {"timezone": "America/Chicago", "window_days": 35}


@pytest.fixture
def raw_events():
    return json.loads(FIXTURE.read_text())["_embedded"]["events"]


@pytest.fixture
def fetcher():
    return TicketmasterFetcher(CITY, {})


def test_parses_full_event(fetcher, raw_events):
    ev = fetcher.parse(raw_events[0])
    assert ev.title == "Sample Band Live"
    assert ev.start_at == datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)
    assert ev.venue_name == "Metro"
    assert ev.category == "Music"
    assert float(ev.price_min) == 25.0 and float(ev.price_max) == 60.0
    assert str(ev.image_url).endswith("large.jpg")  # widest image wins


def test_local_date_falls_back_to_chicago_time(fetcher, raw_events):
    ev = to_utc(fetcher.parse(raw_events[1]))
    # 8pm CDT on Oct 25 = 01:00 UTC Oct 26
    assert ev.start_at == datetime(2026, 10, 26, 1, 0, tzinfo=timezone.utc)


def test_tba_events_are_skipped(fetcher, raw_events):
    assert fetcher.parse(raw_events[2]) is None


def test_content_hash_is_stable(fetcher, raw_events):
    a = fetcher.parse(raw_events[0])
    b = fetcher.parse(raw_events[0])
    assert content_hash(a) == content_hash(b)
