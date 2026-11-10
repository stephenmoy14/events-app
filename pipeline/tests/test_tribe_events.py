import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from events_pipeline.sources.tribe_events import TribeEventsFetcher

DATA = json.loads((Path(__file__).parent / "fixtures" / "tribe_choosechicago_sample.json").read_text(encoding="utf-8"))
CITY = {"timezone": "America/Chicago", "window_days": 35}


def parsed():
    f = TribeEventsFetcher(CITY, {"base_url": "https://www.choosechicago.com"}, source_name="choose_chicago")
    return [e for e in (f.parse(r) for r in DATA["events"]) if e]


def by_title(events):
    return {e.title: e for e in events}


def test_html_entities_decoded():
    ev = by_title(parsed())["Chicago By Night River & Lake"]
    assert ev.venue_name == "Chicago’s First Lady Cruises"
    assert ev.category == "Tours & Attractions"


def test_prices_and_free_flag():
    evs = by_title(parsed())
    cruise = evs["Chicago By Night River & Lake"]
    assert (cruise.price_min, cruise.price_max, cruise.is_free) == (Decimal("50"), Decimal("50"), False)
    assert evs["We the People: Life, Liberty and the Pursuit of Beauty in Greektown Chicago"].is_free is True
    assert evs["NoMI Gallery | Everything is Bright. All Things are Beautiful."].is_free is None


def test_times_are_utc_and_ids_unique_per_occurrence():
    evs = parsed()
    nomi = by_title(evs)["NoMI Gallery | Everything is Bright. All Things are Beautiful."]
    assert nomi.start_at == datetime(2026, 10, 26, 5, 0, tzinfo=timezone.utc)
    assert nomi.source_event_id.endswith("/2026-10-26/")
    assert len({e.source_event_id for e in evs}) == len(evs)


def test_missing_venue_and_image_ok():
    ev = by_title(parsed())["Venue TBA Show"]
    assert ev.venue_name is None and ev.image_url is None and ev.end_at is None


def test_other_state_skipped():
    f = TribeEventsFetcher({**CITY, "state_code": "IL"}, {"base_url": "https://x"}, source_name="choose_chicago")
    raw = dict(DATA["events"][0], venue={"venue": "Cintas Center", "city": "Cincinnati", "stateprovince": "OH"})
    assert f.parse(raw) is None
    raw_il = dict(DATA["events"][0], venue={"venue": "NoMI", "city": "Chicago", "stateprovince": "IL"})
    assert f.parse(raw_il) is not None
