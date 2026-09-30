# CNHS LEARN — Synthetic Historical Learner Dataset & Reference Benchmarks
**Project:** CNHS LEARN (Centralized School Data System)  
**Status:** DUMMY / SYNTHETIC DATASET (Approved for Capstone Machine Learning Development)

---

## 1. Important Disclosure & Purpose
* **Synthetic Nature:** Individual learner rows in `CNHS_LEARN_Synthetic_Historical_Learners.csv` are **Synthetic Development Records**. They must **NEVER** be presented in capstone manuscripts or presentations as actual individual student identities from Camuning National High School (CNHS).
* **Official Aggregate Reference:** The aggregate metrics in the `CNHS_Official_Aggregate_Ref` tab (and outlined below) represent the **verified historical sample aggregate benchmark** provided by CNHS for the ARAL program.
* **Separation Rule:** The synthetic dataset is stored under `data/synthetic/` and is strictly used for model training, testing, and longitudinal simulation. It does not overwrite live CNHS database operational records.

---

## 2. Official CNHS Historical Aggregate Reference Benchmark (SY 2025–2026)

| ARAL Placement Tier | Beginning Enrolled | End Enrolled | Retained in Tier | Promoted Out of Tier | Promotion Rate (%) |
|---|---|---|---|---|---|
| **ARAL Basic** | **129 learners** | 120 learners | 19 learners | 101 learners | **78.29%** ($101 / 129$) |
| **ARAL Plus** | **86 learners** | 81 learners | 7 learners | 74 learners | **86.05%** ($74 / 86$) |
| **Total ARAL Cohort** | **215 learners** | 201 learners | 26 learners | 175 learners | **81.40%** ($175 / 215$) |

### Monthly Attendance Reference
* **September**: Basic 65.82%, Plus 65.75%, Average **65.79%**
* **October**: Basic 64.34%, Plus 56.35%, Average **60.35%**
* **November**: Basic 54.67%, Plus 51.11%, Average **52.89%**

---

## 3. Machine Learning Feature Contract (13 Features)

The Random Forest model consumes strictly the following **13 academic features** (General Average is intentionally excluded to prevent target leakage):

1. `english_grade`
2. `filipino_grade`
3. `mathematics_grade`
4. `science_grade`
5. `mapeh_grade`
6. `araling_panlipunan_grade`
7. `tle_grade`
8. `values_education_grade`
9. `failing_subject_count`
10. `language_fail_count`
11. `non_language_fail_count`
12. `lowest_grade`
13. `available_grade_count`

**Target Variable ($y$):** `risk_level` (`High Risk`, `Moderate Risk`, `Low Risk`).  
*Intervention recommendations and ARAL qualification are handled separately through diagnostic assessments and school personnel review.*

---

## 4. File Inventory in this Directory
1. `CNHS_LEARN_Synthetic_Historical_Learners.csv` — Full longitudinal master dataset with assessments, placement tiers, and outcomes (3,600 records).
2. `CNHS_LEARN_RF_Training_Dataset.csv` — Exact 13-feature input vector + target column for `train_model.py`.
3. `CNHS_LEARN_Synthetic_Historical_Learners.xlsx` — Formatted multi-tab Excel workbook with official CNHS aggregate benchmarks.
4. `README.md` — This documentation file.
