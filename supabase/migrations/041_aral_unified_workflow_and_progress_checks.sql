-- 041_aral_unified_workflow_and_progress_checks.sql
-- Unified ARAL Program Lifecycle (RA 12028):
-- BOSY Assessment -> Needs Review -> Active Intervention -> Progress Checks -> Midline Decision -> EOSY Decision -> ARAL Summer Referral

-- 1. Extend learner_intervention_history with workflow status and assessment columns
alter table public.learner_intervention_history
  drop constraint if exists learner_intervention_history_intervention_status_check;

alter table public.learner_intervention_history
  add constraint learner_intervention_history_intervention_status_check
  check (
    intervention_status in (
      'Needs Review',
      'For Intervention',
      'Active Intervention',
      'Progressing',
      'For Midline Assessment',
      'For EOSY Assessment',
      'Completed',
      'Referred',
      'ARAL Summer Referral',
      -- Legacy compatibility aliases:
      'Identified',
      'Assessment Pending',
      'Qualified',
      'In Progress',
      'Continued',
      'Needs Further Support',
      'For Further Monitoring'
    )
  );

alter table public.learner_intervention_history
  add column if not exists target_competency text,
  add column if not exists midline_assessment_score numeric(5, 2),
  add column if not exists midline_assessment_result text,
  add column if not exists midline_decision text
    check (
      midline_decision is null
      or midline_decision in (
        'Enrichment / Exit ARAL',
        'Continue ARAL',
        'Refer to School Support'
      )
    ),
  add column if not exists midline_assessed_at timestamptz,
  add column if not exists eosy_assessment_score numeric(5, 2),
  add column if not exists eosy_assessment_result text,
  add column if not exists eosy_decision text
    check (
      eosy_decision is null
      or eosy_decision in (
        'Completed / Exit ARAL',
        'ARAL Summer Referral'
      )
    ),
  add column if not exists eosy_assessed_at timestamptz,
  add column if not exists summer_referral_reason text,
  add column if not exists summer_status text default 'Referred'
    check (
      summer_status is null
      or summer_status in (
        'Referred',
        'For Placement',
        'Assigned',
        'Active',
        'Completed',
        'For Further Review'
      )
    ),
  add column if not exists summer_teacher_id uuid references public.teachers (id) on delete set null,
  add column if not exists summer_program_name text;

create index if not exists learner_intervention_history_summer_idx
  on public.learner_intervention_history (summer_status, school_year);

create index if not exists learner_intervention_history_summer_teacher_idx
  on public.learner_intervention_history (summer_teacher_id);

-- 2. Lightweight continuous progress checks table
create table if not exists public.aral_progress_checks (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references public.learner_intervention_history (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  check_date date not null default current_date,
  activity_name text not null,
  result text not null,
  competency text not null,
  teacher_observation text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aral_progress_checks is
  'Chronological concise progress checks recorded by teachers during active ARAL reading intervention.';

create index if not exists aral_progress_checks_student_idx
  on public.aral_progress_checks (student_id, check_date desc);

create index if not exists aral_progress_checks_intervention_idx
  on public.aral_progress_checks (intervention_id);

create index if not exists aral_progress_checks_teacher_idx
  on public.aral_progress_checks (teacher_id);

-- Updated at trigger for aral_progress_checks
drop trigger if exists aral_progress_checks_set_updated_at on public.aral_progress_checks;
create trigger aral_progress_checks_set_updated_at
before update on public.aral_progress_checks
for each row
execute function public.set_learner_intervention_history_updated_at();

-- RLS for aral_progress_checks
alter table public.aral_progress_checks enable row level security;

drop policy if exists aral_progress_checks_select on public.aral_progress_checks;
create policy aral_progress_checks_select
  on public.aral_progress_checks
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or student_id = public.current_student_id()
    or exists (
      select 1 from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = aral_progress_checks.student_id
        and c.teacher_id = public.current_teacher_id()
    )
  );

drop policy if exists aral_progress_checks_insert on public.aral_progress_checks;
create policy aral_progress_checks_insert
  on public.aral_progress_checks
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
    or exists (
      select 1 from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = aral_progress_checks.student_id
        and c.teacher_id = public.current_teacher_id()
    )
  );

drop policy if exists aral_progress_checks_update on public.aral_progress_checks;
create policy aral_progress_checks_update
  on public.aral_progress_checks
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );

drop policy if exists aral_progress_checks_delete on public.aral_progress_checks;
create policy aral_progress_checks_delete
  on public.aral_progress_checks
  for delete
  to authenticated
  using (
    public.is_active_admin_profile()
    or teacher_id = public.current_teacher_id()
  );
