-- Official SF2: adviser marks Morning and Afternoon separately.
-- Not per subject. Not Academic Prediction / RF. Not invented from Yakal.

alter table public.attendance_daily
  add column if not exists session text;

update public.attendance_daily
set session = 'morning'
where session is null;

alter table public.attendance_daily
  alter column session set default 'morning';

alter table public.attendance_daily
  alter column session set not null;

alter table public.attendance_daily
  drop constraint if exists attendance_daily_session_check;

alter table public.attendance_daily
  add constraint attendance_daily_session_check
  check (session in ('morning', 'afternoon'));

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance_daily'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%attendance_date%'
      and pg_get_constraintdef(oid) not ilike '%session%'
  ) then
    execute (
      select 'alter table public.attendance_daily drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.attendance_daily'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) ilike '%attendance_date%'
        and pg_get_constraintdef(oid) not ilike '%session%'
      limit 1
    );
  end if;
end $$;

create unique index if not exists attendance_daily_student_section_date_session_key
  on public.attendance_daily (student_id, section_id, attendance_date, session);

comment on column public.attendance_daily.session is
  'Official SF2 roll-call session: morning or afternoon. Adviser-only write. Not per subject. Not RF.';
