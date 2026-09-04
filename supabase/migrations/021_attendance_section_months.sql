-- Class-level monthly SF2-COMP summaries (CNHS). Additive; keeps legacy attendance_records.
-- Never used by Academic Prediction / RF.

create table if not exists public.attendance_section_months (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  school_year text not null,
  month integer not null check (month between 1 and 12),
  school_days integer not null default 0 check (school_days >= 0),
  attendance_of_month numeric not null default 0,
  absences numeric not null default 0,
  total_attendance numeric not null default 0,
  first_friday numeric not null default 0,
  late numeric not null default 0,
  end_of_month numeric not null default 0,
  percentage numeric,
  ada numeric,
  pa numeric,
  five_consecutive numeric not null default 0,
  nls numeric not null default 0,
  transferred_out numeric not null default 0,
  transferred_in numeric not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  upload_id uuid references public.attendance_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, school_year, month)
);

create index if not exists attendance_section_months_sy_month_idx
  on public.attendance_section_months (school_year, month);
create index if not exists attendance_section_months_section_idx
  on public.attendance_section_months (section_id);

alter table public.attendance_section_months enable row level security;

drop policy if exists attendance_section_months_select_scoped on public.attendance_section_months;
create policy attendance_section_months_select_scoped
  on public.attendance_section_months
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists attendance_section_months_write_staff on public.attendance_section_months;
create policy attendance_section_months_write_staff
  on public.attendance_section_months
  for all
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  )
  with check (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

grant select, insert, update, delete on table public.attendance_section_months to authenticated;
