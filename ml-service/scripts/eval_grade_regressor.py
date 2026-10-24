"""
CNHS LEARN — Experimental Numerical Next-Term Subject Grade Regressor (Phase 1, offline)

Purpose:
  Feasibility evaluation of a RandomForestRegressor that estimates a learner's
  next-term numerical subject grade, reusing EXACTLY the nine features,
  transitions (Term 1 -> Term 2, Term 2 -> Term 3 only), and learner-grouped
  split of the existing trend classifier (train_trend_model.py).

  Target: delta = Grade_{t+1} - Grade_t ; estimate = clip(current + delta_hat, 60, 100)

  Evaluation:
    - Inner 5-fold GroupKFold (by learner) on the training split
    - Held-out 20% learners (zero overlap asserted), same seed/split as classifier
    - MAE, RMSE, R^2 vs previous-grade baseline (delta = 0) and mean-delta baseline
    - Disaggregated T1->T2 vs T2->T3 and intervened vs non-intervened
    - Trend agreement with the existing classifier (+/-2 rule on delta_hat)
    - +/-MAE band coverage
    - Decision gate (>= 10% MAE reduction vs previous-grade in both transitions,
      <= 25% disagreement with classifier)

STRICT SAFETY:
  - Synthetic data only; results are experimental.
  - Does NOT overwrite random_forest_trend.joblib or random_forest_academic_risk.joblib.
  - Does NOT touch FastAPI, Next.js, or Supabase.
  - Writes only to artifacts/grade_regression_experiment/.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from train_trend_model import (  # noqa: E402
    FEATURE_COLS_9,
    SUBJECT_TO_CODE,
    classify_trend,
    load_and_build_dataset,
)

GRADE_MIN, GRADE_MAX = 60.0, 100.0
GATE_MIN_MAE_REDUCTION = 0.10
GATE_MAX_DISAGREEMENT = 0.25


def make_regressor(seed: int, n_estimators: int = 150) -> RandomForestRegressor:
    # Same structural hyperparameters as the trend classifier (no class_weight).
    return RandomForestRegressor(
        n_estimators=n_estimators,
        max_depth=10,
        min_samples_split=6,
        min_samples_leaf=3,
        random_state=seed,
        n_jobs=-1,
    )


def grade_metrics(actual: np.ndarray, pred: np.ndarray) -> dict:
    if len(actual) == 0:
        return {"n": 0}
    return {
        "n": int(len(actual)),
        "mae": round(float(mean_absolute_error(actual, pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, pred))), 4),
        "r2": round(float(r2_score(actual, pred)), 4) if len(actual) > 1 else None,
    }


def to_estimate(current: np.ndarray, delta: np.ndarray) -> np.ndarray:
    return np.clip(current + delta, GRADE_MIN, GRADE_MAX)


def main() -> None:
    parser = argparse.ArgumentParser(description="CNHS LEARN grade regressor feasibility (offline)")
    parser.add_argument(
        "--csv",
        default=str(REPO_ROOT / "data" / "synthetic" / "CNHS_LEARN_Synthetic_Historical_Learners.csv"),
    )
    parser.add_argument("--artifact-dir", default=str(ROOT / "artifacts" / "grade_regression_experiment"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-model", action="store_true", help="Also save the experimental regressor bundle")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        sys.exit(f"Error: synthetic CSV not found at {csv_path}")

    print("=" * 82)
    print("CNHS LEARN — Experimental Next-Term Subject Grade Regressor (Phase 1)")
    print("           *** SYNTHETIC EXPERIMENTAL RESULTS ONLY ***")
    print("=" * 82)

    df = load_and_build_dataset(csv_path)
    print(f"Transitions: {len(df)} | Learners: {df['learner_id'].nunique()}")
    for (s, t), n in df.groupby(["source_term", "target_term"]).size().items():
        print(f"  Term {s} -> Term {t}: {n}")

    # Identical split to train_trend_model.py (same seed, same groups).
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=args.seed)
    tr_idx, te_idx = next(gss.split(df, groups=df["learner_id"]))
    tr = df.iloc[tr_idx].reset_index(drop=True)
    te = df.iloc[te_idx].reset_index(drop=True)
    overlap = set(tr["learner_id"]) & set(te["learner_id"])
    assert not overlap, "Learner identity leakage detected!"
    print(f"Train: {len(tr)} rows / {tr['learner_id'].nunique()} learners | "
          f"Test: {len(te)} rows / {te['learner_id'].nunique()} learners (zero overlap)")

    X_tr = tr[FEATURE_COLS_9].to_numpy(float)
    y_tr = tr["target_delta"].to_numpy(float)
    X_te = te[FEATURE_COLS_9].to_numpy(float)
    cur_te = te["feat_current_subject_grade"].to_numpy(float)
    act_te = te["target_grade"].to_numpy(float)

    # Inner GroupKFold on training split only.
    cv_rf, cv_prev = [], []
    for fold, (a, b) in enumerate(GroupKFold(n_splits=5).split(X_tr, y_tr, groups=tr["learner_id"])):
        m = make_regressor(args.seed + fold, n_estimators=100).fit(X_tr[a], y_tr[a])
        cur_b = tr["feat_current_subject_grade"].to_numpy(float)[b]
        act_b = tr["target_grade"].to_numpy(float)[b]
        cv_rf.append(mean_absolute_error(act_b, to_estimate(cur_b, m.predict(X_tr[b]))))
        cv_prev.append(mean_absolute_error(act_b, cur_b))
    cv = {
        "rf_mae_mean": round(float(np.mean(cv_rf)), 4),
        "rf_mae_sd": round(float(np.std(cv_rf)), 4),
        "prev_grade_mae_mean": round(float(np.mean(cv_prev)), 4),
    }
    print(f"\nInner 5-fold GroupKFold MAE: RF {cv['rf_mae_mean']:.3f} ± {cv['rf_mae_sd']:.3f} "
          f"| previous-grade {cv['prev_grade_mae_mean']:.3f}")

    model = make_regressor(args.seed).fit(X_tr, y_tr)
    delta_hat = model.predict(X_te)
    est_rf = to_estimate(cur_te, delta_hat)
    est_prev = cur_te.copy()
    est_mean = to_estimate(cur_te, np.full_like(cur_te, y_tr.mean()))

    masks = {
        "overall": np.ones(len(te), bool),
        "t1_to_t2": (te["source_term"] == 1).to_numpy(),
        "t2_to_t3": (te["source_term"] == 2).to_numpy(),
        "intervened": te["is_intervened"].to_numpy(bool),
        "non_intervened": ~te["is_intervened"].to_numpy(bool),
    }
    results = {}
    for name, mk in masks.items():
        results[name] = {
            "random_forest_regressor": grade_metrics(act_te[mk], est_rf[mk]),
            "previous_grade_baseline": grade_metrics(act_te[mk], est_prev[mk]),
            "mean_delta_baseline": grade_metrics(act_te[mk], est_mean[mk]),
        }

    # Trend agreement with the existing classifier artifact (read-only).
    clf_path = ROOT / "artifacts" / "trend_experiment" / "random_forest_trend.joblib"
    agreement = None
    if clf_path.exists():
        clf = joblib.load(clf_path)["model"]
        clf_trend = clf.predict(X_te)
        reg_trend = np.array([classify_trend(d) for d in (est_rf - cur_te)])
        act_trend = te["target_trend"].to_numpy()
        agreement = {
            "agreement_rate": round(float((clf_trend == reg_trend).mean()), 4),
            "disagreement_rate": round(float((clf_trend != reg_trend).mean()), 4),
            "regressor_derived_trend_accuracy": round(float((reg_trend == act_trend).mean()), 4),
            "classifier_trend_accuracy": round(float((clf_trend == act_trend).mean()), 4),
        }

    overall_mae = results["overall"]["random_forest_regressor"]["mae"]
    abs_err = np.abs(act_te - est_rf)
    band = {
        "typical_error_points": round(float(overall_mae), 2),
        "within_plus_minus_mae": round(float((abs_err <= overall_mae).mean()), 4),
        "within_plus_minus_2": round(float((abs_err <= 2).mean()), 4),
        "within_plus_minus_5": round(float((abs_err <= 5).mean()), 4),
    }

    def reduction(key: str) -> float:
        rf = results[key]["random_forest_regressor"]["mae"]
        pb = results[key]["previous_grade_baseline"]["mae"]
        return round((pb - rf) / pb, 4) if pb else 0.0

    red = {k: reduction(k) for k in ("overall", "t1_to_t2", "t2_to_t3")}
    gate = {
        "mae_reduction_vs_previous_grade": red,
        "criterion_mae": f">= {GATE_MIN_MAE_REDUCTION:.0%} in T1->T2 and T2->T3",
        "criterion_disagreement": f"<= {GATE_MAX_DISAGREEMENT:.0%}",
        "mae_pass": red["t1_to_t2"] >= GATE_MIN_MAE_REDUCTION and red["t2_to_t3"] >= GATE_MIN_MAE_REDUCTION,
        "cv_stability_pass": cv["rf_mae_sd"] < (cv["prev_grade_mae_mean"] - cv["rf_mae_mean"]),
        "disagreement_pass": bool(agreement and agreement["disagreement_rate"] <= GATE_MAX_DISAGREEMENT),
    }
    gate["passed"] = bool(gate["mae_pass"] and gate["cv_stability_pass"] and gate["disagreement_pass"])

    importances = {n: round(float(v), 4) for n, v in zip(FEATURE_COLS_9, model.feature_importances_)}

    # ---- Report ----
    print("\n" + "=" * 82)
    print(f"{'Segment':<16} | {'Model':<26} | {'MAE':>7} | {'RMSE':>7} | {'R2':>7} | {'N':>5}")
    print("-" * 82)
    for seg, r in results.items():
        for mname, m in r.items():
            r2 = "—" if m.get("r2") is None else f"{m['r2']:.3f}"
            print(f"{seg:<16} | {mname:<26} | {m['mae']:>7.3f} | {m['rmse']:>7.3f} | {r2:>7} | {m['n']:>5}")
        print("-" * 82)
    if agreement:
        print(f"Trend agreement with classifier: {agreement['agreement_rate']:.1%} "
              f"(regressor-derived trend acc {agreement['regressor_derived_trend_accuracy']:.1%}, "
              f"classifier acc {agreement['classifier_trend_accuracy']:.1%})")
    print(f"Error band: ±MAE {band['within_plus_minus_mae']:.1%}, ±2 {band['within_plus_minus_2']:.1%}, "
          f"±5 {band['within_plus_minus_5']:.1%}")
    print(f"MAE reduction vs previous-grade: {red}")
    print(f"DECISION GATE: {'PASSED' if gate['passed'] else 'NOT PASSED'} -> {gate}")
    print("Feature importances:")
    for n, v in sorted(importances.items(), key=lambda x: -x[1]):
        print(f"  - {n:<34}: {v:.4f}")

    out = Path(args.artifact_dir)
    out.mkdir(parents=True, exist_ok=True)
    payload = {
        "provenance": "synthetic_experimental",
        "target": "delta (next_term_grade - current_grade)",
        "features": FEATURE_COLS_9,
        "transitions": ["T1->T2", "T2->T3"],
        "split": {"train_rows": len(tr), "test_rows": len(te), "seed": args.seed, "learner_overlap": 0},
        "inner_cv": cv,
        "heldout": results,
        "trend_agreement": agreement,
        "error_band": band,
        "decision_gate": gate,
        "feature_importances": importances,
    }
    (out / "regression_metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nSaved metrics -> {out / 'regression_metrics.json'}")
    if args.save_model:
        joblib.dump(
            {"model": model, "feature_names": FEATURE_COLS_9, "subject_mapping": SUBJECT_TO_CODE,
             "target": "delta", "grade_bounds": [GRADE_MIN, GRADE_MAX],
             "typical_error": band["typical_error_points"], "provenance": "synthetic_experimental"},
            out / "random_forest_grade_regressor.joblib",
        )
        print(f"Saved experimental bundle -> {out / 'random_forest_grade_regressor.joblib'}")


if __name__ == "__main__":
    main()
