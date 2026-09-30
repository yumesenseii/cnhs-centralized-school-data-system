-- Migration 037: Clean up ghost user records and fix teacher email collision

-- 1. Fix Ronabelle Serpa Juan email (was erroneously yukarinepomuceno@gmail.com)
UPDATE public.teachers 
SET email = 'ronabelle.serpajuan@cnhs.edu.ph' 
WHERE id = 'bfe0535a-bb76-4767-88a8-a39d8492bb22' 
  AND email = 'yukarinepomuceno@gmail.com';

-- 2. Consolidate Yukari Nemoto duplicate teacher records
-- Reassign 4 English classes from dda9e8b2 to 6e87b30b
UPDATE public.classes 
SET teacher_id = '6e87b30b-e40c-40ed-8910-82de89d7b36a' 
WHERE teacher_id = 'dda9e8b2-7d71-4ac7-b130-dd7dd94ca683';

-- Delete duplicate teacher dda9e8b2
DELETE FROM public.teachers 
WHERE id = 'dda9e8b2-7d71-4ac7-b130-dd7dd94ca683';

-- 3. Detach orphaned ghost user 2794360f from teacher 6e87b30b
UPDATE public.teachers 
SET user_id = NULL 
WHERE user_id = '2794360f-cc7c-4076-bb68-a2d86fdc4ad0';

-- 4. Delete orphaned ghost users in public.users (not in auth.users)
DELETE FROM public.users 
WHERE id = '2794360f-cc7c-4076-bb68-a2d86fdc4ad0';

UPDATE public.students 
SET user_id = NULL 
WHERE user_id = '582cd6d4-2205-4915-9a28-f6af5b719947';

DELETE FROM public.users 
WHERE id = '582cd6d4-2205-4915-9a28-f6af5b719947';
