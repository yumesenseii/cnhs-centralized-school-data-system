-- Adviser month close: school days + 1st Friday / EOM enrolment.
-- Computed ADA uses attendance_daily. Not Yakal COMP. Not RF.

create table if not exists public.attendance_month_closes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  school_year text not null,
  month integer not null check (month >= 1 and month <= 12),
  school_days integer not null check (school_days > 0),
  ff_m integer not null default 0 check (ff_m >= 0),
  ff_f integer not null default 0 check (ff_f >= 0),
  eom_m integer not null default 0 check (eom_m >= 0),
  eom_f integer not null default 0 check (eom_f >= 0),
  notes text,
  closed_by uuid references public.teachers (id) on delete set null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, school_year, month)
);

create index if not exists attendance_month_closes_section_sy_idx
  on public.attendance_month_closes (section_id, school_year);

comment on table public.attendance_month_closes is
  'Adviser-confirmed month close for ADA. Do not invent school days from weekdays. Not attendance_section_months. Not RF.';

alter table public.attendance_month_closes enable row level security;

revoke all on table public.attendance_month_closes from anon, public;
grant select, insert, update, delete on table public.attendance_month_closes to authenticated;

drop policy if exists attendance_month_closes_select_staff on public.attendance_month_closes;
create policy attendance_month_closes_select_staff
  on public.attendance_month_closes
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or exists (
      select 1
      from public.sections s
      where s.id = attendance_month_closes.section_id
        and s.adviser_id = public.current_teacher_id()
    )
    or exists (
      select 1
      from public.classes c
      where c.section_id = attendance_month_closes.section_id
        and c.teacher_id = public.current_teacher_id()
    )
  );

drop policy if exists attendance_month_closes_write_adviser on public.attendance_month_closes;
create policy attendance_month_closes_write_adviser
  on public.attendance_month_closes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sections s
      where s.id = attendance_month_closes.section_id
        and s.adviser_id = public.current_teacher_id()
    )
  )
  with check (
    exists (
      select 1
      from public.sections s
      where s.id = attendance_month_closes.section_id
        and s.adviser_id = public.current_teacher_id()
    )
  );
