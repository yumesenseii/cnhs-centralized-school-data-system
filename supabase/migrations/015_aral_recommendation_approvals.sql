-- Lean HT / Admin approval for ARAL Learners recommendations (Eng/Fil).
-- Hybrid workflow: review in portal and/or offline Excel; formal approve in-system.
-- Does not store full PLP documents — status + optional review note only.

create table if not exists public.aral_recommendation_approvals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  school_year text not null,
  quarter integer not null check (quarter between 1 and 4),
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'returned')),
  review_note text,
  submitted_at timestamptz,
  submitted_by_profile_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, school_year, quarter)
);

comment on table public.aral_recommendation_approvals is
  'HT/Admin approval status for system-recommended ARAL Learners (per student, Eng/Fil class, term). No row = Suggested.';

create index if not exists aral_recommendation_approvals_student_idx
  on public.aral_recommendation_approvals (student_id);

create index if not exists aral_recommendation_approvals_class_idx
  on public.aral_recommendation_approvals (class_id);

create index if not exists aral_recommendation_approvals_status_idx
  on public.aral_recommendation_approvals (status);

create index if not exists aral_recommendation_approvals_term_idx
  on public.aral_recommendation_approvals (school_year, quarter);

create or replace function public.set_aral_recommendation_approvals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aral_recommendation_approvals_set_updated_at
  on public.aral_recommendation_approvals;
create trigger aral_recommendation_approvals_set_updated_at
before update on public.aral_recommendation_approvals
for each row
execute function public.set_aral_recommendation_approvals_updated_at();

alter table public.aral_recommendation_approvals enable row level security;

-- Read: admin, owning teacher, or the student themselves.
drop policy if exists aral_recommendation_approvals_select
  on public.aral_recommendation_approvals;
create policy aral_recommendation_approvals_select
  on public.aral_recommendation_approvals
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
    or student_id = public.current_student_id()
  );

-- Teachers may insert/update their own class rows (submit / re-submit after return).
-- Admins may write anything (approve / return / submit).
drop policy if exists aral_recommendation_approvals_insert
  on public.aral_recommendation_approvals;
create policy aral_recommendation_approvals_insert
  on public.aral_recommendation_approvals
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or (
      public.owns_class(class_id)
      and status = 'submitted'
    )
  );

drop policy if exists aral_recommendation_approvals_update
  on public.aral_recommendation_approvals;
create policy aral_recommendation_approvals_update
  on public.aral_recommendation_approvals
  for update
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.owns_class(class_id)
  )
  with check (
    public.is_active_admin_profile()
    or (
      public.owns_class(class_id)
      and status = 'submitted'
    )
  );

-- Only admin may delete approval records.
drop policy if exists aral_recommendation_approvals_delete
  on public.aral_recommendation_approvals;
create policy aral_recommendation_approvals_delete
  on public.aral_recommendation_approvals
  for delete
  to authenticated
  using (public.is_active_admin_profile());
