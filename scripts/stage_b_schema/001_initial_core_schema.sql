-- ============================================================================
-- Script: scripts/stage_b_schema/001_initial_core_schema.sql
-- Description: Reconstructed foundational core schema for CNHS LEARN.
--              Verified from live database metadata queries against
--              information_schema, pg_constraint, pg_indexes, and pg_catalog.
--              Contains zero production learner records, credentials, or PII.
--
-- ISOLATION SAFEGUARD:
--   - This file is strictly isolated from supabase/migrations/ to prevent
--     accidental execution by ordinary production deployment pipelines.
--   - Used exclusively by scripts/replay_stage_b_schema.mjs for disposable
--     test environment initialization.
--
-- Tables Provisioned:
--   1. public.users
--   2. public.profiles
--   3. public.teachers
--   4. public.sections
--   5. public.subjects
--   6. public.students
--   7. public.classes
--   8. public.class_students
--
-- Architectural Note:
--   - Core tables represent the baseline structure established prior to
--     additive migration 002_create_grades.sql.
--   - RLS policies and authorization helper functions are NOT established here;
--     they are introduced in their respective historical migrations
--     (006, 007, 009, 010, 020, 024, etc.).
--   - Profiles columns (must_change_password, temp_password, accepted_terms_at,
--     guided_tour_completed_at) are added by migrations 014, 022, and 032.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Users Table (Application credentials & role status)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) NOT NULL UNIQUE,
  email varchar(100) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL,
  status varchar(20) DEFAULT 'active'::character varying,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_role_check CHECK ((role)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'student'::character varying])::text[])),
  CONSTRAINT users_status_check CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))
);

-- ----------------------------------------------------------------------------
-- 2. Profiles Table (Identity linking to Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text]))
);

-- ----------------------------------------------------------------------------
-- 3. Teachers Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  employee_number varchar(30) NOT NULL UNIQUE,
  first_name varchar(50) NOT NULL,
  middle_name varchar(50),
  last_name varchar(50) NOT NULL,
  email varchar(100),
  learning_area varchar(100),
  contact_number varchar(20),
  status varchar(20) DEFAULT 'active'::character varying,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Sections Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level integer NOT NULL,
  section_name varchar(50) NOT NULL,
  school_year varchar(20) NOT NULL,
  adviser_id uuid REFERENCES public.teachers(id),
  status varchar(20) DEFAULT 'active'::character varying,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT sections_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('archived'::character varying)::text])))
);

-- ----------------------------------------------------------------------------
-- 5. Subjects Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name varchar(100) NOT NULL,
  subject_code varchar(20),
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. Students Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  student_number varchar(30) NOT NULL UNIQUE,
  first_name varchar(50) NOT NULL,
  middle_name varchar(50),
  last_name varchar(50) NOT NULL,
  sex varchar(10),
  birthdate date,
  section_id uuid REFERENCES public.sections(id),
  status varchar(20) DEFAULT 'active'::character varying,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Classes Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  school_year varchar(20) NOT NULL,
  quarter integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT classes_quarter_check CHECK (quarter >= 1 AND quarter <= 4)
);

-- ----------------------------------------------------------------------------
-- 8. Class Students Table (Enrollment Roster)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
