"""
Generate historical-style ECR academic snapshots for RF training.

Each row mimics one learner's term snapshot with subject grades.
Labels are derived from General Average using the official grading scale.

This is synthetic but structured like real ECR exports so the pipeline is real
sklearn training — not a mock classifier. Retrain on live exports via
scripts/export_grades_for_ml.mjs + train_model.py --csv when available.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from feature_contract import FEATURE_NAMES, risk_label_from_gwa

# general_average is written to CSV for LABELING only — not in FEATURE_NAMES (Model B).

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


def _clip(grade: float) -> float:
    return float(np.clip(round(grade, 2), 60.0, 100.0))


def _build_row(rng: np.random.Generator, profile: str) -> dict:
    """profile in {high, moderate, low} steers GWA into label bands with noise."""
    if profile == "high":
        center = rng.uniform(62, 73)
        noise = 6.0
    elif profile == "moderate":
        center = rng.uniform(75, 84)
        noise = 5.0
    else:
        center = rng.uniform(85, 98)
        noise = 4.0

    grades = {}
    for subject in SUBJECTS:
        # Correlated subjects around learner ability + per-subject jitter
        jitter = rng.normal(0, noise)
        # Language subjects slightly more variable for ARAL-like patterns
        if subject in ("english_grade", "filipino_grade"):
            jitter += rng.normal(0, 1.5)
        grades[subject] = _clip(center + jitter)

    # Occasional missing subject (real ECR incompleteness)
    if rng.random() < 0.08:
        drop = SUBJECTS[int(rng.integers(0, len(SUBJECTS)))]
        grades[drop] = None

    present = [g for g in grades.values() if g is not None]
    gwa = float(np.mean(present)) if present else None
    failing = [s for s, g in grades.items() if g is not None and g < 75]
    language_fails = sum(
        1 for s in failing if s in ("english_grade", "filipino_grade")
    )
    non_language_fails = len(failing) - language_fails
    lowest = min(present) if present else None

    row = {
        **grades,
        "general_average": round(gwa, 2) if gwa is not None else None,
        "failing_subject_count": len(failing),
        "language_fail_count": language_fails,
        "non_language_fail_count": non_language_fails,
        "lowest_grade": round(lowest, 2) if lowest is not None else None,
        "available_grade_count": len(present),
    }
    row["risk_label"] = risk_label_from_gwa(gwa)
    return row


def generate_dataset(n: int = 2400, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    # Balanced-ish profiles then label by true GWA (official bands)
    profiles = (
        ["high"] * (n // 3)
        + ["moderate"] * (n // 3)
        + ["low"] * (n - 2 * (n // 3))
    )
    rng.shuffle(profiles)
    rows = [_build_row(rng, p) for p in profiles]
    df = pd.DataFrame(rows)
    df = df[df["risk_label"].notna()].reset_index(drop=True)
    return df


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=2400)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "data" / "ecr_training.csv"),
    )
    args = parser.parse_args()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df = generate_dataset(args.n, args.seed)
    # Ensure feature columns exist
    for col in FEATURE_NAMES:
        if col not in df.columns:
            df[col] = None
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} rows to {out}")
    print(df["risk_label"].value_counts().to_string())


if __name__ == "__main__":
    main()
