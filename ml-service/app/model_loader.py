from __future__ import annotations

from pathlib import Path

import joblib

ARTIFACT_PATH = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
    / "random_forest_academic_risk.joblib"
)

_bundle = None


def get_model_bundle():
    global _bundle
    if _bundle is None:
        if not ARTIFACT_PATH.exists():
            raise FileNotFoundError(
                f"Model artifact missing at {ARTIFACT_PATH}. "
                "Run: python scripts/train_model.py"
            )
        _bundle = joblib.load(ARTIFACT_PATH)
    return _bundle


def reload_model_bundle():
    """Force reload after retrain (e.g. Model B joblib replaced)."""
    global _bundle
    _bundle = None
    return get_model_bundle()


def model_ready() -> bool:
    return ARTIFACT_PATH.exists()
