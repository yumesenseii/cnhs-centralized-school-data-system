-- ============================================================================
-- Migration: 056_create_personalized_learning_plans.sql
-- Description: Non-destructive additive migration for Personalized Learning Plans (PLP)
--              with hardened RPC authorization, server-derived identities,
--              state machine triggers, and immutable scope constraints.
--
-- STRICT SAFEGUARD: SOURCE FILE ONLY — DO NOT EXECUTE DIRECTLY IN STAGE A.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table Creation
-- ----------------------------------------------------------------------------
create table if not exists public.personalized_learning_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  teacher_id uuid references public.teachers(id) on delete restrict,
  school_year text not null,
  academic_term integer check (academic_term between 1 and 3),
  reading_period text check (reading_period in ('BOSY', 'MOSY', 'EOSY')),
  plan_type text not null check (plan_type in ('academic_remedial', 'reading_aral', 'composite')),
  status text not null default 'draft' 
    check (status in ('draft', 'teacher_reviewed', 'active', 'completed', 'archived')),
  
  -- Structured Plan Content
  overall_risk_level text,
  recommended_support_level text,
  learning_needs jsonb not null default '[]'::jsonb,
  target_objectives jsonb not null default '[]'::jsonb,
  recommended_activities jsonb not null default '[]'::jsonb,
  monitoring_indicators jsonb not null default '[]'::jsonb,
  
  -- Teacher Customization, Provenance & Audit
  teacher_notes text,
  is_teacher_edited boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  last_edited_by uuid references public.profiles(id) on delete set null,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  activated_by_profile_id uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  
  -- Concurrency & Timestamps
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Structural Consistency Constraints: Enforce valid combinations per plan_type
  constraint chk_academic_plan_shape check (
    plan_type != 'academic_remedial' or (
      class_id is not null and 
      academic_term is not null and 
      reading_period is null
    )
  ),
  constraint chk_reading_plan_shape check (
    plan_type != 'reading_aral' or (
      class_id is null and 
      academic_term is null and 
      reading_period is not null
    )
  ),
  constraint chk_composite_plan_shape check (
    plan_type != 'composite' or (
      class_id is not null and 
      academic_term is not null and 
      reading_period is not null
    )
  )
);

comment on table public.personalized_learning_plans is
  'Persistent store for learner-specific Personalized Learning Plans with strict authorization and provenance.';

-- ----------------------------------------------------------------------------
-- 2. Partial Unique Indexes
-- Guaranteed non-null active columns avoid any nullable-index ambiguity.
-- ----------------------------------------------------------------------------
create unique index if not exists plp_academic_unique_idx 
  on public.personalized_learning_plans (student_id, class_id, school_year, academic_term) 
  where plan_type = 'academic_remedial';

create unique index if not exists plp_reading_unique_idx 
  on public.personalized_learning_plans (student_id, school_year, reading_period) 
  where plan_type = 'reading_aral';

create unique index if not exists plp_composite_unique_idx 
  on public.personalized_learning_plans (student_id, class_id, school_year, academic_term, reading_period) 
  where plan_type = 'composite';

create index if not exists plp_student_lookup_idx 
  on public.personalized_learning_plans (student_id, school_year, status);

-- ----------------------------------------------------------------------------
-- 3. Security Definer Helper: Scope Authorization
-- ----------------------------------------------------------------------------
create or replace function public.can_teacher_manage_student_plp(
  p_student_id uuid,
  p_class_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- Admin has universal management privilege
    select 1
    where public.is_active_admin_profile()
  ) or exists (
    -- Case A: Academic / Composite PLP with specified class_id:
    -- Teacher MUST own the class AND student MUST be actively enrolled in that class
    select 1
    from public.classes c
    join public.class_students cs on cs.class_id = c.id
    where p_class_id is not null
      and c.id = p_class_id
      and cs.student_id = p_student_id
      and c.teacher_id = public.current_teacher_id()
  ) or exists (
    -- Case B: Reading-only PLP (class_id IS NULL):
    -- Teacher is the Section Adviser of the student's active section
    select 1
    from public.students st
    where p_class_id is null
      and st.id = p_student_id
      and public.is_section_adviser(st.section_id)
  ) or exists (
    -- Case C: Reading-only PLP (class_id IS NULL):
    -- Teacher teaches an English or Filipino class in which the student is enrolled
    select 1
    from public.classes c
    join public.subjects sub on sub.id = c.subject_id
    join public.class_students cs on cs.class_id = c.id
    where p_class_id is null
      and cs.student_id = p_student_id
      and c.teacher_id = public.current_teacher_id()
      and lower(sub.subject_name) in ('english', 'filipino')
  );
