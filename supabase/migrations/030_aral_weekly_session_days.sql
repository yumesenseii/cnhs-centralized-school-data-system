-- Mon–Fri ARAL session marks on the existing weekly monitoring row.
-- One JSON object per learner+week. Not SF2 attendance. Not RF features.

alter table public.monitoring_records
  add column if not exists session_days jsonb;

comment on column public.monitoring_records.session_days is
  'ARAL weekly Mon–Fri session marks {mon,tue,wed,thu,fri} = present|absent|excused|null. Not official SF2. Never an RF feature.';
