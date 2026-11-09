-- Phase 4: one row per source showing how it's doing. Open it in the Supabase Table Editor
-- or run:  select * from source_health;
create index if not exists scrape_runs_source_started_idx on scrape_runs (source_id, started_at desc);

create or replace view source_health with (security_invoker = true) as
select
    s.name,
    s.cadence,
    s.consecutive_failures,
    last_run.started_at                         as last_run_at,
    last_run.status                             as last_status,
    last_run.events_found                       as last_found,
    last_run.error_message                      as last_error,
    last_ok.finished_at                         as last_success_at,
    (select count(*) from events e
      where e.source_id = s.id
        and coalesce(e.end_at, e.start_at) > now()
        and e.missed_runs < 2)                  as upcoming_events
from sources s
left join lateral (
    select * from scrape_runs r where r.source_id = s.id order by r.started_at desc limit 1
) last_run on true
left join lateral (
    select r.finished_at from scrape_runs r
     where r.source_id = s.id and r.status = 'ok'
     order by r.started_at desc limit 1
) last_ok on true
order by s.name;
