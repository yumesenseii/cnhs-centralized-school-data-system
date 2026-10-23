-- Independent reading periods. No global activation and no system_settings dependency.
-- Run as a database administrator. Preserves all existing records; legacy readings stay BOSY.
begin;

alter table public.phil_iri_baseline_records
  add column if not exists assessment_period text not null default 'BOSY';
alter table public.phil_iri_baseline_records alter column total_score drop not null;
alter table public.phil_iri_baseline_records
  drop constraint if exists phil_iri_baseline_records_student_id_school_year_subject_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.phil_iri_baseline_records'::regclass
    and conname = 'phil_iri_baseline_records_student_year_subject_period_key') then
    alter table public.phil_iri_baseline_records add constraint phil_iri_baseline_records_student_year_subject_period_key
      unique (student_id, school_year, subject, assessment_period);
  end if;
end $$;

-- Legacy absences may use a schema-compatible candidate status; absence is authoritative in raw_payload.
-- New writes use the existing For Review value so migration 053 is not a prerequisite.
alter table public.monitoring_records add column if not exists assessment_period text;
create index if not exists monitoring_reading_period_idx
  on public.monitoring_records (student_id, class_id, school_year, assessment_period, week_number);

-- A teacher id alone is not proof of class assignment. Validate the enrolled learner, class,
-- language and school year. Legacy rows without class_id can be corrected into an assigned class.
create or replace function public.can_manage_phil_iri(p_student uuid, p_class uuid, p_subject text, p_year text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_admin_profile() or (
    public.is_active_teacher_profile() and exists (
      select 1 from public.classes c
      join public.class_students cs on cs.class_id = c.id and cs.student_id = p_student
      join public.subjects sub on sub.id = c.subject_id
      where c.teacher_id = public.current_teacher_id()
        and (p_class is null or c.id = p_class) and c.school_year = p_year
        and ((p_subject = 'English' and lower(sub.subject_name) like '%english%')
          or (p_subject = 'Filipino' and lower(sub.subject_name) like '%filipino%'))
    )
  );
$$;
revoke all on function public.can_manage_phil_iri(uuid, uuid, text, text) from public, anon;
grant execute on function public.can_manage_phil_iri(uuid, uuid, text, text) to authenticated;

drop policy if exists phil_iri_baseline_insert on public.phil_iri_baseline_records;
create policy phil_iri_baseline_insert on public.phil_iri_baseline_records for insert to authenticated
  with check (public.is_active_admin_profile() or (class_id is not null
    and teacher_id = public.current_teacher_id()
    and public.can_manage_phil_iri(student_id, class_id, subject, school_year)));
drop policy if exists phil_iri_baseline_update on public.phil_iri_baseline_records;
create policy phil_iri_baseline_update on public.phil_iri_baseline_records for update to authenticated
  using (public.can_manage_phil_iri(student_id, class_id, subject, school_year))
  with check (public.is_active_admin_profile() or (class_id is not null
    and teacher_id = public.current_teacher_id()
    and public.can_manage_phil_iri(student_id, class_id, subject, school_year)));
-- Add scoped read access for current assigned teachers correcting legacy rows.
drop policy if exists phil_iri_assigned_class_select on public.phil_iri_baseline_records;
create policy phil_iri_assigned_class_select on public.phil_iri_baseline_records for select to authenticated
  using (public.can_manage_phil_iri(student_id, class_id, subject, school_year));
grant select, insert, update on public.phil_iri_baseline_records to authenticated;

create table if not exists public.phil_iri_assessment_audit (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null,
  student_id uuid not null,
  class_id uuid,
  school_year text not null,
  subject text not null,
  assessment_period text not null,
  actor_auth_user_id uuid,
  correction_reason text,
  before_result jsonb not null,
  after_result jsonb not null,
  corrected_at timestamptz not null default now()
);
create index if not exists phil_iri_audit_assessment_idx on public.phil_iri_assessment_audit (assessment_id, corrected_at desc);
alter table public.phil_iri_assessment_audit enable row level security;
revoke all on public.phil_iri_assessment_audit from anon, authenticated;
grant select on public.phil_iri_assessment_audit to authenticated;
drop policy if exists phil_iri_audit_select on public.phil_iri_assessment_audit;
create policy phil_iri_audit_select on public.phil_iri_assessment_audit for select to authenticated
  using (public.can_manage_phil_iri(student_id, class_id, subject, school_year));

create or replace function public.validate_and_audit_phil_iri()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  metrics jsonb := new.raw_payload->'iraMetrics';
  field text;
  word_pct numeric;
  comp_pct numeric;
  calculated_profile text;
  old_values jsonb;
  new_values jsonb;
begin
  if new.assessment_period not in ('BOSY', 'MOSY', 'EOSY') then
    raise exception 'Choose BOSY, MOSY, or EOSY.';
  end if;
  if coalesce((new.raw_payload->>'isAbsent')::boolean, false) then
    new.total_score := null;
    if metrics is not null and metrics <> 'null'::jsonb then raise exception 'An absent learner cannot have individual assessment results.'; end if;
  elsif new.total_score is null or new.total_score < 0 or new.total_score > 40 or new.total_score::text = 'NaN' then
    raise exception 'Record a valid GST screening score from 0 to 40 first.';
  end if;
  if metrics is not null and metrics <> 'null'::jsonb then
    if new.total_score is null or new.total_score >= 28 then raise exception 'Individual assessment requires GST screening below 28.'; end if;
    foreach field in array array['totalWords','miscues','readingTimeSeconds','comprehensionCorrect','comprehensionTotal'] loop
      if coalesce(metrics->>field, '') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Complete the individual reading assessment measurements.'; end if;
    end loop;
    if coalesce(metrics->>'passageLevel','') = '' or (metrics->>'totalWords')::numeric <= 0
      or (metrics->>'readingTimeSeconds')::numeric <= 0 or (metrics->>'comprehensionTotal')::numeric <= 0
      or (metrics->>'miscues')::numeric > (metrics->>'totalWords')::numeric
      or (metrics->>'comprehensionCorrect')::numeric > (metrics->>'comprehensionTotal')::numeric then
      raise exception 'Check the passage, word reading, reading time and comprehension results.';
    end if;
    word_pct := round(100 * ((metrics->>'totalWords')::numeric - (metrics->>'miscues')::numeric) / (metrics->>'totalWords')::numeric);
    comp_pct := round(100 * (metrics->>'comprehensionCorrect')::numeric / (metrics->>'comprehensionTotal')::numeric);
    calculated_profile := case when word_pct < 90 or comp_pct < 59 then 'Frustration'
      when word_pct >= 95 and comp_pct >= 80 then 'Independent' else 'Instructional' end;
    if new.reading_level <> calculated_profile then raise exception 'The reading profile must match the recorded measurements.'; end if;
    if coalesce(metrics->>'progressionOutcome','') not in ('No Further Assessment Required',
      case when new.assessment_period = 'EOSY' then 'For Further Review after EOSY' else 'Continue to Next Assessment Period' end) then
      raise exception 'Confirm the assessment outcome.';
    end if;
  elsif new.reading_level in ('Independent','Instructional','Frustration','Non-Reader')
    and (tg_op = 'INSERT' or new.reading_level is distinct from old.reading_level) then
    -- INSERT ON CONFLICT runs this trigger before the UPDATE. Permit retaining
    -- an identical legacy profile, but never assigning a new profile without Form 3.
    if not exists (select 1 from public.phil_iri_baseline_records r
      where (r.student_id,r.school_year,r.subject,r.assessment_period) = (new.student_id,new.school_year,new.subject,new.assessment_period)
        and r.reading_level = new.reading_level and r.total_score is not distinct from new.total_score) then
      raise exception 'Complete Form 3 before assigning a reading profile.';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (new.student_id, new.school_year, new.subject, new.assessment_period) is distinct from
      (old.student_id, old.school_year, old.subject, old.assessment_period) then
      raise exception 'A saved result cannot be moved to another learner, language, year or period.';
    end if;
    if new.raw_payload ? 'expectedUpdatedAt' and (new.raw_payload->>'expectedUpdatedAt')::timestamptz is distinct from old.updated_at then
      raise exception 'This result changed while you were editing. Refresh and review it before saving.';
    end if;
    old_values := jsonb_build_object('score', old.total_score, 'level', old.reading_level,
      'absent', old.raw_payload->'isAbsent', 'metrics', nullif(old.raw_payload->'iraMetrics', 'null'::jsonb) - 'evaluatedAt',
      'outcome', old.raw_payload->'progressionOutcome', 'review', old.raw_payload->'teacherReviewReason');
    new_values := jsonb_build_object('score', new.total_score, 'level', new.reading_level,
      'absent', new.raw_payload->'isAbsent', 'metrics', nullif(new.raw_payload->'iraMetrics', 'null'::jsonb) - 'evaluatedAt',
      'outcome', new.raw_payload->'progressionOutcome', 'review', new.raw_payload->'teacherReviewReason');
    if old_values is distinct from new_values then
      insert into public.phil_iri_assessment_audit (assessment_id, student_id, class_id, school_year, subject,
        assessment_period, actor_auth_user_id, correction_reason, before_result, after_result)
      values (old.id, old.student_id, coalesce(new.class_id,old.class_id), old.school_year, old.subject,
        old.assessment_period, auth.uid(), nullif(new.raw_payload->>'correctionReason',''), to_jsonb(old), to_jsonb(new));
    end if;
  end if;
  if tg_op = 'UPDATE' then new.raw_payload := coalesce(new.raw_payload, '{}'::jsonb) - 'expectedUpdatedAt'; end if;
  return new;
end $$;
revoke all on function public.validate_and_audit_phil_iri() from public, anon, authenticated;
drop trigger if exists phil_iri_validate_and_audit on public.phil_iri_baseline_records;
create trigger phil_iri_validate_and_audit before insert or update on public.phil_iri_baseline_records
  for each row execute function public.validate_and_audit_phil_iri();

-- Existing weekly records keep NULL (unknown period); never guess from academic quarters.
-- No updates to academic grades, RF data, or existing intervention progress.
notify pgrst, 'reload schema';
commit;
