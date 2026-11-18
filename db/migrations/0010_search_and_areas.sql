-- Batch 3: typo-tolerant search suggestions, and day counts for several neighborhoods.
-- Safe to run more than once.

create extension if not exists pg_trgm;

-- Suggestions while typing: venues, neighborhoods and event titles that match, even with typos.
create or replace function public.search_suggestions(p_q text)
returns table (kind text, label text, events bigint)
language sql
stable
set search_path = public
as $$
    with q as (select lower(trim(p_q)) as q),
    candidates as (
        select 'venue' as kind, venue_name as label from upcoming_events where venue_name is not null
        union all
        select 'area', neighborhood from upcoming_events where neighborhood is not null
        union all
        select 'event', title from upcoming_events
    ),
    counted as (
        select kind, label, count(*) as events from candidates group by kind, label
    )
    select c.kind, c.label, c.events
    from counted c, q
    where length(q.q) >= 2
      and (lower(c.label) like '%' || q.q || '%' or word_similarity(q.q, lower(c.label)) > 0.45)
    order by (lower(c.label) like q.q || '%') desc,          -- starts with what was typed
             word_similarity(q.q, lower(c.label)) desc,
             c.events desc
    limit 8;
$$;
grant execute on function public.search_suggestions(text) to anon, authenticated;

-- Day counts now take a list of neighborhoods (the Where filter allows several).
drop function if exists public.event_day_counts(date, date, text[], text, text, text, int[], boolean);

create or replace function public.event_day_counts(
    p_from date,
    p_to date,                        -- exclusive
    p_cats text[] default null,
    p_price text default null,        -- null/'any', 'free', or a max price like '20'
    p_hoods text[] default null,      -- any of these neighborhoods; null = anywhere
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
      and (p_hoods is null or cardinality(p_hoods) = 0 or e.neighborhood = any (p_hoods))
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
grant execute on function public.event_day_counts(date, date, text[], text, text[], text, int[], boolean) to anon, authenticated;

-- Check:
select * from search_suggestions('thalia');
select * from event_day_counts(current_date, current_date + 7, p_hoods => array['Logan Square', 'West Town']);
