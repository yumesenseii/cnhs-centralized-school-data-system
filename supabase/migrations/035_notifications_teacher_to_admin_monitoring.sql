-- Allow teachers to fan-out monitoring/system notifications to active admins
-- (class report submitted to HT). Facilitator assign is admin→teacher (already allowed).

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
      and notification_type in (
        'lesson_plan',
        'delete_request',
        'monitoring',
        'system'
      )
      and exists (
        select 1
        from public.profiles p
        where p.id = recipient_profile_id
          and p.role = 'admin'
          and coalesce(p.is_active, true)
      )
    )
  );
