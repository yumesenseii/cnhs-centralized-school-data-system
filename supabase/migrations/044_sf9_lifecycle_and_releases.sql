-- Migration 044: SF9 Lifecycle, Versioning, and Student Portal Releases

CREATE TABLE IF NOT EXISTS public.sf9_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'draft', 'ready_for_review', 'completed', 'released')) DEFAULT 'draft',
  is_current_release BOOLEAN NOT NULL DEFAULT false,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_summary JSONB DEFAULT '{}'::jsonb,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sf9_releases_student_sy_ver_key UNIQUE (student_id, school_year, version)
);

CREATE INDEX IF NOT EXISTS sf9_releases_section_sy_idx ON public.sf9_releases (section_id, school_year);
CREATE INDEX IF NOT EXISTS sf9_releases_student_sy_idx ON public.sf9_releases (student_id, school_year, status);

ALTER TABLE public.sf9_releases ENABLE ROW LEVEL SECURITY;

-- Revoke public permissions
REVOKE ALL ON TABLE public.sf9_releases FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sf9_releases TO authenticated;

-- Policy 1: Authenticated school staff (teachers, advisers, admins, head teachers, principals)
DROP POLICY IF EXISTS "School staff manage sf9_releases" ON public.sf9_releases;
CREATE POLICY "School staff manage sf9_releases"
  ON public.sf9_releases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.role IN ('admin', 'head_teacher', 'principal', 'teacher')
    )
  );

-- Policy 2: Students can only view their own RELEASED records
DROP POLICY IF EXISTS "Students view only their own released sf9" ON public.sf9_releases;
CREATE POLICY "Students view only their own released sf9"
  ON public.sf9_releases
  FOR SELECT
  TO authenticated
  USING (
    status = 'released'
    AND student_id IN (
      SELECT id FROM public.students
      WHERE user_id = auth.uid()
    )
  );
