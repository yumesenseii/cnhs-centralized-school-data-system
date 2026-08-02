-- Normalized grades table for learner quarterly scores.
-- Does not alter existing tables. Prepared for Random Forest / ARAL feature queries.

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  quarter integer not null,
  final_grade numeric(5, 2),
  school_year character varying not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grades_quarter_check check (quarter >= 1 and quarter <= 4),
  constraint grades_final_grade_check check (
    final_grade is null
    or (final_grade >= 0 and final_grade <= 100)
  ),
  constraint grades_student_class_subject_quarter_year_key
    unique (student_id, class_id, subject_id, quarter, school_year)
);

comment on table public.grades is
  'Normalized quarterly final grades for learners. Used by E-Class import and future Random Forest / ARAL screening features.';

comment on column public.grades.student_id is 'Learner who received the grade.';
comment on column public.grades.class_id is 'Assigned class context (teacher + section + subject offering).';
comment on column public.grades.subject_id is 'Subject/learning area foreign key (no duplicated subject text).';
comment on column public.grades.quarter is 'Academic quarter 1-4.';
comment on column public.grades.final_grade is 'Quarterly final grade (0-100).';
comment on column public.grades.school_year is 'School year label aligned with classes.school_year.';

create index if not exists grades_student_id_idx
  on public.grades (student_id);

create index if not exists grades_class_id_idx
  on public.grades (class_id);

create index if not exists grades_subject_id_idx
  on public.grades (subject_id);

create index if not exists grades_school_year_quarter_idx
  on public.grades (school_year, quarter);

create index if not exists grades_student_subject_year_idx
  on public.grades (student_id, subject_id, school_year, quarter);

create or replace function public.set_grades_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists grades_set_updated_at on public.grades;
create trigger grades_set_updated_at
before update on public.grades
for each row
execute function public.set_grades_updated_at();
