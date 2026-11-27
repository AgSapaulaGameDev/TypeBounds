-- TypeBounds accounts: usernames, protected leaderboard names and online saves.
-- Run once in Supabase -> SQL Editor (after one-row-per-name.sql). Safe to run again.
-- Before running: Authentication -> Sign In / Providers -> Email: enabled, and "Confirm email" OFF
-- (the game makes hidden addresses like gelo@typebounds.vercel.app that can't receive mail).

-- 1) Profiles: one username per account (A-Z 0-9, 1-10 chars, the same rule as the leaderboard).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique check (name ~ '^[A-Z0-9]{1,10}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select on public.profiles to anon, authenticated;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
-- no insert / update / delete for players: profiles are only made by the sign-up trigger below.

-- 2) Signing up makes the profile from the username the game sends. A taken or bad name = sign-up fails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name) values (new.id, upper(new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3) Online saves: one row per account. Players can only read and write their own.
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) < 8000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
grant select, insert, update, delete on public.saves to authenticated;
drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Leaderboard: remember which rows belong to an account (crown on the board),
--    and let logged-in players read and post too (guests already can).
alter table public.scores add column if not exists user_id uuid references auth.users(id) on delete set null;
grant select, insert on public.scores to anon, authenticated;
drop policy if exists scores_read_all on public.scores;
create policy scores_read_all on public.scores for select to anon, authenticated using (true);
drop policy if exists scores_insert_all on public.scores;
create policy scores_insert_all on public.scores for insert to anon, authenticated with check (true);

-- 5) Posting a score: a name that belongs to an account can only be posted by that account
--    (anyone else gets NAME_TAKEN). Otherwise the same as before: one row per name, raised only
--    when the new run is better.
create or replace function public.scores_keep_best()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select id into owner from public.profiles where name = new.name;
  if owner is not null and owner is distinct from auth.uid() then
    raise exception 'NAME_TAKEN' using errcode = 'P0001';
  end if;
  new.user_id := owner; -- null for guest names; players can't set it themselves
  update public.scores set user_id = owner where name = new.name and user_id is distinct from owner;
  update public.scores
     set score = new.score, wave = new.wave, created_at = now()
   where name = new.name
     and (new.score > score or (new.score = score and new.wave > wave));
  if exists (select 1 from public.scores where name = new.name) then
    return null;  -- name already on the board: updated above if better, no new row
  end if;
  return new;     -- first run for this name: insert normally
end;
$$;

drop trigger if exists scores_keep_best on public.scores;
create trigger scores_keep_best
before insert on public.scores
for each row execute function public.scores_keep_best();


-- =====================================================================================
-- HELPERS (run by hand when you need them; replace GELO / the password first)
-- =====================================================================================
-- Reset a player's password (they tell you their name, you give them the new password):
--   update auth.users set encrypted_password = crypt('NEW-PASSWORD-HERE', gen_salt('bf'))
--    where email = lower('GELO') || '@typebounds.vercel.app';
--
-- Delete an account (its save goes with it; its leaderboard row stays, as a guest name):
--   delete from auth.users where email = lower('GELO') || '@typebounds.vercel.app';
--
-- UNDO this whole script (back to guests only):
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop table if exists public.saves;
--   drop table if exists public.profiles;
--   -- then run one-row-per-name.sql again to restore the old score trigger.
