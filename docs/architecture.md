# Architecture

```
 config/cities/chicago.yaml
            │
   GitHub Actions cron (daily, ~5am CT)
            │
   run.py ── for each enabled source ──► sources/<name>.py  (fetch → list[Event])
            │
            ▼
   normalize.py  (trim, tz → UTC, content_hash)
            │
            ▼
   db.py  upsert on (source_id, source_event_id); set last_seen_at
            │                         └─► scrape_runs row per source
            ▼
   dedupe.py  (phase 5: set duplicate_of)
            │
            ▼
   Postgres view `upcoming_events`  ──►  web/ (Next.js) reads it
```

Key rules
- Every fetcher returns the same `Event` model; adding a source never touches the DB or app.
- Fetch today → +35 days. Store UTC; display America/Chicago.
- Expire on read (view filters `end_at`/`start_at` > now), never delete.
- An event missing from its source for 2 runs is treated as cancelled (hidden).
- Polite: a few seconds between requests per site, contact User-Agent, honor robots.txt.
