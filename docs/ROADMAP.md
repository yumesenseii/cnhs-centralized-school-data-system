# CNHS Centralized School Data System — Product Roadmap

**School:** Cambaog National High School (CNHS)  
**Document type:** Fixes, gaps, and planned enhancements  
**Last updated:** August 18, 2026  

Use this roadmap to prioritize remaining work before defense, school pilot, or production hardening. Items are grouped by priority. Status reflects the codebase as of this document.

**Pilot readiness (estimate):** ~90% for desktop admin/teacher/student portals. Remaining critical path is **P0-5** Test Summary Pass/Fail (defense evidence). P3 stays post-pilot.

---

## Legend

| Status | Meaning |
|--------|--------|
| **Done** | Shipped in the current codebase |
| **In progress** | Actively being worked or awaiting formal completion (e.g. QA fill-in) |
| **Partial** | Started or UI exists; needs backend / polish |
| **Todo** | Not started or explicitly deferred |
| **Won’t do (now)** | Discussed and intentionally deferred |

---

## Status at a glance

| Bucket | Items |
|--------|--------|
| **Done (recent)** | PONCE **Class-Record-v1 Excel export** (template-based) · In-system **E-Record** (My Classes spreadsheet entry, `ecr_*` tables, PONCE layout) · Reports Excel + embedded charts · Multi-term ECR · Term UI · Academic Records live · Class-Record parser · LP Reviewed By · Reset / Activate users · Password change (all portals) · Naming (P2-5) · Unused LP cleanup (P2-6) · Admin School/Appearance persist · Notifications live (P2-3) · Shared roster caches / soft-nav performance · Unique-learner Overview KPIs · Teacher dashboard `filteredMonitoring` fix · Portal landing at `/` · Export Users (P1-3) · Login forgot-password built then hidden; HT Reset Password is the supported path (P1-7) · Live DB: `018` delete_requests + `019` Values Education + `020` ECR module (do not re-run 001–017) |
| **In progress** | **P0-5** Test Summary Pass/Fail |
| **Todo (pilot)** | — |
| **Won’t do (now)** | **P2-7** Mobile QA (out of scope — desktop pilot) · DOCX extract · student self-reg · Login “Forgot password?” email self-service (hidden; Gmail one-time links unreliable) |
| **Post-pilot (P3)** | AI LP checks · ONNX · Email/SMS · Audit UI · Bulk ECR/SF2 |

---

## Recently completed (context)

These were delivered in recent iterations and should stay regression-tested:

| Area | Notes |
|------|--------|
| Excel Performance Analysis charts | Canvas PNGs embedded on Report Cover via ExcelJS `addImage`; same `chartSeries` as UI; 2-tab Legal layout kept |
| Multi-term ECR import | One upload → Term 1–3 + Final into sibling All-Terms classes |
| Trimester UI (Term vs Quarter) | Labels Term 1–3 + Final; My Classes groups multi-term cards + in-class Term dropdown |
| Class-Record-v1 + DepEd AVE parsers | TERM-first roster; Male/Female blank gaps; SUMMARY≈AVE |
| Academic Records live data | Same ECR/monitoring source as Reports; official Excel export |
| Admin Lesson Plan Review simplified | Info + preview + Approve / Needs Revision / Cancel; unused checklist cards removed |
| Notifications live (admin + teacher) | Personal inbox from Supabase; mark-all-read + filters + empty states; admin sidebar = live lesson plan activity |
| Admin School + Appearance persist | localStorage save; theme, font size, collapsed sidebar applied in admin shell |
| Classes & Sections combined | `/class-organization` with Sections + Class Assignments tabs |
| User Management Edit / Reset / Activate | Live HT + teacher updates; edge reset password; `is_active` toggle |
| Password change (Teacher / Student / Admin) | Settings / Profile Security via `useAuth().changePassword` |
| ARAL facilitator flow | Admin assign + teacher weekly progress gate |
| Input Grades stepped flow | Upload → confirm class → preview & import (optional; primary path is **E-Record** grid) |
| Teacher E-Record (in-system) | `/teacher/my-classes/[classId]/e-record` — WW/PT/QA grid, HPS row, PS/WS/Term formulas, AVE summary; `ecr_*` tables sync to `grades` on publish; **PONCE Class-Record-v1 Excel export** via template |
| Student My Grades | Shows enrolled subjects even when ungraded |
| Admin + teacher performance caches | Shared TTL/`globalThis` roster caches; soft-nav reuse Overview → Academic Records / Monitoring / Reports; `preferLocal` recommendations; deferred attendance where applicable |
| Unique-learner Overview KPIs | Risk cards / distribution count unique students (worst risk), aligned with Academic Records totals |
| Teacher dashboard model fix | Restored `filteredMonitoring` filter so dashboard build no longer throws |
| Public portal landing | `/` light landing (hero, who-can-sign-in, footer) → Portal Login `/login`; logged-in users still redirect to role home |
| Export Users | Header export writes managed-users Excel via `exportManagedUsersExcel` |
| Password recovery | Login “Forgot password?” was implemented (Supabase email + `/login/reset-password`) then **hidden**. Supported path: User Management → Reset Password (temp password shown once). Route `/login/reset-password` kept for leftover email links. |
| Live schema (do not re-run 001–017) | `delete_requests` table (018) and Values Education subject (019) already on the live Supabase project |

