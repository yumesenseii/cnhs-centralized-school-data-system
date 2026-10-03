# CNHS Centralized School Data System  
## User Manual & Project Documentation

**School:** Cambaog National High School (CNHS)  
**System:** Centralized School Data System for Personalized Learning Plans (PLPs)  
**Document Type:** User Manual · Table of Contents · Test Summary Outline  

---

# Table of Contents

| Section | Page |
|--------|------|
| **Introduction** | 4 |
| **General Information** | 4 |
| System Overview | 4 |
| Two-Module Architecture | 4 |
| **Get Started** | 5 |
| User Access, Roles and Privileges | 5 |
| How to Access the CNHS Centralized School Data System (Internet Speed Requirement and Browser) | 6 |
| **How to Use the CNHS Centralized School Data System** | 8 |
| **Head Teacher / Admin Guide** | 8 |
| How to Use the Dashboard | 8 |
| How to Manage Academic Records | 8 |
| How to Manage Classes & Sections | 8 |
| How to Review Lesson Plans | 9 |
| How to Manage Users | 9 |
| How to Use Academic Monitoring | 9 |
| How to Monitor ARAL / Learner Progress (Assign Facilitators + Weekly Review) | 9 |
| How to Use Attendance Monitoring | 10 |
| How to Generate and View Reports | 10 |
| How to Manage Notifications and Settings | 10 |
| **Teacher Guide** | 10 |
| How to Use the Teacher Dashboard | 10 |
| How to Manage My Classes | 10 |
| How to Input Grades | 11 |
| How to Submit and Track Lesson Plans | 11 |
| How to Use Academic Monitoring | 11 |
| How to Submit Weekly Student Progress Updates (ARAL Learners / Facilitators) | 11 |
| How to Use Attendance Monitoring (SF2 Upload) | 12 |
| How to Generate Class Reports | 12 |
| How to Manage Notifications and Settings | 12 |
| **Student Guide** | 12 |
| How to Use the Student Dashboard | 12 |
| How to View My Grades | 12 |
| How to View Interventions / PLP | 13 |
| How to View My Profile | 13 |
| **System Modules Reference** | 13 |
| Academic Prediction Module | 13 |
| Attendance Monitoring Module | 13 |
| Separation Rule | 13 |
| **General Platform Policies** | 14 |
| Data Privacy and Learner Records | 14 |
| Role-Based Access Control | 14 |
| Academic Records and Upload Guidelines | 14 |
| Monitoring and Intervention Guidelines | 14 |
| **Test Summary Report** | 15 |
| Introduction | 15 |
| Scope of Testing | 15 |
| In-Scope of Testing | 15 |
| Out of Scope | 15 |
| Testing Objectives | 15 |
| Summary of Test Results | 16 |
| Outstanding Issues and Risks | 17 |
| Test Environment | 17 |
| Conclusions and Recommendations | 17 |
| Recommendations | 18 |
| Approval | 18 |
| Testing Documentation | 18 |
| About the Developer | 23 |

---

# 1. General Project Information

## 1.1 Introduction

The **CNHS Centralized School Data System** is a web-based platform developed for Cambaog National High School to support early identification of learners who may need academic intervention and to help teachers and the Head Teacher manage related school operations.

The system centers on generating **Personalized Learning Plan (PLP)**–oriented recommendations for high school learners. Teachers and the Head Teacher operate the system; students are beneficiaries with a view-only portal for grades, interventions, and attendance status.

Two core analytical modules are maintained as separate concerns:

1. **Academic Prediction** — risk and intervention labels based on Official E-Class Record (ECR) grades only  
2. **Attendance Monitoring** — SF2 attendance upload, history, analytics, and 20% absence warnings  

Attendance never influences academic risk prediction.

## 1.2 General Information

### 1.2.1 System Overview

