-- Student portal: helpers + self-scoped RLS + classroom remedial RPC
-- Applied remotely as migration "student_portal_rls"; kept in repo for parity.

create or replace function public.is_active_student_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'student'
      and coalesce(p.is_active, true)
  );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  where s.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.student_enrolled_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    where cs.class_id = p_class_id
      and cs.student_id = public.current_student_id()
  );
$$;

revoke all on function public.is_active_student_profile() from public, anon;
revoke all on function public.current_student_id() from public, anon;
revoke all on function public.student_enrolled_in_class(uuid) from public, anon;
grant execute on function public.is_active_student_profile() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.student_enrolled_in_class(uuid) to authenticated;

drop policy if exists subjects_select_authenticated on public.subjects;
create policy subjects_select_authenticated
  on public.subjects
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
    or public.is_active_student_profile()
  );

drop policy if exists sections_select_scoped on public.sections;
create policy sections_select_scoped
  on public.sections
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
    or id = (
      select s.section_id
      from public.students s
      where s.id = public.current_student_id()
    )
    or exists (
      select 1
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = public.current_student_id()
        and c.section_id = sections.id
    )
  );

drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped
  on public.classes
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.student_enrolled_in_class(id)
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
  );

drop policy if exists students_select_scoped on public.students;
create policy students_select_scoped
  on public.students
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
    or id = public.current_student_id()
  );

drop policy if exists grades_select_scoped on public.grades;
create policy grades_select_scoped
  on public.grades
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
    or student_id = public.current_student_id()
  );

drop policy if exists monitoring_records_select_scoped on public.monitoring_records;
create policy monitoring_records_select_scoped
  on public.monitoring_records
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
    or public.owns_class(class_id)
    or student_id = public.current_student_id()
  );

create or replace function public.get_my_classroom_remedial_flags()
returns table (
  class_id uuid,
  subject_name text,
  section_name text,
  grade_level integer,
  school_year text,
  quarter integer,
  recommended boolean,
  below_passing_count integer,
  graded_count integer,
  below_passing_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid := public.current_student_id();
begin
  if sid is null then
    return;
  end if;

  return query
  with my_classes as (
    select c.id as cid, c.subject_id, c.section_id, c.school_year, c.quarter
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = sid
  ),
  class_stats as (
    select
      mc.cid,
      count(g.id)::integer as graded,
      count(g.id) filter (where g.final_grade < 75)::integer as below75
    from my_classes mc
    left join public.grades g
      on g.class_id = mc.cid
     and g.school_year = mc.school_year
     and g.quarter = mc.quarter
    group by mc.cid
  )
  select
    mc.cid,
    sub.subject_name::text,
    sec.section_name::text,
    sec.grade_level,
    mc.school_year::text,
    mc.quarter,
    case
      when coalesce(cs.graded, 0) = 0 then false
      else (cs.below75::numeric / cs.graded::numeric) > 0.5
    end as recommended,
    coalesce(cs.below75, 0),
    coalesce(cs.graded, 0),
    case
      when coalesce(cs.graded, 0) = 0 then 0::numeric
      else round((cs.below75::numeric / cs.graded::numeric), 4)
    end as below_passing_rate
  from my_classes mc
  join public.subjects sub on sub.id = mc.subject_id
  join public.sections sec on sec.id = mc.section_id
  left join class_stats cs on cs.cid = mc.cid;
end;
$$;

revoke all on function public.get_my_classroom_remedial_flags() from public, anon;
grant execute on function public.get_my_classroom_remedial_flags() to authenticated;
