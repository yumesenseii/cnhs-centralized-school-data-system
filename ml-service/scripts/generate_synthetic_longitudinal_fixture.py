"""
Generate Clearly Labeled Synthetic Longitudinal Fixtures for Offline Testing.

Purpose:
  Provides a reproducible, synthetic test fixture with explicit data_provenance="synthetic"
  to test the longitudinal data preparation pipeline, GroupKFold cross-validation,
  leakage detection, and baseline comparisons WITHOUT accessing production student records.

IMPORTANT:
  Every generated record is explicitly tagged with data_provenance="synthetic".
  This fixture is for software engineering and pipeline validation only.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent

SUBJECT_LIST = [
    "english",
    "filipino",
    "mathematics",
    "science",
    "araling_panlipunan",
    "mapeh",
    "tle",
    "values_education",
]


def generate_synthetic_cohort(
    num_students: int = 100, seed: int = 42
) -> list[dict]:
    """Generate synthetic 3-term student records with realistic transitions.

    Includes edge cases:
    - 85% complete 3-term trajectories
    - 10% incomplete terms (missing subjects or unfinalized flags)
    - 5% partial terms (e.g. only Term 1, dropped out or transferred)
    """
    rng = np.random.default_rng(seed)
    records: list[dict] = []

    for i in range(1, num_students + 1):
        student_id = f"SYN-STU-{i:04d}"
        grade_level = int(rng.choice([7, 8, 9, 10]))
        section_name = f"G{grade_level}-Section{chr(65 + (i % 4))}"
        school_year = "2025-2026"

        # Baseline latent academic ability (60 to 95)
        # 20% high risk baseline (<75), 45% moderate (75-84), 35% low (>=85)
        cluster = rng.choice(["high", "moderate", "low"], p=[0.20, 0.45, 0.35])
        if cluster == "high":
            latent_ability = rng.uniform(65.0, 74.0)
        elif cluster == "moderate":
            latent_ability = rng.uniform(76.0, 83.0)
        else:
            latent_ability = rng.uniform(86.0, 93.0)

        # Subject-specific personal affinities (e.g. stronger in Filipino, weaker in Math)
        affinities = {
            subj: float(rng.normal(0.0, 3.5)) for subj in SUBJECT_LIST
        }

        # Trajectory slope across terms (most students stay consistent, some improve, some decline)
        trajectory_drift = float(rng.normal(0.0, 1.5))

        for term in [1, 2, 3]:
            # Edge case 1: Incomplete student (dropped out after term 1)
            if i % 20 == 0 and term > 1:
                continue

            term_ability = latent_ability + (term - 1) * trajectory_drift
            term_grades: dict[str, float | None] = {}

            # Edge case 2: Unfinalized term (missing one subject or unfinalized flag)
            has_missing_subject = (i % 15 == 0 and term == 2)

            for subj_idx, subj in enumerate(SUBJECT_LIST):
                if has_missing_subject and subj == "tle":
                    term_grades[subj] = None
                    continue

                raw_grade = term_ability + affinities[subj] + float(rng.normal(0.0, 2.0))
                clipped = float(np.clip(round(raw_grade, 1), 60.0, 99.0))
                term_grades[subj] = clipped

            is_finalized = not (i % 25 == 0 and term == 3)

            records.append({
                "student_id": student_id,
                "school_year": school_year,
                "quarter": term,
                "term": term,
                "grade_level": grade_level,
                "section_name": section_name,
                "data_provenance": "synthetic",
                "is_finalized": is_finalized,
                "subject_grades": term_grades,
            })

    return records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate clearly labeled synthetic longitudinal fixture"
    )
    parser.add_argument(
        "--num-students", type=int, default=120, help="Number of synthetic students"
    )
    parser.add_argument(
        "--seed", type=int, default=42, help="Random seed for reproducibility"
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(ROOT / "data" / "synthetic_raw_records.json"),
        help="Path to save raw synthetic records",
    )
    args = parser.parse_args()

    records = generate_synthetic_cohort(args.num_students, args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    import json
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    print(f"Generated {len(records)} synthetic term records across {args.num_students} students.")
    print(f"Saved to: {out_path}")


if __name__ == "__main__":
    main()
