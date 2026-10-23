-- ============================================================================
-- Script: stage_b_baseline_schema.sql
-- Description: Isolated baseline schema prerequisites for Phase 4 Stage B testing.
--              Provisions core tables and security definer helper functions
--              required by migration 056 on a fresh disposable test project.
--
-- TARGET: Isolated test project ONLY (NEVER execute against production).
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Core Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  role text not null check (role in ('admin', 'teacher', 'student')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  section_name text not null,
  grade_level integer not null default 7,
  school_year text not null default '2026-2027',
  adviser_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  subject_name text not null,
  subject_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  section_id uuid references public.sections(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  student_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers(id) on delete restrict,
  section_id uuid references public.sections(id) on delete restrict,
  subject_id uuid references public.subjects(id) on delete restrict,
  school_year text not null default '2026-2027',
  quarter integer not null default 1 check (quarter between 1 and 4),
  created_at timestamptz not null default now()
);

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_class_student unique (class_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 2. Security Definer Helper Functions
-- ----------------------------------------------------------------------------

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
  limit 1;
$$;

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

-- ----------------------------------------------------------------------------
-- 3. Grants & Execution Permissions
-- ----------------------------------------------------------------------------

revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated;

revoke all on function public.is_active_admin_profile() from public, anon;
grant execute on function public.is_active_admin_profile() to authenticated;

revoke all on function public.is_active_teacher_profile() from public, anon;
grant execute on function public.is_active_teacher_profile() to authenticated;

revoke all on function public.current_teacher_id() from public, anon;
grant execute on function public.current_teacher_id() to authenticated;

revoke all on function public.is_active_student_profile() from public, anon;
grant execute on function public.is_active_student_profile() to authenticated;

revoke all on function public.current_student_id() from public, anon;
grant execute on function public.current_student_id() to authenticated;

revoke all on function public.is_section_adviser(uuid) from public, anon;
grant execute on function public.is_section_adviser(uuid) to authenticated;
