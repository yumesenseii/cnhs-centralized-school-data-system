-- ARAL Pre / Mid / Post assessment scores (facilitator-entered).
-- Scoped per program batch + student + phase. Max score is flexible (DepEd materials vary).

create table if not exists public.aral_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.aral_program_batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  assignment_id uuid references public.aral_facilitator_assignments (id) on delete set null,
  grade_section text not null,
  phase text not null check (phase in ('pre', 'mid', 'post')),
  score numeric(8, 2),
  max_score numeric(8, 2) not null default 40
    check (max_score > 0),
  pass_percent numeric(5, 2) not null default 75
    check (pass_percent >= 0 and pass_percent <= 100),
  result text check (result is null or result in ('Passed', 'For ARAL')),
  notes text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'scored')),
  started_at timestamptz,
  scored_at timestamptz,
  recorded_by_teacher_id uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, student_id, phase)
);

comment on table public.aral_assessment_scores is
  'Summer ARAL Pre/Mid/Post scores entered by assigned facilitators. Result is derived from score/max vs pass_percent.';

create index if not exists aral_assessment_scores_batch_phase_idx
  on public.aral_assessment_scores (batch_id, phase);

create index if not exists aral_assessment_scores_section_phase_idx
  on public.aral_assessment_scores (batch_id, grade_section, phase);

create index if not exists aral_assessment_scores_student_idx
  on public.aral_assessment_scores (student_id);

drop trigger if exists aral_assessment_scores_set_updated_at
  on public.aral_assessment_scores;
create trigger aral_assessment_scores_set_updated_at
before update on public.aral_assessment_scores
for each row
execute function public.set_aral_program_updated_at();

alter table public.aral_assessment_scores enable row level security;

-- Admin + assigned facilitator (for that student) can read.
drop policy if exists aral_assessment_scores_select on public.aral_assessment_scores;
create policy aral_assessment_scores_select
  on public.aral_assessment_scores
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_aral_facilitator_for_student(student_id)
  );

-- Facilitators (and admins) may insert rows for learners they facilitate.
drop policy if exists aral_assessment_scores_insert on public.aral_assessment_scores;
create policy aral_assessment_scores_insert
  on public.aral_assessment_scores
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or (
      public.is_aral_facilitator_for_student(student_id)
      and recorded_by_teacher_id = public.current_teacher_id()
    )
  );

-- Facilitators (and admins) may update rows for learners they facilitate.
drop policy if exists aral_assessment_scores_update on public.aral_assessment_scores;
create policy aral_assessment_scores_update
  on public.aral_assessment_scores
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_aral_facilitator_for_student(student_id)
  )
  with check (
    public.is_active_admin_profile()
    or (
      public.is_aral_facilitator_for_student(student_id)
      and (
        recorded_by_teacher_id is null
        or recorded_by_teacher_id = public.current_teacher_id()
      )
    )
  );

-- Admin-only delete (cleanup).
drop policy if exists aral_assessment_scores_delete on public.aral_assessment_scores;
create policy aral_assessment_scores_delete
  on public.aral_assessment_scores
  for delete
  to authenticated
  using (public.is_active_admin_profile());
