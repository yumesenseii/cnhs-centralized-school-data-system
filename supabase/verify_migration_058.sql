-- Verification script for Migration 058: ARAL Independent Periods and Audit
-- Run this in Supabase SQL Editor to check if migration 058 is applied
-- Expected: All checks return true/present

-- 1. Check assessment_period column exists in phil_iri_baseline_records
SELECT 'phil_iri_baseline_records.assessment_period' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'phil_iri_baseline_records' 
         AND column_name = 'assessment_period'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 2. Check total_score is nullable
SELECT 'phil_iri_baseline_records.total_score nullable' as check_item,
       CASE WHEN is_nullable = 'YES' THEN 'NULLABLE' ELSE 'NOT NULL' END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'phil_iri_baseline_records' 
  AND column_name = 'total_score';

-- 3. Check unique constraint on (student_id, school_year, subject, assessment_period)
SELECT 'Unique constraint student_year_subject_period' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint 
         WHERE conrelid = 'public.phil_iri_baseline_records'::regclass
         AND conname = 'phil_iri_baseline_records_student_year_subject_period_key'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 4. Check old unique constraint is dropped
SELECT 'Old unique constraint dropped' as check_item,
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM pg_constraint 
         WHERE conrelid = 'public.phil_iri_baseline_records'::regclass
         AND conname = 'phil_iri_baseline_records_student_id_school_year_subject_key'
       ) THEN 'DROPPED' ELSE 'STILL EXISTS' END as status;

-- 5. Check assessment_period column in monitoring_records
SELECT 'monitoring_records.assessment_period' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'monitoring_records' 
         AND column_name = 'assessment_period'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 6. Check monitoring_reading_period_idx exists
SELECT 'monitoring_reading_period_idx' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes 
         WHERE schemaname = 'public' 
         AND tablename = 'monitoring_records' 
         AND indexname = 'monitoring_reading_period_idx'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 7. Check can_manage_phil_iri function exists
SELECT 'can_manage_phil_iri function' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc 
         WHERE proname = 'can_manage_phil_iri' 
         AND pronamespace = 'public'::regnamespace
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 8. Check validate_and_audit_phil_iri function exists
SELECT 'validate_and_audit_phil_iri function' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc 
         WHERE proname = 'validate_and_audit_phil_iri' 
         AND pronamespace = 'public'::regnamespace
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 9. Check trigger on phil_iri_baseline_records
SELECT 'phil_iri_validate_and_audit trigger' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger 
         WHERE tgrelid = 'public.phil_iri_baseline_records'::regclass
         AND tgname = 'phil_iri_validate_and_audit'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 10. Check phil_iri_assessment_audit table exists
SELECT 'phil_iri_assessment_audit table' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'phil_iri_assessment_audit'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 11. Check phil_iri_audit_assessment_idx exists
SELECT 'phil_iri_audit_assessment_idx' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes 
         WHERE schemaname = 'public' 
         AND tablename = 'phil_iri_assessment_audit' 
         AND indexname = 'phil_iri_audit_assessment_idx'
       ) THEN 'PRESENT' ELSE 'MISSING' END as status;

-- 12. Check RLS policies use can_manage_phil_iri
SELECT 'RLS policy phil_iri_baseline_insert' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE schemaname = 'public' 
         AND tablename = 'phil_iri_baseline_records' 
         AND policyname = 'phil_iri_baseline_insert'
         AND qual LIKE '%can_manage_phil_iri%'
       ) THEN 'UPDATED' ELSE 'OLD OR MISSING' END as status;

SELECT 'RLS policy phil_iri_baseline_update' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE schemaname = 'public' 
         AND tablename = 'phil_iri_baseline_records' 
         AND policyname = 'phil_iri_baseline_update'
         AND qual LIKE '%can_manage_phil_iri%'
       ) THEN 'UPDATED' ELSE 'OLD OR MISSING' END as status;

SELECT 'RLS policy phil_iri_assigned_class_select' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE schemaname = 'public' 
         AND tablename = 'phil_iri_baseline_records' 
         AND policyname = 'phil_iri_assigned_class_select'
         AND qual LIKE '%can_manage_phil_iri%'
       ) THEN 'UPDATED' ELSE 'OLD OR MISSING' END as status;

SELECT 'RLS policy phil_iri_audit_select' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE schemaname = 'public' 
         AND tablename = 'phil_iri_assessment_audit' 
         AND policyname = 'phil_iri_audit_select'
         AND qual LIKE '%can_manage_phil_iri%'
       ) THEN 'UPDATED' ELSE 'OLD OR MISSING' END as status;

-- 13. Check grant on phil_iri_baseline_records
SELECT 'Grant on phil_iri_baseline_records' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.table_privileges 
         WHERE table_schema = 'public' 
         AND table_name = 'phil_iri_baseline_records' 
         AND grantee = 'authenticated'
         AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE')
       ) THEN 'GRANTED' ELSE 'MISSING' END as status;

-- 14. Check grant on phil_iri_assessment_audit
SELECT 'Grant on phil_iri_assessment_audit' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.table_privileges 
         WHERE table_schema = 'public' 
         AND table_name = 'phil_iri_assessment_audit' 
         AND grantee = 'authenticated'
         AND privilege_type = 'SELECT'
       ) THEN 'GRANTED' ELSE 'MISSING' END as status;

-- Summary
SELECT '=== MIGRATION 058 VERIFICATION COMPLETE ===' as summary;