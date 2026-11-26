-- TypeBounds leaderboard: keep ONE row per player name (their best run).
-- Run once in Supabase -> SQL Editor. Safe to run again.

-- 1) Remove duplicate rows, keeping each name's best score (ties: higher wave, then oldest row).
delete from public.scores s
using public.scores t
where s.name = t.name
  and s.id <> t.id
  and (t.score > s.score
       or (t.score = s.score and t.wave > s.wave)
       or (t.score = s.score and t.wave = s.wave and t.id < s.id));

-- 2) One name = one row.
alter table public.scores drop constraint if exists scores_name_unique;
alter table public.scores add constraint scores_name_unique unique (name);

-- 3) When a name posts again: raise its row only if the new run is better, and skip the insert.
--    Runs as the table owner, so players still cannot edit or delete rows directly.
create or replace function public.scores_keep_best()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
