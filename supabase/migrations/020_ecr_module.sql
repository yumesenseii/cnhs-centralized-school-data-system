-- In-system Electronic Class Record (ECR) module.
-- Detailed WW/PT/QA scores live here; public.grades holds published term/final grades only.

create table if not exists public.ecr_workbooks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  school_year character varying not null,
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  template_version text not null default 'class-record-v1',
  source text not null default 'manual'
    check (source in ('manual', 'import')),
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, school_year)
);

comment on table public.ecr_workbooks is
  'One ECR workbook per class offering per school year (DepEd Class-Record-v1).';

create table if not exists public.ecr_term_sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.ecr_workbooks (id) on delete cascade,
  term integer not null check (term >= 1 and term <= 3),
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workbook_id, term)
);

create table if not exists public.ecr_component_config (
  id uuid primary key default gen_random_uuid(),
  term_sheet_id uuid not null references public.ecr_term_sheets (id) on delete cascade,
  component text not null check (component in ('WW', 'PT', 'QA')),
  item_index integer not null check (item_index >= 1),
  item_label text not null,
  highest_possible_score numeric(8, 2) not null check (highest_possible_score > 0),
  component_weight numeric(5, 4) not null check (component_weight > 0 and component_weight <= 1),
  sort_order integer not null default 0,
  unique (term_sheet_id, component, item_index)
);

create table if not exists public.ecr_component_scores (
  id uuid primary key default gen_random_uuid(),
  term_sheet_id uuid not null references public.ecr_term_sheets (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  component text not null check (component in ('WW', 'PT', 'QA')),
  item_index integer not null check (item_index >= 1),
  raw_score numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_sheet_id, student_id, component, item_index)
);

create table if not exists public.ecr_computed_grades (
  id uuid primary key default gen_random_uuid(),
  term_sheet_id uuid not null references public.ecr_term_sheets (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  ww_ps numeric(6, 2),
  ww_ws numeric(6, 2),
  pt_ps numeric(6, 2),
  pt_ws numeric(6, 2),
  qa_ps numeric(6, 2),
  qa_ws numeric(6, 2),
  initial_grade numeric(6, 2),
  term_grade numeric(5, 2),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_sheet_id, student_id)
);

create index if not exists ecr_workbooks_class_id_idx on public.ecr_workbooks (class_id);
create index if not exists ecr_workbooks_teacher_id_idx on public.ecr_workbooks (teacher_id);
create index if not exists ecr_term_sheets_workbook_id_idx on public.ecr_term_sheets (workbook_id);
create index if not exists ecr_component_config_term_sheet_idx
  on public.ecr_component_config (term_sheet_id);
create index if not exists ecr_component_scores_term_student_idx
  on public.ecr_component_scores (term_sheet_id, student_id);
create index if not exists ecr_computed_grades_term_student_idx
  on public.ecr_computed_grades (term_sheet_id, student_id);

drop trigger if exists ecr_workbooks_set_updated_at on public.ecr_workbooks;
create trigger ecr_workbooks_set_updated_at
before update on public.ecr_workbooks
for each row execute function public.set_grades_updated_at();

drop trigger if exists ecr_term_sheets_set_updated_at on public.ecr_term_sheets;
create trigger ecr_term_sheets_set_updated_at
before update on public.ecr_term_sheets
for each row execute function public.set_grades_updated_at();

drop trigger if exists ecr_component_scores_set_updated_at on public.ecr_component_scores;
create trigger ecr_component_scores_set_updated_at
before update on public.ecr_component_scores
for each row execute function public.set_grades_updated_at();

drop trigger if exists ecr_computed_grades_set_updated_at on public.ecr_computed_grades;
create trigger ecr_computed_grades_set_updated_at
before update on public.ecr_computed_grades
for each row execute function public.set_grades_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ecr_workbooks enable row level security;
alter table public.ecr_term_sheets enable row level security;
alter table public.ecr_component_config enable row level security;
alter table public.ecr_component_scores enable row level security;
alter table public.ecr_computed_grades enable row level security;

grant select, insert, update, delete on public.ecr_workbooks to authenticated;
grant select, insert, update, delete on public.ecr_term_sheets to authenticated;
grant select, insert, update, delete on public.ecr_component_config to authenticated;
grant select, insert, update, delete on public.ecr_component_scores to authenticated;
grant select, insert, update, delete on public.ecr_computed_grades to authenticated;

