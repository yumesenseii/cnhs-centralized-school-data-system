-- =============================================================================
-- Migration 036: Phase 1 Class Assignments Unique Constraint & Data Cleanup
-- =============================================================================

BEGIN;

-- 1. Reassign Michelle Mondelo's records from legacy orphaned teacher (1d109ca6)
--    to her active teacher account (141755ab-1839-4e85-bd09-9ffb7958f2b8)

-- (a) Section advisership (Grade 8 Mabini)
UPDATE public.sections
SET adviser_id = '141755ab-1839-4e85-bd09-9ffb7958f2b8'
WHERE adviser_id = '1d109ca6-2ba5-4dc2-ad30-f6317262ec1b';

-- (b) Grade 8 Mabini Math classes (with 40 enrollments each)
UPDATE public.classes
SET teacher_id = '141755ab-1839-4e85-bd09-9ffb7958f2b8'
WHERE teacher_id = '1d109ca6-2ba5-4dc2-ad30-f6317262ec1b'
  AND id IN (
    '52f5c935-ac77-43df-9472-7918282cb4e5',
    '17e5a102-af96-41ea-872b-d6d30881ad95',
    '8c6273b3-907f-471d-8a09-cc96521c8dc8',
    'c2845774-b015-4f82-9aa8-31d648a74b46'
  );

-- (c) Lesson plans
UPDATE public.lesson_plans
SET teacher_id = '141755ab-1839-4e85-bd09-9ffb7958f2b8'
WHERE teacher_id = '1d109ca6-2ba5-4dc2-ad30-f6317262ec1b';

-- (d) ECR workbooks
UPDATE public.ecr_workbooks
SET teacher_id = '141755ab-1839-4e85-bd09-9ffb7958f2b8'
WHERE teacher_id = '1d109ca6-2ba5-4dc2-ad30-f6317262ec1b';

-- 2. Delete empty duplicate Gumamela Filipino classes on orphaned teacher 1d109ca6
-- (The active teacher 141755ab already owns the corresponding classes with 40 enrollments each)
DELETE FROM public.classes
WHERE teacher_id = '1d109ca6-2ba5-4dc2-ad30-f6317262ec1b'
  AND id IN (
    '0416527b-6961-4fbb-8afc-8db035e77383',
    'e4916490-76dd-41e5-b4a3-e2228d54a1e8',
    '8caab666-8a22-4d1e-843d-abf7af34dcf6',
    '54ccf882-3fb3-4aa3-a02c-34b97dde9482'
  );

-- 3. Clean up orphaned teachers and users that have no auth.users row, no profiles row, and no remaining references
DELETE FROM public.teachers
WHERE user_id IN (
  '9fea8ab4-5fe6-40d6-a058-a981370e68ad',
  '8cef1f19-dcc8-4c5e-bdee-fe59434430e7'
);

DELETE FROM public.users
WHERE id IN (
  '9fea8ab4-5fe6-40d6-a058-a981370e68ad',
  '8cef1f19-dcc8-4c5e-bdee-fe59434430e7'
);

-- 4. Create unique index to permanently prevent duplicate class assignments:
-- Teacher + Subject + Section + School Year + Quarter
CREATE UNIQUE INDEX IF NOT EXISTS classes_unique_assignment_idx
  ON public.classes (teacher_id, subject_id, section_id, school_year, quarter);

COMMIT;
