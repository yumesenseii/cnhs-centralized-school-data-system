-- 053_phil_iri_absent_and_audit.sql
-- Expand phil_iri_baseline_records candidate_status check constraint to support 'Absent / For Reschedule'

ALTER TABLE public.phil_iri_baseline_records DROP CONSTRAINT IF EXISTS phil_iri_baseline_records_candidate_status_check;
ALTER TABLE public.phil_iri_baseline_records ADD CONSTRAINT phil_iri_baseline_records_candidate_status_check 
  CHECK (candidate_status IN (
    'For Review',
    'Baseline Complete',
    'ARAL Candidate',
    'Referred to ARAL',
    'Not Currently Eligible',
    'Absent / For Reschedule'
  ));
