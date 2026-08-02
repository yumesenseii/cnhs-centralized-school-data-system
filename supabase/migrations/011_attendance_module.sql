-- Attendance Monitoring Module (independent of Academic Prediction).
-- Attendance is for upload, history, reports, and 20% absence warnings only.
-- It must never be used as a Random Forest / prediction feature.

create table if not exists public.attendance_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.profiles (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  school_year text not null,
  month integer not null check (month between 1 and 12),
  file_name text,
  status text not null default 'imported'
    check (status in ('imported', 'failed', 'partial')),
  row_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  school_year text not null,
  month integer not null check (month between 1 and 12),
  present_days integer not null default 0 check (present_days >= 0),
  absent_days integer not null default 0 check (absent_days >= 0),
  late_days integer not null default 0 check (late_days >= 0),
  school_days integer not null default 0 check (school_days >= 0),
  upload_id uuid references public.attendance_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year, month)
);

create index if not exists attendance_records_student_id_idx
  on public.attendance_records (student_id);
create index if not exists attendance_records_section_sy_month_idx
  on public.attendance_records (section_id, school_year, month);
create index if not exists attendance_uploads_section_sy_month_idx
  on public.attendance_uploads (section_id, school_year, month);

alter table public.attendance_uploads enable row level security;
alter table public.attendance_records enable row level security;

-- Staff can read/write attendance; students can read own records only.
drop policy if exists attendance_uploads_select_scoped on public.attendance_uploads;
create policy attendance_uploads_select_scoped
  on public.attendance_uploads
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists attendance_uploads_write_staff on public.attendance_uploads;
create policy attendance_uploads_write_staff
  on public.attendance_uploads
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

drop policy if exists attendance_records_select_scoped on public.attendance_records;
create policy attendance_records_select_scoped
  on public.attendance_records
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
    or student_id = public.current_student_id()
  );

drop policy if exists attendance_records_write_staff on public.attendance_records;
create policy attendance_records_write_staff
  on public.attendance_records
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

grant select, insert, update, delete on table public.attendance_uploads to authenticated;
grant select, insert, update, delete on table public.attendance_records to authenticated;
