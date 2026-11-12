# Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-13 | Standalone app, linked from personal site | Keeps site simple; app is its own showcase |
| 2026-10-13 | Skip Meetup for now | API access appears limited to Pro (paid) |
| 2026-10-13 | Own scrapers on GitHub Actions; Apify only as backup | Free, and the scrapers are the resume value |
| 2026-10-14 | Scaffolded as Python pipeline + Postgres + Next.js (option A) | Plan's recommendation; still listed as an open question |
| 2026-10-20 | RLS on all tables; public read-only policy on `events`; view uses `security_invoker` | Supabase exposes `public` via the anon key |
| 2026-10-26 | Skip Do312 | Terms of service forbid scraping |
| 2026-10-26 | Use JSON APIs the sites' own pages load (CPL, Choose Chicago) over HTML parsing | Stable fields, UTC times, fewer requests |
| 2026-10-26 | Generic fetchers (`tribe_events`, `bibliocommons`) chosen per source via `fetcher:` in config | New WordPress/library sources need config only |
| 2026-10-26 | Skip online-only events by default (`include_online`) | The app is "what can I do in Chicago" |
| 2026-11-10 | Duplicates matched on title + start time + venue, by Chicago date | Real data showed matinee/evening showtimes and Choose Chicago "all-day" listings; UTC dates split evening shows |
| 2026-11-10 | Duplicates hidden (`duplicate_of`), never deleted; recomputed every run | Reversible, and a wrong match fixes itself when rules improve |
| 2026-11-10 | 12 fixed category groups mapped by keyword rules; raw label kept in `category` | Website filters and chatbot need one vocabulary; rules are easy to tune |
| 2026-11-10 | Neighborhoods via point-in-polygon on city community areas, no PostGIS | 77 polygons, pure Python, no new dependency |
| 2026-11-11 | Own Next.js API routes in front of Supabase's generated API | Defined endpoints and inputs; Supabase becomes an implementation detail |
| 2026-11-11 | Accounts via Supabase Auth email links; saved events and default filters | Personal features without passwords; row rules keep data private |
| 2026-11-11 | Dropped the event chatbot after building it | Little gain over the filters for the cost and upkeep |
