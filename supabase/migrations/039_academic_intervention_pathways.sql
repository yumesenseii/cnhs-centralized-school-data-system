-- 039_academic_intervention_pathways.sql
-- Academic Intervention Pathways: ARAL Program (RA 12028) & Classroom Remediation
-- Distinguishes academic risk classification from diagnostic assessment qualification and placement.

create table if not exists public.learner_intervention_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  school_year text not null,
  term integer not null check (term between 1 and 4),
  learning_area text not null,
  academic_grade numeric(5, 2),
  academic_risk_level text not null default 'Low Risk'
    check (academic_risk_level in ('High Risk', 'Moderate Risk', 'Low Risk')),
  
  -- Diagnostic Assessment Profile
  assessment_type text,
  assessment_result text,
  reading_level_or_placement text
    check (
      reading_level_or_placement is null
      or reading_level_or_placement in (
        'Frustration',
        'Instructional',
        'Independent',
        'Non-Reader',
        'Numeracy Tier 1',
        'Numeracy Tier 2',
        'Numeracy Tier 3',
        'N/A'
      )
    ),
  
  -- Intervention Pathway & Placement Tier
  intervention_pathway text not null default 'classroom_remediation'
    check (intervention_pathway in ('aral', 'classroom_remediation', 'none')),
  aral_placement_tier text
    check (aral_placement_tier is null or aral_placement_tier in ('basic', 'plus')),
  intervention_type text,
  intervention_status text not null default 'Identified'
    check (
      intervention_status in (
        'Identified',
        'Assessment Pending',
        'Qualified',
        'In Progress',
        'Completed',
        'Continued',
        'Needs Further Support',
        'For Further Monitoring'
      )
    ),
  
  -- Timeline & Lifecycle Assessments (Beginning / Middle / End)
  date_started date,
  beginning_assessment_score numeric(5, 2),
  middle_assessment_score numeric(5, 2),
  end_assessment_score numeric(5, 2),
  end_assessment_type text,
  
  -- Attendance Monitoring by Period
  attendance_sessions_attended integer not null default 0,
  attendance_sessions_total integer not null default 0,
  attendance_rate numeric(5, 2),
  
  -- Progress & Outcomes
  movement_outcome text
    check (
      movement_outcome is null
      or movement_outcome in ('Promoted', 'Retained', 'Improved', 'Needs Further Intervention')
    ),
  progress_result text
    check (
      progress_result is null
      or progress_result in (
        'Improved',
        'Progressing',
        'Limited Improvement',
        'No Significant Improvement',
        'Requires Further Support'
      )
    ),
  current_status text not null default 'Active'
    check (current_status in ('Active', 'Completed / Exited', 'Retained in Program', 'Escalated')),
  
  -- Facilitator / Teacher Assignment
  facilitator_or_teacher_id uuid references public.teachers (id) on delete set null,
  facilitator_name text,
  
  -- Principal / Head Teacher Review & Oversight
  principal_review_status text not null default 'Pending Review'
    check (
      principal_review_status in (
        'Pending Review',
        'Approved',
        'Reviewed / Endorsed',
        'Returned'
      )
    ),
  principal_reviewed_by uuid references public.profiles (id) on delete set null,
  principal_reviewed_at timestamptz,
  principal_review_note text,
  
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, learning_area, school_year, term)
);

comment on table public.learner_intervention_history is
  'Multi-term intervention history separating ARAL (Basic/Plus) and Classroom Remediation with beginning/mid/end assessment tracking.';

create index if not exists learner_intervention_history_student_idx
  on public.learner_intervention_history (student_id, school_year, term);

create index if not exists learner_intervention_history_pathway_idx
  on public.learner_intervention_history (intervention_pathway, intervention_status);

create index if not exists learner_intervention_history_review_idx
  on public.learner_intervention_history (principal_review_status);

create index if not exists learner_intervention_history_tier_idx
  on public.learner_intervention_history (aral_placement_tier);

