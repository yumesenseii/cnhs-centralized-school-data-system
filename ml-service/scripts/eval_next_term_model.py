"""
Longitudinal Next-Term Academic Risk Evaluation Scaffold (Phase 5).

Evaluates Random Forest Next-Term Risk Prediction (f: X_t -> y_{t+1}) with:
  - Strict Data Provenance Enforcement ('empirical' vs 'synthetic').
  - GroupKFold Cross-Validation (grouped by student_id to prevent learner leakage).
  - Preprocessing encapsulated within training folds.
  - Multi-baseline comparisons:
      1. Persistence Baseline (y_hat_{t+1} = y_t)
      2. Majority-Class Baseline (y_hat_{t+1} = mode(y_train))
  - Full metrics: Macro F1, Per-Class Precision/Recall, 3x3 Confusion Matrix,
    and High-Risk Recall highlight.

CRITICAL INVARIANT:
  Does NOT replace or overwrite Model B artifact (random_forest_academic_risk.joblib).
  Does NOT deploy models or claim empirical readiness when run on synthetic fixtures.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from longitudinal_contract import (  # noqa: E402
    LABEL_HIGH,
    LABEL_LOW,
    LABEL_MODERATE,
    LONGITUDINAL_FEATURE_NAMES,
    METADATA_COLUMNS,
    MISSING_SENTINEL,
    RISK_CLASSES,
    TARGET_GWA_NAME,
    TARGET_NAME,
    risk_label_from_gwa,
)


def format_confusion_matrix(
    cm: np.ndarray, labels: list[str]
) -> dict[str, dict[str, int]]:
    """Format 3x3 confusion matrix into nested dictionary."""
    result: dict[str, dict[str, int]] = {}
    for i, actual in enumerate(labels):
        result[actual] = {}
        for j, pred in enumerate(labels):
            result[actual][pred] = int(cm[i, j])
    return result


def compute_evaluation_metrics(
    y_true: list[str], y_pred: list[str], labels: list[str]
) -> dict[str, Any]:
    """Calculate accuracy, macro precision/recall/F1, and per-class metrics."""
    acc = float(accuracy_score(y_true, y_pred))
    macro_p = float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_r = float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))

    per_class_p = precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_r = recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)

    cm = confusion_matrix(y_true, y_pred, labels=labels)

    per_class_details: dict[str, dict[str, float]] = {}
    for i, label in enumerate(labels):
        per_class_details[label] = {
            "precision": round(float(per_class_p[i]), 4),
            "recall": round(float(per_class_r[i]), 4),
            "f1_score": round(float(per_class_f1[i]), 4),
            "support": int((np.array(y_true) == label).sum()),
        }

    high_risk_recall = per_class_details.get(LABEL_HIGH, {}).get("recall", 0.0)

    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "high_risk_recall": round(high_risk_recall, 4),
        "per_class": per_class_details,
        "confusion_matrix": format_confusion_matrix(cm, labels),
    }


def evaluate_longitudinal_dataset(
    df: pd.DataFrame,
    n_splits: int = 5,
    seed: int = 42,
    allow_synthetic: bool = False,
) -> dict[str, Any]:
    """Execute GroupKFold evaluation of RF against Persistence and Majority baselines.

    Args:
      df: Prepared longitudinal dataset.
      n_splits: Folds for GroupKFold.
      seed: Random seed.
      allow_synthetic: If False and synthetic records present, raises ValueError.
    """
    # 1. Provenance Verification
    provenance_set = set(df["data_provenance"].dropna().str.lower())
    has_synthetic = "synthetic" in provenance_set

    if has_synthetic and not allow_synthetic:
        raise ValueError(
            "ABORT: Dataset contains synthetic records. Empirical validation cannot "
            "be claimed on synthetic data. Pass allow_synthetic=True strictly for pipeline testing."
        )

    # 2. Leakage Prevention Check
    for col in LONGITUDINAL_FEATURE_NAMES:
        if col not in df.columns:
            raise ValueError(f"Required feature '{col}' missing from dataset.")

    assert TARGET_NAME not in LONGITUDINAL_FEATURE_NAMES, "Target leaked into feature list"
    assert TARGET_GWA_NAME not in LONGITUDINAL_FEATURE_NAMES, "Target GWA leaked into feature list"

    # Filter to valid target rows
    df_clean = df[df[TARGET_NAME].isin(RISK_CLASSES)].copy()
    if len(df_clean) < n_splits * 2:
        raise ValueError(f"Insufficient samples ({len(df_clean)}) for {n_splits}-fold GroupKFold.")

    unique_students = df_clean["student_id"].nunique()
    if unique_students < n_splits:
        raise ValueError(
            f"Unique student count ({unique_students}) is less than fold count ({n_splits})."
        )

    X = df_clean[LONGITUDINAL_FEATURE_NAMES].to_numpy(dtype=float)
    y = df_clean[TARGET_NAME].to_numpy()
    groups = df_clean["student_id"].to_numpy()
    term_t_gwa_values = df_clean["term_t_gwa"].to_numpy(dtype=float)

    # 3. Setup GroupKFold cross-validation
    gkf = GroupKFold(n_splits=n_splits)

    rf_preds_all = [""] * len(y)
    persist_preds_all = [""] * len(y)
    majority_preds_all = [""] * len(y)

    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=groups)):
        # Verify strict learner isolation across folds
        train_students = set(groups[train_idx])
        test_students = set(groups[test_idx])
        overlap = train_students.intersection(test_students)
        assert len(overlap) == 0, f"Learner leakage detected in fold {fold_idx}: {overlap}"

        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Pipeline with imputer fit strictly on training fold
        pipe = Pipeline([
            ("imputer", SimpleImputer(missing_values=MISSING_SENTINEL, strategy="median")),
            ("rf", RandomForestClassifier(
                n_estimators=100,
                max_depth=6,
                min_samples_split=5,
                class_weight="balanced",
                random_state=seed + fold_idx,
            )),
        ])

        pipe.fit(X_train, y_train)
        rf_pred = pipe.predict(X_test)

        # Majority Class Baseline (mode of y_train)
        vals, counts = np.unique(y_train, return_counts=True)
        majority_class = vals[np.argmax(counts)]
        majority_pred = [majority_class] * len(y_test)

        # Persistence Baseline (Risk label of Term t GWA)
        persist_pred = [
            risk_label_from_gwa(term_t_gwa_values[idx]) or LABEL_MODERATE
            for idx in test_idx
        ]

        # Record out-of-fold predictions
        for i, global_idx in enumerate(test_idx):
            rf_preds_all[global_idx] = rf_pred[i]
            majority_preds_all[global_idx] = majority_pred[i]
            persist_preds_all[global_idx] = persist_pred[i]

    y_true_list = list(y)
    rf_metrics = compute_evaluation_metrics(y_true_list, rf_preds_all, RISK_CLASSES)
    persist_metrics = compute_evaluation_metrics(y_true_list, persist_preds_all, RISK_CLASSES)
    majority_metrics = compute_evaluation_metrics(y_true_list, majority_preds_all, RISK_CLASSES)

    return {
        "data_provenance": "synthetic" if has_synthetic else "empirical",
        "sample_count": len(df_clean),
        "unique_students": int(unique_students),
        "n_splits": n_splits,
        "is_synthetic_evaluation": has_synthetic,
        "metrics": {
            "random_forest": rf_metrics,
            "persistence_baseline": persist_metrics,
            "majority_class_baseline": majority_metrics,
        },
    }


def print_comparison_table(results: dict[str, Any]) -> None:
    is_synth = results["is_synthetic_evaluation"]

    print("\n" + "=" * 76)
    if is_synth:
        print("  *** CAUTION: EVALUATION RUNNING ON SYNTHETIC TEST FIXTURE DATA ***")
        print("  *** METRICS DO NOT REPRESENT EMPIRICAL MODEL VALIDATION OR READINESS ***")
        print("=" * 76)

    print("CNHS LEARN — Longitudinal Next-Term Academic Risk Evaluation (SOP 3)")
    print(f"Data Provenance   : {results['data_provenance'].upper()}")
    print(f"Evaluation Samples: {results['sample_count']} pairs ({results['unique_students']} unique learners)")
    print(f"Validation Method : {results['n_splits']}-Fold GroupKFold (Zero Learner Overlap)")
    print("-" * 76)

    rf_m = results["metrics"]["random_forest"]
    ps_m = results["metrics"]["persistence_baseline"]
    mj_m = results["metrics"]["majority_class_baseline"]

    header = f"{'Model / Baseline':<26} | {'Accuracy':<9} | {'Macro F1':<9} | {'High-Risk Recall':<17}"
    print(header)
    print("-" * 76)
    print(f"{'Random Forest (Next-Term)':<26} | {rf_m['accuracy']:<9.4f} | {rf_m['macro_f1']:<9.4f} | {rf_m['high_risk_recall']:<17.4f}")
    print(f"{'Persistence Baseline (t)':<26} | {ps_m['accuracy']:<9.4f} | {ps_m['macro_f1']:<9.4f} | {ps_m['high_risk_recall']:<17.4f}")
    print(f"{'Majority-Class Baseline':<26} | {mj_m['accuracy']:<9.4f} | {mj_m['macro_f1']:<9.4f} | {mj_m['high_risk_recall']:<17.4f}")
    print("-" * 76)

    print("\nPer-Class Breakdown (Random Forest):")
    for cls in RISK_CLASSES:
        pc = rf_m["per_class"][cls]
        print(f"  - {cls:<14}: Precision={pc['precision']:.4f}, Recall={pc['recall']:.4f}, F1={pc['f1_score']:.4f} (Support: {pc['support']})")

    print("\nConfusion Matrix (Random Forest):")
    print(f"  {'Actual \\ Pred':<15} | {'High Risk':<10} | {'Moderate Risk':<14} | {'Low Risk':<10}")
    for act in RISK_CLASSES:
        row = rf_m["confusion_matrix"][act]
        print(f"  {act:<15} | {row['High Risk']:<10} | {row['Moderate Risk']:<14} | {row['Low Risk']:<10}")
    print("=" * 76 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CNHS LEARN - Next-Term Academic Risk Evaluation Scaffold"
    )
    parser.add_argument(
        "--csv",
        type=str,
        required=True,
        help="Path to prepared longitudinal dataset CSV",
    )
    parser.add_argument(
        "--allow-synthetic",
        action="store_true",
        default=False,
        help="Explicitly permit evaluation on synthetic fixtures for offline testing",
    )
    parser.add_argument(
        "--n-splits",
        type=int,
        default=5,
        help="Number of GroupKFold cross-validation splits",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(ROOT / "artifacts" / "next_term_eval" / "metrics.json"),
        help="Output path for evaluation JSON metrics report",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        sys.exit(f"Dataset CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)

    try:
        results = evaluate_longitudinal_dataset(
            df,
            n_splits=args.n_splits,
            seed=args.seed,
            allow_synthetic=args.allow_synthetic,
        )
    except ValueError as e:
        sys.exit(f"\n[EVALUATION BLOCKED] {e}\n")

    print_comparison_table(results)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"Evaluation report successfully saved to: {out_path}\n")


if __name__ == "__main__":
    main()
