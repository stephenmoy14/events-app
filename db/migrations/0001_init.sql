-- Chicago Events App: initial schema (Postgres / Supabase)
create extension if not exists pgcrypto;

create table if not exists sources (
    id                    serial primary key,
    name                  text not null unique,
    type                  text not null check (type in ('api', 'json-ld', 'ical', 'html')),
    base_url              text,
    cadence               text not null default 'daily' check (cadence in ('daily', 'weekly')),
    enabled               boolean not null default true,
    consecutive_failures  integer not null default 0,
    created_at            timestamptz not null default now()
);

create table if not exists events (
    id               uuid primary key default gen_random_uuid(),
    source_id        integer not null references sources(id),
    source_event_id  text not null,
    title            text not null,
    start_at         timestamptz not null,
    end_at           timestamptz,
    venue_name       text,
    address          text,
    neighborhood     text,
    lat              numeric(9, 6),
    lon              numeric(9, 6),
    price_min        numeric(10, 2),
    price_max        numeric(10, 2),
    is_free          boolean,
    category         text,
    url              text not null,
    image_url        text,
    first_seen_at    timestamptz not null default now(),
    last_seen_at     timestamptz not null default now(),
    missed_runs      integer not null default 0,
    content_hash     text not null,
    duplicate_of     uuid references events(id),
    unique (source_id, source_event_id)
);

create index if not exists events_start_at_idx on events (start_at);
create index if not exists events_category_idx on events (category);

create table if not exists scrape_runs (
    id             bigserial primary key,
    source_id      integer not null references sources(id),
    started_at     timestamptz not null default now(),
    finished_at    timestamptz,
    status         text not null default 'running' check (status in ('running', 'ok', 'error')),
    events_found   integer default 0,
    events_new     integer default 0,
    events_updated integer default 0,
    error_message  text
);

-- What the app reads: not ended, not cancelled, not a duplicate, within 30 days.
create or replace view upcoming_events as
select e.*, s.name as source_name
from events e
join sources s on s.id = e.source_id
where coalesce(e.end_at, e.start_at) > now()
  and e.start_at < now() + interval '30 days'
  and e.missed_runs < 2
  and e.duplicate_of is null;

insert into sources (name, type, base_url, cadence) values
    ('ticketmaster', 'api', 'https://app.ticketmaster.com/discovery/v2', 'daily'),
    ('eventbrite',   'api', 'https://www.eventbriteapi.com/v3', 'daily')
on conflict (name) do nothing;
