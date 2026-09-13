-- Break classes ↔ sections RLS recursion from 023.
-- Policies must not SELECT public.sections; use SECURITY DEFINER helpers instead.

create or replace function public.is_section_adviser(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sections s
    where s.id = p_section_id
      and s.adviser_id is not null
      and s.adviser_id = public.current_teacher_id()
  );
$$;

create or replace function public.is_class_section_adviser(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.sections s on s.id = c.section_id
    where c.id = p_class_id
      and s.adviser_id is not null
      and s.adviser_id = public.current_teacher_id()
  );
$$;

revoke all on function public.is_section_adviser(uuid) from public, anon;
revoke all on function public.is_class_section_adviser(uuid) from public, anon;
grant execute on function public.is_section_adviser(uuid) to authenticated;
grant execute on function public.is_class_section_adviser(uuid) to authenticated;

drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped
  on public.classes
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.student_enrolled_in_class(id)
    or public.is_section_adviser(section_id)
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
    or public.is_class_section_adviser(class_id)
  );

drop policy if exists attendance_daily_write_adviser on public.attendance_daily;
create policy attendance_daily_write_adviser
  on public.attendance_daily
  for all
  to authenticated
  using (public.is_section_adviser(section_id))
  with check (public.is_section_adviser(section_id));