-- Update trigger
create or replace function public.set_learner_intervention_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learner_intervention_history_set_updated_at
  on public.learner_intervention_history;
create trigger learner_intervention_history_set_updated_at
before update on public.learner_intervention_history
for each row
execute function public.set_learner_intervention_history_updated_at();

alter table public.learner_intervention_history enable row level security;

-- Read policy: Admins, teachers who teach the class/student, or student themselves
drop policy if exists learner_intervention_history_select on public.learner_intervention_history;
create policy learner_intervention_history_select
  on public.learner_intervention_history
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or (class_id is not null and public.owns_class(class_id))
    or teacher_id = public.current_teacher_id()
    or facilitator_or_teacher_id = public.current_teacher_id()
    or student_id = public.current_student_id()
  );

-- Insert policy: Admins or owning teachers
drop policy if exists learner_intervention_history_insert on public.learner_intervention_history;
create policy learner_intervention_history_insert
  on public.learner_intervention_history
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or (class_id is not null and public.owns_class(class_id))
    or teacher_id = public.current_teacher_id()
  );

-- Update policy: Admins or owning teachers
drop policy if exists learner_intervention_history_update on public.learner_intervention_history;
create policy learner_intervention_history_update
  on public.learner_intervention_history
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or (class_id is not null and public.owns_class(class_id))
    or teacher_id = public.current_teacher_id()
    or facilitator_or_teacher_id = public.current_teacher_id()
  )
  with check (
    public.is_active_admin_profile()
    or (class_id is not null and public.owns_class(class_id))
    or teacher_id = public.current_teacher_id()
    or facilitator_or_teacher_id = public.current_teacher_id()
  );

-- Delete policy: Admin only
drop policy if exists learner_intervention_history_delete on public.learner_intervention_history;
create policy learner_intervention_history_delete
  on public.learner_intervention_history
  for delete
  to authenticated
  using (public.is_active_admin_profile());

-- Historical aggregate reference benchmark table for verified CNHS official aggregate data
create table if not exists public.cnhs_aral_aggregate_benchmarks (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  period_label text not null,
  basic_beginning integer not null default 129,
  basic_end integer not null default 120,
  basic_retained integer not null default 19,
  basic_promoted integer not null default 101,
  basic_percentage numeric(5, 2) not null default 78.29,
  plus_beginning integer not null default 86,
  plus_end integer not null default 81,
  plus_retained integer not null default 7,
  plus_promoted integer not null default 74,
  plus_percentage numeric(5, 2) not null default 86.05,
  attendance_september numeric(5, 2) not null default 65.79,
  attendance_october numeric(5, 2) not null default 60.35,
  attendance_november numeric(5, 2) not null default 52.89,
  is_official_reference boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (school_year, period_label)
);

alter table public.cnhs_aral_aggregate_benchmarks enable row level security;

drop policy if exists cnhs_aral_aggregate_benchmarks_select on public.cnhs_aral_aggregate_benchmarks;
create policy cnhs_aral_aggregate_benchmarks_select
  on public.cnhs_aral_aggregate_benchmarks
  for select
  to authenticated
  using (true);

-- Seed verified CNHS SY 2025-2026 official historical aggregate reference benchmark
insert into public.cnhs_aral_aggregate_benchmarks (
  school_year,
  period_label,
  basic_beginning,
  basic_end,
  basic_retained,
  basic_promoted,
  basic_percentage,
  plus_beginning,
  plus_end,
  plus_retained,
  plus_promoted,
  plus_percentage,
  attendance_september,
  attendance_october,
  attendance_november,
  is_official_reference,
  notes
)
values (
  'SY 2025-2026',
  'Annual Intervention Cycle',
  129,
  120,
  19,
  101,
  78.29,
  86,
  81,
  7,
  74,
  86.05,
  65.79,
  60.35,
  52.89,
  true,
  'Verified CNHS Historical Aggregate Sample Record'
)
on conflict (school_year, period_label) do nothing;
