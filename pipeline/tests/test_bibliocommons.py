import json
from datetime import datetime, timezone
from pathlib import Path

from events_pipeline.sources.bibliocommons import BiblioCommonsFetcher

DATA = json.loads((Path(__file__).parent / "fixtures" / "bibliocommons_chipublib_sample.json").read_text(encoding="utf-8"))
CITY = {"timezone": "America/Chicago", "window_days": 35}


def fetcher(**cfg):
    return BiblioCommonsFetcher(CITY, {"library": "chipublib", **cfg}, source_name="chicago_public_library")


def by_title(events):
    return {e.title: e for e in events}


def test_branch_event_parsed():
    ev = by_title(fetcher().parse_page(DATA))["Meet the Maker: Redemptive Plastics"]
    assert ev.source == "chicago_public_library"
    assert ev.start_at == datetime(2026, 10, 27, 20, 30, tzinfo=timezone.utc)
    assert ev.venue_name == "Chicago Public Library – Obama Presidential Center (Maker Lab)"
    assert ev.address == "6021 S. Stony Island Avenue"
    assert ev.category == "Lectures"
    assert ev.is_free is True
    assert str(ev.url) == "https://chipublib.bibliocommons.com/events/6ac01b8c377296003a494758"


def test_cancelled_and_virtual_skipped_by_default():
    titles = by_title(fetcher().parse_page(DATA))
    assert "Cancelled Storytime" not in titles
    assert "Homework Help: Virtual Teacher in the Library" not in titles
    assert len(titles) == 2


def test_virtual_kept_when_enabled():
    titles = by_title(fetcher(include_online=True).parse_page(DATA))
    assert titles["Homework Help: Virtual Teacher in the Library"].venue_name == "Online"
