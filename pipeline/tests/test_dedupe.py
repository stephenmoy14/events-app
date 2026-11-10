from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from events_pipeline.dedupe import Listing, find_duplicates

CHI = ZoneInfo("America/Chicago")
ORDER = ["ticketmaster", "eventbrite", "chicago_public_library", "choose_chicago"]


def at(day, hour, minute=0):
    return datetime(2026, 11, day, hour, minute, tzinfo=CHI).astimezone(timezone.utc)


def allday(day):
    start = datetime(2026, 11, day, 0, 0, tzinfo=CHI).astimezone(timezone.utc)
    return start, start + timedelta(hours=23, minutes=59, seconds=59)


def L(id, source, title, start, end=None, venue=None, lat=None, lon=None):
    return Listing(id, source, title, start, end, venue, lat, lon)


def dupes(*items):
    return find_duplicates(list(items), CHI, ORDER)


def test_showtimes_stay_separate_and_allday_attaches_to_earliest():
    # Vape! on Nov 21: Ticketmaster 2pm + 8pm, Choose Chicago all-day listing.
    s, e = allday(21)
    result = dupes(
        L("tm1", "ticketmaster", "VAPE! The Grease Parody", at(21, 14), venue="Apollo Theater", lat=41.9339, lon=-87.6573),
        L("tm2", "ticketmaster", "VAPE! The Grease Parody", at(21, 20), venue="Apollo Theater", lat=41.9339, lon=-87.6573),
        L("cc1", "choose_chicago", "Vape! The Grease Parody", s, e, venue="Apollo Theater Chicago"),
    )
    assert result == {"cc1": "tm1"}


def test_evening_show_matches_on_chicago_date_not_utc():
    # 7:30pm Chicago is 01:30 UTC the next day; the all-day listing is for the Chicago date.
    s, e = allday(12)
    result = dupes(
        L("tm", "ticketmaster", "Elf in Concert", at(12, 19, 30), venue="Symphony Center", lat=41.8796, lon=-87.6249),
        L("cc", "choose_chicago", "Elf in Concert", s, e, venue="Symphony Center"),
    )
    assert result == {"cc": "tm"}


def test_timed_listings_within_30_minutes_merge_and_ticketmaster_wins():
    result = dupes(
        L("cc", "choose_chicago", "Chicago Bulls vs. Denver Nuggets", at(23, 19, 0), venue="United Center"),
        L("tm", "ticketmaster", "Chicago Bulls vs. Denver Nuggets", at(23, 19, 10), venue="United Center", lat=41.8807, lon=-87.6742),
    )
    assert result == {"cc": "tm"}


def test_different_games_same_day_do_not_merge():
    result = dupes(
        L("a", "ticketmaster", "Chicago Bulls vs. Denver Nuggets", at(23, 19), venue="United Center"),
        L("b", "choose_chicago", "Chicago Bulls vs. Houston Rockets", at(23, 19), venue="United Center"),
    )
    assert result == {}


def test_same_title_different_venues_do_not_merge():
    result = dupes(
        L("a", "ticketmaster", "Handmade Market", at(14, 11), venue="Plumbers Hall", lat=41.889, lon=-87.666),
        L("b", "choose_chicago", "Handmade Market", at(14, 11), venue="Some Other Place", lat=41.95, lon=-87.70),
    )
    assert result == {}


def test_contained_title_merges():
    result = dupes(
        L("tm", "ticketmaster", "Postcard from Vienna: Muti & Bronfman", at(11, 19, 30), venue="Symphony Center"),
        L("cc", "choose_chicago", "CSO: Postcard from Vienna – Muti and Bronfman", at(11, 19, 30), venue="Symphony Center"),
    )
    assert result == {"cc": "tm"}


def test_generic_title_without_venue_does_not_merge():
    result = dupes(
        L("a", "chicago_public_library", "Storytime", at(14, 10), venue="Chicago Public Library – Chicago Bee"),
        L("b", "choose_chicago", "Storytime", at(14, 10)),
    )
    assert result == {}


def test_same_source_needs_near_identical_time():
    result = dupes(
        L("a", "ticketmaster", "Wild Kratts LIVE! 2.0", at(14, 11), venue="Chicago Theatre"),
        L("b", "ticketmaster", "Wild Kratts LIVE! 2.0", at(14, 11), venue="Chicago Theatre"),
        L("c", "ticketmaster", "Wild Kratts LIVE! 2.0", at(14, 11, 20), venue="Chicago Theatre"),
    )
    assert len(result) == 1 and set(result) <= {"a", "b"} and "c" not in result


def test_chains_resolve_to_one_canonical():
    s, e = allday(28)
    result = dupes(
        L("tm", "ticketmaster", "A Drag Queen Christmas", at(28, 19), venue="Chicago Theatre", lat=41.8855, lon=-87.6273),
        L("eb", "eventbrite", "A Drag Queen Christmas", at(28, 19, 15), venue="The Chicago Theatre", lat=41.8856, lon=-87.6272),
        L("cc", "choose_chicago", "A Drag Queen Christmas", s, e, venue="Chicago Theatre"),
    )
    assert result == {"eb": "tm", "cc": "tm"}


def test_generic_venue_names_still_compare():
    result = dupes(
        L("tm", "ticketmaster", "Wild Kratts LIVE! 2.0", at(14, 11), venue="Chicago Theatre"),
        L("cc", "choose_chicago", "Wild Kratts LIVE! 2.0", at(14, 11), venue="The Chicago Theatre"),
        L("x", "choose_chicago", "Wild Kratts LIVE! 2.0", at(14, 11), venue="Auditorium Theatre"),
    )
    assert result == {"cc": "tm"}


def test_timed_entry_slots_collapse_to_earliest_per_day():
    venue = dict(venue="Balloon Museum", lat=41.89, lon=-87.62)
    items = [L(f"d1-{h}{m}", "ticketmaster", "Balloon Museum | EmotionAir - Art You Can Feel - Chicago", at(14, h, m), **venue)
             for h in range(10, 18) for m in (0, 30)]
    items += [L(f"d2-{h}", "ticketmaster", "Balloon Museum | EmotionAir - Art You Can Feel - Chicago", at(15, h), **venue)
              for h in range(10, 14)]
    result = dupes(*items)
    assert "d1-100" not in result and "d2-10" not in result          # earliest each day stays
    assert set(result.values()) == {"d1-100", "d2-10"}
    assert len(result) == len(items) - 2


def test_three_showtimes_are_not_timed_entry():
    items = [L(f"s{h}", "ticketmaster", "Wild Kratts LIVE! 2.0", at(14, h), venue="Chicago Theatre") for h in (11, 14, 17)]
    assert dupes(*items) == {}
