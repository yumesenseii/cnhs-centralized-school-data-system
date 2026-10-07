-- =============================================================================
-- Migration 046: Authoritative ARAL assessment period configuration
-- =============================================================================
-- Academic terms (Term 1–3) and ARAL assessment periods (BOSY / MOSY / EOSY)
-- are separate concepts. The current ARAL period is owned here — never
-- inferred from the academic term or calendar month by application code.
--
-- period: one of 'BOSY', 'MOSY', 'EOSY'.
-- Only ONE row is live: key = 'aral.assessment_period'.
-- =============================================================================

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by_profile_id uuid,
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is
  'Authoritative school-level configuration (e.g. current ARAL assessment period). Separate from academic terms.';

alter table public.system_settings enable row level security;

-- Everyone authenticated can read (teachers need the current period for gating).
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select
  on public.system_settings
  for select
  to authenticated
  using (true);

-- Admin only writes.
drop policy if exists system_settings_write on public.system_settings;
create policy system_settings_write
  on public.system_settings
  for all
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

-- Seed: school year starts in BOSY. Never overwrites an existing live value.
insert into public.system_settings (key, value)
values (
  'aral.assessment_period',
  '{"period": "BOSY", "note": "Beginning of School Year assessment window"}'::jsonb
)
on conflict (key) do nothing;
