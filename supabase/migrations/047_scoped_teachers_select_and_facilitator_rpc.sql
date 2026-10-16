-- 047_scoped_teachers_select_and_facilitator_rpc.sql
-- Role-scoped access to teacher candidates for Principal ARAL Facilitator assignment.
-- Strictly avoids broadly exposing teacher records to all authenticated users.

-- 1. Helper function to check if active user is an admin, principal, or head teacher
create or replace function public.is_active_admin_or_principal()
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
      and p.role in ('admin', 'principal', 'head_teacher')
      and coalesce(p.is_active, true)
  );
$$;

grant execute on function public.is_active_admin_or_principal() to authenticated;

-- 2. Scoped SELECT policy for teachers table
-- Admins/Principals/Head Teachers can select teachers for management/facilitator assignment.
-- Teachers can select their own row or advisers of classes they teach.
-- Regular users (students, parents) CANNOT read the teachers table.
drop policy if exists teachers_select_scoped on public.teachers;
create policy teachers_select_scoped
  on public.teachers
  for select
  to authenticated
  using (
    public.is_active_admin_or_principal()
    or public.is_active_admin_profile()
    or id = public.current_teacher_id()
    or id in (
      select s.adviser_id
      from public.sections s
      join public.classes c on c.section_id = s.id
      where c.teacher_id = public.current_teacher_id()
        and s.adviser_id is not null
    )
  );

-- Ensure table-level SELECT is granted to authenticated so RLS policies govern row visibility
grant select on table public.teachers to authenticated;

-- 3. Security definer RPC specifically for ARAL Facilitator selection
-- Returns only the required minimal fields for teacher selection and strictly verifies caller role.
create or replace function public.get_aral_facilitator_candidates()
returns table (
  id uuid,
  first_name text,
  middle_name text,
  last_name text,
  email text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.first_name, t.middle_name, t.last_name, t.email, t.status
  from public.teachers t
  where exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('admin', 'principal', 'head_teacher')
      and coalesce(p.is_active, true)
  )
  order by t.last_name asc;
$$;

revoke execute on function public.get_aral_facilitator_candidates() from public, anon;
grant execute on function public.get_aral_facilitator_candidates() to authenticated;
