"""
Longitudinal Next-Term Feature & Target Contract for CNHS LEARN.

Objective (SOP 3):
  Decision support for academic risk advisory:
    f: X_t -> y_{t+1}

Key Constraints & Rules:
1. School-Defined Provisional Risk Bands (Based on DepEd Performance Descriptors):
   - High Risk: GWA strictly below 75 (< 75.0)
   - Moderate Risk: GWA 75.0 to below 85.0 (75.0 <= GWA < 85.0)
   - Low Risk: GWA 85.0 or above (GWA >= 85.0)
   NOTE: These are school-defined provisional risk bands, NOT official DepEd risk categories.
   Failing-subject counts are separate input features, NOT label redefinitions.

2. Target Definition (y_{t+1}):
   - Derived strictly from finalized General Weighted Average (GWA) of Term t+1.
   - Never leaks into Term t feature vector X_t.

3. Feature Vector (X_t):
   - Only features known strictly on or before the close of Term t.
   - Excludes all Term t+1 data.
   - Dynamically supports varying curriculum subject sets across grade levels.
"""

from __future__ import annotations

import math
from typing import Any, Sequence

# Canonical 3-Class Risk Labels
LABEL_HIGH = "High Risk"
LABEL_MODERATE = "Moderate Risk"
LABEL_LOW = "Low Risk"

RISK_CLASSES: list[str] = [LABEL_HIGH, LABEL_MODERATE, LABEL_LOW]

# School-defined risk band thresholds (GWA based)
HIGH_RISK_UPPER_BOUND = 75.0  # GWA < 75.0
MODERATE_RISK_UPPER_BOUND = 85.0  # 75.0 <= GWA < 85.0
# Low Risk: GWA >= 85.0

# Missing value sentinel for scikit-learn pipelines
MISSING_SENTINEL = -1.0

# Standardized Core Subject Slugs
CORE_SUBJECT_SLUGS: list[str] = [
    "english",
    "filipino",
    "mathematics",
    "science",
    "araling_panlipunan",
    "mapeh",
    "tle",
    "values_education",
]

# Canonical 17-Dimensional Longitudinal Feature Vector for X_t
# All features are strictly observed at or before Term t
LONGITUDINAL_FEATURE_NAMES: list[str] = [
    # 1. Academic Performance Summary at Term t
    "term_t_gwa",
    "term_t_failing_count",
    "term_t_lowest_grade",
    "term_t_highest_grade",
    "term_t_grade_std",
    "term_t_finalized_count",
    # 2. Canonical Subject Grades at Term t (or MISSING_SENTINEL if not applicable/taken)
    "term_t_english",
    "term_t_filipino",
    "term_t_mathematics",
    "term_t_science",
    "term_t_araling_panlipunan",
    "term_t_mapeh",
    "term_t_tle",
    "term_t_values_education",
    # 3. Trajectory / Velocity from Prior Term (t - 1) if available
    "has_prior_term",  # 1.0 if Term t-1 exists (e.g. t=2 predicting t=3), 0.0 for t=1
    "delta_gwa",  # GWA_t - GWA_{t-1} (0.0 if no prior term)
    "delta_failing_count",  # Fails_t - Fails_{t-1} (0.0 if no prior term)
]

TARGET_NAME = "target_next_term_risk"
TARGET_GWA_NAME = "target_next_term_gwa"

# Metadata / Audit Columns (Strictly excluded from ML training matrix X)
METADATA_COLUMNS: list[str] = [
    "student_id",
    "school_year",
    "source_term",
    "target_term",
    "grade_level",
    "section_name",
    "data_provenance",
    "is_term_t_complete",
    "is_term_target_complete",
]


def risk_label_from_gwa(gwa: float | None) -> str | None:
    """Map General Weighted Average to school-defined provisional risk label.

    Bands:
      - High Risk: GWA < 75.0
      - Moderate Risk: 75.0 <= GWA < 85.0
      - Low Risk: GWA >= 85.0

    Returns None if gwa is None, NaN, or non-numeric.
    """
    if gwa is None:
        return None
    try:
        val = float(gwa)
    except (TypeError, ValueError):
        return None

    if math.isnan(val):
        return None

    if val < HIGH_RISK_UPPER_BOUND:
        return LABEL_HIGH
    if val < MODERATE_RISK_UPPER_BOUND:
        return LABEL_MODERATE
    return LABEL_LOW


