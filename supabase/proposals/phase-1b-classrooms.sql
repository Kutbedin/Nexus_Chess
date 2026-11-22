-- GambitZone: Phase 1b classroom schema (proposal, NOT a migration — do not run yet).
-- Moves to supabase/migrations/ once classrooms are built. Player backup lives in migrations/0001_cloud_backup.sql.
-- Privacy: no names, emails, or birthdates of students. Auth users are adults (teachers).

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

alter table classrooms enable row level security;
alter table student_seats enable row level security;
alter table presentation_decks enable row level security;

create policy own_classrooms on classrooms for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy own_decks on presentation_decks for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy teacher_seats on student_seats for all
  using (exists (select 1 from classrooms c where c.code = classroom_code and c.teacher_id = auth.uid()));
-- Student access by seat code goes through an Edge Function (no student auth accounts).
