"""
Unit Tests for Phase 5 Offline Longitudinal ML Preparation Framework.

Verifies:
1. School-defined provisional risk band boundaries (GWA < 75, 75 <= GWA < 85, GWA >= 85).
2. Dynamic curriculum normalization and variation handling.
3. Finalized grade completeness validation (no fabrication of missing terms/outcomes).
4. Strict sequential term alignment (Term 1 -> 2, Term 2 -> 3).
5. Student identity isolation in pairing and GroupKFold cross-validation.
6. Data provenance enforcement ('empirical' vs 'synthetic').
7. Leakage prevention detection and feature isolation.
8. Multi-baseline comparison (Persistence vs Majority vs RF).
"""

import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(ROOT / "scripts"))

from longitudinal_contract import (  # noqa: E402
    CORE_SUBJECT_SLUGS,
    LABEL_HIGH,
    LABEL_LOW,
    LABEL_MODERATE,
    LONGITUDINAL_FEATURE_NAMES,
    MISSING_SENTINEL,
    RISK_CLASSES,
    compute_term_summary,
    normalize_subject_name,
    risk_label_from_gwa,
    validate_leakage_in_features,
)
from prepare_longitudinal_dataset import (  # noqa: E402
    build_longitudinal_pairs,
    check_term_completeness,
    extract_subject_grades,
)
from eval_next_term_model import (  # noqa: E402
    compute_evaluation_metrics,
    evaluate_longitudinal_dataset,
)
from app.feature_contract import FEATURE_NAMES, to_feature_list  # noqa: E402
from app.model_loader import get_model_bundle, model_ready  # noqa: E402
from app.main import (  # noqa: E402
    _predict_one,
    predict_batch,
    PredictRequest,
    BatchPredictRequest,
)



class TestLongitudinalContract(unittest.TestCase):
    def test_risk_band_boundaries(self):
        """School-defined risk bands: High (<75), Moderate (75 to <85), Low (>=85)."""
        self.assertEqual(risk_label_from_gwa(74.99), LABEL_HIGH)
        self.assertEqual(risk_label_from_gwa(60.0), LABEL_HIGH)
        self.assertEqual(risk_label_from_gwa(0.0), LABEL_HIGH)

        self.assertEqual(risk_label_from_gwa(75.0), LABEL_MODERATE)
        self.assertEqual(risk_label_from_gwa(79.5), LABEL_MODERATE)
        self.assertEqual(risk_label_from_gwa(84.99), LABEL_MODERATE)

        self.assertEqual(risk_label_from_gwa(85.0), LABEL_LOW)
        self.assertEqual(risk_label_from_gwa(92.0), LABEL_LOW)
        self.assertEqual(risk_label_from_gwa(100.0), LABEL_LOW)

        self.assertIsNone(risk_label_from_gwa(None))
        self.assertIsNone(risk_label_from_gwa(float("nan")))
        self.assertIsNone(risk_label_from_gwa("invalid"))

    def test_subject_normalization(self):
        """Ensures common naming aliases normalize to canonical slugs."""
        self.assertEqual(normalize_subject_name("Mathematics"), "mathematics")
        self.assertEqual(normalize_subject_name("Math"), "mathematics")
        self.assertEqual(normalize_subject_name("English 7"), "english")
        self.assertEqual(normalize_subject_name("Filipino"), "filipino")
        self.assertEqual(normalize_subject_name("Science"), "science")
        self.assertEqual(normalize_subject_name("Araling Panlipunan"), "araling_panlipunan")
        self.assertEqual(normalize_subject_name("Aral Pan"), "araling_panlipunan")
        self.assertEqual(normalize_subject_name("MAPEH"), "mapeh")
        self.assertEqual(normalize_subject_name("Technology and Livelihood Education"), "tle")
        self.assertEqual(normalize_subject_name("TVL / SPTVE"), "tle")
        self.assertEqual(normalize_subject_name("Edukasyon sa Pagpapakatao"), "values_education")
        self.assertEqual(normalize_subject_name("ESP"), "values_education")

    def test_term_summary_curriculum_flexibility(self):
        """Handles varying numbers of subjects without hardcoding 8-subject assumption."""
        # 6 subjects (Junior High elective variation)
        subjs_6 = {
            "english": 88.0,
            "filipino": 86.0,
            "mathematics": 74.0,  # 1 failing
            "science": 82.0,
            "araling_panlipunan": 80.0,
            "mapeh": 85.0,
        }
        summary_6 = compute_term_summary(subjs_6)
        expected_gwa = round((88 + 86 + 74 + 82 + 80 + 85) / 6, 2)  # 82.50
        self.assertEqual(summary_6["gwa"], expected_gwa)
        self.assertEqual(summary_6["failing_count"], 1.0)
        self.assertEqual(summary_6["lowest_grade"], 74.0)
        self.assertEqual(summary_6["highest_grade"], 88.0)
        self.assertEqual(summary_6["finalized_count"], 6.0)
        self.assertGreater(summary_6["grade_std"], 0.0)

    def test_leakage_detection(self):
        """Rejects feature vectors that contain target term references or target labels."""
        clean_features = {
            "term_t_gwa": 82.0,
            "term_t_failing_count": 0.0,
            "term_t_lowest_grade": 78.0,
        }
        is_clean, violations = validate_leakage_in_features(clean_features, target_term=2)
        self.assertTrue(is_clean)
        self.assertEqual(len(violations), 0)

        # Leaking Term 2 grade into Term 1 prediction features
        leaky_features = {
            "term_t_gwa": 82.0,
            "term_2_math": 75.0,  # FORBIDDEN: future term
        }
        is_clean, violations = validate_leakage_in_features(leaky_features, target_term=2)
        self.assertFalse(is_clean)
        self.assertTrue(any("term_2" in v for v in violations))


