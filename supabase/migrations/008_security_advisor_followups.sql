-- Follow-up hardening after 007:
-- - Prevent RPC calls to the privilege-escalation trigger function
-- - Pin search_path on legacy updated_at trigger functions

revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

create or replace function public.set_grades_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_lesson_plans_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_monitoring_records_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
