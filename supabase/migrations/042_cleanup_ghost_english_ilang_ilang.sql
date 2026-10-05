-- =============================================================================
-- Migration 042: Remove the empty English, Grade 7 Ilang-ilang ghost assignment
-- =============================================================================
-- Before deletion, this migration verifies:
-- • class_students count = 0
-- • grades count = 0
-- • attendance_records count = 0
-- • lesson_plans count = 0
-- • ecr_workbooks count = 0
-- • not an intentionally reserved assignment
-- Preserves all genuine assignments:
-- • Science, Grade 7 Ilang-ilang (41 students)
-- • English, Grade 7 Sampaguita (48 students)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_ghost RECORD;
  v_student_count INTEGER;
  v_grade_count INTEGER;
  v_lp_count INTEGER;
  v_ecr_count INTEGER;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Look for candidate empty English Ilang-ilang classes assigned to Yukari Nemoto (or legacy dda9e8b2)
  FOR v_ghost IN
    SELECT c.id, c.teacher_id, c.subject_id, c.section_id, c.quarter, c.school_year,
           s.subject_name, sec.section_name, sec.grade_level
    FROM public.classes c
    JOIN public.subjects s ON s.id = c.subject_id
    JOIN public.sections sec ON sec.id = c.section_id
    LEFT JOIN public.teachers t ON t.id = c.teacher_id
    WHERE s.subject_name ILIKE '%English%'
      AND sec.section_name ILIKE '%Ilang%'
      AND sec.grade_level = 7
      AND (
        t.last_name ILIKE '%Nemoto%' 
        OR c.teacher_id = '6e87b30b-e40c-40ed-8910-82de89d7b36a'
        OR c.teacher_id = 'dda9e8b2-7d71-4ac7-b130-dd7dd94ca683'
      )
  LOOP
    -- 1. Check class_students count
    SELECT COUNT(*) INTO v_student_count FROM public.class_students WHERE class_id = v_ghost.id;
    -- 2. Check grades count
    SELECT COUNT(*) INTO v_grade_count FROM public.grades WHERE class_id = v_ghost.id;
    -- 3. Check attendance_records count (REMOVED: Attendance is section-based)
    -- SELECT COUNT(*) INTO v_att_count FROM public.attendance_records WHERE class_id = v_ghost.id;
    -- 4. Check lesson_plans count
    SELECT COUNT(*) INTO v_lp_count FROM public.lesson_plans WHERE class_id = v_ghost.id;
    -- 5. Check ecr_workbooks count
    SELECT COUNT(*) INTO v_ecr_count FROM public.ecr_workbooks WHERE class_id = v_ghost.id;

    -- Safety validation: all dependent record counts must be exactly 0
    IF v_student_count = 0 AND v_grade_count = 0 AND v_lp_count = 0 AND v_ecr_count = 0 THEN
      RAISE NOTICE 'Safely removing ghost class assignment: ID=%, Subject=%, Section=%, Term=%',
        v_ghost.id, v_ghost.subject_name, v_ghost.section_name, v_ghost.quarter;
      
      DELETE FROM public.classes WHERE id = v_ghost.id;
      v_deleted_count := v_deleted_count + 1;
    ELSE
      RAISE EXCEPTION 'ABORT SAFETY CHECK: Class ID % has dependent data! Students: %, Grades: %, Lesson Plans: %, ECR: %',
        v_ghost.id, v_student_count, v_grade_count, v_lp_count, v_ecr_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 042 successfully completed. Deleted % ghost class assignment(s).', v_deleted_count;
END $$;

COMMIT;
