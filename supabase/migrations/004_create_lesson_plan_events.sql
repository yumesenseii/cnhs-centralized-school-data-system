-- Append-only review history for lesson plans.
-- lesson_plans keeps only the current state, so each workflow transition is
-- recorded here (Submitted / Under Review / Approved / Needs Revision / Resubmitted).
create table if not exists public.lesson_plan_events (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id uuid not null references public.lesson_plans (id) on delete cascade,
  event_type text not null
    check (event_type = any (array[
      'Submitted',
      'Under Review',
      'Approved',
      'Needs Revision',
      'Resubmitted'
    ])),
  actor_role text not null check (actor_role = any (array['teacher', 'admin'])),
  actor_name text,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_plan_events_plan_idx
  on public.lesson_plan_events (lesson_plan_id, created_at);

-- Backfill so lesson plans created before this table still show a history.
insert into public.lesson_plan_events (lesson_plan_id, event_type, actor_role, actor_name, created_at)
select lp.id,
       'Submitted',
       'teacher',
       nullif(trim(concat_ws(' ', t.first_name, t.middle_name, t.last_name)), ''),
       lp.submitted_at
from public.lesson_plans lp
left join public.teachers t on t.id = lp.teacher_id
where not exists (
  select 1 from public.lesson_plan_events e
  where e.lesson_plan_id = lp.id and e.event_type = 'Submitted'
);

-- "Under Review" is intentionally not backfilled: that timestamp was never stored.
insert into public.lesson_plan_events (lesson_plan_id, event_type, actor_role, actor_name, actor_profile_id, remarks, created_at)
select lp.id,
       lp.status,
       'admin',
       p.full_name,
       lp.reviewed_by,
       lp.remarks,
       lp.reviewed_at
from public.lesson_plans lp
left join public.profiles p on p.id = lp.reviewed_by
where lp.reviewed_at is not null
  and lp.status in ('Approved', 'Needs Revision')
  and not exists (
    select 1 from public.lesson_plan_events e
    where e.lesson_plan_id = lp.id and e.event_type = lp.status
  );
