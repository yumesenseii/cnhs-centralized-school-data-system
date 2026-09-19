-- Teachers fan-out lesson_plan / delete_request notifs to admins.
-- INSERT ... RETURNING is gated by SELECT policies; without actor visibility
-- the upsert appears to fail and safeNotify swallows it.

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (
    recipient_profile_id = public.current_profile_id()
    or public.is_active_admin_profile()
    or actor_profile_id = public.current_profile_id()
  );
