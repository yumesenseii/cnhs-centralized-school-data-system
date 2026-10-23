"""
CNHS LEARN — P0-04A: Experimental Per-Subject Next-Term Trend Model (Checkpoint 1)

Purpose:
  Isolated, compact training and evaluation of a Random Forest Classifier for
  per-subject performance trend forecasting (Improving, Stable, Declining):
    - Transitions: Term 1 -> Term 2 and Term 2 -> Term 3 exclusively.
    - Labels: Delta = Grade_{t+1} - Grade_t:
        Improving: Delta >= +2.0
        Declining: Delta <= -2.0
        Stable: -2.0 < Delta < +2.0
    - Learner-grouped 80/20 train/test split (zero student identity leakage).
    - Baselines: Majority-Class, Always-Stable, Prior-Trend Persistence.
    - Disaggregated evaluation: T1->T2 vs T2->T3, and Intervened vs Non-Intervened.
    - Encoding analysis: Integer Subject Code vs One-Hot Encoding comparison.

STRICT SAFETY:
  - Reads synthetic master dataset without modifying it.
  - Does NOT overwrite Model B (random_forest_academic_risk.joblib).
  - Does NOT touch FastAPI routes, Next.js UI, or Supabase database.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent

SUBJECTS = [
    "english",
    "filipino",
    "mathematics",
    "science",
    "araling_panlipunan",
    "mapeh",
    "tle",
    "values_education",
]

SUBJECT_TO_CODE = {subj: idx for idx, subj in enumerate(SUBJECTS)}
CODE_TO_SUBJECT = {idx: subj for idx, subj in enumerate(SUBJECTS)}

CLASSES = ["Improving", "Stable", "Declining"]


def classify_trend(delta: float) -> str:
    """Classify trend strictly by the +/- 2.0 point rule."""
    if delta >= 2.0:
        return "Improving"
    if delta <= -2.0:
        return "Declining"
    return "Stable"


def load_and_build_dataset(csv_path: Path) -> pd.DataFrame:
    """Load master synthetic dataset and construct transition records."""
    df = pd.read_csv(csv_path)

    # Clean term strings e.g. "Term 1" -> 1
    def parse_term(t_val):
        s = str(t_val).lower().replace("term", "").strip()
        try:
            return int(s)
        except (ValueError, TypeError):
            return None

    df["term_num"] = df["term"].apply(parse_term)

    # Group by (learner_id, school_year) -> term_num -> row
    grouped = defaultdict(dict)
    for _, row in df.iterrows():
        lid = str(row["learner_id"]).strip()
        sy = str(row["school_year"]).strip()
        t = row["term_num"]
        if t in (1, 2, 3):
            grouped[(lid, sy)][t] = row

    rows = []

    for (lid, sy), terms in grouped.items():
        # Need Term 1 and Term 2 for T1 -> T2
        # Need Term 1, Term 2, and Term 3 for T2 -> T3
        r1 = terms.get(1)
        r2 = terms.get(2)
        r3 = terms.get(3)

        ref_row = r1 if r1 is not None else (r2 if r2 is not None else {})
        pathway = str(ref_row.get("intervention_pathway") or "No Recommendation")
        is_intervened = pathway in ("ARAL Program (RA 12028)", "Classroom Remediation")

        # 1. Transition: Term 1 -> Term 2
        if r1 is not None and r2 is not None:
            gwa_1 = float(r1["general_average"])
            fails_1 = float(r1["failing_subject_count"])
            lowest_1 = float(r1["lowest_grade"])

            for s_idx, subj in enumerate(SUBJECTS):
                col = f"{subj}_grade"
                g1 = r1.get(col)
                g2 = r2.get(col)
                if pd.notna(g1) and pd.notna(g2):
                    g1_val = float(g1)
                    g2_val = float(g2)
                    delta_12 = round(g2_val - g1_val, 2)
                    trend_12 = classify_trend(delta_12)

                    rows.append({
                        "learner_id": lid,
                        "school_year": sy,
                        "subject": subj,
                        "subject_code": s_idx,
                        "source_term": 1,
                        "target_term": 2,
                        "is_intervened": is_intervened,
                        "intervention_pathway": pathway,
                        # Compact 9 features
                        "feat_subject_code": s_idx,
                        "feat_current_subject_grade": g1_val,
                        "feat_current_term_gwa": gwa_1,
                        "feat_current_relative_standing": round(g1_val - gwa_1, 2),
                        "feat_current_failing_count": fails_1,
                        "feat_current_lowest_grade": lowest_1,
                        "feat_has_prior_term": 0.0,
                        "feat_prior_subject_grade_delta": 0.0,
                        "feat_prior_gwa_delta": 0.0,
                        # Prior trend for persistence baseline
                        "prior_trend": None,
                        # Target
                        "target_grade": g2_val,
                        "target_delta": delta_12,
                        "target_trend": trend_12,
                    })

        # 2. Transition: Term 2 -> Term 3
        if r1 is not None and r2 is not None and r3 is not None:
            gwa_1 = float(r1["general_average"])
            gwa_2 = float(r2["general_average"])
            fails_2 = float(r2["failing_subject_count"])
            lowest_2 = float(r2["lowest_grade"])

            for s_idx, subj in enumerate(SUBJECTS):
                col = f"{subj}_grade"
                g1 = r1.get(col)
                g2 = r2.get(col)
                g3 = r3.get(col)
                if pd.notna(g1) and pd.notna(g2) and pd.notna(g3):
                    g1_val = float(g1)
                    g2_val = float(g2)
                    g3_val = float(g3)
                    delta_23 = round(g3_val - g2_val, 2)
                    trend_23 = classify_trend(delta_23)

                    prior_delta = round(g2_val - g1_val, 2)
                    prior_trend = classify_trend(prior_delta)

                    rows.append({
                        "learner_id": lid,
                        "school_year": sy,
                        "subject": subj,
                        "subject_code": s_idx,
                        "source_term": 2,
                        "target_term": 3,
                        "is_intervened": is_intervened,
                        "intervention_pathway": pathway,
                        # Compact 9 features
                        "feat_subject_code": s_idx,
                        "feat_current_subject_grade": g2_val,
                        "feat_current_term_gwa": gwa_2,
                        "feat_current_relative_standing": round(g2_val - gwa_2, 2),
                        "feat_current_failing_count": fails_2,
                        "feat_current_lowest_grade": lowest_2,
                        "feat_has_prior_term": 1.0,
                        "feat_prior_subject_grade_delta": prior_delta,
                        "feat_prior_gwa_delta": round(gwa_2 - gwa_1, 2),
                        # Prior trend for persistence baseline
                        "prior_trend": prior_trend,
                        # Target
                        "target_grade": g3_val,
                        "target_delta": delta_23,
                        "target_trend": trend_23,
                    })

    df_out = pd.DataFrame(rows)
    return df_out


FEATURE_COLS_9 = [
    "feat_subject_code",
    "feat_current_subject_grade",
    "feat_current_term_gwa",
    "feat_current_relative_standing",
    "feat_current_failing_count",
    "feat_current_lowest_grade",
    "feat_has_prior_term",
    "feat_prior_subject_grade_delta",
    "feat_prior_gwa_delta",
]


def compute_evaluation_metrics(y_true: list[str], y_pred: list[str], labels: list[str] = CLASSES) -> dict[str, Any]:
    """Calculate comprehensive evaluation metrics."""
    acc = float(accuracy_score(y_true, y_pred))
    macro_p = float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_r = float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true, y_pred, labels=labels, average="weighted", zero_division=0))

    per_class_p = precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_r = recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)

    cm = confusion_matrix(y_true, y_pred, labels=labels)

    per_class = {}
    for i, label in enumerate(labels):
        per_class[label] = {
            "precision": round(float(per_class_p[i]), 4),
            "recall": round(float(per_class_r[i]), 4),
            "f1_score": round(float(per_class_f1[i]), 4),
            "support": int((np.array(y_true) == label).sum()),
        }

    cm_dict = {}
    for i, actual in enumerate(labels):
        cm_dict[actual] = {}
        for j, pred in enumerate(labels):
            cm_dict[actual][pred] = int(cm[i, j])

    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "declining_recall": per_class.get("Declining", {}).get("recall", 0.0),
        "per_class": per_class,
        "confusion_matrix": cm_dict,
    }


def main():
    parser = argparse.ArgumentParser(description="CNHS LEARN P0-04A Checkpoint 1 Model Training & Evaluation")
    parser.add_argument(
        "--csv",
        type=str,
        default=str(REPO_ROOT / "data" / "synthetic" / "CNHS_LEARN_Synthetic_Historical_Learners.csv"),
        help="Path to synthetic master historical learners CSV",
    )
    parser.add_argument(
        "--artifact-dir",
        type=str,
        default=str(ROOT / "artifacts" / "trend_experiment"),
        help="Directory to save experimental artifacts",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        csv_path = ROOT.parent / "data" / "synthetic" / "CNHS_LEARN_Synthetic_Historical_Learners.csv"
        if not csv_path.exists():
            sys.exit(f"Error: Master CSV not found at {csv_path}")

    print("=" * 82)
    print("CNHS LEARN — P0-04A: Per-Subject Next-Term Trend Model Evaluation")
    print("           *** SYNTHETIC EXPERIMENTAL RESULTS ONLY ***")
    print("=" * 82)
    print(f"Loading master synthetic dataset from:\n  {csv_path}")

    df_pairs = load_and_build_dataset(csv_path)
    total_samples = len(df_pairs)
    unique_learners = df_pairs["learner_id"].nunique()
    print(f"\n[Dataset Extraction]")
    print(f"Total usable subject transitions: {total_samples}")
    print(f"Unique learners: {unique_learners}")
    print("Distribution by transition:")
    for term_pair, count in df_pairs.groupby(["source_term", "target_term"]).size().items():
        print(f"  - Term {term_pair[0]} -> Term {term_pair[1]}: {count} ({count/total_samples*100:.2f}%)")
    print("Distribution by class:")
    for cls, count in df_pairs["target_trend"].value_counts().items():
        print(f"  - {cls:<10}: {count} ({count/total_samples*100:.2f}%)")

    # 1. Learner-Grouped 80/20 Train/Test Separation
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=args.seed)
    train_idx, test_idx = next(gss.split(df_pairs, groups=df_pairs["learner_id"]))

    df_train = df_pairs.iloc[train_idx].copy().reset_index(drop=True)
    df_test = df_pairs.iloc[test_idx].copy().reset_index(drop=True)

    train_learners = set(df_train["learner_id"])
    test_learners = set(df_test["learner_id"])
    assert len(train_learners.intersection(test_learners)) == 0, "Learner identity leakage detected!"

    print(f"\n[Learner-Grouped 80/20 Split]")
    print(f"Training split: {len(df_train)} samples across {len(train_learners)} learners")
    print(f"Testing split : {len(df_test)} samples across {len(test_learners)} learners (zero student overlap)")

    # 2. Setup Features
    X_train_9 = df_train[FEATURE_COLS_9].to_numpy(dtype=float)
    y_train = df_train["target_trend"].to_numpy()

    X_test_9 = df_test[FEATURE_COLS_9].to_numpy(dtype=float)
    y_test = df_test["target_trend"].to_numpy()

    # Also build One-Hot Encoded version to test for artificial integer ordering distortion
    df_train_ohe = pd.get_dummies(df_train, columns=["feat_subject_code"], prefix="subj")
    df_test_ohe = pd.get_dummies(df_test, columns=["feat_subject_code"], prefix="subj")

    subj_dummy_cols = [f"subj_{i}" for i in range(8)]
    for c in subj_dummy_cols:
        if c not in df_train_ohe.columns:
            df_train_ohe[c] = 0
        if c not in df_test_ohe.columns:
            df_test_ohe[c] = 0

    other_cols = [c for c in FEATURE_COLS_9 if c != "feat_subject_code"]
    ohe_feature_cols = subj_dummy_cols + other_cols

    X_train_ohe = df_train_ohe[ohe_feature_cols].to_numpy(dtype=float)
    X_test_ohe = df_test_ohe[ohe_feature_cols].to_numpy(dtype=float)

    # 3. Model Training (Compact 9-Feature RFC)
    print(f"\n[Training Model: 9-Feature Random Forest Classifier]")
    rf_9 = RandomForestClassifier(
        n_estimators=150,
        max_depth=10,
        min_samples_split=6,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=args.seed,
        n_jobs=-1,
    )

    # Inner 5-Fold GroupKFold within Training Split ONLY
    gkf = GroupKFold(n_splits=5)
    cv_macro_f1 = []
    cv_declining_recall = []
    for fold, (tr_idx, val_idx) in enumerate(gkf.split(X_train_9, y_train, groups=df_train["learner_id"])):
        rf_cv = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=6,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=args.seed + fold,
            n_jobs=-1,
        )
        rf_cv.fit(X_train_9[tr_idx], y_train[tr_idx])
        pred_val = rf_cv.predict(X_train_9[val_idx])
        f1_m = f1_score(y_train[val_idx], pred_val, labels=CLASSES, average="macro", zero_division=0)
        rec_dec = recall_score(y_train[val_idx], pred_val, labels=["Declining"], average=None, zero_division=0)[0]
        cv_macro_f1.append(f1_m)
        cv_declining_recall.append(rec_dec)

    print(f"Inner 5-Fold GroupKFold (Train Split): Macro-F1 = {np.mean(cv_macro_f1):.4f} (+/- {np.std(cv_macro_f1):.4f}), Declining-Recall = {np.mean(cv_declining_recall):.4f}")

    rf_9.fit(X_train_9, y_train)
    y_pred_9 = rf_9.predict(X_test_9)
    metrics_rf_9 = compute_evaluation_metrics(list(y_test), list(y_pred_9))

    # 4. Compare with One-Hot Encoded Model (Addressing Integer Encoding Question)
    print(f"\n[Comparison: One-Hot Encoded RFC (16 Features)]")
    rf_ohe = RandomForestClassifier(
        n_estimators=150,
        max_depth=10,
        min_samples_split=6,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=args.seed,
        n_jobs=-1,
    )
    rf_ohe.fit(X_train_ohe, y_train)
    y_pred_ohe = rf_ohe.predict(X_test_ohe)
    metrics_rf_ohe = compute_evaluation_metrics(list(y_test), list(y_pred_ohe))

    print(f"Compact 9-Feature RFC (Integer Subject Code) : Accuracy = {metrics_rf_9['accuracy']:.4f}, Macro-F1 = {metrics_rf_9['macro_f1']:.4f}, Declining-Recall = {metrics_rf_9['declining_recall']:.4f}")
    print(f"One-Hot Encoded RFC (16 Features)             : Accuracy = {metrics_rf_ohe['accuracy']:.4f}, Macro-F1 = {metrics_rf_ohe['macro_f1']:.4f}, Declining-Recall = {metrics_rf_ohe['declining_recall']:.4f}")
    diff_f1 = abs(metrics_rf_9['macro_f1'] - metrics_rf_ohe['macro_f1'])
    print(f"Encoding difference: {diff_f1:.4f} Macro-F1.")

    # 5. Baseline Comparisons
    # Baseline 1: Majority-Class Baseline (mode of y_train)
    majority_class = pd.Series(y_train).mode()[0]
    y_pred_majority = [majority_class] * len(y_test)
    metrics_majority = compute_evaluation_metrics(list(y_test), y_pred_majority)

    # Baseline 2: Always-Stable Baseline
    y_pred_stable = ["Stable"] * len(y_test)
    metrics_stable = compute_evaluation_metrics(list(y_test), y_pred_stable)

    # Baseline 3: Prior-Trend Persistence Baseline
    y_pred_persist = []
    for _, row in df_test.iterrows():
        pt = row["prior_trend"]
        if pd.notna(pt) and pt in CLASSES:
            y_pred_persist.append(pt)
        else:
            y_pred_persist.append("Stable")
    metrics_persist = compute_evaluation_metrics(list(y_test), y_pred_persist)

    # 6. Disaggregated Evaluation: T1 -> T2 vs T2 -> T3
    mask_t12 = (df_test["source_term"] == 1).to_numpy()
    mask_t23 = (df_test["source_term"] == 2).to_numpy()

    metrics_rf_t12 = compute_evaluation_metrics(list(y_test[mask_t12]), list(y_pred_9[mask_t12]))
    metrics_rf_t23 = compute_evaluation_metrics(list(y_test[mask_t23]), list(y_pred_9[mask_t23]))

    # Prior-trend persistence specifically on T2 -> T3
    y_test_t23 = list(y_test[mask_t23])
    y_pred_persist_t23 = [
        row["prior_trend"] if pd.notna(row["prior_trend"]) and row["prior_trend"] in CLASSES else "Stable"
        for _, row in df_test[mask_t23].iterrows()
    ]
    metrics_persist_t23 = compute_evaluation_metrics(y_test_t23, y_pred_persist_t23)

    # 7. Sensitivity Analysis: Intervened vs Non-Intervened Learners
    mask_intervened = df_test["is_intervened"].to_numpy()
    mask_non_intervened = ~mask_intervened

    metrics_intervened = compute_evaluation_metrics(list(y_test[mask_intervened]), list(y_pred_9[mask_intervened]))
    metrics_non_intervened = compute_evaluation_metrics(list(y_test[mask_non_intervened]), list(y_pred_9[mask_non_intervened]))

    # Print Full Comparative Results Table
    print("\n" + "=" * 82)
    print("CNHS LEARN — P0-04A Model Evaluation & Baseline Comparison on Held-Out Test Set")
    print(f"Sample Count: {len(df_test)} observations across {len(test_learners)} held-out learners")
    print("-" * 82)
    header = f"{'Model / Baseline':<32} | {'Accuracy':<9} | {'Macro F1':<9} | {'Declining Recall':<16} | {'Status'}"
    print(header)
    print("-" * 82)
    print(f"{'Random Forest (9-Feature Compact)':<32} | {metrics_rf_9['accuracy']:<9.4f} | {metrics_rf_9['macro_f1']:<9.4f} | {metrics_rf_9['declining_recall']:<16.4f} | {'Proposed'}")
    print(f"{'Random Forest (One-Hot Encoded)':<32} | {metrics_rf_ohe['accuracy']:<9.4f} | {metrics_rf_ohe['macro_f1']:<9.4f} | {metrics_rf_ohe['declining_recall']:<16.4f} | {'Comparison'}")
    print(f"{'Persistence Baseline (Prior Trend)':<32} | {metrics_persist['accuracy']:<9.4f} | {metrics_persist['macro_f1']:<9.4f} | {metrics_persist['declining_recall']:<16.4f} | {'Baseline'}")
    print(f"{'Always-Stable Baseline':<32} | {metrics_stable['accuracy']:<9.4f} | {metrics_stable['macro_f1']:<9.4f} | {metrics_stable['declining_recall']:<16.4f} | {'Baseline'}")
    print(f"{'Majority-Class Baseline':<32} | {metrics_majority['accuracy']:<9.4f} | {metrics_majority['macro_f1']:<9.4f} | {metrics_majority['declining_recall']:<16.4f} | {'Baseline'}")
    print("-" * 82)

    print("\nPer-Class Breakdown (Proposed 9-Feature RFC):")
    for cls in CLASSES:
        pc = metrics_rf_9["per_class"][cls]
        print(f"  - {cls:<10}: Precision={pc['precision']:.4f}, Recall={pc['recall']:.4f}, F1={pc['f1_score']:.4f} (Support: {pc['support']})")

    print("\nConfusion Matrix (Proposed 9-Feature RFC):")
    print(f"  {'Actual \\ Pred':<15} | {'Improving':<10} | {'Stable':<10} | {'Declining':<10}")
    for act in CLASSES:
        row = metrics_rf_9["confusion_matrix"][act]
        print(f"  {act:<15} | {row['Improving']:<10} | {row['Stable']:<10} | {row['Declining']:<10}")

    print("\n" + "=" * 82)
    print("Disaggregated Analysis (Term 1 -> 2 vs Term 2 -> 3):")
    print(f"  - Term 1 -> Term 2 (No Velocity) : Accuracy={metrics_rf_t12['accuracy']:.4f}, Macro-F1={metrics_rf_t12['macro_f1']:.4f}, Declining-Recall={metrics_rf_t12['declining_recall']:.4f} (N={mask_t12.sum()})")
    print(f"  - Term 2 -> Term 3 (With Velocity): Accuracy={metrics_rf_t23['accuracy']:.4f}, Macro-F1={metrics_rf_t23['macro_f1']:.4f}, Declining-Recall={metrics_rf_t23['declining_recall']:.4f} (N={mask_t23.sum()})")
    print(f"  * Note on T2->T3: Persistence Baseline Macro-F1 is {metrics_persist_t23['macro_f1']:.4f} vs RFC {metrics_rf_t23['macro_f1']:.4f}.")

    print("\n" + "=" * 82)
    print("Sensitivity Analysis: Programmed Recovery Shortcut & Intervened vs Non-Intervened:")
    print(f"  - Intervened Cohort (ARAL / Remedial): Accuracy={metrics_intervened['accuracy']:.4f}, Macro-F1={metrics_intervened['macro_f1']:.4f}, Improving-Recall={metrics_intervened['per_class']['Improving']['recall']:.4f} (N={mask_intervened.sum()})")
    print(f"  - Non-Intervened Cohort (Natural Walk): Accuracy={metrics_non_intervened['accuracy']:.4f}, Macro-F1={metrics_non_intervened['macro_f1']:.4f}, Improving-Recall={metrics_non_intervened['per_class']['Improving']['recall']:.4f} (N={mask_non_intervened.sum()})")
    boost_bias = metrics_intervened['per_class']['Improving']['recall'] - metrics_non_intervened['per_class']['Improving']['recall']
    print(f"  * Intervened cohort Improving-Recall bias: +{boost_bias*100:.2f}% due to synthetic recovery boosts.")
    print("=" * 82 + "\n")

    # Feature Importances
    importances = {name: round(float(imp), 4) for name, imp in zip(FEATURE_COLS_9, rf_9.feature_importances_)}
    print("Feature Importances (9-Feature RFC):")
    for name, imp in sorted(importances.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {name:<32}: {imp:.4f}")

    # Persist Artifacts
    art_dir = Path(args.artifact_dir)
    art_dir.mkdir(parents=True, exist_ok=True)
    model_out = art_dir / "random_forest_trend.joblib"
    metrics_out = art_dir / "trend_metrics.json"

    bundle = {
        "model": rf_9,
        "feature_names": FEATURE_COLS_9,
        "classes": list(rf_9.classes_),
        "subject_mapping": SUBJECT_TO_CODE,
        "delta_threshold": 2.0,
        "metrics": {
            "overall_heldout": metrics_rf_9,
            "majority_baseline": metrics_majority,
            "stable_baseline": metrics_stable,
            "persistence_baseline": metrics_persist,
            "t1_to_t2": metrics_rf_t12,
            "t2_to_t3": metrics_rf_t23,
            "t2_to_t3_persistence": metrics_persist_t23,
            "sensitivity_intervened": metrics_intervened,
            "sensitivity_non_intervened": metrics_non_intervened,
            "one_hot_comparison": metrics_rf_ohe,
        },
        "feature_importances": importances,
        "provenance": "synthetic_experimental",
    }

    joblib.dump(bundle, model_out)
    with open(metrics_out, "w", encoding="utf-8") as f:
        json.dump(bundle["metrics"], f, indent=2)

    print(f"\nSaved experimental model bundle -> {model_out}")
    print(f"Saved evaluation metrics JSON  -> {metrics_out}\n")


if __name__ == "__main__":
    main()
