-- Migration: 038_lesson_plan_section_remarks_and_workflow.sql
-- Description: Add section_remarks JSONB column to lesson_plans and lesson_plan_events
-- Supports section-by-section review, text highlighting remarks, and revision history.

-- 1. Add section_remarks to public.lesson_plans
alter table public.lesson_plans
  add column if not exists section_remarks jsonb not null default '[]'::jsonb;

comment on column public.lesson_plans.section_remarks is
  'Structured section-level remarks from Principal review (array of SectionRemark objects with sectionKey, highlightedText, comment, severity, status).';

-- 2. Add section_remarks to public.lesson_plan_events
alter table public.lesson_plan_events
  add column if not exists section_remarks jsonb default '[]'::jsonb;

comment on column public.lesson_plan_events.section_remarks is
  'Snapshot of section-level remarks at the time of the review event.';

-- 3. Add GIN index for fast JSON querying if needed
create index if not exists lesson_plans_section_remarks_gin
  on public.lesson_plans using gin (section_remarks);

-- 4. Update default reviewer role comment
comment on column public.lesson_plans.reviewed_by_name is
  'Principal or reviewer display name visible to teachers.';