create or replace function public.ecr_workbook_id_for_term_sheet(p_term_sheet_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ts.workbook_id
  from public.ecr_term_sheets ts
  where ts.id = p_term_sheet_id
  limit 1;
$$;

create or replace function public.ecr_class_id_for_workbook(p_workbook_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.class_id
  from public.ecr_workbooks w
  where w.id = p_workbook_id
  limit 1;
$$;

create or replace function public.can_access_ecr_workbook(p_workbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_admin_profile()
    or public.owns_class(public.ecr_class_id_for_workbook(p_workbook_id));
$$;

create or replace function public.can_access_ecr_term_sheet(p_term_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_ecr_workbook(public.ecr_workbook_id_for_term_sheet(p_term_sheet_id));
$$;

create or replace function public.student_enrolled_in_ecr_class(p_student_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    where cs.student_id = p_student_id
      and cs.class_id = p_class_id
  );
$$;

-- workbooks
drop policy if exists ecr_workbooks_select on public.ecr_workbooks;
create policy ecr_workbooks_select on public.ecr_workbooks for select to authenticated
using (
  public.is_active_admin_profile()
  or public.owns_class(class_id)
);

drop policy if exists ecr_workbooks_insert on public.ecr_workbooks;
create policy ecr_workbooks_insert on public.ecr_workbooks for insert to authenticated
with check (
  public.is_active_admin_profile()
  or (
    public.owns_class(class_id)
    and teacher_id = public.current_teacher_id()
  )
);

drop policy if exists ecr_workbooks_update on public.ecr_workbooks;
create policy ecr_workbooks_update on public.ecr_workbooks for update to authenticated
using (
  public.is_active_admin_profile()
  or public.owns_class(class_id)
)
with check (
  public.is_active_admin_profile()
  or public.owns_class(class_id)
);

drop policy if exists ecr_workbooks_delete on public.ecr_workbooks;
create policy ecr_workbooks_delete on public.ecr_workbooks for delete to authenticated
using (public.is_active_admin_profile());

-- term sheets
drop policy if exists ecr_term_sheets_select on public.ecr_term_sheets;
create policy ecr_term_sheets_select on public.ecr_term_sheets for select to authenticated
using (public.can_access_ecr_workbook(workbook_id));

drop policy if exists ecr_term_sheets_insert on public.ecr_term_sheets;
create policy ecr_term_sheets_insert on public.ecr_term_sheets for insert to authenticated
with check (public.can_access_ecr_workbook(workbook_id));

drop policy if exists ecr_term_sheets_update on public.ecr_term_sheets;
create policy ecr_term_sheets_update on public.ecr_term_sheets for update to authenticated
using (public.can_access_ecr_workbook(workbook_id))
with check (public.can_access_ecr_workbook(workbook_id));

drop policy if exists ecr_term_sheets_delete on public.ecr_term_sheets;
create policy ecr_term_sheets_delete on public.ecr_term_sheets for delete to authenticated
using (public.is_active_admin_profile());

-- component config
drop policy if exists ecr_component_config_select on public.ecr_component_config;
create policy ecr_component_config_select on public.ecr_component_config for select to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_config_insert on public.ecr_component_config;
create policy ecr_component_config_insert on public.ecr_component_config for insert to authenticated
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_config_update on public.ecr_component_config;
create policy ecr_component_config_update on public.ecr_component_config for update to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id))
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_config_delete on public.ecr_component_config;
create policy ecr_component_config_delete on public.ecr_component_config for delete to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id));

-- component scores
drop policy if exists ecr_component_scores_select on public.ecr_component_scores;
create policy ecr_component_scores_select on public.ecr_component_scores for select to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_scores_insert on public.ecr_component_scores;
create policy ecr_component_scores_insert on public.ecr_component_scores for insert to authenticated
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_scores_update on public.ecr_component_scores;
create policy ecr_component_scores_update on public.ecr_component_scores for update to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id))
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_component_scores_delete on public.ecr_component_scores;
create policy ecr_component_scores_delete on public.ecr_component_scores for delete to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id));

-- computed grades (teachers + admins + enrolled students read own row)
drop policy if exists ecr_computed_grades_select on public.ecr_computed_grades;
create policy ecr_computed_grades_select on public.ecr_computed_grades for select to authenticated
using (
  public.can_access_ecr_term_sheet(term_sheet_id)
  or student_id = public.current_student_id()
);

drop policy if exists ecr_computed_grades_insert on public.ecr_computed_grades;
create policy ecr_computed_grades_insert on public.ecr_computed_grades for insert to authenticated
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_computed_grades_update on public.ecr_computed_grades;
create policy ecr_computed_grades_update on public.ecr_computed_grades for update to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id))
with check (public.can_access_ecr_term_sheet(term_sheet_id));

drop policy if exists ecr_computed_grades_delete on public.ecr_computed_grades;
create policy ecr_computed_grades_delete on public.ecr_computed_grades for delete to authenticated
using (public.can_access_ecr_term_sheet(term_sheet_id));
