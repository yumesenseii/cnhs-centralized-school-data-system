"""
CNHS LEARN — Random Forest Hyperparameter Tuning & Analysis Experiment

This script performs:
1. Baseline comparison (Majority Class, Persistence, Original RF)
2. Hyperparameter tuning with GroupKFold CV (learner-grouped)
3. Class weighting experiments for imbalanced recall
4. Feature importance analysis
5. Data leakage checks
6. Synthetic data limitation analysis

Preserves: 13 features (Model B), dataset, target labels, learner-grouped evaluation
"""

from __future__ import annotations

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
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupKFold, ParameterGrid
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

from longitudinal_contract import (  # noqa: E402
    LABEL_HIGH,
    LABEL_LOW,
    LABEL_MODERATE,
    LONGITUDINAL_FEATURE_NAMES,
    MISSING_SENTINEL,
    RISK_CLASSES,
    TARGET_NAME,
    risk_label_from_gwa,
)


def load_longitudinal_data(csv_path: Path) -> tuple[pd.DataFrame, dict]:
    """Load and validate longitudinal dataset."""
    df = pd.read_csv(csv_path)
    
    # Verify no leakage
    assert TARGET_NAME not in LONGITUDINAL_FEATURE_NAMES
    
    # Filter valid targets
    df_clean = df[df[TARGET_NAME].isin(RISK_CLASSES)].copy()
    
    X = df_clean[LONGITUDINAL_FEATURE_NAMES].to_numpy(dtype=float)
    y = df_clean[TARGET_NAME].to_numpy()
    groups = df_clean["student_id"].to_numpy()
    term_t_gwa = df_clean["term_t_gwa"].to_numpy(dtype=float)
    
    # Class distribution
    class_dist = {cls: int((y == cls).sum()) for cls in RISK_CLASSES}
    
    return df_clean, {
        "X": X, "y": y, "groups": groups, "term_t_gwa": term_t_gwa,
        "class_distribution": class_dist,
        "n_samples": len(y),
        "n_students": df_clean["student_id"].nunique(),
    }


def evaluate_predictions(y_true, y_pred, labels):
    """Compute comprehensive metrics."""
    acc = float(accuracy_score(y_true, y_pred))
    macro_p = float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_r = float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    
    per_class_p = precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_r = recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    
    per_class = {}
    for i, label in enumerate(labels):
        per_class[label] = {
            "precision": round(float(per_class_p[i]), 4),
            "recall": round(float(per_class_r[i]), 4),
            "f1": round(float(per_class_f1[i]), 4),
            "support": int((np.array(y_true) == label).sum()),
        }
    
    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "high_risk_recall": round(per_class[LABEL_HIGH]["recall"], 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
    }


def run_groupkfold_experiment(
    X, y, groups, term_t_gwa, 
    rf_params: dict,
    n_splits: int = 5,
    seed: int = 42,
) -> dict[str, Any]:
    """Run GroupKFold CV experiment with given RF parameters."""
    gkf = GroupKFold(n_splits=n_splits)
    
    rf_preds_all = [""] * len(y)
    persist_preds_all = [""] * len(y)
    majority_preds_all = [""] * len(y)
    
    fold_metrics = []
    
    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=groups)):
        # Verify no learner overlap
        train_students = set(groups[train_idx])
        test_students = set(groups[test_idx])
        assert len(train_students & test_students) == 0, f"Leakage in fold {fold_idx}"
        
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        
        # Pipeline with imputer fit on training fold only
        pipe = Pipeline([
            ("imputer", SimpleImputer(missing_values=MISSING_SENTINEL, strategy="median")),
            ("rf", RandomForestClassifier(random_state=seed + fold_idx, **rf_params)),
        ])
        
        pipe.fit(X_train, y_train)
        rf_pred = pipe.predict(X_test)
        
        # Majority Class Baseline
        vals, counts = np.unique(y_train, return_counts=True)
        majority_class = vals[np.argmax(counts)]
        majority_pred = [majority_class] * len(y_test)
        
        # Persistence Baseline
        persist_pred = [
            risk_label_from_gwa(term_t_gwa[idx]) or LABEL_MODERATE
            for idx in test_idx
        ]
        
        # Store predictions
        for i, global_idx in enumerate(test_idx):
            rf_preds_all[global_idx] = rf_pred[i]
            majority_preds_all[global_idx] = majority_pred[i]
            persist_preds_all[global_idx] = persist_pred[i]
        
        # Fold metrics
        fold_rf = evaluate_predictions(y_test, rf_pred, RISK_CLASSES)
        fold_metrics.append(fold_rf)
    
    # Aggregate metrics
    rf_metrics = evaluate_predictions(y, rf_preds_all, RISK_CLASSES)
    persist_metrics = evaluate_predictions(y, persist_preds_all, RISK_CLASSES)
    majority_metrics = evaluate_predictions(y, majority_preds_all, RISK_CLASSES)
    
    return {
        "rf_params": rf_params,
        "rf": rf_metrics,
        "persistence": persist_metrics,
        "majority": majority_metrics,
        "fold_metrics": fold_metrics,
    }


