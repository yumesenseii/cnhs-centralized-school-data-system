-- Allow linked students to read their own SF2 daily marks (view-only).
-- Staff write policies unchanged. Not used for academic risk / RF.

drop policy if exists attendance_daily_select_own_student on public.attendance_daily;
create policy attendance_daily_select_own_student
  on public.attendance_daily
  for select
  to authenticated
  using (student_id = public.current_student_id());
