# Chicago Events App

What can I do in Chicago in the next 30 days? A daily pipeline pulls events from APIs, venue
calendars and city pages, merges duplicates, and hides anything that has already ended.

## Layout

```
events-app/
├── PLAN.md                  Phase checklist (what's next)
├── docs/                    Source audit, architecture, decision log
├── config/cities/           One YAML per city (Chicago today; another city = another file)
├── db/migrations/           Postgres schema (Supabase)
├── pipeline/                Python scraping pipeline
│   ├── src/events_pipeline/
│   │   ├── models.py        The shared Event shape every fetcher outputs
│   │   ├── sources/         One small fetcher per source
│   │   ├── normalize.py     Cleanup + content hash
│   │   ├── dedupe.py        Cross-source matching (phase 5)
│   │   ├── db.py            Upserts + scrape_runs logging
│   │   └── run.py           CLI entrypoint
│   └── tests/               Parser tests against saved snapshots in tests/fixtures/
├── web/                     Next.js + TypeScript frontend (phase 6)
└── .github/workflows/       CI (tests) and the daily scrape cron
```

## Quick start (pipeline)

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -e ".[dev]"
copy ..\.env.example ..\.env     # then fill in keys
pytest
python -m events_pipeline.run --source ticketmaster --dry-run
```

## Running it

```bash
python -m events_pipeline.run                  # every source that's due (what the daily job runs)
python -m events_pipeline.run --force          # every enabled source, ignoring daily/weekly cadence
python -m events_pipeline.run --source NAME    # one source, now
python -m events_pipeline.run --dry-run        # fetch and print, write nothing
```

Health: `select * from source_health;` in the Supabase SQL Editor, or the summary table on each
run in GitHub → Actions.
