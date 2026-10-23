from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import HTTPException
from app.main import SubjectTrendPredictRequest, predict_subject_trend


class TestTrendEndpoint(unittest.TestCase):
    def test_predict_subject_trend_term1_success(self):
        """Valid Term 1 -> Term 2 forecast with exact 9 features."""
        req = SubjectTrendPredictRequest(
            student_id="test-student-001",
            subject="mathematics",
            term=1,
            feature_vector={
                "feat_subject_code": 2,
                "feat_current_subject_grade": 82.0,
                "feat_current_term_gwa": 84.5,
                "feat_current_relative_standing": -2.5,
                "feat_current_failing_count": 0,
                "feat_current_lowest_grade": 78.0,
                "feat_has_prior_term": 0.0,
                "feat_prior_subject_grade_delta": 0.0,
                "feat_prior_gwa_delta": 0.0,
            },
        )
        data = predict_subject_trend(req)
        self.assertEqual(data["status"], "available")
        self.assertEqual(data["subject"], "mathematics")
        self.assertEqual(data["currentTerm"], 1)
        self.assertEqual(data["targetTerm"], 2)
        self.assertIn(data["predictedTrend"], ["Improving", "Stable", "Declining"])
        self.assertEqual(data["source"], "pattern-analysis-experimental")
        self.assertIn("Experimental Subject Trend Forecast", data["disclaimer"])
        # Strict safety: confidence and probabilities must NOT be present
        self.assertNotIn("confidence", data)
        self.assertNotIn("probabilities", data)
        self.assertNotIn("class_probabilities", data)

    def test_predict_subject_trend_term2_success(self):
        """Valid Term 2 -> Term 3 forecast with velocity features."""
        req = SubjectTrendPredictRequest(
            student_id="test-student-002",
            subject="science",
            term=2,
            feature_vector={
                "feat_subject_code": 3,
                "feat_current_subject_grade": 79.0,
                "feat_current_term_gwa": 81.0,
                "feat_current_relative_standing": -2.0,
                "feat_current_failing_count": 0,
                "feat_current_lowest_grade": 75.0,
                "feat_has_prior_term": 1.0,
                "feat_prior_subject_grade_delta": -3.0,
                "feat_prior_gwa_delta": -1.5,
            },
        )
        data = predict_subject_trend(req)
        self.assertEqual(data["status"], "available")
        self.assertEqual(data["subject"], "science")
        self.assertEqual(data["currentTerm"], 2)
        self.assertEqual(data["targetTerm"], 3)
        self.assertIn(data["predictedTrend"], ["Improving", "Stable", "Declining"])

    def test_predict_subject_trend_unsupported_term_rejected(self):
        """Term 3 or 4 must be rejected with 400."""
        req = SubjectTrendPredictRequest(
            student_id="test-student-003",
            subject="english",
            term=3,
            feature_vector={
                "feat_subject_code": 0,
                "feat_current_subject_grade": 85.0,
                "feat_current_term_gwa": 86.0,
                "feat_current_relative_standing": -1.0,
                "feat_current_failing_count": 0,
                "feat_current_lowest_grade": 80.0,
                "feat_has_prior_term": 1.0,
                "feat_prior_subject_grade_delta": 2.0,
                "feat_prior_gwa_delta": 1.0,
            },
        )
        with self.assertRaises(HTTPException) as ctx:
            predict_subject_trend(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Unsupported term 3", ctx.exception.detail)

    def test_predict_subject_trend_invalid_subject_rejected(self):
        """Unsupported or non-existent subject must be rejected with 400."""
        req = SubjectTrendPredictRequest(
            student_id="test-student-004",
            subject="astronomy",
            term=1,
            feature_vector={
                "feat_subject_code": 0,
                "feat_current_subject_grade": 85.0,
                "feat_current_term_gwa": 86.0,
                "feat_current_relative_standing": -1.0,
                "feat_current_failing_count": 0,
                "feat_current_lowest_grade": 80.0,
                "feat_has_prior_term": 0.0,
                "feat_prior_subject_grade_delta": 0.0,
                "feat_prior_gwa_delta": 0.0,
            },
        )
        with self.assertRaises(HTTPException) as ctx:
            predict_subject_trend(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Invalid subject 'astronomy'", ctx.exception.detail)

    def test_predict_subject_trend_missing_feature_rejected(self):
        """Missing any of the 9 required features must fail with 400."""
        req = SubjectTrendPredictRequest(
            student_id="test-student-005",
            subject="filipino",
            term=1,
            feature_vector={
                "feat_subject_code": 1,
                # Missing feat_current_subject_grade
                "feat_current_term_gwa": 86.0,
                "feat_current_relative_standing": -1.0,
                "feat_current_failing_count": 0,
                "feat_current_lowest_grade": 80.0,
                "feat_has_prior_term": 0.0,
                "feat_prior_subject_grade_delta": 0.0,
                "feat_prior_gwa_delta": 0.0,
            },
        )
        with self.assertRaises(HTTPException) as ctx:
            predict_subject_trend(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Missing required trend feature", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
