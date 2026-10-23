-- Repair the missing API relation confirmed by PGRST205 in the configured project.
-- This table is also used by existing school settings. Never seed/change academic
-- terms or reading periods, and never overwrite existing school_info values.
begin;
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by_profile_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.system_settings enable row level security;
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings for select to authenticated using (true);
drop policy if exists system_settings_write on public.system_settings;
create policy system_settings_write on public.system_settings for all to authenticated
  using (public.is_active_admin_profile()) with check (public.is_active_admin_profile());
grant select, insert, update, delete on public.system_settings to authenticated;
notify pgrst, 'reload schema';
commit;
