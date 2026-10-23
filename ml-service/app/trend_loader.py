from __future__ import annotations

from pathlib import Path
import joblib

ARTIFACT_PATH = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
    / "trend_experiment"
    / "random_forest_trend.joblib"
)

_trend_bundle = None


def get_trend_bundle():
    global _trend_bundle
    if _trend_bundle is None:
        if not ARTIFACT_PATH.exists():
            raise FileNotFoundError(
                f"Trend model artifact missing at {ARTIFACT_PATH}. "
                "Run: python scripts/train_trend_model.py"
            )
        _trend_bundle = joblib.load(ARTIFACT_PATH)
    return _trend_bundle


def reload_trend_bundle():
    """Force reload of experimental trend model bundle."""
    global _trend_bundle
    _trend_bundle = None
    return get_trend_bundle()


def trend_model_ready() -> bool:
    return ARTIFACT_PATH.exists()
