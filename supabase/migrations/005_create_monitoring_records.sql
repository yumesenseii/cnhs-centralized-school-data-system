-- Teacher monitoring observations for at-risk / intervened learners.
-- Reuses students, classes, and teachers. Does not alter those tables.

create table if not exists public.monitoring_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  observation_date date not null default current_date,
  intervention_given text,
  teacher_remarks text,
  student_progress text,
  follow_up_needed boolean not null default false,
  monitoring_status text not null default 'Ongoing'
    check (
      monitoring_status = any (
        array[
          'Ongoing'::text,
          'Improved'::text,
          'Needs Follow-up'::text,
          'Completed'::text
        ]
      )
    ),
  school_year text not null,
  quarter integer not null check (quarter >= 1 and quarter <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.monitoring_records is
  'Teacher observation / progress entries for learner monitoring. Recommendation itself is computed from grades.';

create index if not exists monitoring_records_student_idx
  on public.monitoring_records (student_id, observation_date desc);

create index if not exists monitoring_records_class_idx
  on public.monitoring_records (class_id, observation_date desc);

create index if not exists monitoring_records_teacher_idx
  on public.monitoring_records (teacher_id, observation_date desc);

create index if not exists monitoring_records_status_idx
  on public.monitoring_records (monitoring_status);

create index if not exists monitoring_records_sy_quarter_idx
  on public.monitoring_records (school_year, quarter);

create or replace function public.set_monitoring_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monitoring_records_set_updated_at on public.monitoring_records;
create trigger monitoring_records_set_updated_at
before update on public.monitoring_records
for each row
execute function public.set_monitoring_records_updated_at();
