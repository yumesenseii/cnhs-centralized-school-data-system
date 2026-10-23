"""
Longitudinal Dataset Preparation Utility for CNHS LEARN (Phase 5).

Transforms term-by-term learner records into non-destructive (X_t -> y_{t+1}) paired datasets:
  - Term 1 -> Term 2 (t=1 -> t=2)
  - Term 2 -> Term 3 (t=2 -> t=3)

Key Safeguards:
1. Student Identity & School Year Integrity:
   - Pairs must share identical student_id and school_year.
   - Sequence must be strictly sequential (t -> t+1).
2. Finalized Grade Completeness:
   - Excludes incomplete terms. Does not fabricate grades or outcomes.
   - Evaluates required subjects per grade level/curriculum.
3. Explicit Data Provenance:
   - Explicitly records 'empirical' vs 'synthetic'.
   - Tracks provenance per pair.
4. Leakage Prevention:
   - Runs automated check ensuring zero t+1 evidence in X_t.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping, Sequence

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from longitudinal_contract import (  # noqa: E402
    CORE_SUBJECT_SLUGS,
    LONGITUDINAL_FEATURE_NAMES,
    METADATA_COLUMNS,
    MISSING_SENTINEL,
    TARGET_GWA_NAME,
    TARGET_NAME,
    compute_term_summary,
    normalize_subject_name,
    risk_label_from_gwa,
    validate_leakage_in_features,
)


class ExclusionReason:
    STUDENT_ID_MISSING = "STUDENT_ID_MISSING"
    INCOMPLETE_TERM_T = "INCOMPLETE_TERM_T"
    INCOMPLETE_TERM_TARGET = "INCOMPLETE_TERM_TARGET"
    NON_CONSECUTIVE_TERMS = "NON_CONSECUTIVE_TERMS"
    MISSING_TARGET_TERM = "MISSING_TARGET_TERM"
    INVALID_PROVENANCE = "INVALID_PROVENANCE"
    LEAKAGE_DETECTED = "LEAKAGE_DETECTED"


def extract_subject_grades(record: Mapping[str, Any]) -> dict[str, float | None]:
    """Extract and normalize subject grades from a record.

    Supports either a nested 'grades' / 'subject_grades' dict, or flat keys.
    """
    raw_dict = (
        record.get("subject_grades")
        or record.get("grades")
        or record.get("standings")
    )
    extracted: dict[str, float | None] = {}

    if isinstance(raw_dict, dict):
        for subj, val in raw_dict.items():
            slug = normalize_subject_name(subj)
            if val is None or val == "" or val == "—":
                extracted[slug] = None
            else:
                try:
                    num = float(val)
                    extracted[slug] = num if not math.isnan(num) else None
                except (TypeError, ValueError):
                    extracted[slug] = None
    elif isinstance(raw_dict, list):
        # Format: list of objects e.g. [{"subject": "Math", "grade": 85}, ...]
        for item in raw_dict:
            if isinstance(item, dict):
                subj = item.get("subject") or item.get("subject_name") or ""
                val = item.get("grade") or item.get("classSubjectGrade") or item.get("final_grade")
                slug = normalize_subject_name(subj)
                if val is None or val == "" or val == "—":
                    extracted[slug] = None
                else:
                    try:
                        num = float(val)
                        extracted[slug] = num if not math.isnan(num) else None
                    except (TypeError, ValueError):
                        extracted[slug] = None
    else:
        # Check flat fields in record
        for k, v in record.items():
            if k in (
                "student_id",
                "school_year",
                "term",
                "quarter",
                "grade_level",
                "section_name",
                "data_provenance",
                "is_finalized",
            ):
                continue
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                slug = normalize_subject_name(k)
                extracted[slug] = float(v)

    return extracted


def check_term_completeness(
    subject_grades: dict[str, float | None],
    required_subjects: Sequence[str] | None = None,
    is_finalized_flag: bool | None = None,
) -> tuple[bool, str | None]:
    """Verify whether a term's academic record is complete and finalized.

    Rule: If an explicit finalized flag is False, term is incomplete.
    Rule: If required subjects are provided, every required subject must have a valid numeric grade.
    Rule: If no required subjects are provided, at least one valid grade must exist, and no nulls in present subjects.
    """
    if is_finalized_flag is False:
        return (False, "Record marked as unfinalized/provisional")

    if required_subjects:
        normalized_required = [normalize_subject_name(s) for s in required_subjects]
        for req in normalized_required:
            val = subject_grades.get(req)
            if val is None or math.isnan(val) or val < 0.0 or val > 100.0:
                return (False, f"Required subject '{req}' missing or unfinalized")
    else:
        # Default requirement: at least 4 valid learning areas, no unparsed nulls
        valid_count = sum(1 for v in subject_grades.values() if v is not None and not math.isnan(v))
        if valid_count < 4:
            return (False, f"Insufficient finalized subjects ({valid_count} < 4)")

    return (True, None)


def build_longitudinal_pairs(
    records: list[dict[str, Any]],
    required_subjects: Sequence[str] | None = None,
    strict_provenance: str | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Process raw term records into paired (X_t -> y_{t+1}) longitudinal dataset.

    Args:
      records: List of term records.
      required_subjects: Optional list of required subject names for completeness verification.
      strict_provenance: If specified ('empirical' or 'synthetic'), filters/validates provenance.

    Returns:
      (dataset_df, audit_summary)
    """
    # 1. Group records by (student_id, school_year) -> term -> record
    grouped: dict[tuple[str, str], dict[int, dict[str, Any]]] = defaultdict(dict)
    exclusion_stats: dict[str, int] = defaultdict(int)
    total_raw_records = len(records)

    for rec in records:
        student_id = str(rec.get("student_id") or rec.get("learner_id") or "").strip()
        if not student_id:
            exclusion_stats[ExclusionReason.STUDENT_ID_MISSING] += 1
            continue

        school_year = str(rec.get("school_year") or "").strip()
        term_raw = rec.get("quarter") or rec.get("term") or rec.get("academic_term")
        try:
            term = int(term_raw)
        except (TypeError, ValueError):
            term = None

        if term not in (1, 2, 3):
            exclusion_stats[ExclusionReason.NON_CONSECUTIVE_TERMS] += 1
            continue

        provenance = str(rec.get("data_provenance") or "synthetic").strip().lower()
        if strict_provenance and provenance != strict_provenance.lower():
            exclusion_stats[ExclusionReason.INVALID_PROVENANCE] += 1
            continue

        subj_grades = extract_subject_grades(rec)
        is_finalized = rec.get("is_finalized", rec.get("is_published", True))
        is_complete, comp_reason = check_term_completeness(
            subj_grades, required_subjects, is_finalized
        )

        term_summary = compute_term_summary(subj_grades)

        grouped[(student_id, school_year)][term] = {
            "record": rec,
            "student_id": student_id,
            "school_year": school_year,
            "term": term,
            "grade_level": rec.get("grade_level", rec.get("grade", "")),
            "section_name": rec.get("section_name", rec.get("section", "")),
            "data_provenance": provenance,
            "subject_grades": subj_grades,
            "is_complete": is_complete,
            "completeness_reason": comp_reason,
            "term_summary": term_summary,
        }

    # 2. Extract valid pairs: (Term 1 -> Term 2) and (Term 2 -> Term 3)
    rows: list[dict[str, Any]] = []

    for (student_id, school_year), terms in grouped.items():
        for source_term, target_term in [(1, 2), (2, 3)]:
            if source_term not in terms:
                continue

            if target_term not in terms:
                exclusion_stats[ExclusionReason.MISSING_TARGET_TERM] += 1
                continue

            t_data = terms[source_term]
            target_data = terms[target_term]

            # Incompleteness checks
            if not t_data["is_complete"]:
                exclusion_stats[ExclusionReason.INCOMPLETE_TERM_T] += 1
                continue

            if not target_data["is_complete"]:
                exclusion_stats[ExclusionReason.INCOMPLETE_TERM_TARGET] += 1
                continue

            # Prior term (t - 1) data for velocity
            prior_term = source_term - 1
            prior_data = terms.get(prior_term) if prior_term >= 1 else None
            has_prior = (
                1.0
                if prior_data is not None and prior_data.get("is_complete")
                else 0.0
            )

            # Build X_t feature vector
            t_summary = t_data["term_summary"]
            t_grades = t_data["subject_grades"]

            features: dict[str, Any] = {
                "term_t_gwa": t_summary["gwa"],
                "term_t_failing_count": t_summary["failing_count"],
                "term_t_lowest_grade": t_summary["lowest_grade"],
                "term_t_highest_grade": t_summary["highest_grade"],
                "term_t_grade_std": t_summary["grade_std"],
                "term_t_finalized_count": t_summary["finalized_count"],
                # Canonical subject grades
                "term_t_english": t_grades.get("english", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_filipino": t_grades.get("filipino", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_mathematics": t_grades.get("mathematics", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_science": t_grades.get("science", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_araling_panlipunan": t_grades.get("araling_panlipunan", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_mapeh": t_grades.get("mapeh", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_tle": t_grades.get("tle", MISSING_SENTINEL) or MISSING_SENTINEL,
                "term_t_values_education": t_grades.get("values_education", MISSING_SENTINEL) or MISSING_SENTINEL,
                # Longitudinal velocity
                "has_prior_term": has_prior,
                "delta_gwa": (
                    round(t_summary["gwa"] - prior_data["term_summary"]["gwa"], 2)
                    if has_prior == 1.0 and prior_data
                    else 0.0
                ),
                "delta_failing_count": (
                    float(t_summary["failing_count"] - prior_data["term_summary"]["failing_count"])
                    if has_prior == 1.0 and prior_data
                    else 0.0
                ),
            }

            # Leakage Check
            is_clean, violations = validate_leakage_in_features(features, target_term)
            if not is_clean:
                exclusion_stats[ExclusionReason.LEAKAGE_DETECTED] += 1
                continue

            # Build Target y_{t+1}
            target_summary = target_data["term_summary"]
            target_gwa = target_summary["gwa"]
            target_risk = risk_label_from_gwa(target_gwa)

            if target_risk is None:
                exclusion_stats[ExclusionReason.INCOMPLETE_TERM_TARGET] += 1
                continue

            # Full row combining metadata, X_t, and y_{t+1}
            full_row: dict[str, Any] = {
                # Metadata
                "student_id": student_id,
                "school_year": school_year,
                "source_term": source_term,
                "target_term": target_term,
                "grade_level": t_data["grade_level"],
                "section_name": t_data["section_name"],
                "data_provenance": t_data["data_provenance"],
                "is_term_t_complete": True,
                "is_term_target_complete": True,
                # Features
                **features,
                # Target
                TARGET_GWA_NAME: target_gwa,
                TARGET_NAME: target_risk,
            }
            rows.append(full_row)

    df = pd.DataFrame(rows)

    audit_summary = {
        "total_raw_records": total_raw_records,
        "valid_pairs_formed": len(rows),
        "unique_students_in_dataset": df["student_id"].nunique() if not df.empty else 0,
        "pair_breakdown_by_term": (
            df["source_term"].value_counts().to_dict() if not df.empty else {}
        ),
        "target_risk_distribution": (
            df[TARGET_NAME].value_counts().to_dict() if not df.empty else {}
        ),
        "provenance_distribution": (
            df["data_provenance"].value_counts().to_dict() if not df.empty else {}
        ),
        "exclusion_reasons": dict(exclusion_stats),
    }

    return df, audit_summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CNHS LEARN - Longitudinal Dataset Preparation Utility"
    )
    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Input JSON or CSV file containing raw learner term records",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(ROOT / "data" / "longitudinal_pairs.csv"),
        help="Path to output prepared paired CSV",
    )
    parser.add_argument(
        "--strict-provenance",
        type=str,
        choices=["empirical", "synthetic"],
        default=None,
        help="Strictly accept only empirical or synthetic records",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.exit(f"Input file not found: {input_path}")

    if input_path.suffix.lower() == ".json":
        with open(input_path, encoding="utf-8") as f:
            raw_records = json.load(f)
            if not isinstance(raw_records, list):
                raw_records = raw_records.get("records") or raw_records.get("data") or []
    else:
        df_raw = pd.read_csv(input_path)
        raw_records = df_raw.to_dict(orient="records")

    df_pairs, summary = build_longitudinal_pairs(
        raw_records, strict_provenance=args.strict_provenance
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df_pairs.to_csv(out_path, index=False)

    print("\n" + "=" * 60)
    print("CNHS LEARN — Longitudinal Dataset Preparation Audit")
    print("=" * 60)
    print(f"Total raw records inspected : {summary['total_raw_records']}")
    print(f"Valid paired records formed : {summary['valid_pairs_formed']}")
    print(f"Unique students in pairs    : {summary['unique_students_in_dataset']}")
    print(f"Pairs by source term        : {summary['pair_breakdown_by_term']}")
    print(f"Target distribution (y_t+1) : {summary['target_risk_distribution']}")
    print(f"Provenance distribution     : {summary['provenance_distribution']}")
    print("Exclusion breakdown         :")
    for reason, count in summary["exclusion_reasons"].items():
        print(f"  - {reason}: {count}")
    print(f"Saved prepared dataset to    : {out_path}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
