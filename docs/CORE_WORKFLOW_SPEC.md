# CNHS LEARN: Core Workflow & Hybrid Architecture Specification

This document serves as the definitive structural and operational boundary for the CNHS Centralized School Data System (CNHS LEARN). It outlines the primary data pipelines, the automated predictive engine, and the strict adherence to a **Hybrid (Progressive Automation)** approach for daily classroom operations.

---

## 1. Module Pipeline: Grade Ingestion to Risk Analytics

### 1.1 Ingestion Layer & Pure In-Domain Feature Extraction
- **Trigger**: The teacher uploads a standard DepEd Electronic Class Record Excel sheet (`.xlsx`) via the My Classes (`/teacher/my-classes`) panel.
- **Data Parsing Rule**: The ingestion engine parses and isolates *academic performance metrics only*. Attendance records are decoupled entirely from this phase and handled separately.
- **Extracted Grade Criteria Features**: The system extracts the raw numerical values of standard DepEd grading pillars:
  - **Written Works (WW)**: Short quizzes, chapter evaluations, component tasks.
  - **Performance Tasks (PT)**: Projects, performance outputs, practical assessments.
  - **Quarterly Assessment (QA)**: Periodical exam marks.

### 1.2 Asynchronous Random Forest Execution (The Predictive Engine)
- **Background Hook**: Upon successfully saving the immutable database records in Supabase, an asynchronous background webhook fires to invoke the custom Random Forest Classifier.
- **Model Logic**: The algorithm processes the newly uploaded grading components against the baseline Grade Criteria Matrix to calculate academic regression and failure probabilities.
- **Threshold Rule**: If the model computes a failure probability score of **≥ 0.65**, the student profile is automatically marked with a dual metadata state:
  - `Academic Risk Level = HIGH`
  - `ARAL Pipeline Status = PENDING_INITIAL_SCREENING`
*(Note: This intelligence layer remains fully centralized and machine-driven.)*

### 1.3 Client-Side Caching & Dashboard Alert Hydration
- **Path**: Academic Monitoring (`/teacher/monitoring`) inside the Intervention sub-tab.
- **Performance Optimization**: The UI instantly handles rendering via client-side snapshot caching (`localStorage` + `useSoftLoadState`). While the teacher views the cached layout, the system queries Supabase for real-time model changes in the background, minimizing layout shifts.
- **Visual Alert UI**: If high-risk learners exist, the interface displays an active alert toast/banner: *"Action Required: [X] students have been flagged as HIGH RISK based on Grade Criteria."*
- **The Isolated View**: High-risk students are extracted into a specialized, dynamically filtered data grid called the **Pending Screening Roster**.

### 1.4 The Hybrid Initial Screening Phase (Human Verification Layer)
When a teacher selects a student from the high-risk queue, it initializes a **3-Step Contextual Validation Wizard**. This hybrid bridge prevents machine-bias before onboarding a learner into the official ARAL Program (RA 12028).
- **Step 1 (Diagnostic Input)**: Teacher inputs manual offline scores from physical Phil-IRI / CRLA Reading Assessment booklets (e.g., Comprehension Score %).
- **Step 2 (Contextual Attendance Sync)**: The system displays the decoupled attendance record from `/teacher/attendance` as a secondary context. This allows the teacher to gauge if low grades are driven by foundational reading difficulties or chronic absenteeism.
- **Step 3 (Legal Consent Check-off)**: A simple binary switch confirming that the physical signed Parental Consent Form is on file.
- **Commit**: Clicking "Submit Screening" securely saves the profile, clearing the student from the pending queue and pushing a Prescriptive PLP Strategy Blueprint recommendation up to the Admin Portal for allocation.

---

## 2. Progressive Automation (Hybrid Strategy) Rules

To ensure seamless teacher onboarding and avoid system fatigue, CNHS LEARN enforces a **Progressive Automation** approach for daily operational modules. AI and heavy automation are reserved strictly for the Risk Analytics Engine, while daily operations remain flexible and hybrid.

### 2.1 Attendance (`/teacher/attendance`)
- **Rule**: Do NOT build a real-time, daily period-by-period attendance logger.
- **Implementation**: Keep it hybrid. Teachers will continue using their physical logbooks daily. The UI only requires a **manual end-of-month or end-of-quarter total absence consolidation field**.

### 2.2 Lesson Plans (`/teacher/lesson-plans`)
- **Rule**: Eliminate any complex grid-typing or AI-assisted row generation fields for teachers.
- **Implementation**: Treat this module as a **Digital Drop-box**. The UI simply allows a PDF/Image file upload option for their existing manual files, accompanied by basic dropdown tags (e.g., Subject, Week) and an approval status workflow tracker.

### 2.3 Reports (`/teacher/reports`)
- **Rule**: Ensure a human feedback layer exists before finalizing documents.
- **Implementation**: All generated reports must be exportable to editable formats (like `.xlsx` or `.docx`) instead of strictly locked PDFs. This guarantees teachers can manually adjust formatting or add personal student remarks before printing.
