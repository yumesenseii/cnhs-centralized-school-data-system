-- Migration 043: Clear Grade 7 Gumamela advisory roster for testing
-- Unlinks learners from Grade 7 Gumamela (adviser: Yukari Nemoto) and removes dependent class links/grades

DO $$
DECLARE
  v_gumamela_id uuid;
  v_teacher_id uuid;
BEGIN
  -- 1. Find teacher Yukari Nemoto
  SELECT id INTO v_teacher_id
  FROM public.teachers
  WHERE first_name ILIKE '%Yukari%' OR last_name ILIKE '%Nemoto%'
  LIMIT 1;

  -- 2. Find Gumamela section
  SELECT id INTO v_gumamela_id
  FROM public.sections
  WHERE section_name ILIKE '%Gumamela%'
    AND (adviser_id = v_teacher_id OR v_teacher_id IS NULL)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_gumamela_id IS NOT NULL THEN
    -- Delete grades for classes in Gumamela
    DELETE FROM public.grades
    WHERE class_id IN (SELECT id FROM public.classes WHERE section_id = v_gumamela_id);

    -- Delete class_students for classes in Gumamela
    DELETE FROM public.class_students
    WHERE class_id IN (SELECT id FROM public.classes WHERE section_id = v_gumamela_id);

    -- Unlink students from Gumamela section
    UPDATE public.students
    SET section_id = NULL
    WHERE section_id = v_gumamela_id;

    RAISE NOTICE 'Successfully cleared advisory roster for Gumamela section %', v_gumamela_id;
  END IF;
END $$;