| Area | Description |
|------|-------------|
| Platform | Web application (Next.js + Supabase) |
| Portals | Head Teacher / Admin · Teacher · Student |
| Primary data inputs | Official E-Class Record (ECR), SF2 attendance sheets, lesson plans |
| Primary outputs | Risk levels, intervention recommendations, monitoring records, attendance status, reports |

**Main capabilities**

- Centralized academic records and Classes & Sections organization  
- Random Forest–based academic risk prediction (grades only)  
- Recommendation engine (ARAL Learners vs Classroom Remedial)  
- Teacher monitoring observations and follow-ups  
- SF2 attendance monitoring and monthly analytics  
- Lesson plan submission and Head Teacher review  
- Role-based dashboards, notifications, and reports  

### 1.2.2 Two-Module Architecture

#### Academic Prediction Module

| Item | Detail |
|------|--------|
| Input | ECR subject grades only |
| Model | Random Forest (with local ensemble / rule fallback) |
| Risk outputs | **High Risk** · **Moderate Risk** · **Low Risk** |
| Recommendations | English / Filipino → **ARAL Learners**; other subjects → **Classroom Remedial** (class-level where applicable) |
| Explicit rule | Attendance / SF2 fields are never included in the feature vector |

#### Attendance Monitoring Module

| Item | Detail |
|------|--------|
| Input | SF2 attendance uploads |
| Features | Upload, history, monthly reports, dashboard analytics |
| Threshold | Warning / Critical around **20% absence** |
| Scope | Independent from Academic Prediction |

## 1.3 Get Started

### 1.3.1 User Access, Roles and Privileges

| Role | Portal | Privileges (summary) |
|------|--------|----------------------|
| **Head Teacher / Admin** | `/dashboard` and admin routes | School-wide overview, academic records, Classes & Sections, lesson plan review, user management, academic monitoring, attendance monitoring, reports, settings |
| **Teacher** | `/teacher/*` | Own classes, ECR upload, lesson plans, academic monitoring for assigned classes, SF2 attendance, class reports, notifications, settings (profile + password) |
| **Student** | `/student/*` | View dashboard, grades, interventions / PLP, profile (academic + attendance + password change). No edit of prediction or attendance records |

Navigation is grouped as **Menu · Analytics · Account** in each portal sidebar.

### 1.3.2 How to Access the System

1. Open the system URL in a modern browser (Chrome, Edge, or Firefox recommended).  
2. Go to the **Login** page.  
3. Sign in with the account credentials provided by the school / Head Teacher.  
4. The system routes you to the correct portal based on your role (`admin`, `teacher`, or `student`).  

**Recommended requirements**

- Stable internet connection  
- Up-to-date desktop or laptop browser  
- Screen width suitable for tables and dashboards (tablet/desktop preferred for admin and teacher work)

---

# 2. How to Use the CNHS Centralized School Data System

## 2.1 Head Teacher / Admin Guide

### 2.1.1 How to Use the Dashboard

1. Open **Dashboard** from the Menu.  
2. Review clickable risk KPI cards (**High Risk**, **Moderate Risk**, **Low Risk**) and **ARAL Learners**.  
3. Click a risk card to open **Academic Monitoring** filtered to that risk (`/monitoring?risk=…`).  
4. Use the **Attendance Analytics** block for SF2 monitoring summaries (separate from prediction).  

### 2.1.2 How to Manage Academic Records

1. Go to **Academic Records**.  
2. Filter by grade, section, risk, or teacher as needed.  
3. Review general average, area needing attention, risk level, and system recommendation.  

### 2.1.3 How to Manage Classes & Sections

1. Open **Classes & Sections** (route: `/class-organization`).  
2. Use the **Sections** tab to create or update grade levels and section names.  
3. Use the **Class Assignments** tab to assign teachers to subjects, grade levels, and sections for the school year / quarter.  
4. Older bookmarks to `/sections` or `/class-assignments` redirect to this combined page.  

### 2.1.4 How to Review Lesson Plans

