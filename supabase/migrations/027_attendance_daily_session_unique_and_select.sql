-- Unique (student, section, date, session) + SELECT for section teachers.
-- Write remains adviser-only. Not per subject. Not RF.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance_daily'::regclass
      and conname = 'attendance_daily_student_section_date_session_key'
  ) then
    alter table public.attendance_daily
      add constraint attendance_daily_student_section_date_session_key
      unique using index attendance_daily_student_section_date_session_key;
  end if;
end $$;

create index if not exists attendance_daily_section_date_session_idx
  on public.attendance_daily (section_id, school_year, attendance_date, session);

drop policy if exists attendance_daily_select_staff on public.attendance_daily;
create policy attendance_daily_select_staff
  on public.attendance_daily
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or exists (
      select 1
      from public.sections s
      where s.id = attendance_daily.section_id
        and s.adviser_id = public.current_teacher_id()
    )
    or exists (
      select 1
      from public.classes c
      where c.section_id = attendance_daily.section_id
        and c.teacher_id = public.current_teacher_id()
    )
  );
