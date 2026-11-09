"""Find the Eventbrite venue and organizer IDs behind an event, to add to the city config.

    python -m events_pipeline.eventbrite_lookup https://www.eventbrite.com/e/some-show-tickets-123456789012
    python -m events_pipeline.eventbrite_lookup 123456789012

Tip: open a few events at a venue or by an organizer you like, run this on each, and paste the
IDs into venue_ids / organizer_ids in config/cities/chicago.yaml.
"""
from __future__ import annotations

import re
import sys

import httpx

from .config import env


def event_id(arg: str) -> str:
    m = re.search(r"(\d{9,})", arg)
    if not m:
        raise SystemExit(f"couldn't find an event ID in {arg!r}")
    return m.group(1)


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    token = env("EVENTBRITE_TOKEN")
    if not token:
        raise SystemExit("EVENTBRITE_TOKEN is not set (see .env.example)")
    headers = {"Authorization": f"Bearer {token}"}
    for arg in args:
        eid = event_id(arg)
        r = httpx.get(f"https://www.eventbriteapi.com/v3/events/{eid}/",
                      params={"expand": "venue,organizer"}, headers=headers, timeout=30)
        if r.status_code != 200:
            print(f"{eid}: HTTP {r.status_code} {r.text[:200]}")
            continue
        e = r.json()
        venue, org = e.get("venue") or {}, e.get("organizer") or {}
        city = (venue.get("address") or {}).get("city")
        print(f"{e['name']['text']}")
        print(f"  venue_id:     {e.get('venue_id')}   # {venue.get('name')} ({city})")
        print(f"  organizer_id: {e.get('organizer_id')}   # {org.get('name')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
