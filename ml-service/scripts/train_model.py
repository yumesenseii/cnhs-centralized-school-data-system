"""
Train RandomForestClassifier on ECR academic features — Model B (PRODUCTION).

Labels: official grading-scale risk classes from General Average (GWA).
Features: subject grades + academic indicators — EXCLUDES general_average
          to avoid target leakage (GWA defines the label).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

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
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from feature_contract import (  # noqa: E402
    FEATURE_NAMES,
    LABEL_SOURCE_COLUMN,
    MISSING_SENTINEL,
    RISK_CLASSES,
    risk_label_from_gwa,
)


def load_frame(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    # Labels always from GWA (official bands) — never from RF features.
    if "risk_label" not in df.columns:
        if LABEL_SOURCE_COLUMN not in df.columns:
            raise SystemExit(
                f"CSV needs risk_label or {LABEL_SOURCE_COLUMN} for labeling."
            )
        df["risk_label"] = df[LABEL_SOURCE_COLUMN].apply(risk_label_from_gwa)
    elif LABEL_SOURCE_COLUMN in df.columns:
        labeled = df[LABEL_SOURCE_COLUMN].apply(risk_label_from_gwa)
        df["risk_label"] = labeled.where(labeled.notna(), df["risk_label"])

    df = df[df["risk_label"].isin(RISK_CLASSES)].copy()

    for col in FEATURE_NAMES:
        if col not in df.columns:
            df[col] = np.nan
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(MISSING_SENTINEL)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train Model B ECR academic risk RF (no GWA feature)"
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=str(ROOT / "data" / "ecr_training.csv"),
    )
    parser.add_argument(
        "--model-out",
        type=str,
        default=str(ROOT / "artifacts" / "random_forest_academic_risk.joblib"),
    )
    parser.add_argument(
        "--metrics-out",
        type=str,
        default=str(ROOT / "artifacts" / "metrics.json"),
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        from generate_training_data import generate_dataset

        csv_path.parent.mkdir(parents=True, exist_ok=True)
        generate_dataset(2400, args.seed).to_csv(csv_path, index=False)
        print(f"Generated training CSV at {csv_path}")

    df = load_frame(csv_path)
    assert LABEL_SOURCE_COLUMN not in FEATURE_NAMES, "GWA must not be an RF feature"
    assert "general_average" not in FEATURE_NAMES

    X = df[FEATURE_NAMES].to_numpy(dtype=float)
    y = df["risk_label"].to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.seed,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=2,
        random_state=args.seed,
        class_weight="balanced_subsample",
        n_jobs=-1,
    )

    # 5-Fold Stratified Cross-Validation across entire dataset
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    cv_accuracy = cross_val_score(model, X, y, cv=skf, scoring="accuracy")
    cv_f1_macro = cross_val_score(model, X, y, cv=skf, scoring="f1_macro")

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    labels = list(model.classes_)

    metrics = {
        "model_configuration": "Model B (production)",
        "general_average_in_features": False,
        "n_estimators": 200,
        "max_depth": 12,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision_macro": float(
            precision_score(y_test, y_pred, average="macro", zero_division=0)
        ),
        "recall_macro": float(
            recall_score(y_test, y_pred, average="macro", zero_division=0)
        ),
        "f1_macro": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(
            precision_score(y_test, y_pred, average="weighted", zero_division=0)
        ),
        "recall_weighted": float(
            recall_score(y_test, y_pred, average="weighted", zero_division=0)
        ),
        "f1_weighted": float(
            f1_score(y_test, y_pred, average="weighted", zero_division=0)
        ),
        "cross_validation_5fold": {
            "accuracy_mean": float(cv_accuracy.mean()),
            "accuracy_std": float(cv_accuracy.std()),
            "f1_macro_mean": float(cv_f1_macro.mean()),
            "f1_macro_std": float(cv_f1_macro.std()),
            "fold_accuracies": [float(v) for v in cv_accuracy],
        },
        "confusion_matrix": {
            "labels": labels,
            "matrix": confusion_matrix(y_test, y_pred, labels=labels).tolist(),
        },
        "classification_report": classification_report(
            y_test, y_pred, labels=labels, zero_division=0, output_dict=True
        ),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "feature_names": FEATURE_NAMES,
        "label_basis": {
            "official_scale": {
                "90-100": "Outstanding -> Low Risk",
                "85-89": "Very Satisfactory -> Low Risk",
                "80-84": "Satisfactory -> Moderate Risk",
                "75-79": "Fairly Satisfactory -> Moderate Risk",
                "<75": "Did Not Meet Expectations -> High Risk",
            },
            "ml_classes": {
                "85-100": "Low Risk",
                "75-84": "Moderate Risk",
                "<75": "High Risk",
            },
            "label_source": "general_average (GWA) — labels only, not an RF feature",
        },
        "feature_importances": {
            name: float(imp)
            for name, imp in zip(FEATURE_NAMES, model.feature_importances_)
        },
    }

    model_out = Path(args.model_out)
    metrics_out = Path(args.metrics_out)
    model_out.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "model": model,
        "model_configuration": "Model B",
        "feature_names": FEATURE_NAMES,
        "classes": list(model.classes_),
        "missing_sentinel": MISSING_SENTINEL,
        "metrics": metrics,
    }
    joblib.dump(artifact, model_out)
    metrics_out.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("=== Random Forest Academic Risk — Model B Evaluation ===")
    print(f"Features ({len(FEATURE_NAMES)}): {FEATURE_NAMES}")
    print("GWA in RF features: False")
    print(f"Accuracy:  {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision_macro']:.4f} (macro)")
    print(f"Recall:    {metrics['recall_macro']:.4f} (macro)")
    print(f"F1-score:  {metrics['f1_macro']:.4f} (macro)")
    print("Confusion matrix labels:", labels)
    print(np.array(metrics["confusion_matrix"]["matrix"]))
    print(f"Saved model -> {model_out}")
    print(f"Saved metrics -> {metrics_out}")


if __name__ == "__main__":
    main()
