-- First-time guided tour completion (survives new browsers).
alter table public.profiles
  add column if not exists guided_tour_completed_at timestamptz;

comment on column public.profiles.guided_tour_completed_at is
  'When the user finished or skipped the first-time guided tour. Null = not completed.';
