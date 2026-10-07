-- =============================================================================
-- CNHS Learn: assignment / enrollment duplicate DETECTION (read-only report)
-- =============================================================================
-- Purpose: distinguish VALID HISTORY from TRUE DUPLICATES without touching
-- any data. Run every statement, review output, and only then decide whether
-- any cleanup is warranted.
--
-- VALID HISTORY (keep):
--   same learner across different quarters / subjects / school years
-- TRUE DUPLICATE (investigate):
--   same learner, same class, same subject, same quarter, same school year,
--   same purpose, more than once
--
-- This script contains SELECT statements ONLY. It deletes nothing.
-- =============================================================================

-- 1. class_students: same learner enrolled twice in the same class.
-- Expected: 0 rows (unique index class_students_class_id_student_id_key).
SELECT class_id, student_id, COUNT(*) AS occurrences,
       array_agg(id) AS row_ids
FROM public.class_students
GROUP BY class_id, student_id
HAVING COUNT(*) > 1;

-- 2. grades: same learner, class, subject, quarter, school year graded twice.
-- Expected: 0 rows (unique student/class/subject/quarter/year).
SELECT student_id, class_id, subject_id, quarter, school_year,
       COUNT(*) AS occurrences, array_agg(id) AS row_ids
FROM public.grades
GROUP BY student_id, class_id, subject_id, quarter, school_year
HAVING COUNT(*) > 1;

-- 3. classes: duplicate assignments (teacher/subject/section/year/quarter).
-- Expected: 0 rows (unique index from 036_phase1 migration).
SELECT teacher_id, subject_id, section_id, school_year, quarter,
       COUNT(*) AS occurrences, array_agg(id) AS class_ids
FROM public.classes
GROUP BY teacher_id, subject_id, section_id, school_year, quarter
HAVING COUNT(*) > 1;

-- 4. monitoring_records: same learner+class with several rows on one date.
-- NOTE: repeats here are usually VALID (weekly progress history), not dupes.
-- Review `intervention_given` / `student_progress` before judging.
SELECT student_id, class_id,
       COALESCE(observation_date::text, 'no-date') AS observation_date,
       COUNT(*) AS occurrences, array_agg(id) AS row_ids
FROM public.monitoring_records
GROUP BY student_id, class_id, observation_date
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 100;

-- 5. ecr_workbooks: more than one workbook per class per school year.
-- Expected: 0 rows (unique class_id + school_year).
SELECT class_id, school_year, COUNT(*) AS occurrences, array_agg(id) AS row_ids
FROM public.ecr_workbooks
GROUP BY class_id, school_year
HAVING COUNT(*) > 1;

-- 6. Learner footprint sanity: learners enrolled in an unexpectedly high
-- number of classes for one quarter (possible double-enrollment symptom).
-- Review rows with class_count well above the school's subject load.
SELECT cs.student_id, c.school_year, c.quarter,
       COUNT(DISTINCT cs.class_id) AS class_count,
       array_agg(DISTINCT s.subject_name) AS subjects
FROM public.class_students cs
JOIN public.classes c ON c.id = cs.class_id
LEFT JOIN public.subjects s ON s.id = c.subject_id
GROUP BY cs.student_id, c.school_year, c.quarter
HAVING COUNT(DISTINCT cs.class_id) > 12
ORDER BY class_count DESC;

-- =============================================================================
-- SAFE UNIQUE CONSTRAINT / INDEX RECOMMENDATIONS (apply only after the
-- report above is clean and dependent records are inspected):
--   a) class_students(class_id, student_id)      — already unique (007).
--   b) grades(student/class/subject/quarter/yr)  — already unique (002).
--   c) classes(teacher/subject/section/yr/qtr)   — already unique (036).
--   d) ecr_workbooks(class_id, school_year)     — already unique (020).
--   e) monitoring_records: do NOT add a blind unique key; weekly history
--      legitimately repeats (student, class, date). If accidental rapid-click
--      dupes are proven, prefer an application-level idempotency guard
--      (disable-while-saving already exists) over a DB constraint.
-- =============================================================================
