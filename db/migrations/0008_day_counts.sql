-- Phase 6: per-day counts for the day strip and calendar, plus the local start hour,
-- weekday and all-day flag the website's time-of-day filter needs.
-- Safe to run more than once (also replaces an earlier version of this file).

-- 1) Local time fields on the view (new columns go at the end, so this replaces in place).
create or replace view upcoming_events with (security_invoker = true) as
select e.id, e.title, e.start_at, e.end_at, e.venue_name, e.address, e.neighborhood,
       e.lat, e.lon, e.price_min, e.price_max, e.is_free, e.category, e.category_group,
       e.url, e.image_url, e.first_seen_at, e.last_seen_at, s.name as source_name,
       extract(hour from e.start_at at time zone 'America/Chicago')::int as start_hour,   -- 0–23
       extract(isodow from e.start_at at time zone 'America/Chicago')::int as start_dow,  -- 1=Mon … 7=Sun
       (date_trunc('day', e.start_at at time zone 'America/Chicago') = e.start_at at time zone 'America/Chicago'
        and (e.end_at is null or e.end_at - e.start_at >= interval '20 hours')) as all_day
from events e
join sources s on s.id = e.source_id
where coalesce(e.end_at, e.start_at) > now()
  and e.start_at < now() + interval '30 days'
  and e.missed_runs < 2
  and e.duplicate_of is null;

-- 2) Events per Chicago day with the website's filters. An event counts on every day it
-- overlaps; today only counts what hasn't ended.
drop function if exists public.event_day_counts(date, date, text[], boolean, text, text);

create or replace function public.event_day_counts(
    p_from date,
    p_to date,                        -- exclusive
    p_cats text[] default null,
    p_price text default null,        -- null/'any', 'free', or a max price like '20'
    p_hood text default null,
    p_q text default null,
    p_hours int[] default null,       -- allowed local start hours; null = any time
    p_weekend_any boolean default false  -- time filter applies Mon–Fri only
)
returns table (day date, events bigint)
language sql
stable
set search_path = public
as $$
    select d::date as day, count(e.id) as events
    from generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day') as d
    join upcoming_events e
      on e.start_at < ((d + interval '1 day') at time zone 'America/Chicago')
     and coalesce(e.end_at, e.start_at) >= greatest(d at time zone 'America/Chicago', now())
    where (p_cats is null or cardinality(p_cats) = 0 or e.category_group = any (p_cats))
      and (p_price is null or p_price in ('', 'any')
           or (p_price = 'free' and e.is_free)
           or (p_price ~ '^[0-9]+$' and (e.is_free or e.price_min < p_price::numeric)))
      and (p_hood is null or p_hood = '' or e.neighborhood = p_hood)
      and (p_q is null or p_q = ''
           or e.title ilike '%' || p_q || '%'
           or e.venue_name ilike '%' || p_q || '%'
           or e.neighborhood ilike '%' || p_q || '%')
      and (p_hours is null or cardinality(p_hours) = 0
           or (coalesce(p_weekend_any, false) and extract(isodow from d) in (6, 7))
           or (not e.all_day and e.start_hour = any (p_hours)))
    group by 1
    order by 1;
$$;

grant execute on function public.event_day_counts(date, date, text[], text, text, text, int[], boolean) to anon, authenticated;
grant select on public.upcoming_events to anon, authenticated;

-- Check (should list ~30 days):
select * from event_day_counts(current_date, current_date + 31);
