-- Phase 5: fixed category groups, faster duplicate lookups, and an updated view.
alter table events add column if not exists category_group text;
create index if not exists events_category_group_idx on events (category_group);
create index if not exists events_neighborhood_idx on events (neighborhood);
create index if not exists events_duplicate_of_idx on events (duplicate_of) where duplicate_of is not null;

-- The view lists its columns when created, so recreate it to pick up category_group.
drop view if exists upcoming_events;
create view upcoming_events with (security_invoker = true) as
select e.id, e.title, e.start_at, e.end_at, e.venue_name, e.address, e.neighborhood,
       e.lat, e.lon, e.price_min, e.price_max, e.is_free, e.category, e.category_group,
       e.url, e.image_url, e.first_seen_at, e.last_seen_at, s.name as source_name
from events e
join sources s on s.id = e.source_id
where coalesce(e.end_at, e.start_at) > now()
  and e.start_at < now() + interval '30 days'
  and e.missed_runs < 2
  and e.duplicate_of is null;

-- Website reads sources.name through the view, so allow reading that table too.
drop policy if exists "public can read sources" on sources;
create policy "public can read sources" on sources for select to anon, authenticated using (true);
