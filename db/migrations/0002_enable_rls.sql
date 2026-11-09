-- Already applied by hand on 2026-10-20. Kept here so a fresh database gets the same setup.
-- The pipeline connects as the database owner and bypasses RLS; this only restricts the
-- public Data API (anon key), which the website will use.
alter table sources     enable row level security;
alter table events      enable row level security;
alter table scrape_runs enable row level security;

drop policy if exists "public can read events" on events;
create policy "public can read events"
  on events for select
  to anon, authenticated
  using (true);

alter view upcoming_events set (security_invoker = true);
