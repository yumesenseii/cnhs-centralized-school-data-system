-- Official SF2 daily marks (Present / Absent / Late / Cutting).
-- Independent of Yakal COMP and Academic Prediction / RF.

create table if not exists public.attendance_daily (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  school_year text not null,
  attendance_date date not null,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late', 'cutting')),
  marked_by uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, section_id, attendance_date)
);

create index if not exists attendance_daily_section_date_idx
  on public.attendance_daily (section_id, school_year, attendance_date);
create index if not exists attendance_daily_student_month_idx
  on public.attendance_daily (student_id, section_id, attendance_date);

comment on table public.attendance_daily is
  'Official SF2 daily attendance. Do not invent rows from Yakal COMP or blank SF2 templates. Not an RF feature.';

alter table public.attendance_daily enable row level security;

revoke all on table public.attendance_daily from anon, public;
grant select, insert, update, delete on table public.attendance_daily to authenticated;

drop policy if exists attendance_daily_select_staff on public.attendance_daily;
create policy attendance_daily_select_staff
  on public.attendance_daily
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists attendance_daily_write_adviser on public.attendance_daily;
create policy attendance_daily_write_adviser
  on public.attendance_daily
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sections s
      where s.id = attendance_daily.section_id
        and s.adviser_id = public.current_teacher_id()
    )
  )
  with check (
    exists (
      select 1
      from public.sections s
      where s.id = attendance_daily.section_id
        and s.adviser_id = public.current_teacher_id()
    )
  );

-- Advisers need the section roster even if they do not teach a subject there.
drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped
  on public.classes
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.student_enrolled_in_class(id)
    or exists (
      select 1
      from public.sections s
      where s.id = classes.section_id
        and s.adviser_id = public.current_teacher_id()
    )
  );

drop policy if exists class_students_select_scoped on public.class_students;
create policy class_students_select_scoped
  on public.class_students
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
    or student_id = public.current_student_id()
    or exists (
      select 1
      from public.classes c
      join public.sections s on s.id = c.section_id
      where c.id = class_students.class_id
        and s.adviser_id = public.current_teacher_id()
    )
  );
