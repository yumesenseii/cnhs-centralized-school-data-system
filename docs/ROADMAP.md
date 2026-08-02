# CNHS Centralized School Data System — Product Roadmap

**School:** Cambaog National High School (CNHS)  
**Document type:** Fixes, gaps, and planned enhancements  
**Last updated:** August 2026  

Use this roadmap to prioritize remaining work before defense, school pilot, or production hardening. Items are grouped by priority. Status reflects the codebase as of this document.

---

## Legend

| Status | Meaning |
|--------|---------|
| **Done** | Shipped in the current codebase |
| **In progress** | Actively being worked or awaiting formal completion (e.g. QA fill-in) |
| **Partial** | Started or UI exists; needs backend / polish |
| **Todo** | Not started or explicitly deferred |
| **Won’t do (now)** | Discussed and intentionally deferred |

---

## Status at a glance

| Bucket | Items |
|--------|--------|
| **Done (recent)** | Reports Excel + embedded charts · Multi-term ECR · Term UI · Academic Records live · Class-Record parser · LP Reviewed By · Reset / Activate users · Password change (all portals) |
| **In progress** | **P0-5** Test Summary Pass/Fail · **P2-3** Notifications polish |
| **Todo (pilot)** | **P1-3** Export Users · **P1-7** Forgot Password · **P2-5** Naming consistency · **P2-6** Archive unused LP components · **P2-7** Mobile QA |
| **Post-pilot (P3)** | AI LP checks · ONNX · Email/SMS · Audit UI · Bulk ECR/SF2 · (deferred: DOCX extract, student self-reg) |

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
| Admin Lesson Plan Review simplified | Info + preview + Approve / Needs Revision / Cancel |
| Classes & Sections combined | `/class-organization` with Sections + Class Assignments tabs |
| User Management Edit / Reset / Activate | Live HT + teacher updates; edge reset password; `is_active` toggle |
| Password change (Teacher / Student / Admin) | Settings / Profile Security via `useAuth().changePassword` |
| ARAL facilitator flow | Admin assign + teacher weekly progress gate |
| Input Grades stepped flow | Upload → confirm class → preview & import |
| Student My Grades | Shows enrolled subjects even when ungraded |

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
| P1-1 | **Admin Settings live data** | Done | Personal Account from session/profiles; Security uses `changePassword`. School/Appearance remain static branding. |
| P1-2 | **Head Teacher login email editable (safe path)** | Done | Edge `admin-update-user-email` syncs Auth + `users` / `teachers`. |
| P1-3 | **Export Users** | Todo | Header button has no export handler. |
| P1-4 | **Admin Recent Activity (Lesson Plans)** | Done | Sidebar from `lesson_plan_events` via `getRecentLessonPlanActivity`. |
| P1-5 | **School year / quarter filters on Lesson Plan Review** | Done | Filters → `getAllLessonPlansForReview({ schoolYear, quarter })`. |
| P1-6 | **USER_MANUAL updates** | Done | Classes & Sections; LP review; teacher Settings; User Management live actions. |
| P1-7 | **Forgot Password (login)** | Todo | UI-only; decide: real reset email vs. “contact Head Teacher”. |
| P1-8 | **Persist upload-form fields not in DB** | Done | Unused wizard fields removed; title / week / competency kept. |

---

## P2 — Polish & consistency

| ID | Item | Status | Notes |
|----|------|--------|-------|
| P2-1 | **Student portal password change** | Done | Profile → Security via `useAuth().changePassword`. |
| P2-2 | **Admin self-service password** | Done | Admin Settings → Security same flow as teacher. |
| P2-3 | **Notifications: mark-all-read / filters polish** | In progress | Verify live vs mock; tighten empty states; mark-all-read polish. |
| P2-4 | **Reports exports** | Done | PDF (print) + ExcelJS **2-tab** Legal (Report Cover + Detailed Report). Cover embeds canvas chart PNGs (**Performance Analysis**) from the same `chartSeries` as the UI; supporting data tables kept. SheetJS for ECR/SF2 imports only. |
| P2-4b | **Academic Records live data** | Done | `/academic-records` uses `getAdminReportsBundle` + monitoring roster; Export → official Excel. |
| P2-4c | **Class-Record-v1 ECR upload** | Done | Class-Record (`TERM1–3` + `SUMMARY OF GRADES`) + DepEd (`AVE`): TERM-first; Male/Female gaps; SUMMARY≈AVE. |
| P2-4d | **Trimester UI (Term vs Quarter)** | Done | UI: Term 1–3 + Final (DB `quarter` 1–4 unchanged). All Terms assign; My Classes multi-term cards + Term dropdown. |
| P2-4e | **Multi-term ECR import** | Done | One upload → Term 1–3 + Final to sibling classes; upserts per term `class_id`. |
| P2-5 | **Sidebar / docs naming consistency** | Todo | Classes & Sections, ARAL Learners, monitoring labels across manuals and UI. |
| P2-6 | **Remove or archive unused LP review components** | Todo | `ReviewChecklist`, `SystemValidationCard`, `DecisionPanel` unused after drawer simplify. |
| P2-7 | **Mobile QA pass** | Todo | Checklist for teacher upload + admin drawers on phone widths. |

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

---

## Suggested implementation order

1. **P0-5** — Fill Test Summary Pass/Fail (defense evidence)  
2. **P2-3** — Finish notifications polish  
3. **P1-3 / P1-7** — Export Users, Forgot Password (as needed for pilot)  
4. **P2-5 / P2-6 / P2-7** — Naming, cleanup, mobile QA  
5. Keep **P3** out of the critical path unless requested  

---

## Module health snapshot

| Module | Health | Main remaining gap |
|--------|--------|--------------------|
| Auth / portals | Good | Forgot password still open; password change live on all portals |
| User Management | Good | Edit, reset password, activate/deactivate live; Export Users still Todo |
| Classes & Sections | Good | Naming consistency in docs (P2-5) |
| Academic records / ECR | Good | Multi-term import + Class-Record/AVE parsers live |
| Lesson plans | Good | Reviewed By denormalized; unused review components to archive (P2-6) |
| Academic monitoring / ARAL | Good | Facilitator training + seed data for demos |
| Attendance (SF2) | Good | Keep prediction separation in training materials |
| Reports | Good | Live charts; PDF + 2-tab Legal Excel with embedded Performance Analysis graphs |
| Student portal | Good | Password change on Profile; grade coverage depends on enrollments |
| Settings (Admin) | Good | Live Personal Account + Security; school/appearance still static |
| Settings (Teacher) | Good | Profile \| Security; temp password until changed |
| Notifications | Partial | Mark-all-read / filters polish in progress (P2-3) |

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
