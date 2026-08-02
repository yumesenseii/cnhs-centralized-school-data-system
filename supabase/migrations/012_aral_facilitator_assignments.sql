-- Summer ARAL Program: facilitator assignments (separate from subject-teacher identification).
-- Subject teachers still identify Eng/Fil → ARAL Learners; only assigned facilitators
-- submit weekly ARAL progress during the summer program.

create table if not exists public.aral_program_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Summer ARAL Program',
  school_year text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year, name)
);

comment on table public.aral_program_batches is
  'Summer ARAL Program periods. Facilitators are assigned per batch; subject teachers still identify ARAL Learners from grades.';

create table if not exists public.aral_facilitator_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.aral_program_batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  facilitator_teacher_id uuid not null references public.teachers (id) on delete cascade,
  source_class_id uuid references public.classes (id) on delete set null,
  assigned_by_profile_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, student_id)
);

comment on table public.aral_facilitator_assignments is
  'Maps an ARAL Learner to a summer-program facilitator who submits weekly progress updates.';

create index if not exists aral_facilitator_assignments_batch_idx
  on public.aral_facilitator_assignments (batch_id);

create index if not exists aral_facilitator_assignments_teacher_idx
  on public.aral_facilitator_assignments (facilitator_teacher_id);

create index if not exists aral_facilitator_assignments_student_idx
  on public.aral_facilitator_assignments (student_id);

create or replace function public.set_aral_program_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aral_program_batches_set_updated_at on public.aral_program_batches;
create trigger aral_program_batches_set_updated_at
before update on public.aral_program_batches
for each row
execute function public.set_aral_program_updated_at();

drop trigger if exists aral_facilitator_assignments_set_updated_at on public.aral_facilitator_assignments;
create trigger aral_facilitator_assignments_set_updated_at
before update on public.aral_facilitator_assignments
for each row
execute function public.set_aral_program_updated_at();

-- True when the current teacher is the assigned facilitator for this student
-- in any active ARAL program batch.
create or replace function public.is_aral_facilitator_for_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.aral_facilitator_assignments a
    join public.aral_program_batches b on b.id = a.batch_id
    where a.student_id = p_student_id
      and a.facilitator_teacher_id = public.current_teacher_id()
      and b.is_active = true
  );
$$;

revoke execute on function public.is_aral_facilitator_for_student(uuid) from public, anon;
grant execute on function public.is_aral_facilitator_for_student(uuid) to authenticated;

alter table public.aral_program_batches enable row level security;
alter table public.aral_facilitator_assignments enable row level security;

drop policy if exists aral_program_batches_select on public.aral_program_batches;
create policy aral_program_batches_select
  on public.aral_program_batches
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_active_teacher_profile()
  );

drop policy if exists aral_program_batches_write on public.aral_program_batches;
create policy aral_program_batches_write
  on public.aral_program_batches
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

drop policy if exists aral_facilitator_assignments_select on public.aral_facilitator_assignments;
create policy aral_facilitator_assignments_select
  on public.aral_facilitator_assignments
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or facilitator_teacher_id = public.current_teacher_id()
  );

drop policy if exists aral_facilitator_assignments_write on public.aral_facilitator_assignments;
create policy aral_facilitator_assignments_write
  on public.aral_facilitator_assignments
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

-- Allow assigned facilitators to insert weekly ARAL monitoring records
-- even when they do not own the source subject class.
drop policy if exists monitoring_records_insert_scoped on public.monitoring_records;
create policy monitoring_records_insert_scoped
  on public.monitoring_records
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or (
      teacher_id = public.current_teacher_id()
      and public.owns_class(class_id)
    )
    or (
      teacher_id = public.current_teacher_id()
      and public.is_aral_facilitator_for_student(student_id)
    )
  );

-- Seed an active Summer ARAL Program batch for the current demo school year.
insert into public.aral_program_batches (name, school_year, is_active)
values ('Summer ARAL Program', 'SY 2025-2026', true)
on conflict (school_year, name) do nothing;