---

## P0 — Fix soon (broken, misleading, or security-related)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| P0-1 | **Lesson plan “Reviewed By” empty for teachers** | Done | `reviewed_by_name` on `lesson_plans`; set on review, cleared on resubmit; mapper fallback “Head Teacher”; backfill done. |
| P0-2 | **Admin Reset Password still UI-only** | Done | Edge `admin-reset-password` + ResetPasswordModal (temp password shown once). |
| P0-3 | **Activate / Deactivate user still placeholder** | Done | `toggleManagedUserStatus` → `profiles.is_active` + `teachers.status`. |
| P0-4 | **Teacher Settings: Profile + About cards** | Done | Profile + Security + About on `/teacher/settings`. |
| P0-5 | **Fill Test Summary results with real QA** | In progress | Checklist in USER_MANUAL §3.4 ready; Result columns blank / Unknown until formal QA fills Pass/Fail. |

---

## P1 — Important for pilot / defense

| ID | Item | Status | Notes |
|----|------|--------|-------|
| P1-1 | **Admin Settings live data** | Done | Personal Account from session/profiles; Security uses `changePassword`. School Information + Appearance persist via localStorage (device-level) and apply theme/font/sidebar. |
| P1-2 | **Head Teacher login email editable (safe path)** | Done | Edge `admin-update-user-email` syncs Auth + `users` / `teachers`. |
| P1-3 | **Export Users** | Done | Header export via `exportManagedUsersExcel` (`lib/admin/userExport.js`). |
| P1-4 | **Admin Recent Activity (Lesson Plans)** | Done | Sidebar from `lesson_plan_events` via `getRecentLessonPlanActivity`. |
| P1-5 | **School year / quarter filters on Lesson Plan Review** | Done | Filters → `getAllLessonPlansForReview({ schoolYear, quarter })`. |
| P1-6 | **USER_MANUAL updates** | Done | Classes & Sections; LP review; teacher Settings; User Management live actions. |
| P1-7 | **Forgot Password (login)** | Done (hidden) | Email reset was built (`ForgotPasswordModal` + `/login/reset-password`). Link is **hidden** on login. Supported recovery: Head Teacher → User Management → Reset Password. Do not rely on Gmail one-time links for pilot. |
| P1-8 | **Persist upload-form fields not in DB** | Done | Unused wizard fields removed; title / week / competency kept. |

---

## P2 — Polish & consistency

| ID | Item | Status | Notes |
|----|------|--------|-------|
| P2-1 | **Student portal password change** | Done | Profile → Security via `useAuth().changePassword`. |
| P2-2 | **Admin self-service password** | Done | Admin Settings → Security same flow as teacher. |
| P2-3 | **Notifications: mark-all-read / filters polish** | Done | Teacher + Admin personal inboxes live (Supabase). Mark all read, search/type/priority/status filters, empty states. Admin sidebar uses live lesson plan activity. Clear Read removed (no delete policy). |
| P2-4 | **Reports exports** | Done | PDF (print) + ExcelJS **2-tab** Legal (Report Cover + Detailed Report). Cover embeds canvas chart PNGs (**Performance Analysis**) from the same `chartSeries` as the UI; supporting data tables kept. SheetJS for ECR/SF2 imports only. |
| P2-4b | **Academic Records live data** | Done | `/academic-records` uses reports roster + monitoring; Export → official Excel. Skips SF2/lesson-plan bundle on this page for speed. |
| P2-4c | **Class-Record-v1 ECR upload** | Done | Class-Record (`TERM1–3` + `SUMMARY OF GRADES`) + DepEd (`AVE`): TERM-first; Male/Female gaps; SUMMARY≈AVE. |
| P2-4d | **Trimester UI (Term vs Quarter)** | Done | UI: Term 1–3 + Final (DB `quarter` 1–4 unchanged). All Terms assign; My Classes multi-term cards + Term dropdown. |
| P2-4e | **Multi-term ECR import** | Done | One upload → Term 1–3 + Final to sibling classes; upserts per term `class_id`. |
| P2-5 | **Sidebar / docs naming consistency** | Done | Canonical labels: Classes & Sections, Academic Monitoring, Attendance Monitoring, ARAL Learners, Lesson Plan Review. Admin/teacher page titles + headers aligned. |
| P2-6 | **Remove or archive unused LP review components** | Done | Deleted unused `ReviewChecklist`, `SystemValidationCard`, `DecisionPanel`, `ReviewHistory`, `ReviewComments`. |
| P2-7 | **Mobile QA pass** | Won’t do (now) | Out of project scope for this release; pilot targets desktop admin/teacher use. Responsive basics may exist but no dedicated phone QA checklist. |
| P2-8 | **Admin / teacher load performance** | Done | Shared `adminRosterCache` / `teacherRosterCache` + `globalThis` TTL; year-first fetches; soft-nav cache hits; unique-learner Overview KPIs; `preferLocal` bulk recommendations. |
| P2-9 | **Portal landing page** | Done | `/` public landing (hero, roles strip, footer) with Portal Login → `/login`. Middleware still redirects authenticated users to role home. |

