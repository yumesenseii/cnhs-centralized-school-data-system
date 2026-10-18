-- 055_phil_iri_term_uniqueness.sql
-- 1. Allow null total_score when a learner is absent (absence is never score 0)
ALTER TABLE public.phil_iri_baseline_records ALTER COLUMN total_score DROP NOT NULL;

-- 2. Add assessment_period column to preserve Term 1 (BOSY), Term 2 (MOSY), and Term 3 (EOSY) independently
ALTER TABLE public.phil_iri_baseline_records ADD COLUMN IF NOT EXISTS assessment_period text NOT NULL DEFAULT 'BOSY';

-- 3. Replace single-term unique constraint with term-aware unique constraint
ALTER TABLE public.phil_iri_baseline_records DROP CONSTRAINT IF EXISTS phil_iri_baseline_records_student_id_school_year_subject_key;
ALTER TABLE public.phil_iri_baseline_records DROP CONSTRAINT IF EXISTS phil_iri_baseline_records_student_year_subject_period_key;
ALTER TABLE public.phil_iri_baseline_records ADD CONSTRAINT phil_iri_baseline_records_student_year_subject_period_key 
  UNIQUE (student_id, school_year, subject, assessment_period);