def analyze_feature_importance(X, y, groups, feature_names, rf_params, seed=42):
    """Train on full data and analyze feature importance with GroupKFold."""
    # Use GroupKFold to get importance from each fold
    gkf = GroupKFold(n_splits=5)
    importances = np.zeros((5, len(feature_names)))
    
    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=groups)):
        X_train, y_train = X[train_idx], y[train_idx]
        
        pipe = Pipeline([
            ("imputer", SimpleImputer(missing_values=MISSING_SENTINEL, strategy="median")),
            ("rf", RandomForestClassifier(random_state=seed + fold_idx, **rf_params)),
        ])
        
        pipe.fit(X_train, y_train)
        rf = pipe.named_steps["rf"]
        importances[fold_idx] = rf.feature_importances_
    
    mean_importance = importances.mean(axis=0)
    std_importance = importances.std(axis=0)
    
    # Rank features
    ranked = sorted(
        zip(feature_names, mean_importance, std_importance),
        key=lambda x: x[1],
        reverse=True
    )
    
    return {
        "ranked_features": [
            {"name": name, "importance": round(float(imp), 6), "std": round(float(std), 6)}
            for name, imp, std in ranked
        ],
        "top_5": [name for name, _, _ in ranked[:5]],
        "bottom_5": [name for name, _, _ in ranked[-5:]],
    }


def check_data_leakage(df: pd.DataFrame) -> dict[str, Any]:
    """Check for potential data leakage in the dataset."""
    issues = []
    
    # Check 1: Target in features
    feature_cols = [c for c in df.columns if c.startswith("term_t_")]
    if TARGET_NAME in feature_cols:
        issues.append(f"Target {TARGET_NAME} found in feature columns")
    
    # Check 2: Future term data in features
    for col in feature_cols:
        col_lower = col.lower()
        if any(f in col_lower for f in ["target", "next", "future", "t+1", "t+2"]):
            issues.append(f"Feature {col} may reference future term")
    
    # Check 3: Target GWA in features
    if "target_next_term_gwa" in feature_cols:
        issues.append("Target GWA found in feature columns")
    
    # Check 4: Same student in train/test (will be caught by GroupKFold)
    # Check 5: Feature correlation with target (high correlation might indicate leakage)
    X = df[LONGITUDINAL_FEATURE_NAMES].to_numpy(dtype=float)
    y = df[TARGET_NAME].to_numpy()
    
    # Encode target for correlation
    target_encoded = np.array([RISK_CLASSES.index(cls) for cls in y])
    correlations = {}
    for i, name in enumerate(LONGITUDINAL_FEATURE_NAMES):
        col = X[:, i]
        # Only correlate non-sentinel values
        mask = col != MISSING_SENTINEL
        if mask.sum() > 10:
            corr = np.corrcoef(col[mask], target_encoded[mask])[0, 1]
            if not np.isnan(corr):
                correlations[name] = float(corr)
    
    high_corr = {k: v for k, v in correlations.items() if abs(v) > 0.8}
    if high_corr:
        issues.append(f"Very high correlation with target: {high_corr}")
    
    return {
        "issues_found": len(issues),
        "issues": issues,
        "feature_target_correlations": correlations,
        "high_correlations": high_corr,
    }