1. Open **Lesson Plan Review**.  
2. Use the header **School Year** and **Quarter** filters to narrow the live list (or leave “All”).  
3. Select a submitted lesson plan to open the review drawer.  
4. Review **Lesson Information** and the file **Preview** (open the uploaded file when needed).  
5. Enter optional **Remarks**, then choose one action:  
   - **Approve** — marks the plan approved and records who reviewed it  
   - **Needs Revision** — returns the plan to the teacher with remarks  
   - **Cancel** — closes the drawer without changing status  
6. The **Recent Activity** sidebar shows live events from lesson plan history (submit, approve, revision, resubmit).  
7. There is no separate checklist or system validation step in the review UI.  

### 2.1.5 How to Manage Users

1. Open **User Management**.  
2. **Add User** — create a Teacher or Head Teacher account with a temporary password.  
3. **Edit** — update name, **login email**, learning area / phone (teachers), and status.  
   - Changing email updates Supabase Auth plus `users` / `teachers` records via an admin edge function.  
   - The new address is **confirmed automatically** (`email_confirm: true`) so school accounts can sign in without clicking a confirmation link.  
   - Tell the user to sign in with the **new** email; if they are already signed in, they should sign out and back in.  
   - If your Supabase project later enables stricter “secure email change” settings, re-check this flow.  
4. **Reset Password** — confirm reset to generate a new temporary password; share it securely with the user. The teacher can also see that temporary password under **Settings → Security** until they change it.  
5. **Activate / Deactivate** — toggle whether the account can sign in (`Active` / `Inactive`).  

### 2.1.6 How to Use Academic Monitoring

1. Under Analytics, open **Academic Monitoring**.  
2. Review school-wide at-risk learners, ARAL recommendations, and classroom remedial indicators.  
3. Open a learner record to inspect academic summary and monitoring history.  
4. Remember: risk labels are based on **ECR grades only**.  

### 2.1.7 How to Monitor ARAL / Learner Progress

1. Open **Academic Monitoring**.
2. In **Assign ARAL Facilitators**, select a Summer ARAL Program facilitator for each English / Filipino learner identified as **ARAL Learners**.
3. Review the **ARAL Learners Weekly Progress** panel (view-only) — facilitators submit weekly updates; Head Teacher reviews whether each learner improved.
4. Open **View progress** to read the full weekly history for that learner.
5. Head Teachers cannot edit facilitator progress entries — review only.

**Separation rule**

- Subject teachers (all subjects) still **identify** risk: English / Filipino → ARAL Learners; other subjects → Classroom Remediation.  
- Only **assigned facilitators** submit **weekly Summer ARAL progress**.  

### 2.1.8 How to Use Attendance Monitoring

1. Under Analytics, open **Attendance Monitoring**.  
2. Upload SF2 files for the appropriate section and month.  
3. Review attendance history, monthly rates, and 20% absence warnings.  
4. This module does **not** change academic risk prediction.  

### 2.1.9 How to Generate and View Reports

1. Open **Reports**.  
2. Select a report category (academic performance, early risk, submissions, school summary, etc.).  
3. Preview or export according to available formats.  
4. Attendance sections in reports are monitoring summaries, not prediction inputs.  

### 2.1.10 How to Manage Notifications and Settings

1. Use **Notifications** for system alerts and follow-up items.  
2. Use **Settings** for school / account preferences available in the portal.  

---

## 2.2 Teacher Guide

### 2.2.1 How to Use the Teacher Dashboard

1. Open **Dashboard**.  
2. Review assigned-class KPIs, today’s tasks, classes overview, learners needing attention, and recommendations.  
3. Academic analytics are grades-based; attendance analytics appear in a separate panel.  

### 2.2.2 How to Manage My Classes

1. Open **My Classes**.  
2. Select a class to view learners and academic summary.  
3. Upload the Official **E-Class Record (ECR)** when required.  
4. Confirm grades appear correctly for the selected school year and quarter.  

### 2.2.3 How to Input Grades

