-- =============================================================================
-- CNHS LEARN — SAFE DELETION OF TEST LESSON PLANS
-- =============================================================================
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/siumnhtrksgjkbgggpwg/sql/new)
-- to delete all submitted test lesson plans, review events, and delete requests.
-- =============================================================================

BEGIN;

-- 1. Delete all audit trail / review history events for lesson plans
DELETE FROM public.lesson_plan_events;

-- 2. Delete all delete requests associated with lesson plans
DELETE FROM public.delete_requests 
WHERE target_type = 'lesson_plan';

-- 3. Delete all submitted test lesson plans
DELETE FROM public.lesson_plans;

COMMIT;

-- Verify all table counts are reset to 0:
SELECT 
  (SELECT count(*) FROM public.lesson_plans) AS remaining_lesson_plans,
  (SELECT count(*) FROM public.lesson_plan_events) AS remaining_events,
  (SELECT count(*) FROM public.delete_requests WHERE target_type = 'lesson_plan') AS remaining_delete_requests;
