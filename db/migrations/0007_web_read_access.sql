-- Let the website (anon / publishable key) read upcoming events. Safe to run more than once.
-- The pipeline connects as the database owner and isn't affected; scrape_runs stays private.
grant usage on schema public to anon, authenticated;
grant select on public.events, public.sources to anon, authenticated;
grant select on public.upcoming_events, public.upcoming_neighborhoods to anon, authenticated;

drop policy if exists "public can read events" on public.events;
create policy "public can read events" on public.events
  for select to anon, authenticated using (true);

drop policy if exists "public can read sources" on public.sources;
create policy "public can read sources" on public.sources
  for select to anon, authenticated using (true);

-- Check: should list both policies.
select tablename, policyname, roles from pg_policies where schemaname = 'public' order by 1;
