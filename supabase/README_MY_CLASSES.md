# My Classes (Teacher Portal) — existing schema

Wag magrecreate ng tables since yung app uses these existing public tables only:

| Table | Role |
|---|---|
| `profiles` | Auth profile (`auth_user_id`, `role`) |
| `teachers` | Teacher entity; `classes.teacher_id` → `teachers.id` |
| `subjects` | Subject labels |
| `sections` | Grade + section |
| `classes` | Admin-assigned teacher classes |
| `students` | Learners |
| `class_students` | Class roster |
| `grades` | Quarterly final grades (`student_id`, `class_id`, `subject_id`, `quarter`, `final_grade`, `school_year`) |

## Workflow

1. Teacher login → resolve `profiles` → linked `teachers` row
2. My Classes loads `classes` where `teacher_id = teachers.id`
3. Student list loads `class_students` (+ averages from `grades`)
4. E-Class upload:
   - Validate INPUT DATA vs assigned class
   - Upsert `students` / `class_students`
   - Upsert `grades` on unique `(student_id, class_id, subject_id, quarter, school_year)`
5. Student profile is read-only (basic info, subject grades, general average, weakest subject, school year, quarter)

Wala pang Monitoring / Reports / Lesson Plans / Random Forest sa module since kulang sa datasets.