---

## P3 — Future enhancements (post-pilot)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| P3-1 | **Lesson plan DOCX metadata extraction** | Won’t do (now) | Deferred for performance/simplicity; HT opens file for content. |
| P3-2 | **AI-assisted lesson plan / competency checks** | Todo | Future: DepEd template scoring, MELC validation. |
| P3-3 | **ONNX / hosted Random Forest** | Todo | Code has TODO for ONNX artifact; local / rule fallback remains. |
| P3-4 | **Email / SMS notifications** | Todo | In-app notifications only today. |
| P3-5 | **Audit log UI** | Todo | Events exist for lesson plans; broader admin audit trail optional. |
| P3-6 | **Bulk ECR / SF2 operations** | Todo | Scale tooling for multi-class import seasons. |
| P3-7 | **Student self-registration** | Won’t do (now) | Accounts provisioned by school / Head Teacher. |
| P3-8 | **Full public school website** | Todo | News, events, contact form, map — separate from portal; landing entry only for now. |

---

## Suggested implementation order

1. **P0-5** — Fill Test Summary Pass/Fail (defense evidence)  
2. Production deploy: Site URL + Redirect URLs on the live origin; edge functions; env on host. Live DB already has 018 `delete_requests` and 019 Values Education — **do not re-run migrations 001–017**.  
3. Keep **P3** out of the critical path unless requested  
4. **P2-7 Mobile QA** — explicitly out of scope (desktop pilot)

---

## Module health snapshot

| Module | Health | Main remaining gap |
|--------|--------|--------------------|
| Auth / portals | Good | Landing at `/`; login Forgot password hidden; HT Reset Password is the supported path; password change live on all portals |
| User Management | Good | Edit, reset password, activate/deactivate, export, delete-request queue live |
| Classes & Sections | Good | Combined organization page; naming aligned (P2-5) |
| Academic records / ECR | Good | Multi-term import + Class-Record/AVE parsers live; soft-nav cache with Overview |
| Lesson plans | Good | Reviewed By denormalized; unused review cards removed (P2-6) |
| Academic monitoring / ARAL | Good | Facilitator training + seed data for demos; shares admin roster cache |
| Attendance (SF2) | Good | Keep prediction separation in training materials |
| Reports | Good | Live charts; PDF + 2-tab Legal Excel with embedded Performance Analysis graphs |
| Student portal | Good | Password change on Profile; grade coverage depends on enrollments |
| Settings (Admin) | Good | Live Personal Account + Security; School/Appearance saved locally and applied |
| Settings (Teacher) | Good | Profile \| Security; temp password until changed |
| Notifications | Good | Live inbox (admin + teacher); mark-all-read + filters + empty states |
| Performance (admin/teacher) | Good | Shared caches; first load still network-bound; soft-nav much lighter |

---

## Documentation deliverables (also track)

| Doc | Action |
|-----|--------|
| `docs/USER_MANUAL.md` | Synced for Classes & Sections; LP review; teacher settings; live User Management |
| `docs/ROADMAP.md` | This file — keep status updated after each sprint |
| Test Summary / Test Cases | Checklist ready (§3.4); **in progress** — fill Pass/Fail after formal QA; attach screenshots for defense |

---

## Approval / ownership (fill in)

| Role | Name | Focus |
|------|------|--------|
| Group 9 — Yukari | | |
| Group 9 — John Vincent | | |
| Group 9 — Michelle | | |
| Group 9 — Alexa | | |

---

*End of roadmap*
