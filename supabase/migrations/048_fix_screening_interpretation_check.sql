-- 048_fix_screening_interpretation_check.sql
-- Expand phil_iri_baseline_records_screening_interpretation_check to support shorthand and teacher-friendly strings

ALTER TABLE public.phil_iri_baseline_records DROP CONSTRAINT IF EXISTS phil_iri_baseline_records_screening_interpretation_check;
ALTER TABLE public.phil_iri_baseline_records ADD CONSTRAINT phil_iri_baseline_records_screening_interpretation_check 
  CHECK (screening_interpretation IN (
    '3 levels lower Phil-IRI testing', 
    '2 levels lower Phil-IRI testing', 
    'No Phil-IRI test required', 
    'Individualized Assessment (Starting point: 3 grade levels below)', 
    'Individualized Assessment (Starting point: 2 grade levels below)', 
    'No further individualized assessment from GST', 
    '2 Grade Levels Below',
    '3 Grade Levels Below',
    'At Grade Level',
    'No data'
  ));
