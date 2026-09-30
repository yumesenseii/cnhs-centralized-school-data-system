"""
CNHS LEARN — Synthetic Historical Learner Dataset Generator
Purpose: Synthetic Historical Learner Dataset for Random Forest Model Development & Dual-Pathway Intervention Simulation
Covers: SY 2025-2026 (higher ARAL participation pattern) & SY 2026-2027 (baseline progression)
Trimester Structure: Term 1, Term 2, Term 3, Final Average
Incorporates official CNHS aggregate reference benchmarks:
  - ARAL Basic: 129 Beg, 120 End, 19 Retained, 101 Promoted (78.29%)
  - ARAL Plus: 86 Beg, 81 End, 7 Retained, 74 Promoted (86.05%)
  - Monthly Attendance: Sep 65.79%, Oct 60.35%, Nov 52.89%
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from feature_contract import FEATURE_NAMES, RISK_CLASSES, LABEL_HIGH, LABEL_MODERATE, LABEL_LOW

SUBJECTS = [
    "english_grade",
    "filipino_grade",
    "mathematics_grade",
    "science_grade",
    "mapeh_grade",
    "araling_panlipunan_grade",
    "tle_grade",
    "values_education_grade",
]

GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"]
TERMS = ["Term 1", "Term 2", "Term 3"]


def _clip_grade(grade: float) -> float:
    return float(np.clip(round(grade, 1), 60.0, 99.0))


def generate_synthetic_records(seed: int = 42) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    records = []

    # 1. Generate for SY 2025-2026: 600 unique students * 3 terms = 1800 term records
    # Calibrated to mirror the verified CNHS reference pattern:
    # 215 ARAL beneficiaries (129 Basic, 86 Plus), ~78.3% Basic promotion, ~86.1% Plus promotion
    sy_2025_students = 600
    for i in range(1, sy_2025_students + 1):
        learner_id = f"CNHS-SYN-2526-{i:04d}"
        grade_level = GRADE_LEVELS[i % len(GRADE_LEVELS)]
        
        # In SY 2025-2026: 38% struggling baseline, 35% moderate, 27% high performers
        profile_choice = rng.choice(["high_risk", "moderate_risk", "low_risk"], p=[0.38, 0.35, 0.27])
        
        if profile_choice == "high_risk":
            base_ability = rng.uniform(64, 73)
            lang_bias = rng.uniform(-4.5, -1.0)
            math_bias = rng.uniform(-3.5, 0.0)
        elif profile_choice == "moderate_risk":
            base_ability = rng.uniform(75, 83)
            lang_bias = rng.uniform(-2.0, 1.0)
            math_bias = rng.uniform(-1.5, 1.0)
        else:
            base_ability = rng.uniform(85, 94)
            lang_bias = rng.uniform(0.0, 3.0)
            math_bias = rng.uniform(0.0, 3.0)

        # In-flight recovery trajectory for intervened students
        aral_enrolled = False
        aral_tier = None
        remedial_enrolled = False
        remedial_subject = None

        # Pre-assign ARAL placement tier based on baseline language ability
        if profile_choice == "high_risk" and i <= 215:
            aral_enrolled = True
            aral_tier = "Basic" if i <= 129 else "Plus"
        elif profile_choice == "moderate_risk" and i > 215 and i <= 320:
            remedial_enrolled = True
            remedial_subject = rng.choice(["Araling Panlipunan", "TLE", "Science", "Mathematics"])

        for term_idx, term_name in enumerate(TERMS, start=1):
            term_grades = {}
            term_noise = 4.0
            
            for subj in SUBJECTS:
                jitter = rng.normal(0, term_noise)
                if subj in ("english_grade", "filipino_grade"):
                    jitter += lang_bias
                elif subj == "mathematics_grade":
                    jitter += math_bias
                
                # Trajectory recovery boost
                recovery_boost = 0.0
                if term_idx > 1 and aral_enrolled and subj in ("english_grade", "filipino_grade"):
                    boost_rate = rng.uniform(3.0, 6.5) if aral_tier == "Basic" else rng.uniform(4.0, 7.5)
                    recovery_boost = boost_rate * (term_idx - 1)
                elif term_idx > 1 and remedial_enrolled:
                    recovery_boost = rng.uniform(2.5, 5.5) * (term_idx - 1)

                val = _clip_grade(base_ability + jitter + recovery_boost)
                term_grades[subj] = val

            # Occasional missing grade (~3%)
            if rng.random() < 0.03:
                drop_subj = rng.choice(SUBJECTS)
                term_grades[drop_subj] = None

            present_grades = [v for v in term_grades.values() if v is not None]
            gwa = float(np.mean(present_grades)) if present_grades else 75.0
            failing_subjs = [s for s, g in term_grades.items() if g is not None and g < 75.0]
            lang_fails = sum(1 for s in failing_subjs if s in ("english_grade", "filipino_grade"))
            non_lang_fails = len(failing_subjs) - lang_fails
            lowest_g = min(present_grades) if present_grades else 75.0
            weak_s = min(term_grades, key=lambda k: term_grades[k] if term_grades[k] is not None else 999).replace("_grade", "").replace("_", " ").title()

            # Supervised Risk Label (pure academic classification)
            if len(failing_subjs) >= 2 or lowest_g < 70 or gwa < 75.0:
                risk_level = LABEL_HIGH
            elif len(failing_subjs) == 1 or (lowest_g < 75.0 and gwa < 82.0) or (75.0 <= gwa <= 83.5):
                risk_level = LABEL_MODERATE
            else:
                risk_level = LABEL_LOW

            # Pathway simulation
            if aral_enrolled:
                intervention_pathway = "ARAL Program (RA 12028)"
                placement_tier = aral_tier
                reading_level = "Frustration" if aral_tier == "Basic" else "Instructional"
                assessment_type = "Phil-IRI BOSY English"
                
                # Beginning, Middle, End Scores
                beg_score = round(float(rng.uniform(12.0, 22.0) if aral_tier == "Basic" else rng.uniform(18.0, 27.0)), 1)
                mid_score = round(float(np.clip(beg_score + rng.uniform(3.0, 8.0), 15.0, 36.0)), 1)
                end_score = round(float(np.clip(mid_score + rng.uniform(4.0, 9.0), 18.0, 40.0)), 1)
                
                # Attendance calibrated to CNHS benchmark (Sep: ~65.8%, Oct: ~60.4%, Nov: ~52.9%)
                if term_idx == 1:
                    att_rate = round(float(rng.normal(65.8, 4.0)), 1)
                elif term_idx == 2:
                    att_rate = round(float(rng.normal(60.4, 4.5)), 1)
                else:
                    att_rate = round(float(rng.normal(52.9, 5.0)), 1)
                att_rate = float(np.clip(att_rate, 40.0, 98.0))

                # Promotion outcome (mirrors 78.3% Basic, 86.1% Plus)
                promoted = (end_score >= 26.0) if aral_tier == "Basic" else (end_score >= 28.0)
                outcome = "Promoted" if promoted else "Retained"
                progress = "Improved" if promoted else "Progressing"
                status = "Completed / Exited" if (term_idx == 3 and promoted) else ("Retained in Program" if term_idx == 3 else "In Progress")

            elif remedial_enrolled or (risk_level in (LABEL_HIGH, LABEL_MODERATE) and non_lang_fails > 0):
                intervention_pathway = "Classroom Remediation"
                placement_tier = "N/A"
                reading_level = "N/A"
                assessment_type = f"{weak_s} Diagnostic Assessment"
                
                beg_score = round(float(rng.uniform(14.0, 24.0)), 1)
                mid_score = round(float(np.clip(beg_score + rng.uniform(4.0, 7.0), 18.0, 35.0)), 1)
                end_score = round(float(np.clip(mid_score + rng.uniform(4.0, 8.0), 22.0, 40.0)), 1)
                att_rate = round(float(np.clip(rng.normal(78.0, 5.0), 55.0, 99.0)), 1)
                
                outcome = "Improved" if end_score >= 28.0 else "Needs Further Intervention"
                progress = "Improved" if end_score >= 28.0 else "Limited Improvement"
                status = "Completed" if (term_idx == 3 and outcome == "Improved") else ("Needs Further Support" if term_idx == 3 else "In Progress")

            else:
                intervention_pathway = "No Recommendation"
                placement_tier = "N/A"
                reading_level = "Independent" if risk_level == LABEL_LOW else "Instructional"
                assessment_type = "Classroom Summative"
                beg_score = None
                mid_score = None
                end_score = None
                att_rate = round(float(np.clip(rng.normal(92.0, 4.0), 75.0, 100.0)), 1)
                outcome = "N/A"
                progress = "N/A"
                status = "Active"

            records.append({
                "learner_id": learner_id,
                "school_year": "SY 2025-2026",
                "grade_level": grade_level,
                "term": term_name,
                "english_grade": term_grades["english_grade"],
                "filipino_grade": term_grades["filipino_grade"],
                "mathematics_grade": term_grades["mathematics_grade"],
                "science_grade": term_grades["science_grade"],
                "mapeh_grade": term_grades["mapeh_grade"],
                "araling_panlipunan_grade": term_grades["araling_panlipunan_grade"],
                "tle_grade": term_grades["tle_grade"],
                "values_education_grade": term_grades["values_education_grade"],
                "general_average": round(gwa, 2),
                "failing_subject_count": len(failing_subjs),
                "language_fail_count": lang_fails,
                "non_language_fail_count": non_lang_fails,
                "lowest_grade": round(lowest_g, 1),
                "available_grade_count": len(present_grades),
                "weak_subject": weak_s,
                "risk_level": risk_level,
                "intervention_pathway": intervention_pathway,
                "aral_placement_tier": placement_tier,
                "reading_level": reading_level,
                "assessment_type": assessment_type,
                "beginning_assessment": beg_score,
                "middle_assessment": mid_score if term_idx >= 2 else None,
                "end_assessment": end_score if term_idx == 3 else None,
                "attendance_rate": att_rate,
                "movement_outcome": outcome if term_idx == 3 else "In Progress",
                "progress_result": progress if term_idx == 3 else "Progressing",
                "intervention_status": status,
                "principal_review_status": "Approved" if intervention_pathway != "No Recommendation" else "Reviewed"
            })

    # 2. Generate for SY 2026-2027: 600 unique students * 3 terms = 1800 term records
    # Baseline progression with lower ARAL caseload and higher stability
    sy_2026_students = 600
    for i in range(1, sy_2026_students + 1):
        learner_id = f"CNHS-SYN-2627-{i:04d}"
        grade_level = GRADE_LEVELS[i % len(GRADE_LEVELS)]
        
        # In SY 2026-2027: 22% struggling baseline, 40% moderate, 38% high performers
        profile_choice = rng.choice(["high_risk", "moderate_risk", "low_risk"], p=[0.22, 0.40, 0.38])
        
        if profile_choice == "high_risk":
            base_ability = rng.uniform(66, 74)
            lang_bias = rng.uniform(-3.5, -0.5)
            math_bias = rng.uniform(-2.5, 0.5)
        elif profile_choice == "moderate_risk":
            base_ability = rng.uniform(76, 84)
            lang_bias = rng.uniform(-1.5, 1.5)
            math_bias = rng.uniform(-1.0, 1.5)
        else:
            base_ability = rng.uniform(86, 95)
            lang_bias = rng.uniform(0.5, 3.5)
            math_bias = rng.uniform(0.5, 3.5)

        aral_enrolled = False
        aral_tier = None
        remedial_enrolled = False
        remedial_subject = None

        if profile_choice == "high_risk" and i <= 140:
            aral_enrolled = True
            aral_tier = "Basic" if i <= 80 else "Plus"
        elif profile_choice == "moderate_risk" and i > 140 and i <= 230:
            remedial_enrolled = True
            remedial_subject = rng.choice(["Araling Panlipunan", "TLE", "Science", "Mathematics"])

        for term_idx, term_name in enumerate(TERMS, start=1):
            term_grades = {}
            term_noise = 3.8
            
            for subj in SUBJECTS:
                jitter = rng.normal(0, term_noise)
                if subj in ("english_grade", "filipino_grade"):
                    jitter += lang_bias
                elif subj == "mathematics_grade":
                    jitter += math_bias
                
                recovery_boost = 0.0
                if term_idx > 1 and aral_enrolled and subj in ("english_grade", "filipino_grade"):
                    boost_rate = rng.uniform(3.5, 7.0) if aral_tier == "Basic" else rng.uniform(4.5, 8.0)
                    recovery_boost = boost_rate * (term_idx - 1)
                elif term_idx > 1 and remedial_enrolled:
                    recovery_boost = rng.uniform(3.0, 6.0) * (term_idx - 1)

                val = _clip_grade(base_ability + jitter + recovery_boost)
                term_grades[subj] = val

            if rng.random() < 0.03:
                drop_subj = rng.choice(SUBJECTS)
                term_grades[drop_subj] = None

            present_grades = [v for v in term_grades.values() if v is not None]
            gwa = float(np.mean(present_grades)) if present_grades else 75.0
            failing_subjs = [s for s, g in term_grades.items() if g is not None and g < 75.0]
            lang_fails = sum(1 for s in failing_subjs if s in ("english_grade", "filipino_grade"))
            non_lang_fails = len(failing_subjs) - lang_fails
            lowest_g = min(present_grades) if present_grades else 75.0
            weak_s = min(term_grades, key=lambda k: term_grades[k] if term_grades[k] is not None else 999).replace("_grade", "").replace("_", " ").title()

            if len(failing_subjs) >= 2 or lowest_g < 70 or gwa < 75.0:
                risk_level = LABEL_HIGH
            elif len(failing_subjs) == 1 or (lowest_g < 75.0 and gwa < 82.0) or (75.0 <= gwa <= 83.5):
                risk_level = LABEL_MODERATE
            else:
                risk_level = LABEL_LOW

            if aral_enrolled:
                intervention_pathway = "ARAL Program (RA 12028)"
                placement_tier = aral_tier
                reading_level = "Frustration" if aral_tier == "Basic" else "Instructional"
                assessment_type = "Phil-IRI BOSY English"
                
                beg_score = round(float(rng.uniform(14.0, 24.0) if aral_tier == "Basic" else rng.uniform(20.0, 29.0)), 1)
                mid_score = round(float(np.clip(beg_score + rng.uniform(4.0, 9.0), 18.0, 37.0)), 1)
                end_score = round(float(np.clip(mid_score + rng.uniform(5.0, 10.0), 22.0, 40.0)), 1)
                
                if term_idx == 1:
                    att_rate = round(float(rng.normal(72.0, 4.0)), 1)
                elif term_idx == 2:
                    att_rate = round(float(rng.normal(68.5, 4.0)), 1)
                else:
                    att_rate = round(float(rng.normal(63.0, 4.5)), 1)
                att_rate = float(np.clip(att_rate, 45.0, 99.0))

                promoted = (end_score >= 26.0) if aral_tier == "Basic" else (end_score >= 28.0)
                outcome = "Promoted" if promoted else "Retained"
                progress = "Improved" if promoted else "Progressing"
                status = "Completed / Exited" if (term_idx == 3 and promoted) else ("Retained in Program" if term_idx == 3 else "In Progress")

            elif remedial_enrolled or (risk_level in (LABEL_HIGH, LABEL_MODERATE) and non_lang_fails > 0):
                intervention_pathway = "Classroom Remediation"
                placement_tier = "N/A"
                reading_level = "N/A"
                assessment_type = f"{weak_s} Diagnostic Assessment"
                
                beg_score = round(float(rng.uniform(16.0, 26.0)), 1)
                mid_score = round(float(np.clip(beg_score + rng.uniform(5.0, 8.0), 20.0, 36.0)), 1)
                end_score = round(float(np.clip(mid_score + rng.uniform(4.0, 9.0), 24.0, 40.0)), 1)
                att_rate = round(float(np.clip(rng.normal(82.0, 4.5), 60.0, 100.0)), 1)
                
                outcome = "Improved" if end_score >= 28.0 else "Needs Further Intervention"
                progress = "Improved" if end_score >= 28.0 else "Limited Improvement"
                status = "Completed" if (term_idx == 3 and outcome == "Improved") else ("Needs Further Support" if term_idx == 3 else "In Progress")

            else:
                intervention_pathway = "No Recommendation"
                placement_tier = "N/A"
                reading_level = "Independent" if risk_level == LABEL_LOW else "Instructional"
                assessment_type = "Classroom Summative"
                beg_score = None
                mid_score = None
                end_score = None
                att_rate = round(float(np.clip(rng.normal(94.0, 3.5), 80.0, 100.0)), 1)
                outcome = "N/A"
                progress = "N/A"
                status = "Active"

            records.append({
                "learner_id": learner_id,
                "school_year": "SY 2026-2027",
                "grade_level": grade_level,
                "term": term_name,
                "english_grade": term_grades["english_grade"],
                "filipino_grade": term_grades["filipino_grade"],
                "mathematics_grade": term_grades["mathematics_grade"],
                "science_grade": term_grades["science_grade"],
                "mapeh_grade": term_grades["mapeh_grade"],
                "araling_panlipunan_grade": term_grades["araling_panlipunan_grade"],
                "tle_grade": term_grades["tle_grade"],
                "values_education_grade": term_grades["values_education_grade"],
                "general_average": round(gwa, 2),
                "failing_subject_count": len(failing_subjs),
                "language_fail_count": lang_fails,
                "non_language_fail_count": non_lang_fails,
                "lowest_grade": round(lowest_g, 1),
                "available_grade_count": len(present_grades),
                "weak_subject": weak_s,
                "risk_level": risk_level,
                "intervention_pathway": intervention_pathway,
                "aral_placement_tier": placement_tier,
                "reading_level": reading_level,
                "assessment_type": assessment_type,
                "beginning_assessment": beg_score,
                "middle_assessment": mid_score if term_idx >= 2 else None,
                "end_assessment": end_score if term_idx == 3 else None,
                "attendance_rate": att_rate,
                "movement_outcome": outcome if term_idx == 3 else "In Progress",
                "progress_result": progress if term_idx == 3 else "Progressing",
                "intervention_status": status,
                "principal_review_status": "Approved" if intervention_pathway != "No Recommendation" else "Reviewed"
            })

    df = pd.DataFrame(records)

    # Aggregate CNHS Reference Table
    cnhs_benchmark_data = [
        {
            "school_year": "SY 2025-2026",
            "tier": "ARAL Basic",
            "beginning_enrolled": 129,
            "end_enrolled": 120,
            "retained": 19,
            "promoted": 101,
            "promotion_percentage": 78.29,
            "attendance_september": 65.82,
            "attendance_october": 64.34,
            "attendance_november": 54.67,
            "data_type": "Official CNHS Verified Aggregate Reference"
        },
        {
            "school_year": "SY 2025-2026",
            "tier": "ARAL Plus",
            "beginning_enrolled": 86,
            "end_enrolled": 81,
            "retained": 7,
            "promoted": 74,
            "promotion_percentage": 86.05,
            "attendance_september": 65.75,
            "attendance_october": 56.35,
            "attendance_november": 51.11,
            "data_type": "Official CNHS Verified Aggregate Reference"
        },
        {
            "school_year": "SY 2025-2026",
            "tier": "Total ARAL Cohort",
            "beginning_enrolled": 215,
            "end_enrolled": 201,
            "retained": 26,
            "promoted": 175,
            "promotion_percentage": 81.40,
            "attendance_september": 65.79,
            "attendance_october": 60.35,
            "attendance_november": 52.89,
            "data_type": "Official CNHS Verified Aggregate Reference"
        }
    ]
    df_benchmark = pd.DataFrame(cnhs_benchmark_data)

    return df, df_benchmark


def main():
    parser = argparse.ArgumentParser(description="Generate CNHS LEARN Synthetic Historical Dataset")
    parser.add_argument("--out-dir", type=str, default=str(ROOT.parent / "data" / "synthetic"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Generating synthetic historical learner dataset & CNHS reference benchmarks...")
    df_full, df_benchmark = generate_synthetic_records(args.seed)

    # 1. Master Historical CSV
    master_csv = out_dir / "CNHS_LEARN_Synthetic_Historical_Learners.csv"
    df_full.to_csv(master_csv, index=False)
    print(f"-> Saved master longitudinal dataset: {master_csv} ({len(df_full)} records)")

    # 2. Random Forest Training Dataset (13 academic features + target risk_level only)
    rf_cols = list(FEATURE_NAMES) + ["risk_level"]
    df_rf = df_full[rf_cols].copy()
    df_rf["risk_label"] = df_rf["risk_level"]
    for col in FEATURE_NAMES:
        df_rf[col] = df_rf[col].fillna(-1.0)
    
    rf_csv = out_dir / "CNHS_LEARN_RF_Training_Dataset.csv"
    df_rf.to_csv(rf_csv, index=False)
    print(f"-> Saved Random Forest training dataset: {rf_csv} ({len(df_rf)} records)")

    # Sync to ml-service/data/ecr_training.csv for model training
    ecr_train_csv = ROOT / "data" / "ecr_training.csv"
    ecr_train_csv.parent.mkdir(parents=True, exist_ok=True)
    df_rf.to_csv(ecr_train_csv, index=False)
    print(f"-> Synced to ML Service training path: {ecr_train_csv}")

    # 3. Formatted Multi-Sheet Excel Workbook
    master_xlsx = out_dir / "CNHS_LEARN_Synthetic_Historical_Learners.xlsx"
    with pd.ExcelWriter(master_xlsx, engine="openpyxl") as writer:
        df_full.to_excel(writer, sheet_name="All_Historical_Records", index=False)
        df_full[df_full["school_year"] == "SY 2025-2026"].to_excel(writer, sheet_name="SY_2025_2026", index=False)
        df_full[df_full["school_year"] == "SY 2026-2027"].to_excel(writer, sheet_name="SY_2026_2027", index=False)
        df_benchmark.to_excel(writer, sheet_name="CNHS_Official_Aggregate_Ref", index=False)
        df_rf.to_excel(writer, sheet_name="RF_Model_Training_Features", index=False)
    print(f"-> Saved multi-sheet Excel workbook: {master_xlsx}")

    # 4. Generate Comprehensive README.md
    readme_path = out_dir / "README.md"
    readme_content = f"""# CNHS LEARN — Synthetic Historical Learner Dataset & Reference Benchmarks
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
1. `CNHS_LEARN_Synthetic_Historical_Learners.csv` — Full longitudinal master dataset with assessments, placement tiers, and outcomes ({len(df_full):,} records).
2. `CNHS_LEARN_RF_Training_Dataset.csv` — Exact 13-feature input vector + target column for `train_model.py`.
3. `CNHS_LEARN_Synthetic_Historical_Learners.xlsx` — Formatted multi-tab Excel workbook with official CNHS aggregate benchmarks.
4. `README.md` — This documentation file.
"""
    readme_path.write_text(readme_content, encoding="utf-8")
    print(f"-> Saved README documentation: {readme_path}")
    print("\nSynthetic dataset generation completed successfully!")


if __name__ == "__main__":
    main()
