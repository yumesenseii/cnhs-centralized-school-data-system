-- =============================================================================
-- Migration 057: Grant SELECT on system_settings to authenticated role
-- =============================================================================
-- Legacy compatibility only. PGRST205 means the relation is unavailable in the
-- API schema cache; it does not establish a missing grant. ARAL no longer needs
-- this table. Do not fail deployment or create an obsolete activation setting
-- when migration 046 was never applied to the configured project.
-- =============================================================================

do $$ begin
  if to_regclass('public.system_settings') is not null then
    grant select on table public.system_settings to authenticated;
  end if;
end $$;
notify pgrst, 'reload schema';
