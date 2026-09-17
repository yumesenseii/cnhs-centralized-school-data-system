"""
Eval-only 3×3 confusion matrix: RF predicted risk vs official grade-band labels.

Official bands (risk_label_from_gwa / GRADE_RISK_BANDS):
  <75 High Risk | 75–84 Moderate Risk | ≥85 Low Risk

This artifact evaluates RISK only — not ARAL, not Classroom Remedial.
Ungraded rows (no GWA / no official label) are excluded.
Do not call this from the teacher app.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(SCRIPTS))

from feature_contract import FEATURE_NAMES, RISK_CLASSES  # noqa: E402
from train_model import load_frame  # noqa: E402

LABELS = list(RISK_CLASSES)  # High, Moderate, Low


def unwrap_model(artifact):
    if hasattr(artifact, "predict"):
        return artifact
    if isinstance(artifact, dict) and artifact.get("model") is not None:
        return artifact["model"]
    raise SystemExit("Joblib artifact has no sklearn model.")


def print_matrix(matrix: np.ndarray, labels: list[str]) -> None:
    width = max(10, max(len(x) for x in labels) + 2)
    header = "Actual \\ Pred".ljust(width) + "".join(x.rjust(width) for x in labels)
    print(header)
    for i, label in enumerate(labels):
        row = label.ljust(width) + "".join(str(int(v)).rjust(width) for v in matrix[i])
        print(row)


def per_class_metrics(y_true, y_pred, labels: list[str]) -> dict:
    precision = precision_score(
        y_true, y_pred, labels=labels, average=None, zero_division=0
    )
    recall = recall_score(
        y_true, y_pred, labels=labels, average=None, zero_division=0
    )
    f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    support = [(y_true == label).sum() for label in labels]
    predicted = [(y_pred == label).sum() for label in labels]
    out = {}
    for i, label in enumerate(labels):
        out[label] = {
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
            "predicted": int(predicted[i]),
        }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "3×3 confusion matrix: RF risk vs official grade-band labels. "
            "Evaluates RISK only — not ARAL, not Classroom Remedial."
        )
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=str(ROOT / "data" / "ecr_training.csv"),
        help="Labeled ECR CSV (ungraded rows are dropped).",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=str(ROOT / "artifacts" / "random_forest_academic_risk.joblib"),
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(ROOT / "artifacts" / "confusion_matrix.json"),
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--full",
        action="store_true",
        help="Score every labeled row (default: same holdout split as train_model).",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    model_path = Path(args.model)
    if not csv_path.exists():
        raise SystemExit(
            f"CSV not found: {csv_path}\n"
            "Generate one with: python scripts/generate_training_data.py"
        )
    if not model_path.exists():
        raise SystemExit(
            f"Trained model not found: {model_path}\n"
            "Train first: npm run ml:train   (or python scripts/train_model.py)"
        )

    df = load_frame(csv_path)
    X = df[FEATURE_NAMES].to_numpy(dtype=float)
    y = df["risk_label"].to_numpy()

    model = unwrap_model(joblib.load(model_path))

    if args.full:
        X_eval, y_true = X, y
        split = "full labeled set"
    else:
        _, X_eval, _, y_true = train_test_split(
            X,
            y,
            test_size=args.test_size,
            random_state=args.seed,
            stratify=y,
        )
        split = f"holdout test_size={args.test_size} seed={args.seed}"

    y_pred = model.predict(X_eval)
    matrix = confusion_matrix(y_true, y_pred, labels=LABELS)
    accuracy = float(accuracy_score(y_true, y_pred))
    classes = per_class_metrics(y_true, y_pred, LABELS)

    payload = {
        "evaluates": "academic RISK (High / Moderate / Low)",
        "does_not_evaluate": ["ARAL", "Classroom Remedial"],
        "official_bands": {
            "<75": "High Risk",
            "75-84": "Moderate Risk",
            ">=85": "Low Risk",
        },
        "ungraded_excluded": True,
        "split": split,
        "n": int(len(y_true)),
        "accuracy": accuracy,
        "labels": LABELS,
        "confusion_matrix": matrix.tolist(),
        "per_class": classes,
        "macro": {
            "precision": float(
                precision_score(
                    y_true, y_pred, labels=LABELS, average="macro", zero_division=0
                )
            ),
            "recall": float(
                recall_score(
                    y_true, y_pred, labels=LABELS, average="macro", zero_division=0
                )
            ),
            "f1": float(
                f1_score(
                    y_true, y_pred, labels=LABELS, average="macro", zero_division=0
                )
            ),
        },
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print("=== RF risk confusion matrix (eval only) ===")
    print("Evaluates: academic RISK  |  Does not evaluate: ARAL, Classroom Remedial")
    print(f"Split: {split}  |  n={payload['n']} (ungraded excluded)")
    print()
    print_matrix(matrix, LABELS)
    print()
    print(f"Accuracy: {accuracy:.4f}")
    print("Per class:")
    for label in LABELS:
        row = classes[label]
        print(
            f"  {label:14s}  P={row['precision']:.4f}  "
            f"R={row['recall']:.4f}  F1={row['f1']:.4f}  "
            f"support={row['support']}  predicted={row['predicted']}"
        )
    print(
        f"Macro          P={payload['macro']['precision']:.4f}  "
        f"R={payload['macro']['recall']:.4f}  F1={payload['macro']['f1']:.4f}"
    )
    print(f"Saved -> {out_path}")


if __name__ == "__main__":
    main()
