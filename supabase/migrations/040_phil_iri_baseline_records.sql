-- 040_phil_iri_baseline_records.sql
-- Dedicated baseline screening record storage for DepEd Phil-IRI (Form 1B / Screening Test Class Reading Record)
-- Ensures strict data separation: baseline scores are immutable and never overwritten by active ARAL assessments.

create table if not exists public.phil_iri_baseline_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  school_year text not null default 'SY 2026-2027',
  quarter integer not null default 1,
  subject text not null default 'English',
  test_taken text default 'GST Form 1B',
  literal_score numeric(5, 2),
  inferential_score numeric(5, 2),
  critical_score numeric(5, 2),
  total_score numeric(5, 2) not null,
  reading_level text not null default 'Instructional'
    check (reading_level in ('Frustration', 'Instructional', 'Independent', 'Non-Reader', 'Not Assessed')),
  screening_interpretation text not null default 'Individualized Assessment (Starting point: 2 grade levels below)'
    check (screening_interpretation in (
      '3 levels lower Phil-IRI testing',
      '2 levels lower Phil-IRI testing',
      'No Phil-IRI test required',
      'Individualized Assessment (Starting point: 3 grade levels below)',
      'Individualized Assessment (Starting point: 2 grade levels below)',
      'No further individualized assessment from GST',
      'No data'
    )),
  candidate_status text not null default 'For Review'
    check (candidate_status in (
      'For Review',
      'Baseline Complete',
      'ARAL Candidate',
      'Referred to ARAL',
      'Not Currently Eligible'
    )),
  matched_by text default 'student_id',
  is_matched boolean not null default true,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year, subject)
);

comment on table public.phil_iri_baseline_records is
  'Baseline Phil-IRI screening test records imported via Excel. Kept separate from ongoing academic grades and active ARAL assessments.';

create index if not exists phil_iri_baseline_student_idx
  on public.phil_iri_baseline_records (student_id, school_year, subject);

create index if not exists phil_iri_baseline_status_idx
  on public.phil_iri_baseline_records (candidate_status);

create index if not exists phil_iri_baseline_teacher_idx
  on public.phil_iri_baseline_records (teacher_id);

-- Update trigger
create or replace function public.set_phil_iri_baseline_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists phil_iri_baseline_set_updated_at on public.phil_iri_baseline_records;
create trigger phil_iri_baseline_set_updated_at
before update on public.phil_iri_baseline_records
for each row
execute function public.set_phil_iri_baseline_updated_at();

alter table public.phil_iri_baseline_records enable row level security;

-- Read policy: Admins, owning teacher, or class teacher
drop policy if exists phil_iri_baseline_select on public.phil_iri_baseline_records;
create policy phil_iri_baseline_select
  on public.phil_iri_baseline_records
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or (class_id is not null and public.owns_class(class_id))
    or student_id = public.current_student_id()
  );

-- Insert policy: Admins or teachers
drop policy if exists phil_iri_baseline_insert on public.phil_iri_baseline_records;
create policy phil_iri_baseline_insert
  on public.phil_iri_baseline_records
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or (class_id is not null and public.owns_class(class_id))
  );

-- Update policy: Admins or teachers
drop policy if exists phil_iri_baseline_update on public.phil_iri_baseline_records;
create policy phil_iri_baseline_update
  on public.phil_iri_baseline_records
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or (class_id is not null and public.owns_class(class_id))
  )
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or (class_id is not null and public.owns_class(class_id))
  );