def analyze_synthetic_limitations(df: pd.DataFrame) -> dict[str, Any]:
    """Analyze limitations of synthetic data."""
    # Check class balance
    class_dist = df[TARGET_NAME].value_counts().to_dict()
    
    # Check feature distributions
    feature_stats = {}
    for name in LONGITUDINAL_FEATURE_NAMES:
        col = df[name]
        valid = col[col != MISSING_SENTINEL]
        if len(valid) > 0:
            feature_stats[name] = {
                "mean": float(valid.mean()),
                "std": float(valid.std()),
                "min": float(valid.min()),
                "max": float(valid.max()),
                "missing_pct": float((col == MISSING_SENTINEL).mean() * 100),
            }
    
    # Check if synthetic data has unrealistic patterns
    # e.g., perfect separation, unrealistic correlations
    warnings = []
    
    # Check for near-perfect separation in any feature
    for name in LONGITUDINAL_FEATURE_NAMES:
        col = df[name]
        valid_mask = col != MISSING_SENTINEL
        if valid_mask.sum() > 100:
            for cls in RISK_CLASSES:
                cls_mask = (df[TARGET_NAME] == cls) & valid_mask
                other_mask = (df[TARGET_NAME] != cls) & valid_mask
                if cls_mask.sum() > 10 and other_mask.sum() > 10:
                    cls_mean = col[cls_mask].mean()
                    other_mean = col[other_mask].mean()
                    cls_std = col[cls_mask].std()
                    other_std = col[other_mask].std()
                    pooled_std = np.sqrt((cls_std**2 + other_std**2) / 2)
                    if pooled_std > 0:
                        d = abs(cls_mean - other_mean) / pooled_std
                        if d > 2.0:  # Cohen's d > 2 is very large effect
                            warnings.append(
                                f"Feature {name} shows very large separation for {cls} "
                                f"(Cohen's d={d:.2f}) - may indicate synthetic over-separation"
                            )
    
    return {
        "class_distribution": class_dist,
        "feature_statistics": feature_stats,
        "warnings": warnings,
    }


