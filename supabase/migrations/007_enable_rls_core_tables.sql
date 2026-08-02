-- Phase 1 security: RLS + least-privilege grants for core tables,
-- ownership helpers, storage path policies for lesson-plans,
-- and unique enrollment constraint when data allows.
--
-- Reuses helpers from 006 where present:
--   current_profile_id(), is_active_admin_profile()
-- Does not alter notifications policies.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, pinned search_path, revoked from anon)
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_active_admin_profile()
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
      and p.role = 'admin'
      and coalesce(p.is_active, true)
  );
$$;

create or replace function public.is_active_teacher_profile()
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
      and p.role = 'teacher'
      and coalesce(p.is_active, true)
  );
$$;

-- Resolves teachers.id for the signed-in user.
-- Prefer teachers.user_id = auth.uid() (current production linkage);
-- also accept teachers.user_id = profiles.id for legacy rows.
create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.teachers t
  where t.user_id = auth.uid()
     or t.user_id = (
       select p.id
       from public.profiles p
       where p.auth_user_id = auth.uid()
       limit 1
     )
  order by case when t.user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

create or replace function public.owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = public.current_teacher_id()
  );
$$;

-- Block non-admins from escalating role / toggling is_active / moving auth link.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_active_admin_profile() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only administrators can change profile roles.';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Only administrators can change account active status.';
  end if;

  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Auth user linkage cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_escalation();

revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.is_active_admin_profile() from public, anon;
revoke execute on function public.is_active_teacher_profile() from public, anon;
revoke execute on function public.current_teacher_id() from public, anon;
revoke execute on function public.owns_class(uuid) from public, anon;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_active_admin_profile() to authenticated;
grant execute on function public.is_active_teacher_profile() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;
grant execute on function public.owns_class(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Unique enrollment (safe: 0 duplicate pairs at migration time)
-- ---------------------------------------------------------------------------

create unique index if not exists class_students_class_id_student_id_key
  on public.class_students (class_id, student_id);

-- ---------------------------------------------------------------------------
-- Table grants: revoke anon; tighten authenticated
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, authenticated, public;
revoke all on table public.users from anon, authenticated, public;
revoke all on table public.teachers from anon, authenticated, public;
revoke all on table public.sections from anon, authenticated, public;
revoke all on table public.subjects from anon, authenticated, public;
revoke all on table public.students from anon, authenticated, public;
revoke all on table public.classes from anon, authenticated, public;
revoke all on table public.class_students from anon, authenticated, public;
revoke all on table public.grades from anon, authenticated, public;
revoke all on table public.lesson_plans from anon, authenticated, public;
revoke all on table public.lesson_plan_events from anon, authenticated, public;
revoke all on table public.monitoring_records from anon, authenticated, public;

-- Authenticated base privileges (RLS still applies). No TRUNCATE.
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.users to authenticated;
grant select, insert, update on table public.teachers to authenticated;
grant select, insert, update, delete on table public.sections to authenticated;
grant select, insert, update on table public.subjects to authenticated;
grant select, insert, update on table public.students to authenticated;
grant select, insert, update, delete on table public.classes to authenticated;
grant select, insert, update, delete on table public.class_students to authenticated;
grant select, insert, update, delete on table public.grades to authenticated;
grant select, insert, update, delete on table public.lesson_plans to authenticated;
grant select, insert on table public.lesson_plan_events to authenticated;
grant select, insert, update on table public.monitoring_records to authenticated;

-- Hide password hashes from the browser role (service role still full access).
revoke select on table public.users from authenticated;
grant select (id, username, email, role, status, created_at, updated_at)
  on table public.users to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.users enable row level security;
alter table public.teachers enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.grades enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_events enable row level security;
alter table public.monitoring_records enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or public.is_active_admin_profile()
  );

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles
  for update
  to authenticated
  using (
    auth_user_id = auth.uid()
    or public.is_active_admin_profile()
  )
  with check (
    auth_user_id = auth.uid()
    or public.is_active_admin_profile()
  );

-- Inserts are performed by the admin-create-user Edge Function (service role).
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
  on public.profiles
  for insert
  to authenticated
  with check (public.is_active_admin_profile());

-- ---------------------------------------------------------------------------
-- users (legacy app user table; no password_hash via grants above)
-- ---------------------------------------------------------------------------

drop policy if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin
  on public.users
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or id = auth.uid()
    or id = public.current_profile_id()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------

drop policy if exists teachers_select_scoped on public.teachers;
create policy teachers_select_scoped
  on public.teachers
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or id = public.current_teacher_id()
    or id in (
      select s.adviser_id
      from public.sections s
      join public.classes c on c.section_id = s.id
      where c.teacher_id = public.current_teacher_id()
        and s.adviser_id is not null
    )
  );

drop policy if exists teachers_insert_admin on public.teachers;
create policy teachers_insert_admin
  on public.teachers
  for insert
  to authenticated
  with check (public.is_active_admin_profile());

drop policy if exists teachers_update_admin_or_own_contact on public.teachers;
create policy teachers_update_admin_or_own_contact
  on public.teachers
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or id = public.current_teacher_id()
  )
  with check (
    public.is_active_admin_profile()
    or id = public.current_teacher_id()
  );

-- ---------------------------------------------------------------------------
-- subjects (catalog; all authenticated staff may read)
-- ---------------------------------------------------------------------------

drop policy if exists subjects_select_authenticated on public.subjects;
create policy subjects_select_authenticated
  on public.subjects
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists subjects_write_admin on public.subjects;
create policy subjects_write_admin
  on public.subjects
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

