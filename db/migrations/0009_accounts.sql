-- Phase 8: accounts (saved events and default filters).
-- Sign-in itself is Supabase Auth (email links); these tables hang off auth.users.
-- Safe to run more than once.

-- Saved events: each person sees and changes only their own.
create table if not exists public.saved_events (
    user_id uuid not null references auth.users (id) on delete cascade,
    event_id uuid not null references public.events (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, event_id)
);
alter table public.saved_events enable row level security;
drop policy if exists "own saved events" on public.saved_events;
create policy "own saved events" on public.saved_events
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
grant select, insert, delete on public.saved_events to authenticated;

-- Default filters, stored as the page's query string (e.g. "when=week&time=evening&price=20").
create table if not exists public.user_preferences (
    user_id uuid primary key references auth.users (id) on delete cascade,
    filters text not null default '',
    updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists "own preferences" on public.user_preferences;
create policy "own preferences" on public.user_preferences
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.user_preferences to authenticated;