1. Open **Input Grades** from the teacher sidebar.  
2. **Upload ECR** — drop or browse the Official DepEd E-Class Record (.xlsx). The system reads grade, section, and subject from the file.  
3. **Confirm Class** — review detected metadata, then choose the matching assigned class from the **dropdown** (no typing).  
4. **Preview & Import** — confirm details and import learners and grades.  
5. This flow is separate from **My Classes**; My Classes still supports upload from a class card.  

### 2.2.4 How to Submit and Track Lesson Plans

1. Open **Lesson Plans**.  
2. Create or submit a lesson plan for Head Teacher review: choose assigned class, week, lesson title, optional learning competency, then upload the lesson plan file.  
3. Full lesson content (objectives, modality, strategies, etc.) belongs in the uploaded file — the form only stores the fields needed for tracking and review queues.  
4. Track status (**pending**, **approved**, **needs revision**, and related review states).  
5. When a plan is returned for revision, update the file or details and resubmit.  
6. After review, **Reviewed By** shows the Head Teacher who acted on the plan (when available).  

### 2.2.5 How to Use Academic Monitoring

1. Open **Academic Monitoring**.  
2. Filter learners by grade, section, subject, intervention, or status.  
3. View risk level and recommendation:
   - **ARAL Learners** — English / Filipino context  
   - **Classroom Remedial** — other subjects / class-level remediation as applicable  
4. Record weekly observations and progress notes.  
5. Do not treat SF2 attendance as part of the risk score.  

### 2.2.6 How to Submit Weekly Student Progress Updates (ARAL Learners)

1. The Head Teacher must first **assign you as facilitator** for the learner (Summer ARAL Program).  
2. Open **ARAL Program** in the teacher sidebar (or open the learner from Academic Monitoring if you are the facilitator).  
3. Under **Weekly ARAL Progress**, choose observation date, progress, status, and remarks.  
4. Click **Save Week N ARAL Progress**.  
5. Subject teachers who only identified the learner (English / Filipino) do **not** submit summer weekly ARAL updates unless they are also assigned as facilitator.  
6. Updates are visible to the Head Teacher on Academic Monitoring (view-only).

### 2.2.7 How to Use Attendance Monitoring (SF2 Upload)

1. Open **Attendance Monitoring**.  
2. Upload SF2 for your section / month.  
3. Review present, absent, late totals and warning / critical status near the 20% absence threshold.  

### 2.2.8 How to Generate Class Reports

1. Open **Reports**.  
2. Select a class report and preview academic, monitoring, and attendance summary sections.  

### 2.2.9 How to Manage Notifications and Settings

1. Check **Notifications** for unread alerts (badge may appear in the sidebar).  
2. Open **Settings** (`/teacher/settings`). On wider screens, **Profile** and **Security** appear side by side; on mobile they stack. **About & Guidelines** is full width below.  
3. **Profile** is read-only (name, employee ID, email, learning area, phone, status). Ask the Head Teacher to correct details in **User Management**.  
4. **Security** — if the account still uses an admin-issued temporary password, a read-only **Temporary password** field with **Copy** is shown. Change it by entering current password, new password, and confirmation (at least 8 characters).  
5. After a successful password change, the temporary password is cleared and no longer shown. Do not share credentials.  

---

## 2.3 Student Guide

Students use a **view-only** portal. They cannot change grades, predictions, or attendance records.

### 2.3.1 How to Use the Student Dashboard

1. Open **Dashboard**.  
2. View academic summary cards and recent interventions.  
3. Risk shown here is based on ECR grades only (not attendance).  

### 2.3.2 How to View My Grades

1. Open **My Grades**.  
2. Review subject grades and related status.  
3. Export / print grade summary if the export action is available.  

### 2.3.3 How to View Interventions / PLP

1. Open **Interventions / PLP** under Analytics.  
2. Review recommended interventions and related monitoring notes visible to the student.  

### 2.3.4 How to View My Profile

