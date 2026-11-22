-- GambitZone: cloud backup of guest progress under anonymous Supabase auth.
-- Run once in the Supabase SQL Editor (or `supabase db push`). Safe to run again.
--
-- One row per record: a level node, a solved puzzle, or a revenge puzzle with its review state.
-- `updated_at` is the client's change time (epoch ms); the trigger below keeps the newest copy per row.
-- Privacy: rows hold only game data keyed by an anonymous auth user id. No names, emails, birthdates, or free text.

create table if not exists public.player_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null check (char_length(id) between 1 and 64),                   -- level node id, e.g. 'w1-3'
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 1024),
  updated_at bigint not null,
  primary key (user_id, id)
);

create table if not exists public.puzzle_stats (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null check (char_length(id) between 1 and 64),                   -- Lichess puzzle id
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 1024),
  updated_at bigint not null,
  primary key (user_id, id)
);

create table if not exists public.revenge_puzzles (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null check (char_length(id) between 1 and 64),                   -- '<gameId>:<ply>'
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 4096),
  updated_at bigint not null,
  primary key (user_id, id)
);

-- Newest copy wins: an upsert carrying an older updated_at leaves the stored row unchanged.
create or replace function public.keep_newest_backup_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_newest on public.player_progress;
create trigger keep_newest before update on public.player_progress
  for each row execute function public.keep_newest_backup_row();

drop trigger if exists keep_newest on public.puzzle_stats;
create trigger keep_newest before update on public.puzzle_stats
  for each row execute function public.keep_newest_backup_row();

drop trigger if exists keep_newest on public.revenge_puzzles;
create trigger keep_newest before update on public.revenge_puzzles
  for each row execute function public.keep_newest_backup_row();

-- Row Level Security: every signed-in user (anonymous ones included) sees and writes only their own rows.
alter table public.player_progress enable row level security;
alter table public.puzzle_stats enable row level security;
alter table public.revenge_puzzles enable row level security;

drop policy if exists own_rows on public.player_progress;
create policy own_rows on public.player_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.puzzle_stats;
create policy own_rows on public.puzzle_stats for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.revenge_puzzles;
create policy own_rows on public.revenge_puzzles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing; anonymous sign-ins use the `authenticated` role.
revoke all on public.player_progress, public.puzzle_stats, public.revenge_puzzles from anon;
grant select, insert, update, delete on public.player_progress, public.puzzle_stats, public.revenge_puzzles to authenticated;