class TestLongitudinalDatasetPreparation(unittest.TestCase):
    def test_completeness_validation(self):
        """Unfinalized or missing required subjects must be marked incomplete."""
        # Complete
        grades_ok = {s: 85.0 for s in CORE_SUBJECT_SLUGS}
        is_comp, reason = check_term_completeness(grades_ok, required_subjects=CORE_SUBJECT_SLUGS)
        self.assertTrue(is_comp)
        self.assertIsNone(reason)

        # Missing a required subject
        grades_missing = {s: 85.0 for s in CORE_SUBJECT_SLUGS if s != "science"}
        is_comp, reason = check_term_completeness(grades_missing, required_subjects=CORE_SUBJECT_SLUGS)
        self.assertFalse(is_comp)
        self.assertIn("science", str(reason))

        # Explicitly unfinalized
        is_comp, reason = check_term_completeness(grades_ok, is_finalized_flag=False)
        self.assertFalse(is_comp)

    def test_longitudinal_pairing_sequential(self):
        """Tests that pairs are strictly (1 -> 2) and (2 -> 3), rejecting non-sequential jumps."""
        raw_records = [
            # Student 1: Terms 1, 2, 3 (Generates: 1->2, 2->3)
            {
                "student_id": "STU-001",
                "school_year": "2025-2026",
                "term": 1,
                "data_provenance": "synthetic",
                "subject_grades": {s: 85.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-001",
                "school_year": "2025-2026",
                "term": 2,
                "data_provenance": "synthetic",
                "subject_grades": {s: 83.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-001",
                "school_year": "2025-2026",
                "term": 3,
                "data_provenance": "synthetic",
                "subject_grades": {s: 80.0 for s in CORE_SUBJECT_SLUGS},
            },
            # Student 2: Terms 1 and 3 only (Term 2 missing -> CANNOT pair 1->3)
            {
                "student_id": "STU-002",
                "school_year": "2025-2026",
                "term": 1,
                "data_provenance": "synthetic",
                "subject_grades": {s: 88.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-002",
                "school_year": "2025-2026",
                "term": 3,
                "data_provenance": "synthetic",
                "subject_grades": {s: 86.0 for s in CORE_SUBJECT_SLUGS},
            },
        ]

        df, summary = build_longitudinal_pairs(raw_records)
        # Student 1 forms 2 pairs (1->2, 2->3). Student 2 forms 0 pairs. Total = 2 pairs.
        self.assertEqual(len(df), 2)
        self.assertEqual(summary["valid_pairs_formed"], 2)
        self.assertEqual(summary["unique_students_in_dataset"], 1)

        # Inspect Student 1 pair 2->3 velocity
        pair_2_3 = df[df["source_term"] == 2].iloc[0]
        self.assertEqual(pair_2_3["has_prior_term"], 1.0)
        self.assertEqual(pair_2_3["delta_gwa"], -2.0)  # 83.0 - 85.0
        self.assertEqual(pair_2_3["target_next_term_risk"], LABEL_MODERATE)  # 80.0

    def test_strict_provenance_filter(self):
        """Enforces provenance separation when requested."""
        mixed_records = [
            {
                "student_id": "STU-EMP-1",
                "school_year": "2025-2026",
                "term": 1,
                "data_provenance": "empirical",
                "subject_grades": {s: 80.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-EMP-1",
                "school_year": "2025-2026",
                "term": 2,
                "data_provenance": "empirical",
                "subject_grades": {s: 82.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-SYN-1",
                "school_year": "2025-2026",
                "term": 1,
                "data_provenance": "synthetic",
                "subject_grades": {s: 80.0 for s in CORE_SUBJECT_SLUGS},
            },
            {
                "student_id": "STU-SYN-1",
                "school_year": "2025-2026",
                "term": 2,
                "data_provenance": "synthetic",
                "subject_grades": {s: 82.0 for s in CORE_SUBJECT_SLUGS},
            },
        ]
        df_emp, _ = build_longitudinal_pairs(mixed_records, strict_provenance="empirical")
        self.assertEqual(len(df_emp), 1)
        self.assertEqual(df_emp.iloc[0]["data_provenance"], "empirical")


class TestEvaluationScaffold(unittest.TestCase):
    def setUp(self):
        """Create synthetic test dataset with 30 students to test GroupKFold and baselines."""
        rows = []
        for i in range(1, 31):
            student_id = f"STU-EVAL-{i:03d}"
            # Distribution: 10 high risk, 10 moderate, 10 low
            if i <= 10:
                gwa_1, gwa_2 = 68.0, 72.0
            elif i <= 20:
                gwa_1, gwa_2 = 78.0, 80.0
            else:
                gwa_1, gwa_2 = 88.0, 90.0

            rows.append({
                "student_id": student_id,
                "school_year": "2025-2026",
                "source_term": 1,
                "target_term": 2,
                "grade_level": 7,
                "section_name": "G7-A",
                "data_provenance": "synthetic",
                "term_t_gwa": gwa_1,
                "term_t_failing_count": 2.0 if gwa_1 < 75 else 0.0,
                "term_t_lowest_grade": gwa_1 - 4.0,
                "term_t_highest_grade": gwa_1 + 4.0,
                "term_t_grade_std": 3.0,
                "term_t_finalized_count": 8.0,
                "term_t_english": gwa_1,
                "term_t_filipino": gwa_1,
                "term_t_mathematics": gwa_1 - 2.0,
                "term_t_science": gwa_1,
                "term_t_araling_panlipunan": gwa_1,
                "term_t_mapeh": gwa_1,
                "term_t_tle": gwa_1,
                "term_t_values_education": gwa_1,
                "has_prior_term": 0.0,
                "delta_gwa": 0.0,
                "delta_failing_count": 0.0,
                "target_next_term_gwa": gwa_2,
                "target_next_term_risk": risk_label_from_gwa(gwa_2),
            })
        self.df_synthetic = pd.DataFrame(rows)

    def test_provenance_enforcement_raises_on_synthetic_without_flag(self):
        """Running evaluation on synthetic data without allow_synthetic=True raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            evaluate_longitudinal_dataset(self.df_synthetic, allow_synthetic=False)
        self.assertIn("ABORT: Dataset contains synthetic records", str(ctx.exception))

    def test_evaluation_scaffold_runs_with_flag(self):
        """Running evaluation on synthetic data with allow_synthetic=True succeeds and reports all baselines."""
        results = evaluate_longitudinal_dataset(
            self.df_synthetic, n_splits=3, seed=42, allow_synthetic=True
        )
        self.assertTrue(results["is_synthetic_evaluation"])
        self.assertEqual(results["data_provenance"], "synthetic")

        metrics = results["metrics"]
        self.assertIn("random_forest", metrics)
        self.assertIn("persistence_baseline", metrics)
        self.assertIn("majority_class_baseline", metrics)

        rf = metrics["random_forest"]
        self.assertIn("macro_f1", rf)
        self.assertIn("high_risk_recall", rf)
        self.assertIn("confusion_matrix", rf)

        # High risk recall must be valid numeric between 0 and 1
        self.assertGreaterEqual(rf["high_risk_recall"], 0.0)
        self.assertLessEqual(rf["high_risk_recall"], 1.0)


class TestModelBFeatureContractAndInference(unittest.TestCase):
    """Verifies actual Model B joblib artifact, 13-feature contract, and real inference."""

    def test_model_bundle_loading_and_features(self):
        """Model B artifact exists, loads, has exactly 13 features in proper order."""
        self.assertTrue(model_ready(), "Model B artifact must exist")
        bundle = get_model_bundle()
        self.assertIn("model", bundle)
        model = bundle["model"]
        self.assertEqual(model.n_features_in_, 13, "Model B must have exactly 13 input features")

        feature_names = bundle.get("feature_names", [])
        self.assertEqual(len(feature_names), 13)
        self.assertEqual(feature_names, FEATURE_NAMES)

        # 8 raw subject grades + 5 engineered features
        expected_raw_8 = [
            "english_grade", "filipino_grade", "mathematics_grade", "science_grade",
            "mapeh_grade", "araling_panlipunan_grade", "tle_grade", "values_education_grade"
        ]
        expected_eng_5 = [
            "failing_subject_count", "language_fail_count", "non_language_fail_count",
            "lowest_grade", "available_grade_count"
        ]
        self.assertEqual(feature_names[:8], expected_raw_8)
        self.assertEqual(feature_names[8:], expected_eng_5)

        # Target leakage prevention
        self.assertNotIn("general_average", feature_names)
        self.assertNotIn("attendance", feature_names)
        self.assertNotIn("sf2", feature_names)

    def test_single_prediction_synthetic(self):
        """Single prediction outputs predicted class, confidence, and well-formed probabilities."""
        test_features = {
            "english_grade": 88.0,
            "filipino_grade": 89.0,
            "mathematics_grade": 90.0,
            "science_grade": 87.0,
            "mapeh_grade": 91.0,
            "araling_panlipunan_grade": 88.0,
            "tle_grade": 89.0,
            "values_education_grade": 92.0,
            "failing_subject_count": 0.0,
            "language_fail_count": 0.0,
            "non_language_fail_count": 0.0,
            "lowest_grade": 87.0,
            "available_grade_count": 8.0,
        }
        req = PredictRequest(student_id="STU-001", features=test_features)
        res = _predict_one(req)

        self.assertEqual(res["student_id"], "STU-001")
        self.assertEqual(res["risk_level"], "Low Risk")
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 1.0)

        probs = res["probabilities"]
        self.assertIn("High Risk", probs)
        self.assertIn("Moderate Risk", probs)
        self.assertIn("Low Risk", probs)
        total_prob = sum(probs.values())
        self.assertAlmostEqual(total_prob, 1.0, places=3)
        self.assertEqual(res["source"], "random-forest")
        self.assertEqual(res["model_configuration"], "Model B")

    def test_batch_prediction_synthetic(self):
        """Batch prediction returns aligned predictions for each student."""
        students = [
            PredictRequest(
                student_id="STU-LOW",
                features={
                    "english_grade": 90.0, "filipino_grade": 91.0, "mathematics_grade": 92.0,
                    "science_grade": 89.0, "mapeh_grade": 93.0, "araling_panlipunan_grade": 90.0,
                    "tle_grade": 91.0, "values_education_grade": 94.0, "failing_subject_count": 0.0,
                    "language_fail_count": 0.0, "non_language_fail_count": 0.0, "lowest_grade": 89.0,
                    "available_grade_count": 8.0,
                }
            ),
            PredictRequest(
                student_id="STU-HIGH",
                features={
                    "english_grade": 70.0, "filipino_grade": 72.0, "mathematics_grade": 68.0,
                    "science_grade": 73.0, "mapeh_grade": 74.0, "araling_panlipunan_grade": 71.0,
                    "tle_grade": 72.0, "values_education_grade": 75.0, "failing_subject_count": 7.0,
                    "language_fail_count": 2.0, "non_language_fail_count": 5.0, "lowest_grade": 68.0,
                    "available_grade_count": 8.0,
                }
            ),
        ]
        res = predict_batch(BatchPredictRequest(students=students))
        self.assertEqual(res["count"], 2)
        preds = res["predictions"]
        self.assertEqual(len(preds), 2)
        self.assertEqual(preds[0]["student_id"], "STU-LOW")
        self.assertEqual(preds[0]["risk_level"], "Low Risk")
        self.assertEqual(preds[1]["student_id"], "STU-HIGH")
        self.assertEqual(preds[1]["risk_level"], "High Risk")

    def test_feature_list_input_compatibility(self):
        """Vector inputs from JavaScript match FEATURE_NAMES ordering and handle sentinels."""
        fl = [85.0, 86.0, 87.0, 88.0, 89.0, 90.0, 91.0, 92.0, 0.0, 0.0, 0.0, 85.0, 8.0]
        out = to_feature_list(feature_list=fl, feature_names=FEATURE_NAMES)
        self.assertEqual(len(out), 13)
        self.assertEqual(out, fl)

        # Missing values use sentinel -1.0
        partial = {"english_grade": 85.0}
        out_partial = to_feature_list(features=partial)
        self.assertEqual(len(out_partial), 13)
        self.assertEqual(out_partial[0], 85.0)
        self.assertEqual(out_partial[1], -1.0)


if __name__ == "__main__":
    unittest.main()
