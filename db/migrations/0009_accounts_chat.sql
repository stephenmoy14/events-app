-- Phase 8: accounts (saved events, default filters) and the invite-only chatbot's limits.
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

-- Chatbot allowlist: add people here (Table Editor or SQL). Not readable through the API.
create table if not exists public.chat_users (
    email text primary key,
    daily_messages int not null default 40,
    note text,
    added_at timestamptz not null default now()
);
alter table public.chat_users enable row level security;

-- One row of settings: the most the chatbot may spend per day, across everyone.
create table if not exists public.chat_settings (
    id boolean primary key default true check (id),
    daily_budget_usd numeric(8, 2) not null default 1.00
);
insert into public.chat_settings (id) values (true) on conflict do nothing;
alter table public.chat_settings enable row level security;

-- Usage per person per Chicago day. People can read their own row; only the functions write.
create table if not exists public.chat_usage (
    user_id uuid not null references auth.users (id) on delete cascade,
    day date not null,
    messages int not null default 0,
    input_tokens bigint not null default 0,
    output_tokens bigint not null default 0,
    cost_usd numeric(10, 4) not null default 0,
    primary key (user_id, day)
);
alter table public.chat_usage enable row level security;
drop policy if exists "own usage" on public.chat_usage;
create policy "own usage" on public.chat_usage for select to authenticated using (user_id = (select auth.uid()));
grant select on public.chat_usage to authenticated;

-- Is the signed-in person invited, and how many messages are left today? (No side effects.)
create or replace function public.chat_status()
returns json language plpgsql stable security definer set search_path = public as $$
declare
    v_limit int;
    v_used int;
    d date := (now() at time zone 'America/Chicago')::date;
begin
    if auth.uid() is null then return json_build_object('invited', false, 'reason', 'signin'); end if;
    select daily_messages into v_limit from chat_users where lower(email) = lower(auth.jwt() ->> 'email');
    if v_limit is null then return json_build_object('invited', false, 'reason', 'not_invited'); end if;
    select messages into v_used from chat_usage where user_id = auth.uid() and day = d;
    return json_build_object('invited', true, 'remaining', greatest(v_limit - coalesce(v_used, 0), 0), 'limit', v_limit);
end $$;

-- Claim one message: checks the invite, the person's daily limit and the overall budget.
create or replace function public.chat_begin()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
    v_limit int;
    v_used int;
    v_spent numeric;
    v_budget numeric;
    d date := (now() at time zone 'America/Chicago')::date;
begin
    if auth.uid() is null then return json_build_object('allowed', false, 'reason', 'signin'); end if;
    select daily_messages into v_limit from chat_users where lower(email) = lower(auth.jwt() ->> 'email');
    if v_limit is null then return json_build_object('allowed', false, 'reason', 'not_invited'); end if;
    select coalesce(sum(cost_usd), 0) into v_spent from chat_usage where day = d;
    select daily_budget_usd into v_budget from chat_settings where id;
    if v_spent >= coalesce(v_budget, 1.00) then
        return json_build_object('allowed', false, 'reason', 'budget');
    end if;
    insert into chat_usage (user_id, day, messages) values (auth.uid(), d, 1)
    on conflict (user_id, day) do update set messages = chat_usage.messages + 1
        where chat_usage.messages < v_limit
    returning messages into v_used;
    if v_used is null then return json_build_object('allowed', false, 'reason', 'limit', 'limit', v_limit); end if;
    return json_build_object('allowed', true, 'remaining', v_limit - v_used);
end $$;

-- Record what a message cost (the server calls this after Claude answers).
create or replace function public.chat_finish(p_input bigint, p_output bigint, p_cost numeric)
returns void language sql volatile security definer set search_path = public as $$
    update chat_usage
       set input_tokens = input_tokens + greatest(p_input, 0),
           output_tokens = output_tokens + greatest(p_output, 0),
           cost_usd = cost_usd + greatest(p_cost, 0)
     where user_id = auth.uid() and day = (now() at time zone 'America/Chicago')::date;
$$;

revoke all on function public.chat_status(), public.chat_begin(), public.chat_finish(bigint, bigint, numeric) from public, anon;
grant execute on function public.chat_status(), public.chat_begin(), public.chat_finish(bigint, bigint, numeric) to authenticated;

-- Invite yourself (change the email):
-- insert into chat_users (email, note) values ('you@example.com', 'me') on conflict do nothing;
