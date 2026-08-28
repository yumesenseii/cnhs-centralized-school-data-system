-- Teacher delete requests (class / ECR / lesson plan) for Head Teacher approval.

create table if not exists public.delete_requests (
  id uuid primary key default gen_random_uuid(),
  requester_teacher_id uuid not null references public.teachers (id) on delete cascade,
  requester_profile_id uuid references public.profiles (id) on delete set null,
  target_type text not null
    check (target_type = any (array['class'::text, 'ecr'::text, 'lesson_plan'::text])),
  target_id uuid not null,
  label text not null default '',
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.delete_requests is
  'Teacher-requested deletions. Only admins execute the actual delete/clear.';

create unique index if not exists delete_requests_pending_target_idx
  on public.delete_requests (target_type, target_id)
  where status = 'pending';

create index if not exists delete_requests_status_idx
  on public.delete_requests (status, created_at desc);

create index if not exists delete_requests_teacher_idx
  on public.delete_requests (requester_teacher_id);

alter table public.delete_requests enable row level security;

drop policy if exists delete_requests_select on public.delete_requests;
create policy delete_requests_select
  on public.delete_requests
  for select
  to authenticated
  using (
    public.is_active_admin_profile()
    or requester_teacher_id = public.current_teacher_id()
  );

drop policy if exists delete_requests_insert_teacher on public.delete_requests;
create policy delete_requests_insert_teacher
  on public.delete_requests
  for insert
  to authenticated
  with check (
    public.is_active_teacher_profile()
    and requester_teacher_id = public.current_teacher_id()
    and status = 'pending'
  );

drop policy if exists delete_requests_update_admin on public.delete_requests;
create policy delete_requests_update_admin
  on public.delete_requests
  for update
  to authenticated
  using (public.is_active_admin_profile())
  with check (public.is_active_admin_profile());

revoke all on public.delete_requests from anon;
grant select, insert on public.delete_requests to authenticated;
grant update (status, reviewed_by, reviewed_at) on public.delete_requests to authenticated;

-- Allow delete_request notification type.
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check
  check (
    notification_type = any (
      array[
        'lesson_plan'::text,
        'aral_screening'::text,
        'classroom_remedial'::text,
        'monitoring'::text,
        'class_assignment'::text,
        'eclass'::text,
        'system'::text,
        'delete_request'::text
      ]
    )
  );