1. Open **Profile**.  
2. Review two clearly separated sections for academic and attendance data.  
3. Use **Security** at the bottom to change your password (current → new → confirm, at least 8 characters).  
4. If an admin-issued temporary password is still active, it appears with **Copy** until you change it successfully.  

**Academic Performance**

- Subject grades  
- Prediction / risk result  
- Recommended intervention  

**Attendance**

- Present  
- Absent  
- Late  
- Attendance % and status (Normal / Warning / Critical)  
- Monthly history  

**Security**

- Change password (and temporary password display when applicable)  

Attendance is for monitoring only and is not used in academic risk prediction.

---

## 2.4 System Modules Reference

### 2.4.1 Academic Prediction Module

1. Teacher uploads ECR grades for a class.  
2. System builds an academic-only feature vector (subject grades, averages, failing counts).  
3. Random Forest (or fallback engine) produces:
   - Risk: High / Moderate / Low  
   - Recommendation type (subject-scoped)  
4. Results appear on dashboards, monitoring pages, and student academic views.  

### 2.4.2 Attendance Monitoring Module

1. Teacher or Head Teacher uploads SF2.  
2. System stores attendance records (present / absent / late / school days).  
3. Analytics compute attendance rate and absence rate.  
4. Status escalates toward Warning / Critical near the **20% absence** threshold.  
5. Dashboards and student profile show monitoring summaries only.  

### 2.4.3 Separation Rule

| Allowed | Not allowed |
|---------|-------------|
| Use ECR grades for prediction | Pass attendance into the prediction model |
| Use SF2 for attendance monitoring | Claim that risk is based on grades **and** attendance |
| Show both modules on dashboards as separate panels | Mix attendance into feature engineering |

---

## 2.5 General Platform Policies

### 2.5.1 Data Privacy and Learner Records

- Learner academic and attendance data must be handled according to school and DepEd privacy practices.  
- Access is limited by role (RLS / portal role checks).  

### 2.5.2 Role-Based Access Control

- Users must only use the portal matching their assigned role.  
- Students cannot edit monitoring or prediction outputs.  

### 2.5.3 Academic Records and Upload Guidelines

- Upload Official E-Class Records in the supported workbook format.  
- Verify school year, quarter, section, and subject before submitting.  

### 2.5.4 Monitoring and Intervention Guidelines

- Academic Monitoring supports early intervention and PLP-related workflows.  
- System recommendations (e.g., ARAL Learners) do not automatically enroll a learner; teachers and the Head Teacher decide next steps.  
- Attendance warnings support follow-up on absences and are independent of academic risk labels.  

---

# 3. Test Summary Report

> Fill in dates, testers, and results during formal QA / defense documentation.

## 3.1 Introduction

This section summarizes verification that the CNHS Centralized School Data System behaves according to the approved architecture: Academic Prediction (grades-only) and Attendance Monitoring (independent SF2 module), across Admin, Teacher, and Student portals.

## 3.2 Scope of Testing

### 3.2.1 In-Scope of Testing

- Login and role-based portal routing  
- Admin: dashboard, academic records, Classes & Sections, lesson plan review (Approve / Needs Revision / Cancel), user management (add, edit, reset password, activate/deactivate), academic monitoring, attendance monitoring, reports  
- Teacher: dashboard, my classes, input grades (ECR), lesson plans, academic monitoring, SF2 attendance, reports, settings (profile + temporary / change password)  
- Student: dashboard, grades, interventions / PLP, profile (academic vs attendance separation)  
- Prediction feature vector excludes attendance  
- Attendance 20% absence warning behavior  
- UI copy stating grades-only prediction  

### 3.2.2 Out of Scope

- External production Random Forest hosting not configured in the environment under test (local ensemble / fallback may be used)  
- Third-party infrastructure beyond the project deployment  
- Hardware / network performance certification  

## 3.3 Testing Objectives

1. Confirm each role can complete its primary workflows.  
2. Confirm Academic Prediction uses ECR grades only.  
3. Confirm Attendance Monitoring functions independently.  
4. Confirm student profile separates academic and attendance information.  
5. Confirm navigation clearly separates Academic Monitoring, Attendance Monitoring, and Reports.  