def main():
    # Load data
    csv_path = ROOT / "data" / "longitudinal_pairs.csv"
    if not csv_path.exists():
        print(f"Dataset not found: {csv_path}")
        print("Run prepare_longitudinal_dataset.py first")
        sys.exit(1)
    
    print("=" * 80)
    print("CNHS LEARN — RF Hyperparameter Tuning Experiment")
    print("=" * 80)
    
    df, data = load_longitudinal_data(csv_path)
    X, y, groups, term_t_gwa = data["X"], data["y"], data["groups"], data["term_t_gwa"]
    
    print(f"\nDataset: {data['n_samples']} samples, {data['n_students']} students")
    print(f"Class distribution: {data['class_distribution']}")
    print(f"Features: {len(LONGITUDINAL_FEATURE_NAMES)}")
    
    # 1. Data Leakage Check
    print("\n" + "=" * 80)
    print("1. DATA LEAKAGE AUDIT")
    print("=" * 80)
    leakage = check_data_leakage(df)
    print(f"Issues found: {leakage['issues_found']}")
    for issue in leakage["issues"]:
        print(f"  - {issue}")
    if leakage["high_correlations"]:
        print("High correlations with target:")
        for k, v in leakage["high_correlations"].items():
            print(f"  {k}: {v:.4f}")
    
    # 2. Synthetic Data Limitations
    print("\n" + "=" * 80)
    print("2. SYNTHETIC DATA LIMITATIONS")
    print("=" * 80)
    synth = analyze_synthetic_limitations(df)
    print(f"Class distribution: {synth['class_distribution']}")
    if synth["warnings"]:
        for w in synth["warnings"]:
            print(f"  WARNING: {w}")
    else:
        print("No extreme separation warnings detected.")
    
    # 3. Baseline Comparison (Original RF params)
    print("\n" + "=" * 80)
    print("3. BASELINE COMPARISON (Original RF: n_est=100, max_depth=6, balanced)")
    print("=" * 80)
    original_params = {
        "n_estimators": 100,
        "max_depth": 6,
        "min_samples_split": 5,
        "class_weight": "balanced",
    }
    baseline_results = run_groupkfold_experiment(X, y, groups, term_t_gwa, original_params)
    
    print(f"Random Forest:      Acc={baseline_results['rf']['accuracy']:.4f}, "
          f"MacroF1={baseline_results['rf']['macro_f1']:.4f}, "
          f"HighRiskRecall={baseline_results['rf']['high_risk_recall']:.4f}")
    print(f"Persistence:        Acc={baseline_results['persistence']['accuracy']:.4f}, "
          f"MacroF1={baseline_results['persistence']['macro_f1']:.4f}, "
          f"HighRiskRecall={baseline_results['persistence']['high_risk_recall']:.4f}")
    print(f"Majority Class:     Acc={baseline_results['majority']['accuracy']:.4f}, "
          f"MacroF1={baseline_results['majority']['macro_f1']:.4f}, "
          f"HighRiskRecall={baseline_results['majority']['high_risk_recall']:.4f}")
    
    # Per-class breakdown for RF
    print("\nPer-class (RF):")
    for cls in RISK_CLASSES:
        pc = baseline_results['rf']['per_class'][cls]
        print(f"  {cls}: P={pc['precision']:.4f}, R={pc['recall']:.4f}, F1={pc['f1']:.4f}")
    
    # 4. Hyperparameter Tuning
    print("\n" + "=" * 80)
    print("4. HYPERPARAMETER TUNING (GroupKFold CV)")
    print("=" * 80)
    
    param_grid = {
        "n_estimators": [100, 200, 300],
        "max_depth": [4, 6, 8, 10, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
        "class_weight": ["balanced", "balanced_subsample", None],
    }
    
    # Sample a subset of combinations for reasonable runtime
    # Full grid = 3*5*3*3*3 = 405 combinations. We'll sample ~50.
    all_combos = list(ParameterGrid(param_grid))
    import random
    random.seed(42)
    sampled_combos = random.sample(all_combos, min(50, len(all_combos)))
    
    print(f"Testing {len(sampled_combos)} parameter combinations...")
    
    best_score = -1
    best_params = None
    all_results = []
    
    for i, params in enumerate(sampled_combos):
        try:
            result = run_groupkfold_experiment(X, y, groups, term_t_gwa, params, n_splits=3, seed=42)
            score = result["rf"]["macro_f1"]
            all_results.append({"params": params, "macro_f1": score, "accuracy": result["rf"]["accuracy"]})
            
            if score > best_score:
                best_score = score
                best_params = params
            
            if (i + 1) % 10 == 0:
                print(f"  [{i+1}/{len(sampled_combos)}] Best Macro F1 so far: {best_score:.4f}")
        except Exception as e:
            print(f"  Error with params {params}: {e}")
    
    print(f"\nBest Macro F1: {best_score:.4f}")
    print(f"Best params: {best_params}")
    
    # 5. Class Weighting Experiments
    print("\n" + "=" * 80)
    print("5. CLASS WEIGHTING EXPERIMENTS")
    print("=" * 80)
    
    # Test custom class weights to boost minority class recall
    class_weights_to_test = [
        "balanced",
        "balanced_subsample",
        None,
        {LABEL_HIGH: 2.0, LABEL_MODERATE: 1.0, LABEL_LOW: 1.0},
        {LABEL_HIGH: 1.5, LABEL_MODERATE: 1.0, LABEL_LOW: 1.0},
        {LABEL_HIGH: 3.0, LABEL_MODERATE: 1.0, LABEL_LOW: 1.0},
    ]
    
    base_params = {
        "n_estimators": 200,
        "max_depth": 8,
        "min_samples_split": 5,
        "min_samples_leaf": 2,
    }
    
    for cw in class_weights_to_test:
        params = {**base_params, "class_weight": cw}
        result = run_groupkfold_experiment(X, y, groups, term_t_gwa, params, n_splits=3, seed=42)
        rf = result["rf"]
        print(f"class_weight={cw}: Acc={rf['accuracy']:.4f}, MacroF1={rf['macro_f1']:.4f}, "
              f"HR_Recall={rf['high_risk_recall']:.4f}, "
              f"Mod_Recall={rf['per_class'][LABEL_MODERATE]['recall']:.4f}, "
              f"Low_Recall={rf['per_class'][LABEL_LOW]['recall']:.4f}")
    
    # 6. Feature Importance Analysis (Best Model)
    print("\n" + "=" * 80)
    print("6. FEATURE IMPORTANCE ANALYSIS (Best Model)")
    print("=" * 80)
    
    if best_params:
        importance = analyze_feature_importance(X, y, groups, LONGITUDINAL_FEATURE_NAMES, best_params)
        print("Ranked features:")
        for i, feat in enumerate(importance["ranked_features"], 1):
            print(f"  {i:2d}. {feat['name']:<30} {feat['importance']:.6f} ± {feat['std']:.6f}")
    
    # 7. Final Optimized Model Evaluation (5-fold)
    print("\n" + "=" * 80)
    print("7. FINAL OPTIMIZED MODEL (5-Fold GroupKFold)")
    print("=" * 80)
    
    if best_params:
        final_result = run_groupkfold_experiment(X, y, groups, term_t_gwa, best_params, n_splits=5, seed=42)
        rf = final_result["rf"]
        print(f"Accuracy:     {rf['accuracy']:.4f}")
        print(f"Macro Precision: {rf['macro_precision']:.4f}")
        print(f"Macro Recall:   {rf['macro_recall']:.4f}")
        print(f"Macro F1:       {rf['macro_f1']:.4f}")
        print(f"High Risk Recall: {rf['high_risk_recall']:.4f}")
        
        print("\nPer-class:")
        for cls in RISK_CLASSES:
            pc = rf['per_class'][cls]
            print(f"  {cls}: P={pc['precision']:.4f}, R={pc['recall']:.4f}, F1={pc['f1']:.4f} (Support: {pc['support']})")
        
        print("\nConfusion Matrix:")
        print(f"  {'Actual \\ Pred':<15} | {'High':>8} | {'Moderate':>10} | {'Low':>8}")
        for act in RISK_CLASSES:
            row = rf['confusion_matrix'][RISK_CLASSES.index(act)]
            print(f"  {act:<15} | {row[0]:>8} | {row[1]:>10} | {row[2]:>8}")
        
        # Compare with original
        orig = baseline_results["rf"]
        print("\n" + "-" * 60)
        print("IMPROVEMENT OVER ORIGINAL:")
        print(f"  Accuracy:     {orig['accuracy']:.4f} -> {rf['accuracy']:.4f} ({rf['accuracy'] - orig['accuracy']:+.4f})")
        print(f"  Macro F1:     {orig['macro_f1']:.4f} -> {rf['macro_f1']:.4f} ({rf['macro_f1'] - orig['macro_f1']:+.4f})")
        print(f"  High Risk R:  {orig['high_risk_recall']:.4f} -> {rf['high_risk_recall']:.4f} ({rf['high_risk_recall'] - orig['high_risk_recall']:+.4f})")
    
    # Save results
    output = {
        "dataset_info": data,
        "leakage_check": leakage,
        "synthetic_analysis": synth,
        "baseline_comparison": {
            "original_rf": baseline_results["rf"],
            "persistence": baseline_results["persistence"],
            "majority_class": baseline_results["majority"],
        },
        "hyperparameter_tuning": {
            "best_params": best_params,
            "best_macro_f1": best_score,
            "all_tested": all_results[:10],  # Top 10
        },
        "class_weighting": "See console output",
        "feature_importance": importance if best_params else {},
        "final_model": final_result if best_params else {},
    }
    
    out_path = ROOT / "artifacts" / "rf_tuning_experiment.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
    print(f"\nResults saved to: {out_path}")
    
    print("\n" + "=" * 80)
    print("EXPERIMENT COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()