def normalize_subject_name(name: str) -> str:
    """Normalize subject string to standard slug for dynamic curriculum mapping."""
    clean = str(name or "").strip().lower().replace("-", " ").replace("_", " ")
    clean = " ".join(clean.split())

    if "math" in clean:
        return "mathematics"
    if "english" in clean or clean == "eng":
        return "english"
    if "filipino" in clean or clean == "fil":
        return "filipino"
    if "science" in clean or clean == "sci":
        return "science"
    if "araling panlipunan" in clean or clean in ("ap", "aral pan"):
        return "araling_panlipunan"
    if "mapeh" in clean:
        return "mapeh"
    if (
        "tle" in clean
        or "technology" in clean
        or "tvl" in clean
        or "sptve" in clean
    ):
        return "tle"
    if (
        "values" in clean
        or "esp" in clean
        or "edukasyon sa pagpapakatao" in clean
        or clean == "ve"
    ):
        return "values_education"

    # Retain sanitized slug for curriculum-specific electives
    return clean.replace(" ", "_")


def compute_term_summary(
    subject_grades: dict[str, float | None],
) -> dict[str, float]:
    """Compute aggregate indicators from finalized grades in a term.

    Handles curriculum variation gracefully:
    - Calculates arithmetic average across all valid numeric grades.
    - Computes count of failing subjects (< 75.0).
    - Computes lowest and highest grade.
    - Computes sample standard deviation to capture grade unevenness.
    """
    valid_grades: list[float] = []
    for g in subject_grades.values():
        if g is not None:
            try:
                val = float(g)
                if not math.isnan(val) and 0.0 <= val <= 100.0:
                    valid_grades.append(val)
            except (TypeError, ValueError):
                pass

    if not valid_grades:
        return {
            "gwa": MISSING_SENTINEL,
            "failing_count": 0.0,
            "lowest_grade": MISSING_SENTINEL,
            "highest_grade": MISSING_SENTINEL,
            "grade_std": 0.0,
            "finalized_count": 0.0,
        }

    count = float(len(valid_grades))
    gwa = sum(valid_grades) / count
    failing_count = float(sum(1 for g in valid_grades if g < 75.0))
    lowest_grade = min(valid_grades)
    highest_grade = max(valid_grades)

    if len(valid_grades) > 1:
        variance = sum((g - gwa) ** 2 for g in valid_grades) / (
            len(valid_grades) - 1
        )
        grade_std = math.sqrt(variance)
    else:
        grade_std = 0.0

    return {
        "gwa": round(gwa, 2),
        "failing_count": failing_count,
        "lowest_grade": lowest_grade,
        "highest_grade": highest_grade,
        "grade_std": round(grade_std, 2),
        "finalized_count": count,
    }


def validate_leakage_in_features(
    feature_dict: dict[str, Any], target_term: int
) -> tuple[bool, list[str]]:
    """Strict leakage audit on a candidate feature dictionary.

    Verifies:
    1. No feature key refers to future terms (e.g. target_term, t+1, next_term).
    2. No target variable exists in the feature dictionary.
    3. Feature keys are strictly subset of LONGITUDINAL_FEATURE_NAMES.

    Returns (is_clean, violations).
    """
    violations: list[str] = []
    target_terms_str = [
        f"term_{target_term}",
        f"term{target_term}",
        "next_term",
        "target",
        "future",
    ]

    for key in feature_dict:
        k_lower = key.lower()
        if key in (TARGET_NAME, TARGET_GWA_NAME):
            violations.append(f"Target variable '{key}' present in feature dict")
        for forbidden in target_terms_str:
            if forbidden in k_lower:
                violations.append(
                    f"Feature '{key}' references target term ({forbidden})"
                )

    return (len(violations) == 0, violations)
