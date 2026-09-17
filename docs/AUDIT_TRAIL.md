# CNHS Learn — Audit trail evidence (Phase C)

Pragmatic accountability map for ISO 25010 security / accountability claims.  
This is **not** a full enterprise Audit Log product. Do not claim a school-wide SIEM.

**Related:** `docs/SMOKE_CHECKLIST.md`, `docs/RLS_ROLE_REVIEW.md`, `docs/BACKUP_RESTORE.md`

---

## Summary matrix

| Action | Durable record today? | Where | How to show for defense |
|--------|:---------------------:|-------|-------------------------|
| **Login / session** | Partial | Supabase Auth (`auth.users`: `last_sign_in_at`, session tokens) | Dashboard → Authentication → Users; or SQL on `auth.users` (project owner only). No in-app login audit page. |
| **Create user** | Yes | Auth user + `profiles` (+ `teachers` / `students` as needed) via `admin-create-user` Edge Function | User Management list; Supabase Auth user created_at; welcome email via Brevo if configured. |
| **Reset password (HT)** | Yes | Auth password update + `profiles.must_change_password` | User Management → Reset Password; first-login gate afterwards. |
| **First-login / Terms** | Yes | `profiles.must_change_password`, `profiles.accepted_terms_at`, clears `temp_password` | Middleware forces `/login/first-login` until complete. |
| **Lesson plan submit / approve / revision** | **Yes (strongest)** | Append-only `lesson_plan_events` | See below. |
| **Attendance month close** | Yes | `attendance_month_closes` (`closed_by`, `closed_at`, school days, enrolment) | Teacher Attendance → month close; query table by section / school year / month. |
| **Daily AM/PM attendance save** | Yes (operational) | `attendance_daily` rows with timestamps | Per section/date in Attendance UI; not a separate “audit log” screen. |
| **ECR import / publish** | Yes (status + rows) | `ecr_workbooks` / `ecr_term_sheets` `status` (`draft` \| `published`); published grades sync to `grades` | E-Class Record page status; Academic Records / class grades after publish. |
| **Notifications** | Yes (inbox) | `notifications` table | Admin / Teacher Notifications inbox (recipient-scoped). |
| **Delete user request** | Yes | `delete_requests` + HT approve/reject | Admin Notifications → Delete requests panel. |

**Gaps (honest):** No single Admin “Audit Log” UI (roadmap P3-5). No dedicated app table for every login attempt (failed logins stay in Auth / hosting logs). ECR publish does not write a separate `*_events` history row beyond status + grade sync.

---

## Lesson plan events (primary durable history)

**Table:** `public.lesson_plan_events` (migration `004_create_lesson_plan_events.sql`)

| Column | Purpose |
|--------|---------|
| `event_type` | `Submitted`, `Under Review`, `Approved`, `Needs Revision`, `Resubmitted` |
| `actor_role` | `teacher` \| `admin` |
| `actor_name` / `actor_profile_id` | Who acted |
| `remarks` | HT revision notes when present |
| `created_at` | When |

**Write path:** `recordLessonPlanEvent()` in `lib/supabase/queries/lessonPlans.js` on submit / review transitions (failure is logged to console and must not block the workflow).

### How to show for defense

1. **In product (preferred for screenshots)**  
   - Teacher: open the lesson plan detail / drawer — review timeline is built from events (`lib/teacher/lessonPlanMappers.js`).  
   - Head Teacher: **Notifications → Recent Lesson Plan Activity** (school-wide latest events via `getRecentLessonPlanActivity`).  
   - Head Teacher: **Lesson Plan Review** — current status + Reviewed By; history rows come from the same events table when loaded with the plan.

2. **In Supabase (owner only)**  
   ```sql
   select event_type, actor_role, actor_name, remarks, created_at, lesson_plan_id
   from public.lesson_plan_events
   order by created_at desc
   limit 50;
   ```

---

## Attendance month close

**Table:** `public.attendance_month_closes` (migration `028_attendance_month_closes.sql`)

- Stores adviser-confirmed school days and enrolment counts used for ADA.  
- `closed_by` → `teachers.id`, `closed_at` timestamp.  
- **Not** official DepEd SF2; **not** an RF / prediction input.

Defense: screenshot month-close confirmation + export preview noting “working report”; optional SQL select for the closed month.

---

## ECR import / publish

**Tables:** `ecr_workbooks`, `ecr_term_sheets`, `ecr_scores` / computed grades (migration `020_ecr_module.sql`)

- Publish sets term/workbook `status = 'published'` and syncs class-subject grades into `public.grades`.  
- Defense: show draft → publish on E-Record, then Monitoring/Reports reflecting graded learners only.

---

## Login / create user (what to claim)

| Claim | Safe wording |
|-------|----------------|
| Access control | Role portals + RLS; first-login password + Terms before staff dashboard |
| Account provisioning | Only Head Teacher / admin Edge Function creates users |
| Login audit | Supabase Auth retains last sign-in; **no** custom failed-login report in CNHS Learn UI |

---

## What Phase C does **not** add

- New Admin Audit Log page  
- Changes to RF features or attendance AM/PM save logic  
- Fake DepEd or PLP wording in the product UI