## 3.4 Summary of Test Results

Fill **Result** after each case is executed: **Pass**, **Fail**, or leave blank / **Unknown** if not yet verified. Use §3.4.1 for defects found during testing.

### 3.4.0 High-level rollup

| Area | Result | Notes |
|------|--------|-------|
| Authentication / portals | | |
| User Management (admin) | | |
| Classes & Sections | | |
| Grades / ECR | | |
| Lesson plans (submit + review) | | |
| Settings (teacher temp / change password) | | |
| Academic Prediction (grades only) | | |
| Attendance SF2 | | |
| Student view-only | | |

---

### 3.4.A Authentication & portals

| ID | Portal | Case | Expected | Result |
|----|--------|------|----------|--------|
| A-01 | All | Login with valid Head Teacher credentials | Routes to admin portal (`/dashboard`) | |
| A-02 | All | Login with valid Teacher credentials | Routes to teacher portal (`/teacher/dashboard`) | |
| A-03 | All | Login with valid Student credentials | Routes to student portal (`/student/dashboard`) | |
| A-04 | All | Login with wrong password | Clear error; no portal access | |
| A-05 | All | Login with inactive / deactivated account | Sign-in blocked with inactive message | |
| A-06 | All | Logout | Session cleared; returns to login | |
| A-07 | All | Open another role’s URL while logged in (e.g. teacher opens `/dashboard`) | Blocked or redirected per role guards | |

---

### 3.4.B Admin — User Management

| ID | Case | Expected | Result |
|----|------|----------|--------|
| U-01 | Open **User Management**; list loads | Teachers / Head Teachers visible with status | |
| U-02 | **Add User** (Teacher) with temporary password | Account created; can sign in with temp password | |
| U-03 | **Edit** teacher profile (name / learning area / contact as available) | Changes saved and reflected on reload | |
| U-04 | **Reset Password** — confirm reset | New temporary password shown once; teacher can sign in with it | |
| U-05 | After reset, teacher **Settings → Security** | Temporary password visible with Copy while must-change flag is set | |
| U-06 | **Deactivate** user | User cannot sign in; status shows Inactive | |
| U-07 | **Activate** user again | User can sign in; status Active | |
| U-08 | Export Users (if button present) | CSV / file downloads **or** note as known gap if not wired | Unknown |

---

### 3.4.C Admin — Classes & Sections

| ID | Case | Expected | Result |
|----|------|----------|--------|
| C-01 | Open **Classes & Sections** (`/class-organization`) | Combined page with Sections + Class Assignments tabs | |
| C-02 | Visit `/sections` or `/class-assignments` | Redirects to `/class-organization` (correct tab if applicable) | |
| C-03 | **Sections** tab — create / edit a section | Section saved and listed | |
| C-04 | **Class Assignments** tab — assign teacher to subject / section / SY / quarter | Assignment saved and listed | |
| C-05 | Teacher **My Classes** after assignment | Assigned class appears for that teacher | |

---

### 3.4.D Grades / ECR (Teacher + Admin visibility)

| ID | Portal | Case | Expected | Result |
|----|--------|------|----------|--------|
| G-01 | Teacher | **Input Grades** — upload valid ECR → confirm class → preview & import | Learners / grades imported for selected class | |
| G-02 | Teacher | **My Classes** — open class after import | Grades / learners visible | |
| G-03 | Teacher | Reject wrong / mismatched class selection if applicable | Clear validation; no silent wrong import | |
| G-04 | Admin | **Academic Records** / monitoring after import | Risk / recommendation appear from grades (not attendance) | |
| G-05 | Student | **My Grades** for enrolled subjects | Enrolled subjects listed even if some are still ungraded | |

---

### 3.4.E Lesson plans — Teacher submit + Admin review

