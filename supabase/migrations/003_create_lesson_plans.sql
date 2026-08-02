-- Lesson plans workflow (teacher submit → admin review)
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  lesson_title text not null,
  week_covered text not null,
  learning_competency text,
  school_year text not null,
  quarter integer not null check (quarter >= 1 and quarter <= 4),
  file_name text not null,
  file_path text not null,
  file_size bigint not null check (file_size > 0),
  file_type text not null,
  status text not null default 'Pending Review'
    check (status = any (array[
      'Pending Review',
      'Under Review',
      'Approved',
      'Needs Revision'
    ])),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  remarks text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists lesson_plans_teacher_id_idx on public.lesson_plans (teacher_id);
create index if not exists lesson_plans_class_id_idx on public.lesson_plans (class_id);
create index if not exists lesson_plans_status_idx on public.lesson_plans (status);
create index if not exists lesson_plans_school_year_quarter_idx
  on public.lesson_plans (school_year, quarter);

create or replace function public.set_lesson_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lesson_plans_set_updated_at on public.lesson_plans;
create trigger lesson_plans_set_updated_at
before update on public.lesson_plans
for each row
execute function public.set_lesson_plans_updated_at();
