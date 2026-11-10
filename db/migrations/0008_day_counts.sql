-- Phase 6: events per Chicago day, with the website's filters applied.
-- Feeds the day strip and the calendar. Runs with the caller's permissions (RLS applies).
-- An event counts on every day it overlaps, so multi-day exhibits show on each day they're open;
-- today only counts what hasn't ended yet.
create or replace function public.event_day_counts(
    p_from date,
    p_to date,                       -- exclusive
    p_cats text[] default null,
    p_free boolean default false,
    p_hood text default null,
    p_q text default null
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
      and (not coalesce(p_free, false) or e.is_free)
      and (p_hood is null or p_hood = '' or e.neighborhood = p_hood)
      and (p_q is null or p_q = ''
           or e.title ilike '%' || p_q || '%'
           or e.venue_name ilike '%' || p_q || '%'
           or e.neighborhood ilike '%' || p_q || '%')
    group by 1
    order by 1;
$$;

grant execute on function public.event_day_counts(date, date, text[], boolean, text, text) to anon, authenticated;

-- Check (should list ~30 days):
select * from event_day_counts(current_date, current_date + 31);
