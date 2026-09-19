-- Allow teachers to notify active admins for lesson_plan / delete_request
-- workflow events; expose admin id list via SECURITY DEFINER RPC; enable
-- Realtime on lesson_plans (+ events) for live HT review.

-- ---------------------------------------------------------------------------
-- list_active_admin_profile_ids(): teachers cannot SELECT other profiles under
-- profiles_select_own_or_admin, so client-side admin lookup returns empty.
-- ---------------------------------------------------------------------------

create or replace function public.list_active_admin_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.role = 'admin'
    and coalesce(p.is_active, true);
$$;

revoke all on function public.list_active_admin_profile_ids() from public, anon;
grant execute on function public.list_active_admin_profile_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications insert: teachers may create lesson_plan / delete_request rows
-- only when the recipient is an active admin.
-- ---------------------------------------------------------------------------

drop policy if exists notifications_insert_admin_or_self on public.notifications;
create policy notifications_insert_admin_or_self
  on public.notifications
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or recipient_profile_id = public.current_profile_id()
    or (
      public.is_active_teacher_profile()
      and notification_type in ('lesson_plan', 'delete_request')
      and exists (
        select 1
        from public.profiles p
        where p.id = recipient_profile_id
          and p.role = 'admin'
          and coalesce(p.is_active, true)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: HT Lesson Plan Review soft-refresh on insert/update/delete
-- ---------------------------------------------------------------------------

alter table public.lesson_plans replica identity full;
alter table public.lesson_plan_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lesson_plans'
  ) then
    alter publication supabase_realtime add table public.lesson_plans;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lesson_plan_events'
  ) then
    alter publication supabase_realtime add table public.lesson_plan_events;
  end if;
end;
$$;