$$;

revoke all on function public.can_teacher_manage_student_plp(uuid, uuid) from public, anon;
grant execute on function public.can_teacher_manage_student_plp(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Triggers: Direct-Write Bypass Prevention & State Transitions
-- ----------------------------------------------------------------------------

-- Trigger 4A: Direct INSERT Restriction (All new PLPs MUST be draft)
create or replace function public.enforce_plp_insert_constraints()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status != 'draft' then
    raise exception 'Invalid status: All new Personalized Learning Plans must be initialized with status = ''draft''. Direct creation in ''%'' status is prohibited.', new.status;
  end if;

  new.version = 1;
  new.created_at = now();
  new.updated_at = now();
  new.is_teacher_edited = coalesce(new.is_teacher_edited, false);

  if new.created_by_profile_id is null then
    new.created_by_profile_id = public.current_profile_id();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_plp_insert_constraints on public.personalized_learning_plans;
create trigger trg_enforce_plp_insert_constraints
before insert on public.personalized_learning_plans
for each row
execute function public.enforce_plp_insert_constraints();

-- Trigger 4B: UPDATE Immutability & State Machine
create or replace function public.enforce_plp_status_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Enforce immutability of structural scope columns
  if (new.student_id != old.student_id) or
     (new.class_id is distinct from old.class_id) or
     (new.teacher_id is distinct from old.teacher_id) or
     (new.school_year != old.school_year) or
     (new.academic_term is distinct from old.academic_term) or
     (new.reading_period is distinct from old.reading_period) or
     (new.plan_type != old.plan_type) then
    raise exception 'PLP core scope columns (student_id, class_id, teacher_id, school_year, academic_term, reading_period, plan_type) are immutable.';
  end if;

  -- 2. State Machine Transition validation
  if old.status = 'draft' then
    if new.status not in ('draft', 'teacher_reviewed', 'archived') then
      raise exception 'Invalid status transition: A draft PLP must be teacher_reviewed before it can be activated. Cannot transition from draft directly to %.', new.status;
    end if;
  elsif old.status = 'teacher_reviewed' then
    if new.status not in ('teacher_reviewed', 'active', 'archived') then
      raise exception 'Invalid status transition: A teacher_reviewed PLP can only transition to active or archived, not %.', new.status;
    end if;
  elsif old.status = 'active' then
    if new.status not in ('active', 'completed', 'archived') then
      raise exception 'Invalid status transition: An active PLP cannot be downgraded to %.', new.status;
    end if;
  elsif old.status in ('completed', 'archived') then
    if new.status != old.status then
      raise exception 'Terminal status: Cannot modify or reopen a % PLP.', old.status;
    end if;
  end if;

  -- 3. Version increment check
  if new.version != old.version + 1 then
    raise exception 'Concurrency conflict: Stale PLP version detected (expected %, received %).', old.version + 1, new.version;
  end if;

  -- 4. Timestamp updates
  new.updated_at = now();
  if new.status = 'teacher_reviewed' and old.status != 'teacher_reviewed' then
    new.reviewed_at = now();
  end if;
  if new.status = 'active' and old.status != 'active' then
    new.activated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_plp_status_transitions on public.personalized_learning_plans;
create trigger trg_enforce_plp_status_transitions
before update on public.personalized_learning_plans
for each row
execute function public.enforce_plp_status_transitions();

-- ----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
alter table public.personalized_learning_plans enable row level security;

-- SELECT Policy
create policy plp_select_policy on public.personalized_learning_plans
  for select to authenticated
  using (
    public.is_active_admin_profile()
    or (
      public.is_active_teacher_profile()
      and public.can_teacher_manage_student_plp(student_id, class_id)
    )
    or (
      public.is_active_student_profile()
      and student_id = public.current_student_id()
      and status in ('active', 'completed')
    )
  );

-- INSERT Policy (Teachers and Admins only; Students NEVER insert)
create policy plp_insert_policy on public.personalized_learning_plans
  for insert to authenticated
  with check (
    public.is_active_admin_profile()
    or (
      public.is_active_teacher_profile()
      and public.can_teacher_manage_student_plp(student_id, class_id)
    )
  );

-- UPDATE Policy (Teachers and Admins only; Students NEVER update)
create policy plp_update_policy on public.personalized_learning_plans
  for update to authenticated
  using (
    public.is_active_admin_profile()
    or (
      public.is_active_teacher_profile()
      and public.can_teacher_manage_student_plp(student_id, class_id)
    )
  )
  with check (
    public.is_active_admin_profile()
    or (
      public.is_active_teacher_profile()
      and public.can_teacher_manage_student_plp(student_id, class_id)
    )
  );

-- DELETE Policy (No ordinary deletes; archival only)
create policy plp_delete_policy on public.personalized_learning_plans
  for delete to authenticated
  using (public.is_active_admin_profile());

-- Table-Level Grants: Restrict ordinary clients to SELECT-only (filtered by RLS).
-- Direct INSERT, UPDATE, DELETE are strictly REVOKED. All mutations must flow through
-- hardened SECURITY DEFINER RPCs (generate_and_save_draft_plp, save_teacher_plp_draft,
-- mark_plp_reviewed_rpc, activate_plp_rpc, complete_plp_rpc).
revoke all on table public.personalized_learning_plans from public, anon, authenticated;
grant select on table public.personalized_learning_plans to authenticated;



-- ----------------------------------------------------------------------------
-- 6. Hardened SECURITY DEFINER RPC Functions
-- ----------------------------------------------------------------------------

-- RPC A: Automated Draft Regeneration (Server-Derived Identity & Authorization)
create or replace function public.generate_and_save_draft_plp(
  p_student_id uuid,
  p_class_id uuid,
  p_school_year text,
  p_academic_term integer,
  p_reading_period text,
  p_plan_type text,
  p_overall_risk_level text,
  p_recommended_support_level text,
  p_learning_needs jsonb,
  p_target_objectives jsonb,
  p_recommended_activities jsonb,
  p_monitoring_indicators jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_teacher boolean;
  v_teacher_id uuid;
  v_existing public.personalized_learning_plans;
  v_result public.personalized_learning_plans;
begin
  -- 1. Verify Authentication Context
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'Authentication required: Anonymous access is prohibited.';
  end if;

  v_caller_profile_id := public.current_profile_id();
  if v_caller_profile_id is null then
    raise exception 'Access denied: No active profile found for authenticated user.';
  end if;

  v_is_admin := public.is_active_admin_profile();
  v_is_teacher := public.is_active_teacher_profile();

  if not (v_is_admin or v_is_teacher) then
    raise exception 'Access denied: Only active teachers and administrators may generate learning plans.';
  end if;

  -- 2. Authorization Check (No reliance on RLS inside SECURITY DEFINER)
  if not v_is_admin then
    if not public.can_teacher_manage_student_plp(p_student_id, p_class_id) then
      raise exception 'Authorization failed: You do not have permission to manage learning plans for student % in class %.', p_student_id, p_class_id;
    end if;
  end if;

  -- 3. Context Validation
  if p_student_id is null or p_school_year is null or p_plan_type is null then
    raise exception 'Missing required context: student_id, school_year, and plan_type are mandatory.';
  end if;

  -- Derive teacher_id server-side
  v_teacher_id := case when v_is_teacher then public.current_teacher_id() else null end;

  -- Advisory transaction lock on student scope
  perform pg_advisory_xact_lock(hashtext(p_student_id::text || ':' || p_school_year || ':' || p_plan_type));

  -- Look up existing record
  if p_plan_type = 'academic_remedial' then
    select * into v_existing from public.personalized_learning_plans
    where student_id = p_student_id and class_id = p_class_id and school_year = p_school_year and academic_term = p_academic_term
    for update;
  elsif p_plan_type = 'reading_aral' then
    select * into v_existing from public.personalized_learning_plans
    where student_id = p_student_id and school_year = p_school_year and reading_period = p_reading_period
    for update;
  elsif p_plan_type = 'composite' then
    select * into v_existing from public.personalized_learning_plans
    where student_id = p_student_id and class_id = p_class_id and school_year = p_school_year and academic_term = p_academic_term and reading_period = p_reading_period
    for update;
  end if;

  if v_existing.id is not null then
    -- PROTECTED PLAN CHECK: Do not overwrite teacher-customized content!
    if v_existing.status in ('teacher_reviewed', 'active', 'completed', 'archived') or v_existing.is_teacher_edited then
      return jsonb_build_object(
        'success', false,
        'status', 'protected',
        'code', 'PLP_PROTECTED_FROM_AUTOMATION',
        'message', 'PLP is protected from automated re-generation because it is teacher-reviewed, active, or customized.',
        'data', to_jsonb(v_existing)
      );
    end if;

    -- Update existing unedited draft
    update public.personalized_learning_plans
    set
      overall_risk_level = p_overall_risk_level,
      recommended_support_level = p_recommended_support_level,
      learning_needs = p_learning_needs,
      target_objectives = p_target_objectives,
      recommended_activities = p_recommended_activities,
      monitoring_indicators = p_monitoring_indicators,
      version = v_existing.version + 1,
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;

    return jsonb_build_object('success', true, 'status', 'updated', 'data', to_jsonb(v_result));
  else
    -- Insert new draft
    insert into public.personalized_learning_plans (
      student_id,
      class_id,
      teacher_id,
      school_year,
      academic_term,
      reading_period,
      plan_type,
      status,
      overall_risk_level,
      recommended_support_level,
      learning_needs,
      target_objectives,
      recommended_activities,
      monitoring_indicators,
      created_by_profile_id,
      version
    ) values (
      p_student_id,
      p_class_id,
      v_teacher_id,
      p_school_year,
      p_academic_term,
      p_reading_period,
      p_plan_type,
      'draft',
      p_overall_risk_level,
      p_recommended_support_level,
      p_learning_needs,
      p_target_objectives,
      p_recommended_activities,
      p_monitoring_indicators,
      v_caller_profile_id,
      1
    )
    returning * into v_result;

    return jsonb_build_object('success', true, 'status', 'created', 'data', to_jsonb(v_result));
  end if;
end;
$$;

revoke all on function public.generate_and_save_draft_plp from public, anon;
grant execute on function public.generate_and_save_draft_plp to authenticated;

-- RPC B: Authorized Teacher Manual Draft Save
create or replace function public.save_teacher_plp_draft(
  p_id uuid,
  p_learning_needs jsonb,
  p_target_objectives jsonb,
  p_recommended_activities jsonb,
  p_monitoring_indicators jsonb,
  p_teacher_notes text,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_teacher boolean;
  v_existing public.personalized_learning_plans;
  v_result public.personalized_learning_plans;
begin
  -- 1. Authentication Check
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'Authentication required: Anonymous access is prohibited.';
  end if;

  v_caller_profile_id := public.current_profile_id();
  v_is_admin := public.is_active_admin_profile();
  v_is_teacher := public.is_active_teacher_profile();

  if not (v_is_admin or v_is_teacher) then
    raise exception 'Access denied: Only active teachers and administrators may edit learning plans.';
  end if;

  -- 2. Lock & Fetch Existing Plan
  select * into v_existing from public.personalized_learning_plans
  where id = p_id
  for update;

  if v_existing.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found', 'message', 'PLP not found.');
  end if;

  -- 3. Authorization Check
  if not v_is_admin then
    if not public.can_teacher_manage_student_plp(v_existing.student_id, v_existing.class_id) then
      raise exception 'Authorization failed: You do not have permission to edit this PLP.';
    end if;
  end if;

  -- 4. Status Check: Cannot edit active or completed plans as draft
  if v_existing.status not in ('draft', 'teacher_reviewed') then
    return jsonb_build_object(
      'success', false,
      'status', 'conflict',
      'code', 'PLP_STATUS_LOCKED',
      'message', 'Cannot edit draft: Plan has already been activated or completed.'
    );
  end if;

  -- 5. Optimistic Version Check
  if v_existing.version != p_version then
    return jsonb_build_object(
      'success', false,
      'status', 'concurrency_conflict',
      'code', 'STALE_VERSION',
      'message', 'A newer update has been saved by another session. Please reload the latest plan.'
    );
  end if;

  -- 6. Apply Teacher Update (Server derives last_edited_by)
  update public.personalized_learning_plans
  set
    learning_needs = p_learning_needs,
    target_objectives = p_target_objectives,
    recommended_activities = p_recommended_activities,
    monitoring_indicators = p_monitoring_indicators,
    teacher_notes = p_teacher_notes,
    is_teacher_edited = true,
    last_edited_by = v_caller_profile_id,
    version = v_existing.version + 1,
    updated_at = now()
  where id = p_id
  returning * into v_result;

  return jsonb_build_object('success', true, 'status', 'saved', 'data', to_jsonb(v_result));
end;
$$;

revoke all on function public.save_teacher_plp_draft from public, anon;
grant execute on function public.save_teacher_plp_draft to authenticated;

-- RPC C: Mark Reviewed
create or replace function public.mark_plp_reviewed_rpc(
  p_id uuid,
  p_teacher_notes text,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_teacher boolean;
  v_existing public.personalized_learning_plans;
  v_result public.personalized_learning_plans;
begin
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'Authentication required: Anonymous access is prohibited.';
  end if;

  v_caller_profile_id := public.current_profile_id();
  v_is_admin := public.is_active_admin_profile();
  v_is_teacher := public.is_active_teacher_profile();

  if not (v_is_admin or v_is_teacher) then
    raise exception 'Access denied: Only active teachers and administrators may review learning plans.';
  end if;

  select * into v_existing from public.personalized_learning_plans where id = p_id for update;

  if v_existing.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found', 'message', 'PLP not found.');
  end if;

  if not v_is_admin then
    if not public.can_teacher_manage_student_plp(v_existing.student_id, v_existing.class_id) then
      raise exception 'Authorization failed: You do not have permission to review this PLP.';
    end if;
  end if;

  if v_existing.status not in ('draft', 'teacher_reviewed') then
    return jsonb_build_object('success', false, 'status', 'conflict', 'message', 'Only draft or reviewed plans can be updated.');
  end if;

  if v_existing.version != p_version then
    return jsonb_build_object('success', false, 'status', 'concurrency_conflict', 'message', 'Stale version detected.');
  end if;

  update public.personalized_learning_plans
  set
    status = 'teacher_reviewed',
    teacher_notes = coalesce(p_teacher_notes, teacher_notes),
    is_teacher_edited = true,
    reviewed_by_profile_id = v_caller_profile_id,
    last_edited_by = v_caller_profile_id,
    reviewed_at = now(),
    version = v_existing.version + 1,
    updated_at = now()
  where id = p_id
  returning * into v_result;

  return jsonb_build_object('success', true, 'status', 'teacher_reviewed', 'data', to_jsonb(v_result));
end;
$$;

revoke all on function public.mark_plp_reviewed_rpc from public, anon;
grant execute on function public.mark_plp_reviewed_rpc to authenticated;

-- RPC D: Activate PLP (Accepts ONLY teacher_reviewed)
create or replace function public.activate_plp_rpc(
  p_id uuid,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_teacher boolean;
  v_existing public.personalized_learning_plans;
  v_result public.personalized_learning_plans;
begin
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'Authentication required: Anonymous access is prohibited.';
  end if;

  v_caller_profile_id := public.current_profile_id();
  v_is_admin := public.is_active_admin_profile();
  v_is_teacher := public.is_active_teacher_profile();

  if not (v_is_admin or v_is_teacher) then
    raise exception 'Access denied: Only active teachers and administrators may activate learning plans.';
  end if;

  select * into v_existing from public.personalized_learning_plans where id = p_id for update;

  if v_existing.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found', 'message', 'PLP not found.');
  end if;

  if not v_is_admin then
    if not public.can_teacher_manage_student_plp(v_existing.student_id, v_existing.class_id) then
      raise exception 'Authorization failed: You do not have permission to activate this PLP.';
    end if;
  end if;

  -- CRITICAL REQUIREMENT: Must be teacher_reviewed before activation!
  if v_existing.status != 'teacher_reviewed' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_transition',
      'code', 'REVIEW_REQUIRED_BEFORE_ACTIVATION',
      'message', 'Cannot activate PLP: Plan must be teacher_reviewed before activation. Current status: ' || v_existing.status
    );
  end if;

  if v_existing.version != p_version then
    return jsonb_build_object('success', false, 'status', 'concurrency_conflict', 'message', 'Stale version detected.');
  end if;

  update public.personalized_learning_plans
  set
    status = 'active',
    activated_by_profile_id = v_caller_profile_id,
    last_edited_by = v_caller_profile_id,
    activated_at = now(),
    version = v_existing.version + 1,
    updated_at = now()
  where id = p_id
  returning * into v_result;

  return jsonb_build_object('success', true, 'status', 'active', 'data', to_jsonb(v_result));
end;
$$;

revoke all on function public.activate_plp_rpc from public, anon;
grant execute on function public.activate_plp_rpc to authenticated;

-- RPC E: Plan Completion (Active -> Completed)
create or replace function public.complete_plp_rpc(
  p_id uuid,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_teacher boolean;
  v_existing public.personalized_learning_plans;
  v_result public.personalized_learning_plans;
begin
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'Authentication required: Anonymous access is prohibited.';
  end if;

  v_caller_profile_id := public.current_profile_id();
  v_is_admin := public.is_active_admin_profile();
  v_is_teacher := public.is_active_teacher_profile();

  if not (v_is_admin or v_is_teacher) then
    raise exception 'Access denied: Only active teachers and administrators may complete learning plans.';
  end if;

  select * into v_existing from public.personalized_learning_plans where id = p_id for update;

  if v_existing.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found', 'message', 'PLP not found.');
  end if;

  if not v_is_admin then
    if not public.can_teacher_manage_student_plp(v_existing.student_id, v_existing.class_id) then
      raise exception 'Authorization failed: You do not have permission to complete this PLP.';
    end if;
  end if;

  if v_existing.status != 'active' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_transition',
      'code', 'ACTIVE_REQUIRED_BEFORE_COMPLETION',
      'message', 'Cannot complete PLP: Plan must be active before completion. Current status: ' || v_existing.status
    );
  end if;

  if v_existing.version != p_version then
    return jsonb_build_object('success', false, 'status', 'concurrency_conflict', 'message', 'Stale version detected.');
  end if;

  update public.personalized_learning_plans
  set
    status = 'completed',
    last_edited_by = v_caller_profile_id,
    version = v_existing.version + 1,
    updated_at = now()
  where id = p_id
  returning * into v_result;

  return jsonb_build_object('success', true, 'status', 'completed', 'data', to_jsonb(v_result));
end;
$$;

revoke all on function public.complete_plp_rpc from public, anon;
grant execute on function public.complete_plp_rpc to authenticated;

