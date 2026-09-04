# CNHS subject grading weights + MAPEH consolidation

## Component weights (E-Record / Class Record)

| Subject | WW | PT | QA / Summative |
|---------|----|----|----------------|
| **MAPEH** | 20% | **60%** | **20%** |
| **Values Education** | 20% | **60%** | **20%** |
| English, Filipino, Science, Mathematics, Araling Panlipunan, TLE (default) | 20% | **50%** | **30%** |

Computation for every subject:

```
Assessment scores
→ Weighted component scores (WW / PT / QA)
→ Initial Grade
→ Official grade transmutation
→ Final Term Grade
```

Implemented in `lib/ecr/computeGrades.js` using `ecr_component_config.component_weight`.
New workbooks pick the template via `getEcrTemplateForSubject()` in `lib/ecr/constants.js`.

## MAPEH consolidation (CNHS ECR)

```
Music & Arts Term Grade  → MA
PE & Health Term Grade   → PEH
Official MAPEH           → round(average(MA, PEH))
```

- **Summary of Grades** and **Random Forest** use only the final consolidated **MAPEH** grade.
- Music, Arts, PE, Health, MA, PEH are **not** RF features.
- If only component grades exist, `resolveOfficialMapehGrade()` in `features.js` derives MAPEH once.

## Values Education

Same 20/60/20 weights as MAPEH. Final official grade is stored as `values_education_grade` for Summary + RF.

## Random Forest (Model B)

Official subject features (final grades only):

- english_grade, filipino_grade, mathematics_grade, science_grade
- mapeh_grade, araling_panlipunan_grade, tle_grade, values_education_grade
- failing_subject_count, language_fail_count, non_language_fail_count
- lowest_grade, available_grade_count

**Excluded:** `general_average` (labels only), SF2/attendance, MAPEH component subjects, raw WW/PT/QA scores.
