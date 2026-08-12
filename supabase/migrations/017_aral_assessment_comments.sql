-- HT/Admin comments on ARAL section assessments (view-only for facilitators).

create or replace function public.is_aral_facilitator_for_grade_section(
  p_batch_id uuid,
  p_grade_section text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.aral_facilitator_assignments a
    join public.classes c on c.id = a.source_class_id
    join public.sections s on s.id = c.section_id
    where a.batch_id = p_batch_id
      and a.facilitator_teacher_id = public.current_teacher_id()
      and (
        ('Grade ' || s.grade_level::text || ' — ' || coalesce(s.section_name, ''))
          = p_grade_section
        or ('Grade ' || s.grade_level::text || ' ' || coalesce(s.section_name, ''))
          = p_grade_section
        or ('Grade ' || s.grade_level::text || ' - ' || coalesce(s.section_name, ''))
          = p_grade_section
      )
  );
$$;

revoke execute on function public.is_aral_facilitator_for_grade_section(uuid, text)
  from public, anon;
grant execute on function public.is_aral_facilitator_for_grade_section(uuid, text)
  to authenticated;

create table if not exists public.aral_assessment_comments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.aral_program_batches (id) on delete cascade,
  grade_section text not null,
  phase text check (phase is null or phase in ('pre', 'mid', 'post')),
  body text not null check (char_length(trim(body)) > 0),
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.aral_assessment_comments is
  'HT/Admin notes for facilitators on an ARAL section (optional phase scope). Facilitators read-only.';

create index if not exists aral_assessment_comments_section_idx
  on public.aral_assessment_comments (batch_id, grade_section, created_at desc);

create index if not exists aral_assessment_comments_phase_idx
  on public.aral_assessment_comments (batch_id, grade_section, phase);

alter table public.aral_assessment_comments enable row level security;

drop policy if exists aral_assessment_comments_select on public.aral_assessment_comments;
create policy aral_assessment_comments_select
  on public.aral_assessment_comments
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or public.is_aral_facilitator_for_grade_section(batch_id, grade_section)
  );

drop policy if exists aral_assessment_comments_insert on public.aral_assessment_comments;
create policy aral_assessment_comments_insert
  on public.aral_assessment_comments
  for insert
  to authenticated
  with check (public.is_active_admin_profile());

drop policy if exists aral_assessment_comments_delete on public.aral_assessment_comments;
create policy aral_assessment_comments_delete
  on public.aral_assessment_comments
  for delete
  to authenticated
  using (public.is_active_admin_profile());
