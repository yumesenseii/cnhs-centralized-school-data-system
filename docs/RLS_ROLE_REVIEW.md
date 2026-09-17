# CNHS Learn — RLS & role review notes (Phase C)

Quick reference for ISO access-control claims. Policies live in SQL migrations; the Next.js **middleware** adds portal routing. This file does **not** rewrite live policies.

---

## Roles in the product

| `profiles.role` | Portal home | Typical title in school |
|-----------------|-------------|-------------------------|
| `admin` | `/dashboard` (admin routes without `/teacher` prefix) | Head Teacher / school admin |
| `teacher` | `/teacher/dashboard` | Subject teacher / adviser / ARAL facilitator |
| `student` | `/student/dashboard` | Learner (view-oriented) |

Helpers (SECURITY DEFINER), used by RLS:

- `current_profile_id()`, `is_active_admin_profile()`, `is_active_teacher_profile()`, `current_teacher_id()` — `007_enable_rls_core_tables.sql` (also defined/used from `006` notifications era)
- `is_active_student_profile()`, `current_student_id()`, enrollment helpers — `010_student_portal_rls.sql`

Inactive profiles (`is_active = false`) should not pass “active” helpers.

---

## Portal routing (middleware)

File: `middleware.js`

- Public: `/`, `/login`, `/login/reset-password`
- First-login gate: `/login/first-login` when `must_change_password` / Terms incomplete
- Admin path prefixes: dashboard, academic-records, lesson-plan-review, monitoring, class-organization, reports, user-management, notifications, settings, attendance, …
- Teacher paths: `/teacher/*`
- Student paths: `/student/*`
- Cross-role URL access is redirected to `roleHome(role)`

**Claim carefully:** Middleware is a UX / route guard. **Authorization of data** is still RLS (+ Edge Functions with service role for privileged admin-create-user / reset-password).

---

## Key migrations (pointers)

| Migration | Focus |
|-----------|--------|
| `006_create_notifications.sql` | Notifications + early helpers |
| `007_enable_rls_core_tables.sql` | Core RLS, grants, profile role-escalation trigger, Storage `lesson-plans` path policies |
| `008_security_advisor_followups.sql` | Advisor follow-ups |
| `009_performance_rls_indexes.sql` | RLS-friendly indexes / initplan tweaks |
| `010_student_portal_rls.sql` | Student self-scope |
| `011`–`021` | Attendance / ARAL / SF2 section months / ECR module RLS as introduced |
| `023`–`028` | Daily attendance sessions + month closes policies |
| `024_fix_adviser_rls_recursion.sql` | Break classes ↔ sections recursion |
| `018_delete_requests.sql` | Delete-request queue |

Always prefer **reading** these files over re-applying `001–017` on a live DB that already migrated (see `docs/ROADMAP.md`).

---

## Expected access by role (high level)

| Area | Admin (HT) | Teacher | Student |
|------|------------|---------|---------|
| User management / create user | Yes (Edge Function) | No | No |
| Class organization / assignments | Yes | Read own classes | No |
| Lesson plan review (approve / revision) | Yes | Submit / resubmit own | No |
| ECR import / publish for assigned class | Oversight / records | Own class | View published grades |
| Attendance AM/PM mark | Oversight / archive | Adviser for section | Own attendance view |
| Month close | View | Adviser write | No |
| Monitoring / recommendations | School-wide | Own classes / caseload | Own interventions view |
| Notifications | Own + school LP activity | Own inbox | (if provisioned) own |

Exact table policies vary; when in doubt, open the migration for that table.

---

## Manual role-test checklist

Sign each row after testing on a **non-production** or carefully chosen pilot account.

| # | Test | Pass? |
|---|------|:-----:|
| 1 | HT login → `/dashboard`; cannot open `/teacher/...` without redirect | ☐ |
| 2 | Teacher login → `/teacher/dashboard`; cannot open `/user-management` | ☐ |
| 3 | Student login → `/student/dashboard`; cannot open admin or teacher routes | ☐ |
| 4 | Teacher sees **only** own assigned classes in My Classes | ☐ |
| 5 | Teacher cannot approve another teacher’s lesson plan as HT | ☐ |
| 6 | Student sees **own** grades / interventions only | ☐ |
| 7 | Deactivated profile (`is_active = false`) cannot use the portal | ☐ |
| 8 | Non-admin cannot change `profiles.role` (trigger / RLS) | ☐ |
| 9 | Adviser can month-close own section; non-adviser cannot | ☐ |
| 10 | Storage: teacher can upload LP under own path; cannot list arbitrary bucket paths | ☐ |

**Tester / date:** _______________________

---

## Honest limits

- RLS quality depends on migrations applied on the **live** project matching this repo.  
- Service-role Edge Functions bypass RLS by design — protect secrets; only HT-triggered admin ops.  
- This review is a **checklist + map**, not a penetration test. Full pen-test remains out of scope for truthful “mostly 4–5” scoring.
