-- Structured ARAL weekly progress on monitoring_records.
-- week_number is stored; do not infer week from remarks for new rows.
-- session_status is ARAL session only — not SF2, not Academic Prediction / RF.

alter table public.monitoring_records
  add column if not exists week_number integer
    check (week_number is null or week_number >= 1);

alter table public.monitoring_records
  add column if not exists session_status text
    check (
      session_status is null
      or session_status in ('present', 'absent', 'excused')
    );

alter table public.monitoring_records
  add column if not exists skill_focus text
    check (
      skill_focus is null
      or skill_focus in ('Reading', 'Writing', 'Grammar', 'Comprehension')
    );

comment on column public.monitoring_records.week_number is
  'ARAL weekly file number. Null for classroom monitoring. Not inferred from remarks.';

comment on column public.monitoring_records.session_status is
  'ARAL session mark (present/absent/excused). Not official SF2. Never an RF feature.';

comment on column public.monitoring_records.skill_focus is
  'ARAL weekly skill focus. Structured band only.';

create unique index if not exists monitoring_records_aral_week_uniq
  on public.monitoring_records (student_id, class_id, week_number)
  where week_number is not null;

-- Backfill older ARAL rows that only stored [Week N] in remarks.
update public.monitoring_records
set week_number = (regexp_match(teacher_remarks, '^\[Week\s+(\d+)\]', 'i'))[1]::integer
where week_number is null
  and teacher_remarks ~* '^\[Week\s+[0-9]+\]';
