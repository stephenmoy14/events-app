-- Phase 6: the neighborhood list for the website's filter.
create or replace view upcoming_neighborhoods with (security_invoker = true) as
select neighborhood, count(*) as events
from upcoming_events
where neighborhood is not null
group by neighborhood;
