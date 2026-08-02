-- Per-recipient notification inbox.
-- Reuses profiles for both recipient and actor. Does not alter existing tables.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  notification_type text not null
    check (
      notification_type = any (
        array[
          'lesson_plan'::text,
          'aral_screening'::text,
          'classroom_remedial'::text,
          'monitoring'::text,
          'class_assignment'::text,
          'eclass'::text,
          'system'::text
        ]
      )
    ),
  title text not null,
  message text not null,
  priority text not null default 'Medium'
    check (priority = any (array['High'::text, 'Medium'::text, 'Low'::text])),
  action_url text,
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Personal action items for a single recipient profile. Deduplicated per event via dedupe_key.';

-- Plain (not partial) so `on conflict (dedupe_key) do nothing` can infer it.
-- NULL dedupe keys stay distinct, so unkeyed notifications are never merged.
create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_profile_id);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id, is_read);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

-- Keep read_at consistent with is_read regardless of what the client sends.
create or replace function public.set_notification_read_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_read and not coalesce(old.is_read, false) then
    new.read_at = coalesce(new.read_at, now());
  elsif not new.is_read then
    new.read_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_set_read_at on public.notifications;
create trigger notifications_set_read_at
before update on public.notifications
for each row
execute function public.set_notification_read_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_active_admin_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_active, true)
  );
$$;

-- These exist only to be evaluated inside the policies below; signed-out
-- callers must not be able to invoke them over the RPC endpoint.
revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.is_active_admin_profile() from public, anon;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_active_admin_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (
    recipient_profile_id = public.current_profile_id()
    or public.is_active_admin_profile()
  );

-- Admins may notify anyone. Everyone else may only create their own
-- action items (E-Class import, monitoring save, recommendation sync).
drop policy if exists notifications_insert_admin_or_self on public.notifications;
create policy notifications_insert_admin_or_self
  on public.notifications
  for insert
  to authenticated
  with check (
    public.is_active_admin_profile()
    or recipient_profile_id = public.current_profile_id()
  );

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_profile_id = public.current_profile_id())
  with check (recipient_profile_id = public.current_profile_id());

-- No delete policy: notifications are not client-deletable.

-- Column-level grants keep recipients limited to the read-state columns.
revoke all on public.notifications from anon;
revoke update on public.notifications from authenticated;
revoke delete, truncate on public.notifications from authenticated;
grant select, insert on public.notifications to authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;

-- Realtime inbox updates for the signed-in recipient.
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
