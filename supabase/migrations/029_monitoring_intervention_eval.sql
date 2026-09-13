-- Intervention evaluation / next action / session topic on monitoring_records.
-- Extends existing observations. Does not create an interventions table.
-- ARAL session_status remains not SF2 and never an RF feature.

alter table public.monitoring_records
  drop constraint if exists monitoring_records_monitoring_status_check;

alter table public.monitoring_records
  add constraint monitoring_records_monitoring_status_check
  check (
    monitoring_status = any (
      array[
        'Ongoing'::text,
        'Improved'::text,
        'Needs Follow-up'::text,
        'Completed'::text,
        'Needs Further Support'::text,
        'For Further Monitoring'::text
      ]
    )
  );

alter table public.monitoring_records
  add column if not exists progress_evaluation text
    check (
      progress_evaluation is null
      or progress_evaluation in (
        'Improving',
        'Limited Improvement',
        'No Significant Improvement',
        'Requires Further Support'
      )
    );

alter table public.monitoring_records
  add column if not exists next_action text
    check (
      next_action is null
      or next_action in (
        'Continue Intervention',
        'Provide Additional Support',
        'Complete Intervention',
        'Further Monitoring'
      )
    );

alter table public.monitoring_records
  add column if not exists evaluated_by uuid
    references public.teachers (id) on delete set null;

alter table public.monitoring_records
  add column if not exists evaluated_at timestamptz;

alter table public.monitoring_records
  add column if not exists topic text;

alter table public.monitoring_records
  add column if not exists activity text;

comment on column public.monitoring_records.progress_evaluation is
  'Teacher evaluation of recorded progress. Not auto-set from a test score.';

comment on column public.monitoring_records.next_action is
  'Teacher-chosen next step. System does not complete the intervention.';

comment on column public.monitoring_records.topic is
  'Teacher-typed session learning focus. Not a generated lesson plan.';

comment on column public.monitoring_records.activity is
  'Teacher-typed session activity. Not DepEd material generation.';

-- Students may read their own ARAL scores (progress view only).
drop policy if exists aral_assessment_scores_student_select
  on public.aral_assessment_scores;
create policy aral_assessment_scores_student_select
  on public.aral_assessment_scores
  for select
  to authenticated
  using (student_id = public.current_student_id());
