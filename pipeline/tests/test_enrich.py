from datetime import datetime, timezone

from events_pipeline.enrich import Neighborhoods, category_group, enrich
from events_pipeline.models import Event


def test_source_labels_map_to_groups():
    assert category_group("Arts & Theatre / Comedy") == "comedy"
    assert category_group("Arts & Theatre / Theatre") == "theater"
    assert category_group("Arts & Theatre / Dance") == "arts"
    assert category_group("Music / Classical") == "music"
    assert category_group("Sports / Basketball") == "sports"
    assert category_group("Lectures") == "learning"
    assert category_group("Computers and Technology") == "learning"
    assert category_group("Tours & Attractions") == "outdoors"
    assert category_group("Family / Children's Theatre") == "family"


def test_title_used_only_when_no_label():
    assert category_group(None, "Chicago Bulls vs. Denver Nuggets") == "sports"
    assert category_group("", "Handmade Market") == "community"
    assert category_group(None, "Elf in Concert") == "music"
    assert category_group(None, "NoMI Gallery | Everything is Bright") == "other"
    assert category_group("Lectures", "Jazz history") == "learning"   # label beats title


SQUARE = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"community": "LOGAN SQUARE"},
     "geometry": {"type": "MultiPolygon", "coordinates": [[[[-87.72, 41.91], [-87.68, 41.91], [-87.68, 41.94], [-87.72, 41.94], [-87.72, 41.91]]]]}},
    {"type": "Feature", "properties": {"community": "MCKINLEY PARK"},
     "geometry": {"type": "Polygon", "coordinates": [[[-87.70, 41.82], [-87.66, 41.82], [-87.66, 41.84], [-87.70, 41.84], [-87.70, 41.82]],
                                                     [[-87.69, 41.825], [-87.68, 41.825], [-87.68, 41.835], [-87.69, 41.835], [-87.69, 41.825]]]}},
]}


def test_neighborhood_lookup():
    areas = Neighborhoods(SQUARE, "community")
    assert areas.lookup(41.923, -87.703) == "Logan Square"
    assert areas.lookup(41.83, -87.665) == "McKinley Park"
    assert areas.lookup(41.83, -87.685) is None        # inside the hole
    assert areas.lookup(41.88, -87.63) is None         # outside everything
    assert areas.lookup(None, None) is None


def test_enrich_sets_both_fields():
    ev = Event(source="x", source_event_id="1", title="Jazz night", start_at=datetime(2026, 11, 20, 2, tzinfo=timezone.utc),
               category="Music / Jazz", lat=41.923, lon=-87.703, url="https://example.com/1")
    [out] = enrich([ev], Neighborhoods(SQUARE, "community"))
    assert out.category_group == "music" and out.neighborhood == "Logan Square"
