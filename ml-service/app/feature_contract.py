"""
ECR-only feature contract — must match lib/services/recommendation/features.js

Model B (PRODUCTION):
  - Labels: official GWA grade bands (computed separately, NOT an RF input)
  - Features: 8 official subject grades + academic indicators — NO general_average
  - MAPEH: consolidated official grade only (not Music/Arts/PE/Health)

Attendance / SF2 must NEVER appear in this vector.
Missing values use sentinel -1 (same as the Next.js featureList).
"""

from __future__ import annotations

from typing import Any

# Exact order and names from features.js RF_FEATURE_NAMES (Model B).
FEATURE_NAMES: list[str] = [
    "english_grade",
    "filipino_grade",
    "mathematics_grade",
    "science_grade",
    "mapeh_grade",
    "araling_panlipunan_grade",
    "tle_grade",
    "values_education_grade",
    "failing_subject_count",
    "language_fail_count",
    "non_language_fail_count",
    "lowest_grade",
    "available_grade_count",
]

# Kept for documentation / CSV labeling only — never in FEATURE_NAMES.
LABEL_SOURCE_COLUMN = "general_average"

MISSING_SENTINEL = -1.0

LABEL_LOW = "Low Risk"
LABEL_MODERATE = "Moderate Risk"
LABEL_HIGH = "High Risk"

RISK_CLASSES = [LABEL_HIGH, LABEL_MODERATE, LABEL_LOW]


def risk_label_from_gwa(gwa: float | None) -> str | None:
    """Map General Average to official 3-class risk label (labeling only)."""
    if gwa is None:
        return None
    try:
        n = float(gwa)
    except (TypeError, ValueError):
        return None
    if n < 75:
        return LABEL_HIGH
    if n <= 84:
        return LABEL_MODERATE
    return LABEL_LOW


def descriptor_from_grade(grade: float) -> str:
    if grade >= 90:
        return "Outstanding"
    if grade >= 85:
        return "Very Satisfactory"
    if grade >= 80:
        return "Satisfactory"
    if grade >= 75:
        return "Fairly Satisfactory"
    return "Did Not Meet Expectations"


def to_feature_list(
    features: dict[str, Any] | None = None,
    feature_list: list[float] | None = None,
    feature_names: list[str] | None = None,
) -> list[float]:
    """Build dense feature vector aligned with FEATURE_NAMES (Model B).

    Ignores general_average and MAPEH component subjects even if sent.
    """
    if feature_list is not None and feature_names:
        name_to_value = {
            str(n): feature_list[i] if i < len(feature_list) else None
            for i, n in enumerate(feature_names)
        }
        out: list[float] = []
        for name in FEATURE_NAMES:
            value = name_to_value.get(name)
            if value is None:
                out.append(MISSING_SENTINEL)
            else:
                try:
                    out.append(float(value))
                except (TypeError, ValueError):
                    out.append(MISSING_SENTINEL)
        return out

    if feature_list is not None and len(feature_list) == len(FEATURE_NAMES):
        return [MISSING_SENTINEL if v is None else float(v) for v in feature_list]

    src = dict(features or {})
    src.pop("general_average", None)

    out = []
    for name in FEATURE_NAMES:
        value = src.get(name)
        if value is None:
            out.append(MISSING_SENTINEL)
        else:
            try:
                out.append(float(value))
            except (TypeError, ValueError):
                out.append(MISSING_SENTINEL)
    return out
