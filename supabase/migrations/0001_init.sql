-- Nexus Chess: initial schema (proposal, not yet applied).
-- Phase 1a uses local storage; these tables back the same repository interfaces once accounts exist.
-- Privacy: no names, emails, or birthdates of students. Auth users are adults (players/teachers).

create table player_progress (
  user_id uuid primary key references auth.users on delete cascade,
  progress jsonb not null,               -- PlayerProgress (versioned JSON)
  locale text not null default 'tr',
  updated_at timestamptz not null default now()
);

create table revenge_puzzles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  fen text not null,
  solution_uci text not null,
  source_game_id text,
  box smallint not null default 0,        -- Leitner box
  due_at timestamptz not null default now(),
  lapses int not null default 0,
  created_at timestamptz not null default now()
);
create index revenge_due_idx on revenge_puzzles (owner_id, due_at);

-- Phase 1b (data model only): anonymous classrooms and teacher presentation decks.
create table classrooms (
  code text primary key check (code ~ '^[A-Z]{2,5}-[0-9]{4}$'),   -- e.g. KALE-4521
  teacher_id uuid not null references auth.users on delete cascade,
  label text not null check (char_length(label) <= 20),           -- e.g. "5-B"; never student names
  created_at timestamptz not null default now()
);

create table student_seats (
  code text primary key check (code ~ '^[A-Z]{2,5}-[0-9]{4}$'),
  classroom_code text not null references classrooms on delete cascade,
  avatar text,                                                     -- emoji only
  progress jsonb not null default '{"version":1,"nodes":{}}'
);

create table presentation_decks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  title text,
  slides jsonb not null default '[]',     -- PresentationSlide[]: fen + arrows/highlights
  updated_at timestamptz not null default now()
);

alter table player_progress enable row level security;
alter table revenge_puzzles enable row level security;
alter table classrooms enable row level security;
alter table student_seats enable row level security;
alter table presentation_decks enable row level security;

create policy own_progress on player_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_revenge on revenge_puzzles for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy own_classrooms on classrooms for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy own_decks on presentation_decks for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy teacher_seats on student_seats for all
  using (exists (select 1 from classrooms c where c.code = classroom_code and c.teacher_id = auth.uid()));
-- Student access by seat code goes through an Edge Function (no student auth accounts).
