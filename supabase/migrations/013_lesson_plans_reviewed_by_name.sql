-- Denormalized reviewer display name so teachers can see Reviewed By
-- without reading admin profiles (RLS).
alter table public.lesson_plans
  add column if not exists reviewed_by_name text;

comment on column public.lesson_plans.reviewed_by_name is
  'Denormalized reviewer display name for teacher-visible Reviewed By (avoids profiles RLS).';
