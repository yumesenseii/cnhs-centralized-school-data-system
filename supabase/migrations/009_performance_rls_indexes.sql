-- Performance pass after Phase 1 security:
-- 1) RLS initplan: wrap auth.* in (select ...)
-- 2) Split FOR ALL write policies so SELECT is not double-evaluated
-- 3) Add covering indexes for hot FKs / RLS joins

-- ---------------------------------------------------------------------------
-- Helpers: evaluate auth.uid() once per call
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
  where p.auth_user_id = (select auth.uid())
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
    where p.auth_user_id = (select auth.uid())
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
    where p.auth_user_id = (select auth.uid())
      and p.role = 'teacher'
      and coalesce(p.is_active, true)
  );
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.teachers t
  where t.user_id = (select auth.uid())
     or t.user_id = (
       select p.id
       from public.profiles p
       where p.auth_user_id = (select auth.uid())
       limit 1
     )
  order by case when t.user_id = (select auth.uid()) then 0 else 1 end
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- profiles / users: initplan-safe auth calls
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or public.is_active_admin_profile()
  );

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles
  for update
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or public.is_active_admin_profile()
  )
  with check (
    auth_user_id = (select auth.uid())
    or public.is_active_admin_profile()
  );

drop policy if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin
  on public.users
  for select
  to authenticated
  using (
    (select public.is_active_admin_profile())
    or id = (select auth.uid())
    or id = (select public.current_profile_id())
    or lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  );

-- ---------------------------------------------------------------------------
-- Split FOR ALL write policies → write-only (avoid duplicate SELECT policies)
-- ---------------------------------------------------------------------------

drop policy if exists subjects_write_admin on public.subjects;
create policy subjects_insert_admin
  on public.subjects for insert to authenticated
  with check (public.is_active_admin_profile());
create policy subjects_update_admin
  on public.subjects for update to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());
create policy subjects_delete_admin
  on public.subjects for delete to authenticated
  using (public.is_active_admin_profile());

drop policy if exists sections_write_admin on public.sections;
create policy sections_insert_admin
  on public.sections for insert to authenticated
  with check (public.is_active_admin_profile());
create policy sections_update_admin
  on public.sections for update to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());
create policy sections_delete_admin
  on public.sections for delete to authenticated
  using (public.is_active_admin_profile());

drop policy if exists classes_write_admin on public.classes;
create policy classes_insert_admin
  on public.classes for insert to authenticated
  with check (public.is_active_admin_profile());
create policy classes_update_admin
  on public.classes for update to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());
create policy classes_delete_admin
  on public.classes for delete to authenticated
  using (public.is_active_admin_profile());

-- ---------------------------------------------------------------------------
-- Indexes for FKs / RLS joins
-- ---------------------------------------------------------------------------

create index if not exists class_students_student_id_idx
  on public.class_students (student_id);

create index if not exists classes_section_id_idx
  on public.classes (section_id);

create index if not exists classes_subject_id_idx
  on public.classes (subject_id);

create index if not exists classes_teacher_id_idx
  on public.classes (teacher_id);

create index if not exists lesson_plan_events_actor_profile_id_idx
  on public.lesson_plan_events (actor_profile_id);

create index if not exists lesson_plans_reviewed_by_idx
  on public.lesson_plans (reviewed_by);

create index if not exists notifications_actor_profile_id_idx
  on public.notifications (actor_profile_id);

create index if not exists sections_adviser_id_idx
  on public.sections (adviser_id);

create index if not exists students_section_id_idx
  on public.students (section_id);

create index if not exists profiles_auth_user_id_idx
  on public.profiles (auth_user_id);

create index if not exists teachers_user_id_idx
  on public.teachers (user_id);

create index if not exists grades_class_id_idx
  on public.grades (class_id);