-- ---------------------------------------------------------------------------
-- sections
-- ---------------------------------------------------------------------------

drop policy if exists sections_select_scoped on public.sections;
create policy sections_select_scoped
  on public.sections
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or id in (
      select c.section_id
      from public.classes c
      where c.teacher_id = public.current_teacher_id()
    )
    or adviser_id = public.current_teacher_id()
  );

drop policy if exists sections_write_admin on public.sections;
create policy sections_write_admin
  on public.sections
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------

drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped
  on public.classes
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

drop policy if exists classes_write_admin on public.classes;
create policy classes_write_admin
  on public.classes
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

-- ---------------------------------------------------------------------------
-- class_students
-- ---------------------------------------------------------------------------

drop policy if exists class_students_select_scoped on public.class_students;
create policy class_students_select_scoped
  on public.class_students
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists class_students_insert_scoped on public.class_students;
create policy class_students_insert_scoped
  on public.class_students
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists class_students_update_scoped on public.class_students;
create policy class_students_update_scoped
  on public.class_students
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  )
  with check (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists class_students_delete_scoped on public.class_students;
create policy class_students_delete_scoped
  on public.class_students
  for delete
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

drop policy if exists students_select_scoped on public.students;
create policy students_select_scoped
  on public.students
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists students_insert_teacher_or_admin on public.students;
create policy students_insert_teacher_or_admin
  on public.students
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists students_update_scoped on public.students;
create policy students_update_scoped
  on public.students
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  )
  with check (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

-- ---------------------------------------------------------------------------
-- grades
-- ---------------------------------------------------------------------------

drop policy if exists grades_select_scoped on public.grades;
create policy grades_select_scoped
  on public.grades
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists grades_insert_scoped on public.grades;
create policy grades_insert_scoped
  on public.grades
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists grades_update_scoped on public.grades;
create policy grades_update_scoped
  on public.grades
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  )
  with check (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

drop policy if exists grades_delete_scoped on public.grades;
create policy grades_delete_scoped
  on public.grades
  for delete
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  );

-- ---------------------------------------------------------------------------
-- lesson_plans
-- ---------------------------------------------------------------------------

drop policy if exists lesson_plans_select_scoped on public.lesson_plans;
create policy lesson_plans_select_scoped
  on public.lesson_plans
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

drop policy if exists lesson_plans_insert_own on public.lesson_plans;
create policy lesson_plans_insert_own
  on public.lesson_plans
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

drop policy if exists lesson_plans_update_scoped on public.lesson_plans;
create policy lesson_plans_update_scoped
  on public.lesson_plans
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  )
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

drop policy if exists lesson_plans_delete_own on public.lesson_plans;
create policy lesson_plans_delete_own
  on public.lesson_plans
  for delete
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

-- ---------------------------------------------------------------------------
-- lesson_plan_events
-- ---------------------------------------------------------------------------

drop policy if exists lesson_plan_events_select_scoped on public.lesson_plan_events;
create policy lesson_plan_events_select_scoped
  on public.lesson_plan_events
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or exists (
      select 1
      from public.lesson_plans lp
      where lp.id = lesson_plan_id
        and lp.teacher_id = public.current_teacher_id()
    )
  );

drop policy if exists lesson_plan_events_insert_scoped on public.lesson_plan_events;
create policy lesson_plan_events_insert_scoped
  on public.lesson_plan_events
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or exists (
      select 1
      from public.lesson_plans lp
      where lp.id = lesson_plan_id
        and lp.teacher_id = public.current_teacher_id()
    )
  );

-- ---------------------------------------------------------------------------
-- monitoring_records
-- ---------------------------------------------------------------------------

drop policy if exists monitoring_records_select_scoped on public.monitoring_records;
create policy monitoring_records_select_scoped
  on public.monitoring_records
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.owns_class(class_id)
  );

drop policy if exists monitoring_records_insert_scoped on public.monitoring_records;
create policy monitoring_records_insert_scoped
  on public.monitoring_records
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or (
      teacher_id = public.current_teacher_id()
      and public.owns_class(class_id)
    )
  );

drop policy if exists monitoring_records_update_scoped on public.monitoring_records;
create policy monitoring_records_update_scoped
  on public.monitoring_records
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.owns_class(class_id)
  )
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or public.owns_class(class_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: lesson-plans bucket path ownership
-- Path convention from app: {teacherId}/{schoolYear}/{filename}
-- ---------------------------------------------------------------------------

drop policy if exists lesson_plans_storage_select on storage.objects;
drop policy if exists lesson_plans_storage_insert on storage.objects;
drop policy if exists lesson_plans_storage_update on storage.objects;
drop policy if exists lesson_plans_storage_delete on storage.objects;

create policy lesson_plans_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (
      public.is_active_admin_profile()
      or (storage.foldername(name))[1] = public.current_teacher_id()::text
    )
  );

create policy lesson_plans_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'lesson-plans'
    and (
      public.is_active_admin_profile()
      or (storage.foldername(name))[1] = public.current_teacher_id()::text
    )
  );

create policy lesson_plans_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (
      public.is_active_admin_profile()
      or (storage.foldername(name))[1] = public.current_teacher_id()::text
    )
  )
  with check (
    bucket_id = 'lesson-plans'
    and (
      public.is_active_admin_profile()
      or (storage.foldername(name))[1] = public.current_teacher_id()::text
    )
  );

create policy lesson_plans_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (
      public.is_active_admin_profile()
      or (storage.foldername(name))[1] = public.current_teacher_id()::text
    )
  );
