# Source audit

Fill in the last two columns during phase 1. Add rows freely.

Scrapeability check, in order:
1. `robots.txt` + terms of use — if forbidden, skip.
2. View source → search `application/ld+json` with `"@type": "Event"`.
3. Calendar feed: `.ics` link, or `/wp-json/tribe/events/v1/events`.
4. Network tab → JSON request that loads events.
5. Last resort: HTML parsing / Playwright.

| Source | Type | Access | Cadence | Scrapeable? | Method found | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Ticketmaster Discovery | API | city=Chicago | daily | ✅ API | REST v2 | Live since phase 2. Follow branding/attribution terms |
| Eventbrite | API | venue IDs (+ organizer IDs, best effort) | daily | ✅ API | `/v3/venues/{id}/events/` | No location search since 2020. Organizer endpoint not in current docs |
| Meetup | API | skipped (cost) | — | — | — | Revisit if free access appears |
| Chicago Public Library | city | BiblioCommons JSON API | weekly | ✅ JSON API | `gateway.bibliocommons.com/v2/libraries/chipublib/events` | The library site's own data source. No date filter, ~37 pages of 100; 10s delay. Library-site robots.txt allows /events (Crawl-delay 120 there; gateway has no robots.txt) |
| Choose Chicago | city/tourism | WordPress Events Calendar REST | weekly | ✅ JSON API | `/wp-json/tribe/events/v1/events` | robots.txt: Crawl-delay 20, disallows `?ical=` (so not iCal). ~1,900 occurrences in 35 days |
| Chicago Park District | city | HTML list + per-event iCal | weekly | ⚠️ HTML | List pages `?page=N`, each event page embeds an .ics | No JSON-LD or feed; robots.txt allows /events. Needs one request per event; later |
| Do312 | aggregator | — | — | ❌ ToS | `.json` endpoints exist | Terms: users agree not to "scrape, harvest, or misuse content or data". Skip |
| City of Chicago DCASE | city | page | weekly | | | |
| Chicago Data Portal | open data | Socrata API | weekly | | | Park District / permit datasets |
| Chicago Reader | media | page | daily | | | Check terms |
| Metro / Thalia Hall / Empty Bottle / Lincoln Hall / Schubas | venues | calendar | daily | | | May already be in TM/Eventbrite |
| Art Institute / Field Museum / MCA | museums | calendar | weekly | | | |

Audited 2026-10-26.

## Hyperlocal to check later
- CPL branch calendars · Park District programs by park · Chambers of commerce / SSAs
- Chicago Cultural Center · City farmers markets · Bars with trivia / open mic calendars
