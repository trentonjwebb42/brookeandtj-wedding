-- Save-the-date replies table. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Row level security is on with no policies, so only the server (secret key in
-- Vercel) can read or write. Nothing on the public website can read the list.

create table if not exists public.save_the_date_replies (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text check (char_length(email) <= 200),
  leaning     text not null check (leaning in ('yes', 'maybe', 'no')),
  note        text check (char_length(note) <= 1000)
);

alter table public.save_the_date_replies enable row level security;

-- Latest answer per person (someone may change their mind), handy for counting.
create or replace view public.save_the_date_latest
with (security_invoker = true) as
select distinct on (lower(name)) name, email, leaning, note, created_at
from public.save_the_date_replies
order by lower(name), created_at desc;

-- Newer Supabase projects don't grant table access to the server role automatically.
-- Grant it to service_role only (what the secret key uses); the public gets nothing.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.save_the_date_replies to service_role;
grant select on public.save_the_date_latest to service_role;

-- One reply per person (added Oct 2026). The same email, or the same name when no
-- email is given, updates the earlier reply instead of adding a duplicate row.
alter table public.save_the_date_replies
  add column if not exists updated_at timestamptz not null default now();
alter table public.save_the_date_replies
  add column if not exists reply_key text generated always as (
    coalesce(nullif(lower(btrim(email)), ''), 'name:' || lower(btrim(name)))
  ) stored;
create unique index if not exists save_the_date_replies_reply_key_idx
  on public.save_the_date_replies (reply_key);