| ID | Portal | Case | Expected | Result |
|----|--------|------|----------|--------|
| L-01 | Teacher | Create / submit lesson plan | Status pending / awaiting review | |
| L-02 | Admin | Open **Lesson Plan Review**; open a submitted plan | Drawer shows Lesson Information + Preview (+ remarks field) | |
| L-03 | Admin | **Approve** | Status approved; **Reviewed By** shows Head Teacher name (or fallback) | |
| L-04 | Admin | **Needs Revision** with remarks | Status needs revision; teacher sees remarks | |
| L-05 | Admin | **Cancel** on drawer | Drawer closes; status unchanged | |
| L-06 | Admin | Confirm no review checklist / system validation card | Simplified actions only | |
| L-07 | Teacher | Resubmit after Needs Revision | Returns to review queue; previous Reviewed By cleared / updated on next review | |

---

### 3.4.F Settings — Teacher (and related)

| ID | Portal | Case | Expected | Result |
|----|--------|------|----------|--------|
| S-01 | Teacher | Open **Settings** | Profile \| Security side-by-side on desktop; About full width below | |
| S-02 | Teacher | Profile card | Read-only live name, employee ID, email, learning area, phone, status | |
| S-03 | Teacher | Temp password banner when must-change is set | Read-only temporary password + Copy works | |
| S-04 | Teacher | Change password (correct current → new ≥ 8 chars) | Success; can sign in with new password | |
| S-05 | Teacher | After successful change | Temporary password no longer shown; flags cleared | |
| S-06 | Teacher | Change password with wrong current password | Error; password unchanged | |
| S-07 | Admin | **Settings** school / account preferences | Note live vs mock behavior for defense | Unknown |

---

### 3.4.G Academic Monitoring, Attendance, Student portal

| ID | Portal | Case | Expected | Result |
|----|--------|------|----------|--------|
| M-01 | Admin / Teacher | Academic Monitoring filters / learner detail | Risk from ECR grades only | |
| M-02 | Admin | Assign ARAL facilitator; view weekly progress (read-only) | Facilitator assignment saves; weekly history viewable | |
| M-03 | Teacher (facilitator) | Save weekly ARAL progress | Entry visible to Head Teacher | |
| M-04 | Teacher / Admin | SF2 upload + attendance analytics | Rates / ~20% absence warning; does not change academic risk | |
| M-05 | Student | Dashboard | View-only academic summary | |
| M-06 | Student | Interventions / PLP | View-only recommendations / notes | |
| M-07 | Student | Profile | Academic and Attendance sections clearly separated | |
| M-08 | Student | Cannot edit grades / risk / attendance | No edit controls for those records | |

---

### 3.4.1 Outstanding Issues and Risks

| ID | Issue / Risk | Severity | Status |
|----|--------------|----------|--------|
| | | | |

## 3.5 Test Environment

| Item | Detail |
|------|--------|
| Application | CNHS Centralized School Data System |
| Framework | Next.js |
| Backend / DB | Supabase |
| Browsers tested | |
| Date of testing | |
| Testers | |

## 3.6 Conclusions and Recommendations

_Summarize whether the system is ready for school use / defense demonstration, noting any residual risks._

## 3.7 Recommendations

1. Keep Academic Prediction and Attendance Monitoring documentation and training materials separate.  
2. Continue validating ECR and SF2 templates with live school files.  
3. Complete formal sign-off after outstanding issues in §3.4.1 are resolved.  

## 3.8 Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| Adviser / Panel | | | |
| School Representative | | | |

## 3.9 Testing Documentation

List supporting artifacts (test cases, screenshots, ECR/SF2 samples, audit notes):

1.  
2.  
3.  

## 3.10 About the Developer

_Project developed as a capstone / academic software project for Cambaog National High School. Update this section with developer name(s), program, and institution as required by your documentation format._

---

## Document Control

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | July 2026 | Initial user manual & TOC aligned to two-module architecture |
| 1.1 | August 2026 | Classes & Sections, LP review, teacher settings, User Management sync; QA checklist in §3.4 |

---

*End of document*
