# Build plan

Full plan lives in the "Chicago Events App — Project Plan" doc. This is the working checklist.
Rule: one source working end to end before adding more. Each phase ends with something runnable.

## Phase 0 — Setup ✅ scaffolded
- [x] Folder structure, Event model, schema, Ticketmaster fetcher, CI skeleton
- [x] `git init`, push to GitHub
- [x] Create Supabase project, run `db/migrations/0001_init.sql` (+ RLS, `0002`)
- [x] Copy `.env.example` → `.env`, add keys

## Phase 1 — Source audit
- [x] Get a Ticketmaster Discovery API key
- [ ] Confirm Eventbrite token works for org/venue lookups
- [ ] Run the scrapeability check on every row in `docs/sources.md` (main ones done 2026-10-26)

## Phase 2 — First source end to end
- [x] `python -m events_pipeline.run --source ticketmaster --dry-run` prints events
- [x] Same without `--dry-run` writes to Postgres
- [x] Rerun creates zero duplicates

## Phase 3 — More sources
- [x] Eventbrite fetcher (by venue / organizer IDs in `config/cities/chicago.yaml`)
- [x] Chicago Public Library (BiblioCommons JSON API)
- [x] Choose Chicago (WordPress Events Calendar REST API; reusable for other WP sites)
- [x] Snapshot test per parser in `pipeline/tests/fixtures/`
- [x] Run `db/migrations/0003_phase3_sources.sql` in Supabase
- [x] Dry-run then real-run `chicago_public_library` and `choose_chicago`
- [x] Eventbrite enabled with venue and organizer IDs
- [ ] Swap the hand-written Eventbrite fixture for a real response

## Phase 4 — Schedule and health
- [x] Daily GitHub Actions run (`.github/workflows/scrape.yml`, ~4–5am Chicago)
- [x] Per-source cadence: daily sources about once a day, weekly ones about once a week (`health.py`)
- [x] Retries for timeouts, 429 and 5xx with backoff (`sources/base.py`)
- [x] `scrape_runs` row every run; stuck "running" rows closed out; `source_health` view (`0004`)
- [x] Run summary table on each Actions run; the run fails (and GitHub emails you) after 3 failures in a row
- [x] Run `db/migrations/0004_source_health.sql` in Supabase
- [x] Put the repo on GitHub, add secrets, run it once by hand from the Actions tab (Session pooler URL for `DATABASE_URL`)

## Phase 5 — Dedupe, categories, neighborhoods
- [x] Cross-source matching: title + start time (±30 min) + venue; showtimes stay separate; all-day listings attach to the earliest showtime (`dedupe.py`)
- [x] Best listing stays visible (timed over all-day, then source order in config); runs after every scrape
- [x] Ended events and events missing for 2 runs hidden (`upcoming_events` view)
- [x] Fixed category groups: music, comedy, theater, arts, food, nightlife, sports, outdoors, family, learning, community, other (`enrich.py`)
- [x] `neighborhood` from lat/lon using the city's 77 community areas
- [ ] Run `db/migrations/0005_categories_dedupe.sql` in Supabase
- [ ] `python -m events_pipeline.dedupe` to preview groups, then a `--force` run to backfill
- [ ] Commit `config/cities/chicago_community_areas.geojson` (downloaded on first run)
- [ ] Spot-check `select category, category_group, count(*) ... group by 1, 2` and tune rules
- [ ] Later: manual merge/split overrides for the odd wrong match

## Phase 6 — Frontend
- [ ] `npx create-next-app@latest web --ts` (replace placeholder)
- [ ] 30-day day-by-day list; filters: date, category, free, neighborhood; link to source

## Phase 7 — Showcase
- [ ] Write-up + architecture diagram on the personal website

## Phase 8 — Event recommendation chatbot
Chat panel on the site: "I like jazz and cheap food, what's good this weekend near Logan Square?" → a few real events with links and why each fits.
- [ ] Postgres function `search_events(...)` over `upcoming_events`: text query, date range, categories, free only, max price, neighborhood, limit (≤ 25)
- [ ] Next.js API route that calls the Claude API with that function as a tool (API key stays server-side)
- [ ] System prompt rules: today's date in Chicago; recommend only events the tool returned; give day, time, venue, price, link; ask one question if the request is too vague
- [ ] Interests: `preferences` table (categories, neighborhoods, budget) + saved/liked events, passed in as context
- [ ] Guardrails: rate limit per visitor, cap reply length, log questions without personal data
- [ ] Test set: 10–15 sample asks; check that every recommended link came from a tool result
- [ ] Later: pgvector embeddings for fuzzy asks ("something chill and artsy")
- Done when: "free things this weekend in Pilsen" returns real events with working links and nothing invented

## Open questions (from the plan)
- [ ] Categories that matter most?
- [ ] Neighborhoods or distance from home?
- [ ] Personal-only or public?
- [ ] Confirm stack: Python + TS (scaffolded this way)
- [ ] Mobile-first or desktop?
